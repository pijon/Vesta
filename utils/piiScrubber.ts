// Strips personal information from user-supplied text before it is sent to Gemini.
// The free tier of the Gemini API may use prompts to improve Google's products, so
// nothing that identifies a person should leave the device. Only apply this to user
// input, never to whole prompts: the template text contains dates and quantities that
// the patterns below would mangle.

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const URL = /\b(?:https?:\/\/|www\.)\S+/gi;
const HANDLE = /(^|[\s(])@[\w.]{2,}/g;
// Runs of digits with separators: phone numbers, personal identity numbers
// (e.g. 19900101-1234), card and account numbers. Only redacted when the run holds
// at least 8 digits, so quantities like "2 x 400 g" or "1 1/2 cups" are untouched.
const DIGIT_RUN = /\+?\d[\d\s().-]{5,}\d/g;
const MIN_ID_DIGITS = 8;
// Bylines and contact lines in pasted recipes ("By Jane Doe", "Author: ...", "Tel: ...").
const BYLINE = /^\s*(?:recipe\s+by|by|author|written\s+by|posted\s+by|photo(?:graph)?\s+by|contact|phone|tel|email|e-mail|address)\b\s*:?.*$/gim;

export const scrubPII = (text: string): string =>
  text
    .replace(BYLINE, '')
    .replace(EMAIL, '[email]')
    .replace(URL, '[link]')
    .replace(HANDLE, '$1[handle]')
    .replace(DIGIT_RUN, match =>
      (match.match(/\d/g)?.length ?? 0) >= MIN_ID_DIGITS ? '[number]' : match
    );
