import type { DocumentData } from "firebase/firestore";

// Family recipes read for day plans, kept for the session so each refresh doesn't read today's
// recipes again. Keyed by group and recipe id; this device's own saves replace or drop an entry at
// once, and an entry is read again after a few minutes, so another member's edit shows up too.

/** How long a recipe read for a plan is reused before it's read again */
export const RECIPE_CACHE_MS = 5 * 60_000;

type Entry = { at: number; data: Promise<DocumentData | null> };
const entries = new Map<string, Entry>();
const keyOf = (groupId: string, id: string) => `${groupId}/${id}`;

/**
 * The stored recipe (null: the family has none by that id), read with `read` unless a recent read
 * is kept or on its way. A failed read isn't kept.
 */
export const readRecipeOnce = (groupId: string, id: string, read: () => Promise<DocumentData | null>): Promise<DocumentData | null> => {
    const key = keyOf(groupId, id);
    const kept = entries.get(key);
    if (kept && Date.now() - kept.at < RECIPE_CACHE_MS) return kept.data;
    const entry: Entry = { at: Date.now(), data: read() };
    entries.set(key, entry);
    entry.data.catch(() => { if (entries.get(key) === entry) entries.delete(key); });
    return entry.data;
};

/** A recipe as just saved or read from the server */
export const rememberRecipe = (groupId: string, id: string, data: DocumentData | null) => {
    entries.set(keyOf(groupId, id), { at: Date.now(), data: Promise.resolve(data) });
};

/** Drops a recipe changed here without knowing its new form, so the next plan read fetches it */
export const forgetRecipe = (groupId: string, id: string) => { entries.delete(keyOf(groupId, id)); };

export const forgetRecipes = () => { entries.clear(); };
