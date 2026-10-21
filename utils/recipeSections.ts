/**
 * A recipe can hold several dishes (a main, a sauce, a gremolata). Ingredient and step lists stay
 * flat string arrays; a line written as a markdown heading ("## Sauce") starts a new section and
 * is never an ingredient or a step.
 */
const HEADING = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/;

/** The section title when a line is a markdown heading, else null */
export const headingOf = (line: string): string | null => {
  const match = HEADING.exec(line);
  return match && match[1] ? match[1] : null;
};

/** The lines that are ingredients or steps, without section headings */
export const withoutHeadings = (lines: readonly string[]): string[] => lines.filter(line => headingOf(line) === null);

export interface RecipeSection {
  /** Absent for lines before the first heading */
  title?: string;
  /** Each line with its index in the full list, so tick state can stay keyed by index */
  items: { text: string; index: number }[];
}

/** Splits a list at its headings. Blank lines are dropped; empty sections are kept so a title still shows. */
export const sectionsOf = (lines: readonly string[]): RecipeSection[] => {
  const sections: RecipeSection[] = [];
  lines.forEach((text, index) => {
    const title = headingOf(text);
    if (title !== null) {
      sections.push({ title, items: [] });
      return;
    }
    if (!text.trim()) return;
    if (sections.length === 0) sections.push({ items: [] });
    sections[sections.length - 1].items.push({ text, index });
  });
  return sections;
};

/** True when the list has more than one dish, so the sections are worth labelling */
export const hasSections = (lines: readonly string[]): boolean => lines.some(line => headingOf(line) !== null);
