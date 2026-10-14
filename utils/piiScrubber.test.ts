import { describe, expect, it } from 'vitest';
import { scrubPII } from './piiScrubber';

describe('scrubPII', () => {
  it('removes emails, links and handles', () => {
    expect(scrubPII('mail jane.doe+food@example.co.uk')).toBe('mail [email]');
    expect(scrubPII('from https://example.com/recipe?id=1 ok')).toBe('from [link] ok');
    expect(scrubPII('thanks @jane_doe!')).toBe('thanks [handle]!');
  });

  it('removes phone, personal identity and card numbers', () => {
    expect(scrubPII('call 070-123 45 67')).toBe('call [number]');
    expect(scrubPII('pnr 19900101-1234')).toBe('pnr [number]');
    expect(scrubPII('+46 70 123 45 67')).toBe('[number]');
  });

  it('removes bylines and contact lines from pasted recipes', () => {
    expect(scrubPII('By Jane Doe\nChili con carne')).toBe('\nChili con carne');
    expect(scrubPII('Tel: 08-123 456\nServes 4')).toBe('\nServes 4');
  });

  it('keeps quantities, times and fasting windows', () => {
    for (const text of ['2 x 400 g chopped tomatoes', '1 1/2 cups flour', 'bake 180 °C for 25-30 min', 'fasting 16:8', '2 eggs, 1 slice of bread']) {
      expect(scrubPII(text)).toBe(text);
    }
  });
});
