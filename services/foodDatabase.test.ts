import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lookupBarcode, nutritionFor } from './foodDatabase';

type OffNutriments = Record<string, number | string>;

const offResponse = (product: Record<string, unknown> | null, status = 200) =>
  new Response(JSON.stringify(product ? { status: 1, product } : { status: 0 }), { status });

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('navigator', { language: 'sv-SE' });
});
afterEach(() => vi.unstubAllGlobals());

const lookup = async (product: Record<string, unknown> | null, code = '7310865004703') => {
  fetchMock.mockResolvedValueOnce(offResponse(product));
  return lookupBarcode(code);
};

describe('lookupBarcode', () => {
  it('reads name, brand, nutrition per 100 g and the serving size', async () => {
    const food = await lookup({
      product_name: 'Nutella',
      brands: 'Ferrero, Nutella',
      serving_size: '15 g',
      serving_quantity: '15',
      nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3 } satisfies OffNutriments,
    });
    expect(food).toEqual({ code: '7310865004703', name: 'Nutella', brand: 'Ferrero', kcalPer100: 539, proteinPer100: 6.3, servingAmount: 15, unit: 'g' });
    expect(String(fetchMock.mock.calls[0][0])).toContain('lc=sv');
  });

  it('converts kJ when only energy in kJ is listed (energy_100g is always kJ)', async () => {
    expect((await lookup({ product_name: 'Rye bread', nutriments: { 'energy-kj_100g': 1000 } }))?.kcalPer100).toBe(239);
    expect((await lookup({ product_name: 'Oats', nutriments: { energy_100g: 1550, energy_unit: 'kcal' } }, '7310130003318'))?.kcalPer100).toBe(370);
  });

  it('measures drinks in ml', async () => {
    expect((await lookup({ product_name: 'Cola', serving_size: '330 ml', nutriments: { 'energy-kcal_100g': 42 } }))?.unit).toBe('ml');
    expect((await lookup({ product_name: 'Juice', quantity: '1,5 l', nutriments: { 'energy-kcal_100g': 45 } }, '7310865000002'))?.unit).toBe('ml');
    expect((await lookup({ product_name: 'Soda', quantity: '33 cl', nutriments: { 'energy-kcal_100g': 40 } }, '7310865000019'))?.unit).toBe('ml');
  });

  it('gives null for unknown products and products without calories or a name', async () => {
    expect(await lookup(null)).toBeNull();
    expect(await lookup({ product_name: 'Mystery', nutriments: {} })).toBeNull();
    expect(await lookup({ nutriments: { 'energy-kcal_100g': 100 } })).toBeNull();
    fetchMock.mockResolvedValueOnce(new Response('', { status: 404 }));
    expect(await lookupBarcode('7310865000026')).toBeNull();
  });

  it('throws when Open Food Facts fails, so the scanner can offer a retry', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(lookupBarcode('7310865004703')).rejects.toThrow('503');
  });

  it('answers a repeat scan from the cache', async () => {
    await lookup({ product_name: 'Nutella', nutriments: { 'energy-kcal_100g': 539 } });
    expect((await lookupBarcode('7310865004703'))?.name).toBe('Nutella');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reads a cache saved in the first release format (an object by code)', async () => {
    const food = { code: '7310865004703', name: 'Nutella', kcalPer100: 539, unit: 'g' };
    localStorage.setItem('vesta_barcode_cache', JSON.stringify({ [food.code]: food }));
    expect(await lookupBarcode(food.code)).toEqual(food);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the most recently scanned products when the cache is full, EAN-8 codes too', async () => {
    const product = { product_name: 'Item', nutriments: { 'energy-kcal_100g': 100 } };
    for (let i = 0; i < 200; i++) await lookup(product, String(7310000000000 + i));
    await lookup(product, '96385074'); // an EAN-8, scanned last
    fetchMock.mockClear();
    expect(await lookupBarcode('96385074')).not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled(); // still cached
    fetchMock.mockResolvedValueOnce(offResponse(product));
    await lookupBarcode('7310000000000'); // the oldest one was dropped
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('nutritionFor', () => {
  it('scales per-100 values to the amount eaten', () => {
    const food = { code: '1', name: 'Cola', kcalPer100: 42, proteinPer100: 0.4, unit: 'ml' as const };
    expect(nutritionFor(food, 330)).toEqual({ calories: 139, protein: 1 });
    expect(nutritionFor({ ...food, proteinPer100: undefined }, 100)).toEqual({ calories: 42 });
  });
});
