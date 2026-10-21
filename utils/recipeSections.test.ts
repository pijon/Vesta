import { describe, expect, it } from 'vitest';
import { hasSections, headingOf, sectionsOf, withoutHeadings } from './recipeSections';

describe('recipe sections', () => {
  it('reads markdown headings of any level', () => {
    expect(headingOf('## Dillgremolata')).toBe('Dillgremolata');
    expect(headingOf('# Sauce ##')).toBe('Sauce');
    expect(headingOf('### For the fish')).toBe('For the fish');
  });

  it('leaves ingredients and steps alone', () => {
    expect(headingOf('400 g potatis')).toBeNull();
    expect(headingOf('#1 favourite')).toBeNull();
    expect(headingOf('##')).toBeNull();
    expect(headingOf('Mix **well**')).toBeNull();
  });

  it('removes headings', () => {
    expect(withoutHeadings(['## A', '1 egg', '## B', '2 g salt'])).toEqual(['1 egg', '2 g salt']);
  });

  it('splits at headings and keeps full-list indexes', () => {
    expect(sectionsOf(['1 egg', '## Sauce', '', '2 dl cream'])).toEqual([
      { items: [{ text: '1 egg', index: 0 }] },
      { title: 'Sauce', items: [{ text: '2 dl cream', index: 3 }] },
    ]);
    expect(hasSections(['1 egg'])).toBe(false);
    expect(hasSections(['## A', '1 egg'])).toBe(true);
  });
});
