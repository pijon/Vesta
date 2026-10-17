import React, { useState, useEffect, useRef } from 'react';
import { shoppingData } from '../services/pageData';
import { ensureWarm, peekWarm } from '../utils/prewarm';
import { Reorder } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  savePantryInventory,
  saveEnhancedShoppingState,
  migrateShoppingState
} from '../services/storageService';
import { parseIngredients, convertToPurchasableQuantities } from '../services/geminiService';
import { ParsedIngredient, AggregatedIngredient, PurchasableItem, EnhancedShoppingState, PantryInventory } from '../types';
import { PlanMeal, extractMealsFromPlan, hasThingsToBuy, aggregateIngredients, reconcilePurchasable } from '../utils/shoppingUtils';
import { IngredientReviewCard } from './IngredientReviewCard';
import ShoppingItem from './ShoppingItem';
import { ConfirmSheet } from './ConfirmSheet';
import { localDateString } from '../utils/dateUtils';
import { CircleAlert, ArrowLeft, CalendarHeart, Check, CookingPot, Copy, CopyCheck, ListChecks, Minus, PartyPopper, Plus, RotateCcw, ShoppingBasket } from 'lucide-react';

type Phase = 'selection' | 'requirements' | 'shopping';

export const ShoppingList: React.FC = () => {
  const [phase, setPhase] = useState<Phase>('selection');
  const [availableMeals, setAvailableMeals] = useState<PlanMeal[]>([]);
  const [selectedMealIds, setSelectedMealIds] = useState<Set<string>>(new Set());
  /** Portions to buy for, by meal key, where the user changed them from the recipe's servings */
  const [portions, setPortions] = useState<Record<string, number>>({});

  // Keep existing state for downstream phases
  const [aggregatedIngredients, setAggregatedIngredients] = useState<AggregatedIngredient[]>([]);
  const [purchasableItems, setPurchasableItems] = useState<PurchasableItem[]>([]);
  // Starts true so the page, pre-rendered while hidden, never shows "no meals" before loading
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  // Delay the loading screen so quick loads don't flash a spinner
  const [showLoading, setShowLoading] = useState(false);
  useEffect(() => {
    if (!isProcessing) { setShowLoading(false); return; }
    const timer = setTimeout(() => setShowLoading(true), 300);
    return () => clearTimeout(timer);
  }, [isProcessing]);

  // Persistence State
  const [inventory, setInventory] = useState<PantryInventory>({ items: [], lastUpdated: 0 });
  const [shoppingState, setShoppingState] = useState<EnhancedShoppingState>({
    pantryChecks: {},
    purchased: [],
    removed: [],
    lastGeneratedDate: '',
    cachedPurchasableItems: [],
    cachedParsedIngredients: [],
    cachedAggregatedIngredients: [],
    ingredientsHash: ''
  });
  // The latest state, for saves that run after a delay or right after another change: building on
  // a render's copy could write back something older (a tick undone by a reorder's delayed save)
  const shoppingStateRef = useRef(shoppingState);
  const updateShoppingState = (changes: Partial<EnhancedShoppingState>) => {
    const next = { ...shoppingStateRef.current, ...changes };
    shoppingStateRef.current = next;
    setShoppingState(next);
    return saveEnhancedShoppingState(next);
  };

  // Load once; when the page is shown again (App keeps it in an Activity, which re-runs
  // effects) just pick up meals planned meanwhile, without a loading screen
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      initializeShoppingList();
    } else {
      refreshPlannedMeals();
    }
  }, []);

  // Debounced persistence for items (fixes jerky drag and drop)
  useEffect(() => {
    // Skip initial load or empty
    if (purchasableItems.length === 0 && shoppingState.cachedPurchasableItems.length === 0) return;

    // Saved 1s after the last change, so dragging doesn't save on every frame
    const timeoutId = setTimeout(() => {
      if (JSON.stringify(purchasableItems) === JSON.stringify(shoppingStateRef.current.cachedPurchasableItems)) return;
      updateShoppingState({ cachedPurchasableItems: purchasableItems }).catch(console.error);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [purchasableItems]);

  // Simple hash function for ingredients from selected meals
  const hashIngredients = (ingredients: Array<{ text: string, recipeId: string, recipeName: string }>): string => {
    return ingredients.map(i => `${i.text}|${i.recipeId}`).join('::');
  };

  /** Planned meals for the next two weeks, from the whole family's plan (loaded in the background after sign-in). */
  const loadPlannedMeals = async (fresh = false) => extractMealsFromPlan((await ensureWarm(shoppingData, fresh)).plans, localDateString());

  // New meals start selected while choosing meals
  const knownMealIds = useRef<Set<string>>(new Set());
  // After the first load from background data, fetch the latest plan once
  const refreshAfterInit = useRef(false);
  useEffect(() => {
    if (!isProcessing && refreshAfterInit.current) {
      refreshAfterInit.current = false;
      refreshPlannedMeals();
    }
  }, [isProcessing]);
  const refreshPlannedMeals = () => {
    if (isProcessing) return;
    loadPlannedMeals(true).then(meals => {
      const added = meals.filter(m => !knownMealIds.current.has(m.key)).map(m => m.key);
      knownMealIds.current = new Set(meals.map(m => m.key));
      setAvailableMeals(meals);
      if (phase === 'selection' && added.length > 0) {
        setSelectedMealIds(prev => new Set([...prev, ...added]));
      }
    }).catch(e => console.error('Failed to refresh planned meals', e));
  };

  const initializeShoppingList = async () => {
    try {
      setIsProcessing(true);
      setLoadingMessage('Loading meal plan...');
      setError(null);

      // Migrate old shopping state if needed
      migrateShoppingState();

      // Usually ready already (App loads it in the background after sign-in): show that
      // straight away, however old, and pick up newer meals just after
      const warm = peekWarm(shoppingData) ?? await ensureWarm(shoppingData);
      const { shoppingState: enhancedState, pantry: pantryInventory } = warm;
      const mealsPromise = Promise.resolve(extractMealsFromPlan(warm.plans, localDateString()));

      shoppingStateRef.current = enhancedState;
      setShoppingState(enhancedState);
      setPortions(enhancedState.portions || {});
      inventoryRef.current = pantryInventory;
      setInventory(pantryInventory);

      if (enhancedState.cachedPurchasableItems.length > 0) {
        // We have an active list, restore it (without the items the user removed)
        const visibleItems = enhancedState.cachedPurchasableItems.filter(
          item => !enhancedState.removed.includes(item.ingredientName)
        );

        setPurchasableItems(visibleItems);
        setAggregatedIngredients(enhancedState.cachedAggregatedIngredients);
        if (enhancedState.selectedMealIds) setSelectedMealIds(new Set(enhancedState.selectedMealIds));
        setPhase('shopping');
        setIsProcessing(false);

        const meals = await mealsPromise;
        setAvailableMeals(meals);
        knownMealIds.current = new Set(meals.map(m => m.key));
        // Lists saved with no selection, or one by recipe (before meals had keys): every planned meal is selected
        const saved = new Set(enhancedState.selectedMealIds || []);
        if (!meals.some(m => saved.has(m.key))) setSelectedMealIds(new Set(meals.map(m => m.key)));
      } else {
        // No active list, start fresh in selection mode with every meal selected
        setLoadingMessage('Loading meal plan...');
        const meals = await mealsPromise;
        setAvailableMeals(meals);
        knownMealIds.current = new Set(meals.map(m => m.key));
        setSelectedMealIds(new Set(meals.map(m => m.key)));
        setPhase('selection');
      }

      setIsProcessing(false);
      refreshAfterInit.current = true;

    } catch (err) {
      console.error('Error initializing shopping list:', err);
      setError(err instanceof Error ? err.message : 'Failed to load shopping list');
      setIsProcessing(false);
    }
  };

  const handleAnalyzeIngredients = async () => {
    try {
      setIsProcessing(true);
      setLoadingMessage('Analyzing ingredients with AI...');
      setError(null);

      // Filter meals based on selection
      const selectedMeals = availableMeals.filter(meal => selectedMealIds.has(meal.key) && hasThingsToBuy(meal));

      if (selectedMeals.length === 0) {
        setError("Please select at least one meal to generate a list.");
        setIsProcessing(false);
        return;
      }

      // Save selection state
      await updateShoppingState({ selectedMealIds: Array.from(selectedMealIds), portions });

      // Extract ingredients from selected meals
      const ingredientsToProcess: Array<{ text: string, recipeId: string, recipeName: string, scale: number }> = [];
      selectedMeals.forEach(meal => {
        // A recipe's ingredients are for its servings; a quick meal's items are what to buy as they are
        const scale = meal.isQuick ? 1 : portionsFor(meal) / (meal.servings || 1);

        meal.ingredients.forEach(ing => {
          ingredientsToProcess.push({
            text: ing,
            recipeId: meal.id,
            recipeName: meal.name,
            scale: scale
          });
        });
      });

      await processIngredients(ingredientsToProcess);

      setPhase('requirements');
      setIsProcessing(false);
    } catch (err) {
      console.error('Error analyzing ingredients:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze ingredients');
      setIsProcessing(false);
    }
  };

  const processIngredients = async (ingredientsToProcess: Array<{ text: string, recipeId: string, recipeName: string, scale: number }>) => {
    // Parse ingredients
    const texts = ingredientsToProcess.map(r => r.text);
    // One result per text, or it throws
    const parsed = await parseIngredients(texts);

    // Map parsed results back to include recipe info
    const parsedWithRecipeInfo: ParsedIngredient[] = parsed.map((p, index) => ({
      id: crypto.randomUUID(),
      originalText: ingredientsToProcess[index].text,
      name: p.name,
      quantity: p.quantity * ingredientsToProcess[index].scale, // Apply scaling
      unit: p.unit,
      recipeId: ingredientsToProcess[index].recipeId,
      recipeName: ingredientsToProcess[index].recipeName
    }));

    // Aggregate by ingredient name
    const aggregated = aggregateIngredients(parsedWithRecipeInfo);
    setAggregatedIngredients(aggregated);

    // Cache the results
    await updateShoppingState({
      cachedParsedIngredients: parsedWithRecipeInfo,
      cachedAggregatedIngredients: aggregated,
      ingredientsHash: hashIngredients(ingredientsToProcess),
      selectedMealIds: Array.from(selectedMealIds), // Ensure selection is saved with cache
      portions,
    });
  };

  // The pantry flips at once; saves run one after another, each writing the latest pantry, so
  // quick taps can't overwrite each other
  const inventoryRef = useRef(inventory);
  const pantrySaves = useRef(Promise.resolve());
  const handleTogglePantry = (ingredientName: string, inPantry: boolean) => {
    const others = inventoryRef.current.items.filter(item => item.name !== ingredientName);
    const next: PantryInventory = {
      items: inPantry ? [...others, { name: ingredientName, markedAt: Date.now(), persistent: true }] : others,
      lastUpdated: Date.now(),
    };
    inventoryRef.current = next;
    setInventory(next);
    pantrySaves.current = pantrySaves.current
      .then(() => savePantryInventory(inventoryRef.current))
      .catch(e => console.error('Failed to save pantry', e));
  };

  const isInPantry = (ingredientName: string): boolean => {
    return inventory.items.some(item => item.name === ingredientName);
  };

  const handleGenerateShoppingList = async () => {
    try {
      setIsProcessing(true);
      setLoadingMessage('Converting to purchasable quantities...');
      setError(null);

      // Filter out pantry items using state
      const pantryNames = new Set(inventory.items.map(item => item.name));
      const toBuy = aggregatedIngredients.filter(ing => !pantryNames.has(ing.name));

      if (toBuy.length === 0) {
        setPhase('shopping');
        setPurchasableItems([]);
        setIsProcessing(false);
        return;
      }

      // Convert to purchasable quantities
      const simplified = toBuy.map(ing => ({
        name: ing.name,
        quantity: ing.totalQuantity,
        unit: ing.unit
      }));

      const purchasable = reconcilePurchasable(simplified, await convertToPurchasableQuantities(simplified));
      setPurchasableItems(purchasable);

      // Cache results
      await updateShoppingState({
        lastGeneratedDate: localDateString(),
        cachedPurchasableItems: purchasable,
        removed: [], // Clear removed items on new generation
      });

      setPhase('shopping');
      setIsProcessing(false);

    } catch (err) {
      console.error('Error generating shopping list:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate shopping list');
      setIsProcessing(false);
    }
  };

  /** The last item removed, offered back for a few seconds */
  const [lastRemoved, setLastRemoved] = useState<{ item: PurchasableItem; index: number } | null>(null);
  useEffect(() => {
    if (!lastRemoved) return;
    const timer = setTimeout(() => setLastRemoved(null), 5000);
    return () => clearTimeout(timer);
  }, [lastRemoved]);

  const handleRemoveItem = async (ingredientName: string) => {
    const index = purchasableItems.findIndex(item => item.ingredientName === ingredientName);
    if (index < 0) return;
    setLastRemoved({ item: purchasableItems[index], index });
    // Update UI local state for immediate list removal
    setPurchasableItems(purchasableItems.filter(item => item.ingredientName !== ingredientName));
    await updateShoppingState({ removed: [...shoppingStateRef.current.removed, ingredientName] });
  };

  const handleUndoRemove = async () => {
    if (!lastRemoved) return;
    const { item, index } = lastRemoved;
    setLastRemoved(null);
    setPurchasableItems(prev => [...prev.slice(0, index), item, ...prev.slice(index)]);
    await updateShoppingState({ removed: shoppingStateRef.current.removed.filter(name => name !== item.ingredientName) });
  };

  const handleUpdateItem = async (ingredientName: string, newQuantityString: string) => {
    const currentItems = [...purchasableItems];
    const itemIndex = currentItems.findIndex(i => i.ingredientName === ingredientName);
    if (itemIndex >= 0) {
      currentItems[itemIndex] = {
        ...currentItems[itemIndex],
        purchasableQuantity: newQuantityString // Override display quantity/string
      };
      setPurchasableItems(currentItems);
      await updateShoppingState({ cachedPurchasableItems: currentItems });
    }
  };

  const handleReorder = (newOrder: PurchasableItem[]) => {
    // The list only reorders items still to buy; keep purchased ones after them.
    // Local state only, for smooth dragging.
    const purchased = purchasableItems.filter(item => shoppingState.purchased?.includes(item.ingredientName));
    setPurchasableItems([...newOrder, ...purchased]);
  };

  const [listCopied, setListCopied] = useState(false);
  const handleCopyList = () => {
    const lines = purchasableItems
      .filter(item => !shoppingState.purchased?.includes(item.ingredientName))
      .map(item => `${item.purchasableQuantity || item.requiredQuantity} ${item.ingredientName}`);
    navigator.clipboard?.writeText(lines.join('\n')).then(() => {
      setListCopied(true);
      setTimeout(() => setListCopied(false), 2000);
    }).catch(err => console.error('Failed to copy list:', err));
  };

  const handleToggleCheck = async (ingredientName: string) => {
    const purchased = shoppingStateRef.current.purchased;
    await updateShoppingState({
      purchased: purchased.includes(ingredientName)
        ? purchased.filter(n => n !== ingredientName)
        : [...purchased, ingredientName],
    });
  };

  const handleCopyItem = (item: PurchasableItem) => {
    if (navigator.clipboard) {
      const text = `${item.purchasableQuantity || item.requiredQuantity} ${item.ingredientName}`;
      navigator.clipboard.writeText(text).catch(err => {
        console.error('Failed to copy to clipboard:', err);
      });
    }
  };

  const [confirmingReset, setConfirmingReset] = useState(false);
  const resetList = async () => {
    setLastRemoved(null);
    await updateShoppingState({
      pantryChecks: {},
      purchased: [],
      removed: [],
      lastGeneratedDate: '',
      cachedPurchasableItems: [],
      cachedParsedIngredients: [],
      cachedAggregatedIngredients: [],
      ingredientsHash: '',
      selectedMealIds: [],
      portions: {},
    });

    setPhase('selection');
    setPurchasableItems([]);
    setAggregatedIngredients([]);
    setIsProcessing(false);

    // Default select all again when resetting
    setSelectedMealIds(new Set(availableMeals.map(m => m.key)));
    setPortions({});
  };

  const handleToggleMeal = (mealId: string) => {
    const newSelection = new Set(selectedMealIds);
    if (newSelection.has(mealId)) {
      newSelection.delete(mealId);
    } else {
      newSelection.add(mealId);
    }
    setSelectedMealIds(newSelection);
  };

  /** Portions to buy for a meal: the recipe's servings unless the user changed them */
  const portionsFor = (meal: PlanMeal) => portions[meal.key] ?? (meal.servings || 1);
  const setMealPortions = (meal: PlanMeal, n: number) => setPortions(prev => {
    const { [meal.key]: _old, ...rest } = prev;
    return n === (meal.servings || 1) ? rest : { ...rest, [meal.key]: n };
  });

  // Only meals with something to buy can be chosen; leftovers and meals without ingredients are listed for context
  const buyableMeals = availableMeals.filter(hasThingsToBuy);
  const chosenMeals = buyableMeals.filter(m => selectedMealIds.has(m.key));
  const handleSelectAll = (selectAll: boolean) => {
    setSelectedMealIds(new Set(selectAll ? availableMeals.map(m => m.key) : []));
  };

  // Calculate pantry counts
  const inPantryItems = aggregatedIngredients.filter(ing => isInPantry(ing.name));
  const needToBuyItems = aggregatedIngredients.filter(ing => !isInPantry(ing.name));

  // Step indicator shared by every phase. Steps already done can be revisited: going back to
  // the meals keeps the list until a new one is built
  const STEPS: { phase: Phase; label: string; reachable: boolean }[] = [
    { phase: 'selection', label: 'Choose meals', reachable: true },
    { phase: 'requirements', label: 'Check pantry', reachable: aggregatedIngredients.length > 0 },
    { phase: 'shopping', label: 'Shop', reachable: purchasableItems.length > 0 || shoppingState.lastGeneratedDate !== '' },
  ];
  const stepIndex = STEPS.findIndex(st => st.phase === phase);
  const goToStep = (step: Phase) => {
    setError(null);
    setPhase(step);
  };
  const stepBar = (
    <nav aria-label="Shopping list steps">
      <ol className="flex gap-1.5">
        {STEPS.map((step, i) => {
          const current = i === stepIndex;
          const canGo = !current && step.reachable && !isProcessing;
          return (
            <li key={step.phase} className="flex-1 min-w-0">
              <button
                onClick={() => goToStep(step.phase)}
                disabled={!canGo}
                aria-current={current ? 'step' : undefined}
                className="group w-full min-h-11 text-left rounded-[10px] disabled:cursor-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              >
                <span className={`block h-1.5 rounded-full ${i <= stepIndex ? 'bg-ink' : 'bg-surface-sunken'}`} />
                <span className={`block mt-1.5 text-xs font-semibold truncate ${current ? 'text-main' : 'text-muted'} ${canGo ? 'underline decoration-border-control underline-offset-2 group-hover:text-main' : ''}`}>
                  {i + 1}. {step.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {/* Every phase shows the step bar, so the Start over question lives here (it renders in a portal) */}
      {confirmingReset && (
        <ConfirmSheet
          title="Start the list over?"
          message="Your shopping list and ticked items are cleared, and you choose meals again. What you marked as at home stays marked."
          confirmLabel="Start over"
          tone="danger"
          onConfirm={resetList}
          onClose={() => setConfirmingReset(false)}
        />
      )}
    </nav>
  );

  // Sticky footer for each phase's main action, kept clear of the bottom nav
  const stickyAction = (children: React.ReactNode) => (
    <div className="sticky bottom-[calc(var(--tab-bar-bottom)+78px)] nav:bottom-8 z-20 flex justify-center pt-4 pointer-events-none">
      <div className="pointer-events-auto">{children}</div>
    </div>
  );

  const errorNotice = error && (
    <div className="rounded-3xl bg-error-bg p-5 flex gap-3" role="alert">
      <CircleAlert size={22} className="text-error shrink-0 mt-0.5" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-semibold">We couldn't build your list</p>
        <p className="text-sm mt-0.5">{error}</p>
      </div>
    </div>
  );

  // Loading state. Building the list from chosen meals keeps its inline spinner on the
  // button; the first load (no meals yet) and later phases use this screen.
  if (isProcessing && (phase !== 'selection' || availableMeals.length === 0)) {
    if (!showLoading) return <div className="min-h-[50vh]" aria-busy="true" />;
    return (
      <div className="space-y-5 pb-20">
        {stepBar}
        <div className="tile tile-neutral items-center text-center py-12" role="status">
          <span className="spinner spinner-lg text-main mb-4" aria-hidden="true" />
          <p className="font-semibold">{loadingMessage || 'Working on your list…'}</p>
        </div>
      </div>
    );
  }

  // Phase 0: Selection (a failed first load has no meals to show, so it gets the error screen)
  if (phase === 'selection' && !(error && availableMeals.length === 0)) {
    const mealsByDate = new Map<string, PlanMeal[]>();
    availableMeals.forEach(meal => {
      if (!mealsByDate.has(meal.date)) mealsByDate.set(meal.date, []);
      mealsByDate.get(meal.date)!.push(meal);
    });
    const allChosen = chosenMeals.length === buyableMeals.length;
    const hasList = purchasableItems.length > 0;

    return (
      <div className="space-y-5 pb-20">
        {stepBar}

        {availableMeals.length === 0 ? (
          <div className="tile tile-neutral items-center text-center py-12">
            <CalendarHeart size={28} className="text-muted mb-3" aria-hidden="true" />
            <p className="font-semibold">No meals planned yet</p>
            <p className="text-sm text-muted mt-1">Plan a few meals for the week and your shopping list builds itself.</p>
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="heading-2">Choose meals</h2>
                <p className="text-sm text-muted mt-0.5">
                  {chosenMeals.length} of {buyableMeals.length} meals to shop for
                </p>
              </div>
              {buyableMeals.length > 1 && (
                <button onClick={() => handleSelectAll(!allChosen)} className="btn-ghost btn-sm shrink-0">
                  {allChosen ? 'Clear all' : 'Select all'}
                </button>
              )}
            </div>

            {errorNotice}

            <div className="space-y-3">
              {Array.from(mealsByDate.entries()).sort().map(([date, meals]) => {
                const d = new Date(`${date}T00:00:00`);
                const isToday = date === localDateString();
                return (
                  <section key={date} className="card px-3 md:px-4 py-3">
                    <h3 className="font-sans text-xs font-semibold text-muted px-2 pb-1">
                      {isToday ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'long' })} · {d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    </h3>
                    <ul>
                      {meals.map(meal => {
                        const familyBadge = meal.isShared && <span className="badge badge-workout !py-0">From {meal.ownerName?.split(' ')[0] || 'family'}</span>;

                        if (!hasThingsToBuy(meal)) {
                          // Nothing to choose: shown so the day reads as planned, without a toggle
                          return (
                            <li key={meal.key}>
                              <div className="flex items-center gap-3 px-2 py-2">
                                <span className="size-11 shrink-0 flex items-center justify-center rounded-full bg-surface-sunken text-muted" aria-hidden="true">
                                  <CookingPot size={18} strokeWidth={2.25} />
                                </span>
                                <span className="flex-1 min-w-0 text-muted">
                                  <span className="font-semibold leading-snug line-clamp-2">{meal.name}</span>
                                  <span className="flex flex-wrap items-center gap-1.5 text-xs mt-0.5">
                                    {meal.isLeftover ? 'Leftover · nothing to buy'
                                      : meal.isQuick ? 'Quick meal · add shopping items to it in the planner'
                                      : 'No ingredients listed'}
                                    {familyBadge}
                                  </span>
                                </span>
                              </div>
                              {!meal.isLeftover && !meal.isQuick && (
                                // Beside the row, lined up under the meal name
                                <Link
                                  to={`/recipes?edit=${encodeURIComponent(meal.id)}`}
                                  aria-label={`Add ingredients to ${meal.name}`}
                                  className="inline-flex items-center min-h-9 ml-16 -mt-1 text-xs font-semibold text-main underline underline-offset-2"
                                >
                                  Add ingredients
                                </Link>
                              )}
                            </li>
                          );
                        }

                        const isSelected = selectedMealIds.has(meal.key);
                        const scalable = isSelected && !meal.isQuick;
                        const count = portionsFor(meal);
                        return (
                          <li key={meal.key}>
                            <button
                              onClick={() => handleToggleMeal(meal.key)}
                              aria-pressed={isSelected}
                              className="w-full flex items-center gap-3 px-2 py-2 rounded-[14px] text-left hover:bg-surface-sunken transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--focus-ring)]"
                            >
                              <span className={`size-11 shrink-0 flex items-center justify-center rounded-full border-2 transition-colors ${isSelected
                                ? 'bg-ink border-ink text-on-ink'
                                : 'border-border-control text-transparent'}`}
                              >
                                <Check size={20} strokeWidth={3} aria-hidden="true" />
                              </span>
                              <span className={`flex-1 min-w-0 ${isSelected ? '' : 'text-muted'}`}>
                                <span className="font-semibold leading-snug line-clamp-2">{meal.name}</span>
                                <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted mt-0.5">
                                  {meal.ingredients.length} {meal.isQuick ? 'shopping items' : 'ingredients'}
                                  {familyBadge}
                                </span>
                              </span>
                            </button>
                            {scalable && (
                              // Beside the toggle, not inside it: lines up under the meal name
                              <div className="flex items-center gap-1 ml-16 -mt-1 pb-1">
                                <span className="text-xs text-muted mr-1">Portions</span>
                                <button onClick={() => setMealPortions(meal, Math.max(1, count - 1))} disabled={count <= 1} className="icon-btn hit-target size-8 disabled:text-muted" aria-label={`One portion fewer of ${meal.name}`}><Minus size={16} /></button>
                                <span className="w-6 text-center font-semibold tabular-nums" aria-live="polite">{count}</span>
                                <button onClick={() => setMealPortions(meal, Math.min(20, count + 1))} className="icon-btn hit-target size-8" aria-label={`One portion more of ${meal.name}`}><Plus size={16} /></button>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>

            {buyableMeals.length === 0 && (
              <p className="text-sm text-muted text-center">
                Nothing to buy for the planned meals yet. Add ingredients to their recipes or shopping items to quick meals.
              </p>
            )}

            {stickyAction(
              <button
                onClick={handleAnalyzeIngredients}
                disabled={isProcessing || chosenMeals.length === 0}
                className="btn-primary btn-lg shadow-[var(--elev-md)]"
              >
                {isProcessing ? <span className="spinner spinner-sm" aria-hidden="true" /> : <ListChecks size={20} aria-hidden="true" />}
                {isProcessing ? 'Reading recipes…' : `${hasList ? 'Rebuild' : 'Build'} list from ${chosenMeals.length} ${chosenMeals.length === 1 ? 'meal' : 'meals'}`}
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-5 pb-20">
        {stepBar}
        {errorNotice}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => (phase === 'requirements' ? handleGenerateShoppingList() : initializeShoppingList())}
            className="btn-primary btn-sm"
          >
            Try again
          </button>
          {phase === 'requirements' && (
            <button onClick={() => setError(null)} className="btn-ghost btn-sm">
              <ArrowLeft size={16} aria-hidden="true" /> Back to the pantry
            </button>
          )}
        </div>
      </div>
    );
  }

  // Phase 1: Pantry check
  if (phase === 'requirements') {
    return (
      <div className="space-y-5 pb-20">
        {stepBar}

        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="heading-2">Check your pantry</h2>
            <p className="text-sm text-muted mt-0.5">
              Tap anything you already have · <span className="tabular-nums">{needToBuyItems.length}</span> to buy, <span className="tabular-nums">{inPantryItems.length}</span> at home
            </p>
          </div>
          <button onClick={() => setConfirmingReset(true)} className="btn-ghost btn-sm shrink-0">
            <RotateCcw size={16} aria-hidden="true" /> Start over
          </button>
        </div>

        <ul className="card px-2 md:px-3 py-2 grid md:grid-cols-2 md:gap-x-4">
          {aggregatedIngredients.map(ingredient => (
            <IngredientReviewCard
              key={ingredient.name}
              ingredient={ingredient}
              inPantry={isInPantry(ingredient.name)}
              onTogglePantry={handleTogglePantry}
            />
          ))}
        </ul>

        {needToBuyItems.length === 0 ? (
          <div className="tile tile-neutral items-center text-center py-8">
            <PartyPopper size={28} className="mb-2" aria-hidden="true" />
            <p className="font-semibold">You have everything</p>
            <p className="text-sm text-muted mt-1">Every ingredient is already at home.</p>
          </div>
        ) : stickyAction(
          <button onClick={handleGenerateShoppingList} className="btn-primary btn-lg shadow-[var(--elev-md)]">
            <ShoppingBasket size={20} aria-hidden="true" />
            Make list · {needToBuyItems.length} {needToBuyItems.length === 1 ? 'item' : 'items'}
          </button>
        )}
      </div>
    );
  }

  // Phase 2: Shopping list
  const isPurchased = (item: PurchasableItem) => shoppingState.purchased?.includes(item.ingredientName);
  const toBuy = purchasableItems.filter(item => !isPurchased(item));
  const inBasket = purchasableItems.filter(item => isPurchased(item));
  const recipesFor = (item: PurchasableItem) =>
    aggregatedIngredients
      .find(ing => ing.name.toLowerCase() === item.ingredientName.toLowerCase())
      ?.recipes.map(r => r.name) || [];
  const renderItem = (item: PurchasableItem, reorderable: boolean) => (
    <ShoppingItem
      key={item.ingredientName}
      item={item}
      recipes={recipesFor(item)}
      isChecked={isPurchased(item)}
      reorderable={reorderable}
      onToggleCheck={() => handleToggleCheck(item.ingredientName)}
      onRemove={() => handleRemoveItem(item.ingredientName)}
      onCopy={() => handleCopyItem(item)}
      onUpdate={(val) => handleUpdateItem(item.ingredientName, val)}
    />
  );
  const listActions = (
    <div className="flex justify-end gap-1">
      {aggregatedIngredients.length > 0 && (
        <button onClick={() => goToStep('requirements')} className="btn-ghost btn-sm">
          <ArrowLeft size={16} aria-hidden="true" /> Pantry
        </button>
      )}
      <button onClick={() => setConfirmingReset(true)} className="btn-ghost btn-sm">
        <RotateCcw size={16} aria-hidden="true" /> Start over
      </button>
    </div>
  );

  return (
    <div className="space-y-5 pb-20">
      {stepBar}

      {purchasableItems.length === 0 ? (
        <>
          {/* No heading: the Planner's "Shopping list" tab already names this page */}
          {listActions}
          <div className="tile tile-neutral items-center text-center py-12">
            <PartyPopper size={28} className="mb-2" aria-hidden="true" />
            <p className="font-semibold">Nothing to buy</p>
            <p className="text-sm text-muted mt-1">You already have everything you need.</p>
          </div>
        </>
      ) : (
        <>
          {/* What's left to buy is the page's one bold block */}
          <section className="hero p-5 md:p-6 flex flex-col gap-4" aria-label="Shopping progress">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[15px] font-bold">{toBuy.length === 0 ? 'All in the basket' : 'Left to buy'}</p>
              <p className="text-sm font-medium tabular-nums">{inBasket.length} of {purchasableItems.length} in the basket</p>
            </div>
            <p className="font-display font-extrabold text-[80px] leading-[0.9] tracking-[-0.05em] tabular-nums">
              {toBuy.length}<span className="sr-only"> {toBuy.length === 1 ? 'item' : 'items'} left to buy</span>
            </p>
            <div className="h-2.5 rounded-full bg-current/20 overflow-hidden" aria-hidden="true">
              <div className="h-full rounded-full bg-current transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${(inBasket.length / purchasableItems.length) * 100}%` }} />
            </div>
            {toBuy.length > 0 && (
              <button
                onClick={handleCopyList}
                className="btn-base btn-block min-h-[52px] text-base hover:opacity-90"
                style={{ background: 'var(--hero-foreground)', color: 'var(--hero)' }}
              >
                {listCopied ? <CopyCheck size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
                {listCopied ? 'Copied' : 'Copy list'}
              </button>
            )}
          </section>
          <div className="-mt-2">{listActions}</div>

          {toBuy.length > 0 ? (
            <Reorder.Group axis="y" values={toBuy} onReorder={handleReorder} className="card px-2 md:px-3 py-2">
              {toBuy.map(item => renderItem(item, true))}
            </Reorder.Group>
          ) : (
            <div className="tile tile-neutral items-center text-center py-8">
              <PartyPopper size={28} className="mb-2" aria-hidden="true" />
              <p className="font-semibold">All done</p>
              <p className="text-sm text-muted mt-1">Everything's in the basket. Time to head home.</p>
            </div>
          )}

          {inBasket.length > 0 && (
            <section>
              <h3 className="font-sans text-xs font-semibold text-muted px-2 pb-1.5">In the basket · {inBasket.length}</h3>
              <ul className="card px-2 md:px-3 py-2">
                {inBasket.map(item => renderItem(item, false))}
              </ul>
            </section>
          )}
        </>
      )}

      {lastRemoved && stickyAction(
        <div className="flex items-center gap-1 rounded-full bg-ink text-on-ink pl-5 pr-1.5 py-1.5 shadow-[var(--elev-md)]" role="status">
          <span className="text-sm font-semibold truncate max-w-[55vw] first-letter:uppercase">Removed {lastRemoved.item.ingredientName}</span>
          <button onClick={handleUndoRemove} className="btn-base min-h-10 px-4 rounded-full text-sm font-bold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--on-ink)]">
            Undo
          </button>
        </div>
      )}
    </div>
  );
};
