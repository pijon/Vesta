import React, { useState, useEffect, useRef } from 'react';
import { shoppingData } from '../services/pageData';
import { ensureWarm, peekWarm } from '../utils/prewarm';
import { Reorder } from 'framer-motion';
import {
  getFamilyPlansInRange,
  getPantryInventory,
  addToPantry,
  removeFromPantry,
  getEnhancedShoppingState,
  saveEnhancedShoppingState,
  migrateShoppingState
} from '../services/storageService';
import { parseIngredients, convertToPurchasableQuantities } from '../services/geminiService';
import { ParsedIngredient, AggregatedIngredient, PurchasableItem } from '../types';
import { IngredientReviewCard } from './IngredientReviewCard';
import ShoppingItem from './ShoppingItem';
import { localDateString } from '../utils/dateUtils';
import { AlertCircle, ArrowLeft, CalendarDays, Check, Copy, CopyCheck, ListChecks, PartyPopper, RotateCcw, ShoppingBasket } from 'lucide-react';

type Phase = 'selection' | 'requirements' | 'shopping';

interface PlanMeal {
  id: string;
  name: string;
  date: string;
  ingredients: string[];
  servings?: number;
  cookingServings?: number;

  isLeftover?: boolean;
  isShared?: boolean;
  ownerName?: string;
}

export const ShoppingList: React.FC = () => {
  const [phase, setPhase] = useState<Phase>('selection');
  const [availableMeals, setAvailableMeals] = useState<PlanMeal[]>([]);
  const [selectedMealIds, setSelectedMealIds] = useState<Set<string>>(new Set());

  // Keep existing state for downstream phases
  const [parsedIngredients, setParsedIngredients] = useState<ParsedIngredient[]>([]);
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
  const [inventory, setInventory] = useState<{ items: Array<{ name: string }> }>({ items: [] });
  const [shoppingState, setShoppingState] = useState<{
    purchased: string[], // Keeping for backward compatibility but unused in UI
    removed: string[],
    lastGeneratedDate: string,
    cachedPurchasableItems: PurchasableItem[],
    cachedParsedIngredients: ParsedIngredient[],
    cachedAggregatedIngredients: AggregatedIngredient[],
    ingredientsHash: string,
    selectedMealIds?: string[]
  }>({
    purchased: [],
    removed: [],
    lastGeneratedDate: '',
    cachedPurchasableItems: [],
    cachedParsedIngredients: [],
    cachedAggregatedIngredients: [],
    ingredientsHash: ''
  });

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

    // We only want to save if the order/content significantly changed or if we just need to sync
    // Simple debounce to prevent saving on every drag frame
    const timeoutId = setTimeout(async () => {
      // Only save if different to prevent loops, though simpler to just save for now
      // This will run 1s after the LAST change
      const newState = {
        ...shoppingState,
        cachedPurchasableItems: purchasableItems
      };

      // We don't need to await this
      saveEnhancedShoppingState(newState).catch(console.error);

      // Update local shopping state wrapper if needed, but risky if it triggers re-renders loop
      // Actually, we should just update the internal shoppingState ref without causing loop if possible
      // But setShoppingState is fine as long as purchasableItems doesn't change from it
      setShoppingState(prev => ({ ...prev, cachedPurchasableItems: purchasableItems }));

    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [purchasableItems]);

  // Simple hash function for ingredients from selected meals
  const hashIngredients = (ingredients: Array<{ text: string, recipeId: string, recipeName: string }>): string => {
    return ingredients.map(i => `${i.text}|${i.recipeId}`).join('::');
  };

  /** Planned meals for the next two weeks, from the whole family's plan (loaded in the background after sign-in). */
  const loadPlannedMeals = async (fresh = false) => extractMealsFromPlan((await ensureWarm(shoppingData, fresh)).plans);

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
      const added = meals.filter(m => !knownMealIds.current.has(m.id)).map(m => m.id);
      knownMealIds.current = new Set(meals.map(m => m.id));
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
      const mealsPromise = Promise.resolve(extractMealsFromPlan(warm.plans));

      setShoppingState(enhancedState);
      setInventory(pantryInventory);

      if (enhancedState.cachedPurchasableItems.length > 0) {
        // We have an active list, restore it (without the items the user removed)
        const visibleItems = enhancedState.cachedPurchasableItems.filter(
          item => !enhancedState.removed.includes(item.ingredientName)
        );

        setPurchasableItems(visibleItems);
        setParsedIngredients(enhancedState.cachedParsedIngredients);
        setAggregatedIngredients(enhancedState.cachedAggregatedIngredients);
        if (enhancedState.selectedMealIds) setSelectedMealIds(new Set(enhancedState.selectedMealIds));
        setPhase('shopping');
        setIsProcessing(false);

        const meals = await mealsPromise;
        setAvailableMeals(meals);
        knownMealIds.current = new Set(meals.map(m => m.id));
        // Legacy lists saved no selection: treat every planned meal as selected
        if (!enhancedState.selectedMealIds) setSelectedMealIds(new Set(meals.map(m => m.id)));
      } else {
        // No active list, start fresh in selection mode with every meal selected
        setLoadingMessage('Loading meal plan...');
        const meals = await mealsPromise;
        setAvailableMeals(meals);
        knownMealIds.current = new Set(meals.map(m => m.id));
        setSelectedMealIds(new Set(meals.map(m => m.id)));
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

  const getLocalMidnight = (dateStr: string): Date => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const extractMealsFromPlan = (plan: Record<string, any>): PlanMeal[] => {
    const meals: PlanMeal[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sortedDates = Object.keys(plan).sort();

    sortedDates.forEach(dateStr => {
      // Use robust local date comparison
      const dayDate = getLocalMidnight(dateStr);

      if (dayDate >= today) {
        const day = plan[dateStr];
        day.meals.forEach((meal: any) => {
          meals.push({
            id: meal.id,
            name: meal.name,
            date: day.date,
            ingredients: Array.isArray(meal.ingredients) ? meal.ingredients : [],
            servings: meal.servings,
            cookingServings: meal.cookingServings,

            isLeftover: meal.isLeftover,
            isShared: meal.isShared,
            ownerName: meal.ownerName
          });
        });
      }
    });
    return meals;
  };

  const handleAnalyzeIngredients = async () => {
    try {
      setIsProcessing(true);
      setLoadingMessage('Analyzing ingredients with AI...');
      setError(null);

      // Filter meals based on selection
      const selectedMeals = availableMeals.filter(meal => selectedMealIds.has(meal.id));

      if (selectedMeals.length === 0) {
        setError("Please select at least one meal to generate a list.");
        setIsProcessing(false);
        return;
      }

      // Save selection state
      const newShoppingState = {
        ...shoppingState,
        selectedMealIds: Array.from(selectedMealIds)
      };
      setShoppingState(newShoppingState);
      await saveEnhancedShoppingState(newShoppingState);

      // Extract ingredients from selected meals
      const ingredientsToProcess: Array<{ text: string, recipeId: string, recipeName: string, scale: number }> = [];
      selectedMeals.forEach(meal => {
        // Skip ingredients for leftovers
        if (meal.isLeftover) {
          console.log(`Skipping ingredients for leftover meal: ${meal.name}`);
          return;
        }

        // Calculate scale factor: cookingServings / servings. Default to 1 if missing.
        const baseServings = meal.servings || 1;
        const targetServings = meal.cookingServings || baseServings;
        const scale = targetServings / baseServings;

        console.log(`Scaling ${meal.name}: ${targetServings}/${baseServings} = ${scale}`);

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
    const parsed = await parseIngredients(texts);

    // Safety check: ensure arrays match in length
    if (parsed.length !== ingredientsToProcess.length) {
      console.warn(`Array length mismatch: ${parsed.length} parsed vs ${ingredientsToProcess.length} raw ingredients`);
      // Use the shorter length to avoid index errors
      const safeLength = Math.min(parsed.length, ingredientsToProcess.length);
      parsed.splice(safeLength);
    }

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

    setParsedIngredients(parsedWithRecipeInfo);

    // Aggregate by ingredient name
    const aggregated = aggregateIngredients(parsedWithRecipeInfo);
    setAggregatedIngredients(aggregated);

    // Cache the results
    const currentHash = hashIngredients(ingredientsToProcess);
    const newState = {
      ...shoppingState,
      cachedParsedIngredients: parsedWithRecipeInfo,
      cachedAggregatedIngredients: aggregated,
      ingredientsHash: currentHash,
      selectedMealIds: Array.from(selectedMealIds) // Ensure selection is saved with cache
    };

    await saveEnhancedShoppingState(newState);
    setShoppingState(newState);
  };

  const aggregateIngredients = (parsed: ParsedIngredient[]): AggregatedIngredient[] => {
    const map = new Map<string, AggregatedIngredient>();

    parsed.forEach(ing => {
      const existing = map.get(ing.name);

      if (existing) {
        // Check if same unit before aggregating
        if (existing.unit === ing.unit) {
          existing.totalQuantity += ing.quantity;
        } else {
          // Different units - keep separate with unit in name
          const uniqueName = `${ing.name} (${ing.unit})`;
          if (!map.has(uniqueName)) {
            map.set(uniqueName, {
              name: uniqueName,
              totalQuantity: ing.quantity,
              unit: ing.unit,
              recipes: [{ id: ing.recipeId, name: ing.recipeName, quantity: ing.quantity }],
              originalIngredients: [ing]
            });
          } else {
            const existing = map.get(uniqueName)!;
            existing.totalQuantity += ing.quantity;
            const recipeRef = existing.recipes.find(r => r.id === ing.recipeId);
            if (recipeRef) {
              recipeRef.quantity += ing.quantity;
            } else {
              existing.recipes.push({ id: ing.recipeId, name: ing.recipeName, quantity: ing.quantity });
            }
            existing.originalIngredients.push(ing);
          }
          return;
        }

        // Add recipe reference
        const recipeRef = existing.recipes.find(r => r.id === ing.recipeId);
        if (recipeRef) {
          recipeRef.quantity += ing.quantity;
        } else {
          existing.recipes.push({ id: ing.recipeId, name: ing.recipeName, quantity: ing.quantity });
        }

        existing.originalIngredients.push(ing);
      } else {
        map.set(ing.name, {
          name: ing.name,
          totalQuantity: ing.quantity,
          unit: ing.unit,
          recipes: [{ id: ing.recipeId, name: ing.recipeName, quantity: ing.quantity }],
          originalIngredients: [ing]
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  };

  const handleTogglePantry = async (ingredientName: string, inPantry: boolean) => {
    if (inPantry) {
      await addToPantry(ingredientName, true);
    } else {
      await removeFromPantry(ingredientName);
    }

    // Refresh inventory
    setInventory(await getPantryInventory());
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

      const purchasable = await convertToPurchasableQuantities(simplified);
      setPurchasableItems(purchasable);

      // Cache results
      const today = localDateString();
      const newState = {
        ...shoppingState,
        lastGeneratedDate: today,
        cachedPurchasableItems: purchasable,
        removed: [], // Clear removed items on new generation
      };

      await saveEnhancedShoppingState(newState);
      setShoppingState(newState);

      setPhase('shopping');
      setIsProcessing(false);

    } catch (err) {
      console.error('Error generating shopping list:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate shopping list');
      setIsProcessing(false);
    }
  };

  const handleRemoveItem = async (ingredientName: string) => {
    const newState = {
      ...shoppingState,
      removed: [...shoppingState.removed, ingredientName],
    };

    setShoppingState(newState);
    await saveEnhancedShoppingState(newState);

    // Update UI local state for immediate list removal
    setPurchasableItems(purchasableItems.filter(item => item.ingredientName !== ingredientName));
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

      // Persist to cache
      const newState = {
        ...shoppingState,
        cachedPurchasableItems: currentItems
      };
      setShoppingState(newState);
      await saveEnhancedShoppingState(newState);
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
    const isChecked = shoppingState.purchased.includes(ingredientName);
    let newPurchased;

    if (isChecked) {
      newPurchased = shoppingState.purchased.filter(n => n !== ingredientName);
    } else {
      newPurchased = [...shoppingState.purchased, ingredientName];
    }

    // Immediate UI update via local state if needed (purchasableItems doesn't track check status directly, handled by lookup below)

    const newState = {
      ...shoppingState,
      purchased: newPurchased
    };

    setShoppingState(newState);
    await saveEnhancedShoppingState(newState);
  };

  const handleCopyItem = (item: PurchasableItem) => {
    if (navigator.clipboard) {
      const text = `${item.purchasableQuantity || item.requiredQuantity} ${item.ingredientName}`;
      navigator.clipboard.writeText(text).catch(err => {
        console.error('Failed to copy to clipboard:', err);
      });
    }
  };

  const handleResetList = async () => {
    if (confirm('This will clear all shopping list data and start fresh from selection. Continue?')) {
      const newState = {
        pantryChecks: {},
        purchased: [],
        removed: [],
        lastGeneratedDate: '',
        cachedPurchasableItems: [],
        cachedParsedIngredients: [],
        cachedAggregatedIngredients: [],
        ingredientsHash: '',
        selectedMealIds: []
      };

      await saveEnhancedShoppingState(newState);
      setShoppingState(newState);
      setInventory(await getPantryInventory()); // Refresh inventory too just in case

      setPhase('selection');
      setPurchasableItems([]);
      setParsedIngredients([]);
      setAggregatedIngredients([]);
      setIsProcessing(false);

      // Default select all again when resetting
      setSelectedMealIds(new Set(availableMeals.map(m => m.id)));
    }
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

  const handleSelectAll = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedMealIds(new Set(availableMeals.map(m => m.id)));
    } else {
      setSelectedMealIds(new Set());
    }
  };

  // Calculate pantry counts
  const inPantryItems = aggregatedIngredients.filter(ing => isInPantry(ing.name));
  const needToBuyItems = aggregatedIngredients.filter(ing => !isInPantry(ing.name));

  // Step indicator shared by every phase
  const STEPS: { phase: Phase; label: string }[] = [
    { phase: 'selection', label: 'Choose meals' },
    { phase: 'requirements', label: 'Check pantry' },
    { phase: 'shopping', label: 'Shop' },
  ];
  const stepIndex = STEPS.findIndex(st => st.phase === phase);
  const stepBar = (
    <nav aria-label="Shopping list steps">
      <ol className="flex gap-1.5">
        {STEPS.map((step, i) => (
          <li key={step.phase} className="flex-1 min-w-0" aria-current={i === stepIndex ? 'step' : undefined}>
            <span className={`block h-1.5 rounded-full ${i <= stepIndex ? 'bg-primary' : 'bg-surface-sunken'}`} />
            <span className={`block mt-1.5 text-xs font-semibold truncate ${i === stepIndex ? 'text-main' : 'text-muted'}`}>
              {i + 1}. {step.label}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );

  // Sticky footer for each phase's main action, kept clear of the bottom nav
  const stickyAction = (children: React.ReactNode) => (
    <div className="sticky bottom-24 z-20 flex justify-center pt-4 pointer-events-none">
      <div className="pointer-events-auto">{children}</div>
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
          <span className="spinner spinner-lg text-primary mb-4" aria-hidden="true" />
          <p className="font-semibold">{loadingMessage || 'Working on your list…'}</p>
        </div>
      </div>
    );
  }

  // Phase 0: Selection
  if (phase === 'selection') {
    const mealsByDate = new Map<string, PlanMeal[]>();
    availableMeals.forEach(meal => {
      if (!mealsByDate.has(meal.date)) mealsByDate.set(meal.date, []);
      mealsByDate.get(meal.date)!.push(meal);
    });
    const selectedIngredientCount = availableMeals
      .filter(m => selectedMealIds.has(m.id) && !m.isLeftover)
      .reduce((sum, m) => sum + m.ingredients.length, 0);

    return (
      <div className="space-y-5 pb-20">
        {stepBar}

        {availableMeals.length === 0 ? (
          <div className="tile tile-neutral items-center text-center py-12">
            <CalendarDays size={28} className="text-muted mb-3" aria-hidden="true" />
            <p className="font-semibold">No meals planned yet</p>
            <p className="text-sm text-muted mt-1">Plan a few meals for the week and your shopping list builds itself.</p>
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="heading-2">Choose meals</h2>
                <p className="text-sm text-muted mt-0.5">
                  {selectedMealIds.size} of {availableMeals.length} meals · {selectedIngredientCount} ingredients
                </p>
              </div>
              <button
                onClick={() => handleSelectAll(selectedMealIds.size !== availableMeals.length)}
                className="btn-ghost btn-sm shrink-0"
              >
                {selectedMealIds.size === availableMeals.length ? 'Clear all' : 'Select all'}
              </button>
            </div>

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
                        const isSelected = selectedMealIds.has(meal.id);
                        return (
                          <li key={meal.id}>
                            <button
                              onClick={() => handleToggleMeal(meal.id)}
                              aria-pressed={isSelected}
                              className="w-full flex items-center gap-3 px-2 py-2 rounded-[14px] text-left hover:bg-surface-sunken transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--focus-ring)]"
                            >
                              <span className={`size-11 shrink-0 flex items-center justify-center rounded-full border-2 transition-colors ${isSelected
                                ? 'bg-primary border-primary text-primary-foreground'
                                : 'border-border-control text-transparent'}`}
                              >
                                <Check size={20} strokeWidth={3} aria-hidden="true" />
                              </span>
                              <span className={`flex-1 min-w-0 ${isSelected ? '' : 'text-muted'}`}>
                                <span className="block font-semibold leading-snug line-clamp-2">{meal.name}</span>
                                <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted mt-0.5">
                                  {meal.isLeftover
                                    ? 'Leftover · nothing to buy'
                                    : meal.ingredients.length > 0 ? `${meal.ingredients.length} ingredients` : 'No ingredients listed'}
                                  {meal.isShared && <span className="badge badge-workout !py-0">From {meal.ownerName?.split(' ')[0] || 'family'}</span>}
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>

            {stickyAction(
              <button
                onClick={handleAnalyzeIngredients}
                disabled={isProcessing || selectedMealIds.size === 0}
                className="btn-primary btn-lg shadow-[var(--elev-md)]"
              >
                {isProcessing ? <span className="spinner spinner-sm" aria-hidden="true" /> : <ListChecks size={20} aria-hidden="true" />}
                {isProcessing ? 'Reading recipes…' : `Build list from ${selectedMealIds.size} ${selectedMealIds.size === 1 ? 'meal' : 'meals'}`}
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
        <div className="rounded-[18px] bg-error-bg p-6 text-center" role="alert">
          <AlertCircle size={28} className="text-error mx-auto mb-3" aria-hidden="true" />
          <p className="font-semibold">We couldn't build your list</p>
          <p className="text-sm text-muted mt-1">{error}</p>
          <button onClick={() => initializeShoppingList()} className="btn-primary btn-sm mt-4">
            Try again
          </button>
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
            <p className="text-sm text-muted mt-0.5">Tap anything you already have at home.</p>
          </div>
          <button onClick={handleResetList} className="btn-ghost btn-sm shrink-0">
            <RotateCcw size={16} aria-hidden="true" /> Start over
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 md:gap-3">
          <div className="tile tile-calories">
            <span className="text-sm font-semibold">To buy</span>
            <span className="font-display font-extrabold text-3xl leading-9">{needToBuyItems.length}</span>
          </div>
          <div className="tile tile-weight">
            <span className="text-sm font-semibold">In your pantry</span>
            <span className="font-display font-extrabold text-3xl leading-9">{inPantryItems.length}</span>
          </div>
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
          <div className="tile tile-weight items-center text-center py-8">
            <PartyPopper size={28} className="mb-2" aria-hidden="true" />
            <p className="font-semibold">You have everything</p>
            <p className="text-sm mt-1">Every ingredient is already in your pantry.</p>
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

  return (
    <div className="space-y-5 pb-20">
      {stepBar}

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h2 className="heading-2">Shopping list</h2>
          <p className="text-sm text-muted mt-0.5">
            {purchasableItems.length === 0
              ? 'Nothing to buy'
              : toBuy.length === 0
                ? `All ${purchasableItems.length} items in the basket`
                : `${inBasket.length} of ${purchasableItems.length} in the basket`}
          </p>
        </div>
        <div className="flex gap-1">
          {toBuy.length > 0 && (
            <button onClick={handleCopyList} className="btn-secondary btn-sm">
              {listCopied ? <CopyCheck size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
              {listCopied ? 'Copied' : 'Copy list'}
            </button>
          )}
          <button onClick={() => setPhase('requirements')} className="btn-ghost btn-sm">
            <ArrowLeft size={16} aria-hidden="true" /> Pantry
          </button>
          <button onClick={handleResetList} className="btn-ghost btn-sm !px-3" aria-label="Start over">
            <RotateCcw size={16} aria-hidden="true" /> <span className="hidden md:inline">Start over</span>
          </button>
        </div>
      </div>

      {purchasableItems.length > 0 && (
        <div className="h-2 rounded-full bg-surface-sunken overflow-hidden" role="img" aria-label={`${inBasket.length} of ${purchasableItems.length} items in the basket`}>
          <div className="h-full rounded-full bg-secondary transition-[width] duration-300" style={{ width: `${(inBasket.length / purchasableItems.length) * 100}%` }} />
        </div>
      )}

      {purchasableItems.length === 0 ? (
        <div className="tile tile-weight items-center text-center py-12">
          <PartyPopper size={28} className="mb-2" aria-hidden="true" />
          <p className="font-semibold">Nothing to buy</p>
          <p className="text-sm mt-1">You already have everything you need.</p>
        </div>
      ) : (
        <>
          {toBuy.length > 0 ? (
            <Reorder.Group axis="y" values={toBuy} onReorder={handleReorder} className="card px-2 md:px-3 py-2">
              {toBuy.map(item => renderItem(item, true))}
            </Reorder.Group>
          ) : (
            <div className="tile tile-weight items-center text-center py-8">
              <PartyPopper size={28} className="mb-2" aria-hidden="true" />
              <p className="font-semibold">All done</p>
              <p className="text-sm mt-1">Everything's in the basket. Time to head home.</p>
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
    </div>
  );
};
