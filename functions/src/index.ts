import { randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import sharp from 'sharp';

initializeApp();

const MAX_HTML_BYTES = 3 * 1024 * 1024;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_REDIRECTS = 4;
// Browser-like headers; some hosts reject anything that looks like a bot.
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

// Addresses a user-supplied URL must never reach (SSRF guard).
const blocked = new BlockList();
blocked.addSubnet('0.0.0.0', 8);
blocked.addSubnet('10.0.0.0', 8);
blocked.addSubnet('100.64.0.0', 10);
blocked.addSubnet('127.0.0.0', 8);
blocked.addSubnet('169.254.0.0', 16); // includes the metadata server
blocked.addSubnet('172.16.0.0', 12);
blocked.addSubnet('192.168.0.0', 16);
blocked.addSubnet('224.0.0.0', 4);
blocked.addSubnet('::', 128, 'ipv6');
blocked.addSubnet('::1', 128, 'ipv6');
blocked.addSubnet('fc00::', 7, 'ipv6');
blocked.addSubnet('fe80::', 10, 'ipv6');
// IPv4-mapped IPv6 (::ffff:a.b.c.d) is checked against the IPv4 rules above by BlockList itself;
// adding ::ffff:0:0/96 here would block every IPv4 address.

const assertPublicUrl = async (raw: string): Promise<URL> => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpsError('invalid-argument', 'Not a valid URL.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new HttpsError('invalid-argument', 'Only http(s) links are supported.');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) {
    throw new HttpsError('not-found', 'Could not resolve that host.');
  }
  for (const { address, family } of addresses) {
    if (blocked.check(address, family === 6 ? 'ipv6' : 'ipv4')) {
      throw new HttpsError('invalid-argument', 'That address is not allowed.');
    }
  }
  return url;
};

/** fetch() that re-checks every redirect hop against the SSRF guard. */
const safeFetch = async (raw: string, accept: string): Promise<{ res: Response; url: URL }> => {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': USER_AGENT, Accept: accept, 'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8' },
      signal: AbortSignal.timeout(10_000),
    });
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      url = await assertPublicUrl(new URL(location, url).href);
      continue;
    }
    if (!res.ok) throw new HttpsError('not-found', `Fetch of ${url.host} failed with status ${res.status}.`);
    return { res, url };
  }
  throw new HttpsError('not-found', 'Too many redirects.');
};

const readCapped = async (res: Response, maxBytes: number): Promise<Buffer> => {
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > maxBytes) throw new HttpsError('failed-precondition', 'Response too large.');
  const reader = res.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new HttpsError('failed-precondition', 'Response too large.');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
};

const decodeEntities = (s: string): string =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x2F;/gi, '/');

/** Pulls the first image URL out of a schema.org `image` value (string, array or ImageObject). */
const imageFromLd = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = imageFromLd(item);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return imageFromLd(obj.url ?? obj.contentUrl);
  }
  return null;
};

const findRecipeImageInLd = (node: unknown): string | null => {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipeImageInLd(item);
      if (found) return found;
    }
    return null;
  }
  if (!node || typeof node !== 'object') return null;
  const obj = node as Record<string, unknown>;
  const type = obj['@type'];
  const isRecipe = type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'));
  if (isRecipe) {
    const found = imageFromLd(obj.image);
    if (found) return found;
  }
  return findRecipeImageInLd(obj['@graph']);
};

/** Prefers the JSON-LD Recipe image, then og:image, then twitter:image. */
export const extractImageUrl = (html: string, pageUrl: URL): string | null => {
  const ldBlocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, json] of ldBlocks) {
    try {
      const found = findRecipeImageInLd(JSON.parse(json.trim()));
      if (found) return new URL(decodeEntities(found), pageUrl).href;
    } catch {
      // Malformed JSON-LD is common; fall through to meta tags.
    }
  }

  for (const key of ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']) {
    const escaped = key.replace(/:/g, '\\:');
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${escaped}["']`, 'i'),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) return new URL(decodeEntities(match[1]), pageUrl).href;
    }
  }
  return null;
};

interface ImportRecipeImageRequest {
  pageUrl: string;
  recipeId: string;
}

/**
 * Finds the main image on a recipe page, resizes it and stores it at
 * users/{uid}/recipe-images/{recipeId}.jpg. Returns a Storage download URL.
 * Runs server-side because recipe sites don't send CORS headers.
 */
export const importRecipeImage = onCall<ImportRecipeImageRequest>(
  { region: 'europe-west1', memory: '512MiB', timeoutSeconds: 30, maxInstances: 5 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');

    const { pageUrl, recipeId } = request.data ?? {};
    if (typeof pageUrl !== 'string' || typeof recipeId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(recipeId)) {
      throw new HttpsError('invalid-argument', 'pageUrl and recipeId are required.');
    }

    try {
      return await copyPageImage(uid, pageUrl, recipeId);
    } catch (error) {
      logger.warn('Recipe image import failed', {
        uid,
        pageUrl,
        reason: error instanceof Error ? error.message : String(error),
      });
      throw error instanceof HttpsError ? error : new HttpsError('internal', 'Image import failed.');
    }
  }
);

const copyPageImage = async (uid: string, pageUrl: string, recipeId: string): Promise<{ url: string }> => {
  const page = await safeFetch(pageUrl, 'text/html,application/xhtml+xml');
  const html = (await readCapped(page.res, MAX_HTML_BYTES)).toString('utf8');
  const imageUrl = extractImageUrl(html, page.url);
  if (!imageUrl) throw new HttpsError('not-found', 'No image found on that page.');

  const image = await safeFetch(imageUrl, 'image/*');
  const contentType = image.res.headers.get('content-type') ?? '';
  if (!contentType.startsWith('image/')) {
    throw new HttpsError('failed-precondition', 'The linked image is not an image.');
  }
  const original = await readCapped(image.res, MAX_IMAGE_BYTES);

  // Match the client upload: fit within 800x800, JPEG quality 0.7.
  const jpeg = await sharp(original, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 70 })
    .toBuffer();

  const bucket = getStorage().bucket();
  const path = `users/${uid}/recipe-images/${recipeId}.jpg`;
  const token = randomUUID();
  await bucket.file(path).save(jpeg, {
    contentType: 'image/jpeg',
    metadata: {
      cacheControl: 'public, max-age=31536000',
      metadata: { firebaseStorageDownloadTokens: token, sourceUrl: imageUrl },
    },
  });

  logger.info('Imported recipe image', { uid, recipeId, imageUrl, bytes: jpeg.length });
  return {
    url: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`,
  };
};
