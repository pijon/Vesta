/**
 * How many recipes a file to restore holds when recipes are all it holds (a recipe import, such as
 * the ebook extractor writes), else null. Restoring such a file only adds or updates those recipes,
 * so it needs none of a full backup's warning. Anything else in the file counts as a full backup.
 */
export const recipesOnlyCount = (json: string): number | null => {
  try {
    const data: unknown = JSON.parse(json);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const keys = Object.keys(data);
    const recipes = (data as { recipes?: unknown }).recipes;
    return keys.length === 1 && keys[0] === 'recipes' && Array.isArray(recipes) ? recipes.length : null;
  } catch {
    return null;
  }
};
