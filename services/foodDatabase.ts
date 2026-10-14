/**
 * Packaged food by barcode from Open Food Facts (openfoodfacts.org), a free, open database.
 * Only the barcode is sent. Found products are cached in localStorage, so a re-scan is instant
 * and works offline.
 */

export interface PackagedFood {
  code: string;
  name: string;
  brand?: string;
  /** Per 100 g (or 100 ml for drinks) */
  kcalPer100: number;
  proteinPer100?: number;
  /** One serving as printed on the pack, in grams or ml */
  servingAmount?: number;
  unit: 'g' | 'ml';
}

interface OffProduct {
  product_name?: string;
  generic_name?: string;
  brands?: string;
  quantity?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
}

const CACHE_KEY = 'vesta_barcode_cache';
const CACHE_LIMIT = 200;
const FIELDS = 'product_name,generic_name,brands,quantity,serving_size,serving_quantity,nutriments';

const readCache = (): Record<string, PackagedFood> => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
};

const writeCache = (food: PackagedFood) => {
  try {
    const cache = readCache();
    delete cache[food.code];
    cache[food.code] = food;
    const codes = Object.keys(cache);
    codes.slice(0, Math.max(0, codes.length - CACHE_LIMIT)).forEach(code => delete cache[code]);
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch { /* storage full or blocked */ }
};

const num = (value: unknown): number | undefined => {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : undefined;
};

const toPackagedFood = (code: string, p: OffProduct): PackagedFood | null => {
  const n = p.nutriments ?? {};
  // Some products only list energy in kJ
  const kj = num(n['energy-kj_100g']) ?? (n['energy_100g_unit'] === 'kcal' ? undefined : num(n['energy_100g']));
  const kcal = num(n['energy-kcal_100g']) ?? (kj !== undefined ? kj / 4.184 : undefined);
  const name = (p.product_name || p.generic_name || '').trim();
  if (!name || kcal === undefined) return null;
  const unit = /\d\s*(ml|cl|l)\b/i.test(`${p.serving_size ?? ''} ${p.quantity ?? ''}`) ? 'ml' : 'g';
  const serving = num(p.serving_quantity);
  return {
    code,
    name,
    ...(p.brands ? { brand: p.brands.split(',')[0].trim() } : {}),
    kcalPer100: Math.round(kcal),
    ...(num(n['proteins_100g']) !== undefined ? { proteinPer100: Math.round(num(n['proteins_100g'])! * 10) / 10 } : {}),
    ...(serving && serving > 0 ? { servingAmount: Math.round(serving) } : {}),
    unit,
  };
};

/**
 * Looks a barcode up. Resolves null when the product is unknown or has no calories listed;
 * rejects when Open Food Facts can't be reached.
 */
export const lookupBarcode = async (code: string): Promise<PackagedFood | null> => {
  const cached = readCache()[code];
  if (cached) return cached;

  const lang = (navigator.language || 'en').split('-')[0];
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}&lc=${lang}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Food Facts answered ${res.status}`);
  const body = await res.json() as { status?: number; product?: OffProduct };
  if (body.status !== 1 || !body.product) return null;

  const food = toPackagedFood(code, body.product);
  if (food) writeCache(food);
  return food;
};

/** Calories and protein for an amount in grams (or ml) */
export const nutritionFor = (food: PackagedFood, amount: number) => ({
  calories: Math.round((food.kcalPer100 * amount) / 100),
  ...(food.proteinPer100 !== undefined ? { protein: Math.round((food.proteinPer100 * amount) / 100) } : {}),
});
