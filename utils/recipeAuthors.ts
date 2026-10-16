import { Recipe } from '../types';

/** Whether the user added this family recipe (recipes from before createdBy count as theirs). */
export const isAddedBy = (recipe: Recipe, uid: string | null) => !recipe.createdBy || recipe.createdBy === uid;

/** Sets ownerName on the recipes another member added, for the "From …" badges. */
export const withAuthorNames = (recipes: Recipe[], uid: string | null, names?: Map<string, string>): Recipe[] =>
  recipes.map(recipe => isAddedBy(recipe, uid) ? recipe : { ...recipe, ownerName: names?.get(recipe.createdBy!) ?? 'Family member' });
