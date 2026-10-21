import { mealNutrition } from '../utils/recipeNutrition';
import React, { useId, useMemo, useState } from 'react';
import { ArrowLeft, Heart, Plus, Search, Sparkles, Store, UsersRound } from 'lucide-react';
import { MealSlot, Recipe } from '../types';
import { Sheet } from './Sheet';
import { mealVisualFor } from '../utils/mealVisual';
import { QUICK_MEAL_DESCRIPTION, eatingOutDishMeal, slotFor, mealKcalLabel, slotLabel, usualQuickMeals } from '../utils/planUtils';
import { useDevMode } from '../contexts/DevModeContext';
import { QuickMealForm } from './QuickMealForm';
import { EatingOutBudgetForm } from './EatingOutBudgetForm';
import { EatingOutDishList } from './EatingOutDishList';
import { usePrewarmed } from '../utils/prewarm';
import { eatingOutDishesData, quickMealHistoryData } from '../services/pageData';
import { suggestDishes } from '../utils/eatingOutHistory';
import { suggestSideDishes } from '../services/geminiService';

export type AddMode = 'add' | 'swap' | 'side';

export interface LeftoverOption {
  meal: Recipe;
  /** e.g. "Monday dinner" */
  from: string;
}

interface PlannerAddSheetProps {
  mode: AddMode;
  slot: MealSlot;
  title: string;
  /** Calories left in the day (before this meal), shown as a filter */
  caloriesLeft: number | undefined;
  isFastDay: boolean;
  recipes: Recipe[];
  familyRecipes: Recipe[];
  leftovers: LeftoverOption[];
  /** In a family with other members: a quick meal can be the family's */
  inFamily: boolean;
  /** Name of the meal a side is being added to */
  mainMealName?: string;
  mainMealCalories?: number;
  onPick: (recipe: Recipe, options?: { leftoverOf?: Recipe }) => void;
  onClose: () => void;
}

const PAGE = 40;

/** Pick a recipe for one slot: leftovers first, then the library with search and quick filters. */
export const PlannerAddSheet: React.FC<PlannerAddSheetProps> = ({
  mode, slot, title, caloriesLeft, isFastDay, recipes, familyRecipes, leftovers, inFamily,
  mainMealName, mainMealCalories, onPick, onClose,
}) => {
  const [search, setSearch] = useState('');
  const [fitsOnly, setFitsOnly] = useState(isFastDay && caloriesLeft > 0 && mode !== 'side');
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [source, setSource] = useState<'all' | 'mine' | 'family'>('all');
  const [shown, setShown] = useState(PAGE);
  const [quickName, setQuickName] = useState('');
  const [quickKcal, setQuickKcal] = useState('');
  const [quickError, setQuickError] = useState('');
  const [suggested, setSuggested] = useState<Recipe[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState('');
  /** Name for the quick-meal form; null shows the recipe list */
  const [quickDraft, setQuickDraft] = useState<string | null>(null);
  const quickFormId = useId();
  /** Setting a budget for eating out with the place undecided */
  const [budgeting, setBudgeting] = useState(false);
  const pastDishes = usePrewarmed(eatingOutDishesData) ?? [];
  const quickHistory = usePrewarmed(quickMealHistoryData);
  const quickMeals = useDevMode().isFeatureEnabled('quickMeals');

  const term = search.trim().toLowerCase();

  const list = useMemo(() => {
    const pool = source === 'mine' ? recipes : source === 'family' ? familyRecipes : [...recipes, ...familyRecipes];
    const wantsTag = (r: Recipe) => mode === 'side'
      ? (r.tags || []).some(t => ['side dish', 'snack', 'light meal'].includes(t.toLowerCase()))
      : slotFor(r) === slot;
    return pool
      .filter(r => !term || r.name.toLowerCase().includes(term))
      .filter(r => !fitsOnly || caloriesLeft === undefined || (mealNutrition(r).complete && !mealNutrition(r).budget && mealNutrition(r).knownCalories <= caloriesLeft))
      .filter(r => !favouritesOnly || r.isFavorite)
      .sort((a, b) =>
        Number(wantsTag(b)) - Number(wantsTag(a)) ||
        Number(!!b.isFavorite) - Number(!!a.isFavorite) ||
        a.name.localeCompare(b.name));
  }, [recipes, familyRecipes, source, term, fitsOnly, favouritesOnly, caloriesLeft, slot, mode]);

  const usual = useMemo(() => {
    if (mode === 'side' || !quickHistory) return [];
    return usualQuickMeals(quickHistory, slot, 20).filter(m => !term || m.name.toLowerCase().includes(term)).slice(0, 6);
  }, [quickHistory, slot, mode, term]);

  // Offer to plan the typed text as is, unless it names a recipe exactly
  const offerQuick = quickMeals && !!term &&
    ![...recipes, ...familyRecipes].some(r => r.name.trim().toLowerCase() === term);
  const typedName = search.trim().charAt(0).toUpperCase() + search.trim().slice(1);

  const addQuick = () => {
    const kcal = Number(quickKcal);
    if (!quickName.trim()) { setQuickError('Enter a name'); return; }
    if (!Number.isFinite(kcal) || kcal < 0 || kcal > 5000 || quickKcal.trim() === '') { setQuickError('Enter calories from 0 to 5000'); return; }
    onPick({
      id: crypto.randomUUID(),
      name: quickName.trim(),
      calories: Math.round(kcal),
      ingredients: [],
      instructions: [],
      tags: mode === 'side' ? ['side dish'] : [slot === 'snack' ? 'snack' : slot],
      servings: 1,
      description: QUICK_MEAL_DESCRIPTION,
      quick: {},
    });
  };

  const suggestSides = async () => {
    if (!mainMealName) return;
    setSuggesting(true);
    setSuggestError('');
    try {
      setSuggested(await suggestSideDishes(mainMealName, mainMealCalories || 0));
    } catch (e) {
      console.error(e);
      setSuggestError("Couldn't get suggestions right now. Try again in a moment.");
    } finally {
      setSuggesting(false);
    }
  };

  const chip = (label: React.ReactNode, active: boolean, onClick: () => void) => (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="chip shrink-0"
    >
      {label}
    </button>
  );

  const row = (recipe: Recipe, meta: React.ReactNode, onClick: () => void, key: string) => {
    const visual = mealVisualFor(recipe);
    return (
      <li key={key}>
        <button
          onClick={onClick}
          className="w-full flex items-center gap-3 py-2 px-2 -mx-2 rounded-[14px] text-left hover:bg-surface-sunken transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
        >
          {recipe.image ? (
            <img src={recipe.image} alt="" loading="lazy" className="size-12 rounded-full object-cover shrink-0" />
          ) : (
            <span className={`size-12 rounded-full flex items-center justify-center shrink-0 ${visual.tint}`}>
              <visual.Icon size={22} strokeWidth={2.25} aria-hidden="true" />
            </span>
          )}
          <span className="flex-1 min-w-0">
            <span className="font-semibold leading-snug line-clamp-2">{recipe.name}</span>
            <span className="block text-xs text-muted mt-0.5">{meta}</span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block font-display font-extrabold leading-5">{mealKcalLabel(recipe)}</span>

          </span>
          <span className="size-9 shrink-0 flex items-center justify-center rounded-full bg-surface-sunken text-main" aria-hidden="true">
            <Plus size={18} />
          </span>
        </button>
      </li>
    );
  };

  const subtitle = mode === 'side'
    ? `With ${mainMealName}`
    : caloriesLeft === undefined ? 'Calorie fit unavailable until all planned nutrition is known' : `${isFastDay ? 'Fast day · ' : ''}${caloriesLeft >= 0 ? `${caloriesLeft} kcal left` : `${-caloriesLeft} kcal over`}`;

  if (budgeting) {
    return (
      <Sheet
        title={title}
        subtitle={subtitle}
        onClose={onClose}
        footer={
          <div className="flex gap-2">
            <button type="button" onClick={() => setBudgeting(false)} className="btn-secondary"><ArrowLeft size={16} aria-hidden="true" /> Back</button>
            <button type="submit" form={quickFormId} className="btn-primary flex-1">
              {mode === 'swap' ? 'Swap in' : 'Add to plan'}
            </button>
          </div>
        }
      >
        <EatingOutBudgetForm id={quickFormId} slot={slot} caloriesLeft={caloriesLeft} onSubmit={meal => onPick(meal)} />
        {pastDishes.length > 0 && (
          <section aria-labelledby="usual-orders-heading" className="mt-6">
            <h3 id="usual-orders-heading" className="text-sm font-semibold text-muted">Or plan a dish you've had before</h3>
            <p className="text-xs text-muted mb-1">It stays open until you log what you really had.</p>
            <EatingOutDishList
              dishes={suggestDishes(pastDishes, { budget: caloriesLeft > 0 ? caloriesLeft : undefined })}
              budget={caloriesLeft > 0 ? caloriesLeft : undefined}
              onPick={d => onPick(eatingOutDishMeal(slot, d))}
            />
          </section>
        )}
      </Sheet>
    );
  }

  if (quickDraft !== null) {
    return (
      <Sheet
        title={title}
        subtitle={subtitle}
        onClose={onClose}
        size="lg"
        footer={
          <div className="flex gap-2">
            <button type="button" onClick={() => setQuickDraft(null)} className="btn-secondary"><ArrowLeft size={16} aria-hidden="true" /> Back</button>
            <button type="submit" form={quickFormId} className="btn-primary flex-1">
              {mode === 'swap' ? 'Swap in' : mode === 'side' ? 'Add side' : 'Add to plan'}
            </button>
          </div>
        }
      >
        <QuickMealForm id={quickFormId} initialName={quickDraft} slot={slot} isSide={mode === 'side'} askFamily={inFamily && mode === 'add'} onSubmit={meal => onPick(meal)} />
      </Sheet>
    );
  }

  return (
    <Sheet title={title} subtitle={subtitle} onClose={onClose} size="lg">
      <div className="space-y-5">
        <div className="space-y-3 sticky top-0 bg-surface pt-1 pb-2 z-10">
          <label className="relative block">
            <span className="sr-only">Search recipes</span>
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={e => { setSearch(e.target.value); setShown(PAGE); }}
              placeholder={quickMeals ? 'Search recipes or type any meal' : 'Search your recipes'}
              className="input w-full !pl-11"
            />
          </label>
          <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1 no-scrollbar">
            {caloriesLeft !== undefined && caloriesLeft > 0 && mode !== 'side' && chip(`Fits ${caloriesLeft} kcal`, fitsOnly, () => setFitsOnly(v => !v))}
            {chip(<><Heart size={14} className="inline -mt-0.5 mr-1" aria-hidden="true" />Favourites</>, favouritesOnly, () => setFavouritesOnly(v => !v))}
            {familyRecipes.length > 0 && chip('Mine', source === 'mine', () => setSource(s => s === 'mine' ? 'all' : 'mine'))}
            {familyRecipes.length > 0 && chip(<><UsersRound size={14} className="inline -mt-0.5 mr-1" aria-hidden="true" />Family</>, source === 'family', () => setSource(s => s === 'family' ? 'all' : 'family'))}
          </div>
        </div>

        {offerQuick && (
          <button
            onClick={() => setQuickDraft(typedName)}
            className="w-full flex items-center gap-3 py-2 px-2 -mx-2 rounded-[14px] text-left hover:bg-surface-sunken transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
          >
            <span className={`size-12 rounded-full flex items-center justify-center shrink-0 bg-surface-sunken border-[1.5px] border-dashed border-border-control`} aria-hidden="true">
              <Plus size={22} strokeWidth={2.25} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="font-semibold leading-snug line-clamp-2">Plan “{search.trim()}” without a recipe</span>
              <span className="block text-xs text-muted mt-0.5">Name it now, add details if you like</span>
            </span>
          </button>
        )}

        {quickMeals && mode !== 'side' && !term && (
          <button
            onClick={() => setBudgeting(true)}
            className="w-full flex items-center gap-3 py-2 px-2 -mx-2 rounded-[14px] text-left hover:bg-surface-sunken transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
          >
            <span className="size-12 rounded-full flex items-center justify-center shrink-0 bg-workout-bg text-workout-text" aria-hidden="true">
              <Store size={22} strokeWidth={2.25} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="font-semibold leading-snug">Eating out, place not decided</span>
              <span className="block text-xs text-muted mt-0.5">Set a calorie budget now, pick the place later</span>
            </span>
          </button>
        )}

        {quickMeals && usual.length > 0 && (
          <section aria-labelledby="usual-heading">
            <h3 id="usual-heading" className="text-sm font-semibold text-muted mb-1">Your usual {slotLabel(slot).toLowerCase()}</h3>
            <ul>
              {usual.map(meal => row(
                meal,
                `${mealVisualFor(meal).label}${meal.protein ? ` · ${meal.protein} g protein` : ''} · planned before`,
                () => onPick(meal),
                `usual-${meal.id}`,
              ))}
            </ul>
          </section>
        )}

        {mode !== 'side' && leftovers.length > 0 && !term && (
          <section aria-labelledby="leftovers-heading">
            <h3 id="leftovers-heading" className="text-sm font-semibold text-muted mb-1">Leftovers from this week</h3>
            <ul>
              {leftovers.map(({ meal, from }) => row(
                meal,
                `From ${from} · no extra shopping`,
                () => onPick(meal, { leftoverOf: meal }),
                `leftover-${meal.instanceId || meal.id}`,
              ))}
            </ul>
          </section>
        )}

        {mode === 'side' && (
          <section aria-labelledby="suggest-heading" className="space-y-2">
            <h3 id="suggest-heading" className="text-sm font-semibold text-muted">Ideas for a side</h3>
            {suggested.length === 0 ? (
              <button onClick={suggestSides} disabled={suggesting} className="btn-secondary btn-sm">
                <Sparkles size={16} aria-hidden="true" /> {suggesting ? 'Thinking…' : 'Suggest sides'}
              </button>
            ) : (
              <ul>
                {suggested.map((r, i) => row(r, 'Suggested side', () => onPick({ ...r, description: r.description || QUICK_MEAL_DESCRIPTION, quick: {} }), `suggested-${i}`))}
              </ul>
            )}
            {suggestError && <p className="text-sm text-error">{suggestError}</p>}
          </section>
        )}

        <section aria-labelledby="library-heading">
          <h3 id="library-heading" className="text-sm font-semibold text-muted mb-1">
            {term ? `${list.length} matching recipes` : 'Your recipes'}
          </h3>
          {list.length === 0 ? (
            <p className="text-sm text-muted py-4">
              {quickMeals
                ? (fitsOnly ? `Nothing in your recipes fits ${caloriesLeft} kcal.` : 'No recipes match.')
                : (fitsOnly ? `Nothing in your recipes fits ${caloriesLeft} kcal. Turn off the filter or add a quick entry below.` : 'No recipes match. Add a quick entry below.')}
            </p>
          ) : (
            <ul>
              {list.slice(0, shown).map(r => row(
                r,
                <>
                  {mealVisualFor(r).label}
                  {!!r.protein && ` · ${r.protein} g protein`}
                  {r.ownerName && ` · From ${r.ownerName.split(' ')[0]}`}
                </>,
                () => onPick(r),
                `${r.ownerId || 'me'}-${r.id}`,
              ))}
            </ul>
          )}
          {list.length > shown && (
            <button onClick={() => setShown(s => s + PAGE)} className="btn-ghost btn-sm mt-2">Show more</button>
          )}
        </section>

        {quickMeals ? (
          !offerQuick && <div className="border-t border-border pt-4">
            <button onClick={() => setQuickDraft(typedName)} className="btn-ghost btn-sm -ml-4">
              <Plus size={16} aria-hidden="true" /> Plan a meal without a recipe
            </button>
          </div>
        ) : (
        <section aria-labelledby="quick-heading" className="border-t border-border pt-4">
          <h3 id="quick-heading" className="text-sm font-semibold text-muted mb-2">Quick entry</h3>
          <form
            className="flex flex-col sm:flex-row gap-2"
            onSubmit={e => { e.preventDefault(); addQuick(); }}
            noValidate
          >
            <label className="flex-1">
              <span className="sr-only">Meal name</span>
              <input value={quickName} onChange={e => { setQuickName(e.target.value); setQuickError(''); }} placeholder="Pizza night out" className="input w-full" />
            </label>
            <label className="sm:w-28">
              <span className="sr-only">Calories</span>
              <input value={quickKcal} onChange={e => { setQuickKcal(e.target.value); setQuickError(''); }} inputMode="numeric" placeholder="kcal" className="input w-full" />
            </label>
            <button type="submit" className="btn-primary">Add</button>
          </form>
          {quickError && <p className="text-sm text-error mt-1.5" role="alert">{quickError}</p>}
        </section>
        )}
      </div>
    </Sheet>
  );
};
