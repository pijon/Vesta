/**
 * Keyword → icon matching shared by the food and workout icons.
 * Words match whole (English plurals ending in s/es included). A leading '-' also matches the end
 * of a word and a trailing '-' the start, for Swedish compounds: '-soppa' matches linssoppa.
 */
export type IconRule<I> = [I, string[]];
export type IconPatterns<I> = ReadonlyArray<readonly [I, RegExp]>;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// \b only knows ASCII letters, so use Unicode lookarounds to handle å/ä/ö
const NOT_AFTER_LETTER = '(?<![\\p{L}])';
const NOT_BEFORE_LETTER = '(?![\\p{L}])';

const wordPattern = (words: string[]) => new RegExp(words.map(word => {
  const open = word.startsWith('-');
  const prefix = word.endsWith('-');
  const core = escapeRegExp(word.replace(/^-|-$/g, ''));
  return `${open ? '' : NOT_AFTER_LETTER}${core}${prefix ? '' : `(?:e?s)?${NOT_BEFORE_LETTER}`}`;
}).join('|'), 'iu');

export const compileIconRules = <I,>(rules: IconRule<I>[]): IconPatterns<I> =>
  rules.map(([icon, words]) => [icon, wordPattern(words)] as const);

/** First rule (in order) with a word in `text`. */
export const matchIcon = <I,>(text: string, patterns: IconPatterns<I>): I | undefined =>
  patterns.find(([, re]) => re.test(text))?.[0];
