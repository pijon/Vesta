import { Recipe } from '../types';

/** A recipe name reduced to what makes it the same dish: case, punctuation and extra spaces don't count */
export const recipeNameKey = (name: string) =>
  name
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** The ids of every recipe that shares its name with another */
export const duplicateRecipeIds = (recipes: Recipe[]): Set<string> => {
  const byName = new Map<string, string[]>();
  for (const r of recipes) {
    const key = recipeNameKey(r.name);
    if (!key) continue;
    byName.set(key, [...(byName.get(key) ?? []), r.id]);
  }
  return new Set([...byName.values()].filter(ids => ids.length > 1).flat());
};

/** An existing recipe with the same name as `name`, if there is one */
export const findSameName = (recipes: Recipe[], name: string): Recipe | undefined => {
  const key = recipeNameKey(name);
  return key ? recipes.find(r => recipeNameKey(r.name) === key) : undefined;
};
