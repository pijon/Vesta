import { describe, expect, it } from 'vitest';
import { portionLabel, scaleToPortions } from './portions';

describe('scaleToPortions', () => {
  it('scales from the portions an amount was logged for', () => {
    expect(scaleToPortions(520, 1, 1.5)).toBe(780);
    expect(scaleToPortions(780, 1.5, 0.5)).toBe(260);
    expect(scaleToPortions(31, 1, 0.5)).toBe(16);
  });

  it('treats a missing count as one portion', () => {
    expect(scaleToPortions(400, 0, 2)).toBe(800);
  });
});

describe('portionLabel', () => {
  it('writes halves as fractions', () => {
    expect([0.5, 1, 1.5, 2].map(portionLabel)).toEqual(['½', '1', '1½', '2']);
  });
});
