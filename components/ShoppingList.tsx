import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  getUpcomingPlan,
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

type Phase = 'selection' | 'requirements' | 'shopping';

interface PlanMeal {
  id: string;
  name: string;
  date: string;
  ingredients: string[];
  servings?: number;
  cookingServings?: number;
}

export const ShoppingList: React.FC = () => {
  const [phase, setPhase] = useState<Phase>('selection');
  const [availableMeals, setAvailableMeals] = useState<PlanMeal[]>([]);
  const [selectedMealIds, setSelectedMealIds] = useState<Set<string>>(new Set());

  // Keep existing state for downstream phases
  const [parsedIngredients, setParsedIngredients] = useState<ParsedIngredient[]>([]);
  const [aggregatedIngredients, setAggregatedIngredients] = useState<AggregatedIngredient[]>([]);
  const [purchasableItems, setPurchasableItems] = useState<PurchasableItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');

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

  // Initialize component
  useEffect(() => {
    initializeShoppingList();
  }, []);

  // Simple hash function for ingredients from selected meals
  const hashIngredients = (ingredients: Array<{ text: string, recipeId: string, recipeName: string }>): string => {
    return ingredients.map(i => `${i.text}|${i.recipeId}`).join('::');
  };

  const initializeShoppingList = async () => {
    try {
      setIsProcessing(true);
      setLoadingMessage('Loading meal plan...');
      setError(null);

      // Migrate old shopping state if needed
      migrateShoppingState();

      // Extract meals from weekly plan
      const plan = await getUpcomingPlan(14); // Get next 2 weeks
      const meals = extractMealsFromPlan(plan);
      setAvailableMeals(meals);

      // Load persistence data
      const [enhancedState, pantryInventory] = await Promise.all([
        getEnhancedShoppingState(),
        getPantryInventory()
      ]);

      setShoppingState(enhancedState);
      setInventory(pantryInventory);

      // Determine initial phase and selection
      if (enhancedState.cachedPurchasableItems.length > 0) {
        // We have an active list, restore it
        // Filter out removed items from the cached list
        const visibleItems = enhancedState.cachedPurchasableItems.filter(
          item => !enhancedState.removed.includes(item.ingredientName)
        );

        setPurchasableItems(visibleItems);
        setParsedIngredients(enhancedState.cachedParsedIngredients);
        setAggregatedIngredients(enhancedState.cachedAggregatedIngredients);

        // Restore selection if saved, otherwise default to all used in cache (implicit) or just all
        if (enhancedState.selectedMealIds) {
          setSelectedMealIds(new Set(enhancedState.selectedMealIds));
        } else {
          // Fallback: select all if we have a list but no selection state (legacy support)
          setSelectedMealIds(new Set(meals.map(m => m.id)));
        }

        setPhase('shopping');
      } else {
        // No active list, start fresh in selection mode
        // Default to selecting ALL meals
        setSelectedMealIds(new Set(meals.map(m => m.id)));
        setPhase('selection');
      }

      setIsProcessing(false);

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
            cookingServings: meal.cookingServings
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
      const today = new Date().toISOString().split('T')[0];
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

  // Phase 0: Selection
  if (phase === 'selection') {
    // Group available meals by date for nicer display
    const mealsByDate = new Map<string, PlanMeal[]>();
    availableMeals.forEach(meal => {
      if (!mealsByDate.has(meal.date)) {
        mealsByDate.set(meal.date, []);
        mealsByDate.get(meal.date)!.push(meal);
      } else {
        mealsByDate.get(meal.date)!.push(meal);
      }
    });

    return (
      <div className="space-y-8 pb-20 animate-fade-in">
        {/* Info Card */}
        {availableMeals.length === 0 ? (
          <div className="p-12 text-center text-charcoal/60 dark:text-stone-400 bg-white dark:bg-white/5 rounded-2xl border border-dashed border-border">
            <div className="text-4xl mb-4">🍽️</div>
            <p className="text-lg font-medium text-charcoal dark:text-stone-200 mb-2">No meals found</p>
            <p className="text-sm">Go to the Planner to add meals for the upcoming week.</p>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4">
              <h3 className="heading-4">Planned Meals ({availableMeals.length})</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSelectAll(true)}
                  className="text-sm text-primary font-semibold hover:bg-primary/5 px-2 py-1 rounded transition-colors"
                >
                  Select All
                </button>
                <span className="text-border">|</span>
                <button
                  onClick={() => handleSelectAll(false)}
                  className="text-sm text-charcoal/60 dark:text-stone-400 hover:text-charcoal dark:text-stone-200 px-2 py-1 rounded transition-colors"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {Array.from(mealsByDate.entries()).sort().map(([date, meals]) => (
                <div key={date} className="space-y-3">
                  <h4 className="text-sm font-bold text-charcoal/60 dark:text-stone-400 uppercase tracking-wider pl-1">
                    {new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </h4>
                  <div className="grid gap-3 md:gap-4">
                    {meals.map(meal => {
                      const isSelected = selectedMealIds.has(meal.id);
                      return (
                        <div
                          key={meal.id}
                          onClick={() => handleToggleMeal(meal.id)}
                          className={`
                                        group flex items-center justify-between p-5 rounded-xl border cursor-pointer transition-all duration-200
                                        ${isSelected
                              ? 'bg-primary/5 border-primary shadow-sm'
                              : 'bg-white dark:bg-white/5 border-border hover:border-primary/50 hover:shadow-md'
                            }
                                      `}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`
                                              w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors
                                              ${isSelected ? 'bg-primary border-primary' : 'border-muted group-hover:border-primary/50'}
                                          `}>
                              {isSelected && (
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                                  <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                              )}
                            </div>

                            <div>
                              <div className={`font-medium text-lg ${isSelected ? 'text-primary' : 'text-charcoal dark:text-stone-200'}`}>
                                {meal.name}
                              </div>
                              <div className="text-sm text-charcoal/60 dark:text-stone-400 mt-1">
                                {meal.ingredients.length > 0
                                  ? `${meal.ingredients.length} ingredients`
                                  : 'No ingredients listed'
                                }
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Generate Button */}
            <div className="sticky bottom-6 flex justify-center pt-8 pb-4 z-20 pointer-events-none">
              <div className="bg-white dark:bg-white/5/90 backdrop-blur-md p-2 rounded-2xl shadow-lg border border-white/10 pointer-events-auto">
                <button
                  onClick={handleAnalyzeIngredients}
                  disabled={isProcessing || selectedMealIds.size === 0}
                  className={`
                            btn-primary btn-lg flex items-center gap-3 px-8 shadow-md
                            ${(isProcessing || selectedMealIds.size === 0) ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}
                        `}
                >
                  {isProcessing ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path>
                      </svg>
                      <span>Generate List ({selectedMealIds.size})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}

      </div>
    );
  }

  // Loading state
  if (isProcessing) {
    return (
      <div className="space-y-8 pb-20 animate-fade-in">
        <div className="p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-border border-t-primary mb-4"></div>
          <p className="text-charcoal/60 dark:text-stone-400 font-medium">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-8 pb-20 animate-fade-in">
        <div className="p-8 text-center text-error bg-error-bg rounded-2xl border border-error-border">
          <div className="text-3xl mb-2">⚠️</div>
          <p className="font-medium mb-2">Error</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={() => initializeShoppingList()}
            className="btn-primary mt-4"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }


  // Phase 1: Requirements Review
  if (phase === 'requirements') {
    return (
      <div className="space-y-8 pb-20 animate-fade-in">
        <div className="flex justify-end mb-4">
          <button
            onClick={handleResetList}
            className="text-sm font-semibold text-charcoal dark:text-stone-200 bg-white dark:bg-white/5 border border-border px-4 py-2 rounded-xl hover:bg-stone-50 dark:bg-[#1A1714] transition-colors shadow-sm"
          >
            Reset All
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4 md:gap-6">
          <div className="bg-white dark:bg-white/5 border border-primary/20 rounded-2xl p-6 shadow-sm">
            <div className="text-primary text-sm font-medium mb-1 uppercase tracking-wider">In Pantry</div>
            <div className="text-4xl font-bold text-charcoal dark:text-stone-200">{inPantryItems.length}</div>
          </div>
          <div className="bg-white dark:bg-white/5 border border-warning/20 rounded-2xl p-6 shadow-sm">
            <div className="text-warning text-sm font-medium mb-1 uppercase tracking-wider">Need to Buy</div>
            <div className="text-4xl font-bold text-charcoal dark:text-stone-200">{needToBuyItems.length}</div>
          </div>
        </div>

        {/* Ingredients Grid */}
        <div className="grid md:grid-cols-2 gap-4">
          {aggregatedIngredients.map(ingredient => (
            <IngredientReviewCard
              key={ingredient.name}
              ingredient={ingredient}
              inPantry={isInPantry(ingredient.name)}
              onTogglePantry={handleTogglePantry}
            />
          ))}
        </div>

        {/* Generate Button */}
        <div className="flex justify-center pt-8 pb-4">
          {needToBuyItems.length === 0 ? (
            <div className="text-center">
              <div className="text-5xl mb-4">🎉</div>
              <p className="text-xl font-medium text-charcoal dark:text-stone-200 mb-2">You have everything!</p>
              <p className="text-base text-charcoal/60 dark:text-stone-400">All ingredients are in your pantry.</p>
            </div>
          ) : (
            <button
              onClick={handleGenerateShoppingList}
              className="px-10 py-4 bg-primary text-primary-foreground rounded-2xl transition-all text-lg font-semibold shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
            >
              Generate Shopping List ({needToBuyItems.length} items)
            </button>
          )}
        </div>
      </div>
    );
  }

  // Phase 2: Shopping List
  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      <div className="flex justify-end gap-2 mb-4">
        <button
          onClick={() => setPhase('requirements')}
          className="text-sm font-semibold text-charcoal dark:text-stone-200 bg-white dark:bg-white/5 border border-border px-4 py-2 rounded-xl hover:bg-stone-50 dark:bg-[#1A1714] transition-colors"
        >
          ← Back to Review
        </button>
        <button
          onClick={handleResetList}
          className="text-sm font-semibold text-charcoal dark:text-stone-200 bg-white dark:bg-white/5 border border-border px-4 py-2 rounded-xl hover:bg-stone-50 dark:bg-[#1A1714] transition-colors"
        >
          Reset
        </button>
      </div>

      {purchasableItems.length === 0 ? (
        <div className="p-12 text-center text-charcoal/60 dark:text-stone-400 border-2 border-dashed border-border rounded-xl">
          <div className="text-4xl mb-4">✨</div>
          <p className="text-lg font-medium text-charcoal dark:text-stone-200 mb-2">Perfect!</p>
          <p className="text-sm">You already have everything you need.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white dark:bg-white/5 rounded-3xl shadow-sm border border-border overflow-hidden p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-normal text-charcoal dark:text-stone-200 font-serif text-lg">Items to Purchase ({purchasableItems.length})</h3>
            </div>

            <motion.div layout className="grid gap-3">
              <AnimatePresence initial={false} mode="popLayout">
                {purchasableItems.map(item => {
                  const aggIng = aggregatedIngredients.find(ing =>
                    ing.name.toLowerCase() === item.ingredientName.toLowerCase()
                  );
                  const recipeNames = aggIng?.recipes.map(r => r.name) || [];

                  return (
                    <ShoppingItem
                      key={item.ingredientName}
                      item={item}
                      recipes={recipeNames}
                      onRemove={() => handleRemoveItem(item.ingredientName)}
                      onCopy={() => handleCopyItem(item)}
                      onUpdate={(newVal) => handleUpdateItem(item.ingredientName, newVal)}
                    />
                  );
                })}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
};
