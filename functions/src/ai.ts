import { ApiError, GenerateContentParameters, GoogleGenAI } from '@google/genai';
import { getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

// Keep in step with GEMINI_MODEL_PRIMARY / GEMINI_MODEL_STABLE in the app's constants.ts.
const STABLE_MODEL = 'gemini-3.5-flash-lite';
const ALLOWED_MODELS = new Set(['gemini-3.8-flash', STABLE_MODEL]);

/** Per-attempt limits: the primary leaves room for the Flash-Lite retry inside the function's 120 s. */
const PRIMARY_MS = 45_000;
const ATTEMPT_MS = 60_000;

/** Requests per user per UTC day; heavy normal use (logging, planning, a shopping list) stays well under. */
const DAILY_LIMIT = 300;
/** Callable requests are capped at 10 MB; a downscaled food photo is a few hundred KB. */
const MAX_REQUEST_CHARS = 8 * 1024 * 1024;

interface GenerateRequest {
  model: string;
  contents: GenerateContentParameters['contents'];
  config?: {
    responseMimeType?: string;
    responseSchema?: unknown;
    urlContext?: boolean;
  };
}

export interface GenerateResult {
  text: string;
  /** Whether the urlContext tool read at least one page */
  urlRetrieved: boolean;
}

/** Counts this request against the user's daily allowance; aiUsage/{uid} has no client rules, so only this function touches it. */
const takeQuota = async (uid: string): Promise<void> => {
  const db = getFirestore();
  const ref = db.collection('aiUsage').doc(uid);
  const today = new Date().toISOString().slice(0, 10);
  const allowed = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const count = snap.get('date') === today ? (snap.get('count') as number) : 0;
    if (count >= DAILY_LIMIT) return false;
    tx.set(ref, { date: today, count: count + 1 });
    return true;
  });
  if (!allowed) throw new HttpsError('resource-exhausted', "You've reached today's limit for AI features. It resets tomorrow.");
};

/**
 * Runs a Gemini request for the app so the API key never reaches the browser.
 * Signed-in users only, allowlisted models, a per-user daily limit, and only the
 * config the app uses (JSON output and the urlContext tool).
 */
export const generateAi = onCall<GenerateRequest>(
  { region: 'europe-west1', secrets: [GEMINI_API_KEY], timeoutSeconds: 120, memory: '512MiB', maxInstances: 10 },
  async (request): Promise<GenerateResult> => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');

    const { model, contents, config } = request.data ?? {};
    if (typeof model !== 'string' || !ALLOWED_MODELS.has(model) || !contents) {
      throw new HttpsError('invalid-argument', 'A supported model and contents are required.');
    }
    if (JSON.stringify(request.data).length > MAX_REQUEST_CHARS) {
      throw new HttpsError('invalid-argument', 'Request is too large.');
    }

    await takeQuota(uid);

    const params: GenerateContentParameters = {
      model,
      contents,
      config: {
        ...(config?.responseMimeType === 'application/json' && { responseMimeType: 'application/json' }),
        ...(config?.responseSchema !== undefined && { responseSchema: config.responseSchema }),
        ...(config?.urlContext && { tools: [{ urlContext: {} }] }),
      },
    };

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });
    // Gemini calls have no timeout of their own and can stall until the function is killed at 120 s,
    // so each attempt gets its own limit and a stalled primary still leaves time for the fallback.
    const run = async (p: GenerateContentParameters, ms: number): Promise<GenerateResult> => {
      const response = await ai.models.generateContent({ ...p, config: { ...p.config, httpOptions: { timeout: ms } } });
      return {
        text: response.text ?? '',
        urlRetrieved: !!response.candidates?.[0]?.urlContextMetadata?.urlMetadata?.some(
          m => m.urlRetrievalStatus === 'URL_RETRIEVAL_STATUS_SUCCESS'
        ),
      };
    };

    try {
      try {
        return await run(params, model === STABLE_MODEL ? ATTEMPT_MS : PRIMARY_MS);
      } catch (error) {
        // 3.8 Flash is often overloaded (503), rate limited (429), erroring (500/502) or stalled (504); retry once on Flash-Lite.
        const overloaded = error instanceof ApiError && [429, 500, 502, 503, 504].includes(error.status);
        const stalled = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
        if (!(overloaded || stalled) || model === STABLE_MODEL) throw error;
        logger.warn(`${model} ${stalled ? 'timed out' : `unavailable (${(error as ApiError).status})`}, retrying on ${STABLE_MODEL}`);
        return await run({ ...params, model: STABLE_MODEL }, ATTEMPT_MS);
      }
    } catch (error) {
      logger.error('Gemini request failed', {
        uid,
        model,
        status: error instanceof ApiError ? error.status : undefined,
        reason: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
        throw new HttpsError('deadline-exceeded', 'The AI service took too long. Try again.');
      }
      if (error instanceof ApiError && [429, 503, 504].includes(error.status)) {
        throw new HttpsError('unavailable', 'The AI service is busy. Try again in a moment.');
      }
      throw new HttpsError('internal', 'The AI request failed.');
    }
  }
);
