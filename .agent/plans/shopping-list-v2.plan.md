# Shopping list v2: one living family list

## Why

The current list is a three-step wizard (Choose meals → Check pantry → Shop) that produces a frozen,
per-person snapshot:

- Building it waits on the AI to parse every ingredient line (≈20 s on a cold cache). The cache is
  one browser's localStorage, so other devices and family members start from zero.
- Meals planned after building need a rebuild.
- The plan is the family's, but the list lives in `users/{uid}/data/shopping`: two people shopping
  for one week get two lists.
- Nothing can be added by hand (milk, coffee, toilet paper).
- "Have it" never expires (`isInPantry` ignores `markedAt`), so eggs marked once never come back.
- Names merge poorly ("Avocados" / "Avokador", "Garlic" / "Garlic cloves") and units don't convert.

The AI "purchasable quantities" step is already gone (amounts are what the recipes need).

## Decisions (from Jon, 2026-10-18)

- **One shared family list**, live for every member.
- **A living list**: meals are added into it, any time; no wizard, no snapshot.
- **Own items** typed straight onto the list.
- **Pantry as a section** of the list ("Probably at home"), and it expires.
- Not now: grouping by store section, portions per meal. Amounts follow each recipe's servings.

## Shape

### Parsed ingredients live on the recipe

- `utils/ingredientParse.ts`: a parser for "qty unit name" lines, in code. It handles fractions and
  unicode (½, 1/2, 1 ½), ranges (2–3 takes the top), Swedish and English units (g, kg, ml, dl, l,
  tsk, msk, krm, st, tsp, tbsp, cup, oz, pound, clove/klyfta, can/burk, pkt) and strips prep words
  ("diced", "hackad"). It returns `null` when unsure.
- `Recipe.parsedIngredients?: Array<{ text: string; name: string; quantity: number; unit: string }>`,
  keyed by `text`, so editing one line only reparses that line.
- `saveRecipe` fills it in the background: the parser first, then the existing AI `parseIngredients`
  (fast model) for the lines it couldn't read. Recipes without it are parsed the first time they are
  added to the list, and the result is written back. That's a one-time cost per recipe, shared by
  the whole family.
- Merge key: canonical name (lowercase, singular/plural folded) plus a unit dimension. Same-dimension
  units convert in code (g↔kg, ml↔dl↔l, tsp↔tbsp), and the larger unit is shown when ≥ 1.
- The localStorage `vesta_ingredient_cache` goes away.

### The list: `groups/{groupId}/shoppingItems/{id}`

One doc per item, so ticks by two people never overwrite each other. The existing
`groups/{groupId}/{document=**}` rule covers it, so no rules change is needed.

```ts
interface ShoppingListItem {
  id: string;                 // crypto.randomUUID()
  key: string;                // merge key (canonical name + unit dimension)
  name: string;               // shown name
  quantity?: number;          // absent for "some" (own items without an amount)
  unit?: string;
  /** Planned meals this is for; empty for an own item */
  sources: Array<{ instanceId: string; date: string; mealName: string; quantity: number }>;
  addedBy: string;            // uid
  checked: boolean;
  checkedBy?: string;
  createdAt: number;
}
```

- `services/shoppingService.ts` (like `activityService.ts`): `subscribeShoppingList` (onSnapshot),
  `addMealsToList(meals)`, `addOwnItem(text)`, `setChecked`, `removeItem`, `clearChecked`,
  `removeMealFromList(instanceId)`.
- `addMealsToList` skips meals whose `instanceId` is already in some item's `sources`, so adding twice
  never doubles. It merges into an existing unchecked item with the same key, otherwise it creates
  one. It runs in a transaction per touched item.
- Quick meals add their shopping items as they are, as today.

### The page

- **Top:** the hero keeps "Left to buy" and the count, plus Copy list.
- **Add bar:** a text field ("Add an item…", parsed by the same parser) and a **"Add meals · N"**
  button. N counts upcoming planned family meals (next 7 days) not yet on the list. It opens a sheet
  with those meals, all ticked; one tap adds them.
- **The list:** unchecked items, each showing its amount and the meals it's for ("For Tuesday's
  salmon"). Swipe or trash removes, with undo, as now.
- **Probably at home** (collapsed, with a count): items whose key is in the family pantry. "Need it"
  moves one back up. On any item, "Have it" sends it here.
- **In the basket:** checked items, with "Clear basket".
- **Stale meals:** if a meal on the list is no longer planned, a quiet notice offers to take its
  ingredients off.

### Pantry: `groups/{groupId}/pantry/{key}`

`{ key, name, markedAt, by }`. It is shared by the family (one kitchen). An entry counts for 30 days
after `markedAt`; marking it again renews it. Older entries are ignored, and cleared when read.

## Phases

1. **Parsing on the recipe.** Add the parser with thorough tests, `parsedIngredients`, filling it in
   `saveRecipe`, and backfilling it on first use. The current wizard reads from it right away, which
   alone makes "Build list" near-instant. This ships on its own.
2. **Shared list.** Add `shoppingService`, the new page replacing the wizard, own items and the
   Add meals sheet. Migration: the first time a family's list is empty, import the member's unbought
   `cachedPurchasableItems` as own items once (old docs stay as a backup).
3. **Pantry section.** Add the family pantry with expiry, import members' old `pantry` items (their
   `markedAt` decides whether they still count), and the stale-meal notice.

## Removes

`EnhancedShoppingState`, the `portions` UI, `IngredientReviewCard`, `aggregateIngredients` /
`toShoppingItems` (replaced by merge-by-key), `getEnhancedShoppingState` / `saveEnhancedShoppingState`
once migrated, and the localStorage ingredient cache. Update CLAUDE.md (Persistence, Family groups)
and `.agent/knowledge` schema notes.

## Tests

- `utils/ingredientParse.test.ts`: a table of real lines from the family's recipes (Swedish and
  English), unit conversion, and the `null` cases.
- `services/shoppingService.test.ts` against `test/fakeFirestore.ts`: adding the same meal twice,
  two meals merging (g + kg), own items, a checked item not absorbing new amounts, removing a meal's
  share, pantry expiry.

## Open questions

- Cross-language duplicates ("Avokador" vs "Avocados"). Could the AI fallback return one canonical
  (Swedish?) name, or do we let people merge two items by hand?
- Should "Clear basket" be automatic when every item is checked?
