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

type Phase = 'raw' | 'requirements' | 'shopping';

export const ShoppingList: React.FC = () => {
  const [phase, setPhase] = useState<Phase>('raw');
  const [rawIngredients, setRawIngredients] = useState<Array<{ text: string, recipeId: string, recipeName: string }>>([]);
  const [parsedIngredients, setParsedIngredients] = useState<ParsedIngredient[]>([]);
  const [aggregatedIngredients, setAggregatedIngredients] = useState<AggregatedIngredient[]>([]);
  const [purchasableItems, setPurchasableItems] = useState<PurchasableItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [totalPlannedMeals, setTotalPlannedMeals] = useState(0);

  // Persistence State
  const [inventory, setInventory] = useState<{ items: Array<{ name: string }> }>({ items: [] });
  const [shoppingState, setShoppingState] = useState<{
    purchased: string[],
    removed: string[],
    lastGeneratedDate: string,
    cachedPurchasableItems: PurchasableItem[],
    cachedParsedIngredients: ParsedIngredient[],
    cachedAggregatedIngredients: AggregatedIngredient[],
    ingredientsHash: string
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

  // Simple hash function for ingredients
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

      // Extract ingredients from weekly plan
      const plan = await getUpcomingPlan(14); // Get next 2 weeks

      // Calculate meal count with robust date check
      const mealCount = countMealsInPlan(plan);
      setTotalPlannedMeals(mealCount);

      const extractedIngredients = extractIngredientsFromPlan(plan);

      if (extractedIngredients.length === 0) {
        setIsProcessing(false);
        setPhase('raw');
        // If we have meals but no ingredients, we still return to let the render handle it
        return;
      }

      setRawIngredients(extractedIngredients);

      // Load persistence data
      const [enhancedState, pantryInventory] = await Promise.all([
        getEnhancedShoppingState(),
        getPantryInventory()
      ]);

      setShoppingState(enhancedState);
      setInventory(pantryInventory);

      // Check if we have cached analysis for these ingredients
      const currentHash = hashIngredients(extractedIngredients);

      if (enhancedState.ingredientsHash === currentHash &&
        enhancedState.cachedParsedIngredients.length > 0 &&
        enhancedState.cachedAggregatedIngredients.length > 0) {
        // Load from cache
        setLoadingMessage('Loading cached analysis...');
        setParsedIngredients(enhancedState.cachedParsedIngredients);
        setAggregatedIngredients(enhancedState.cachedAggregatedIngredients);

        if (enhancedState.cachedPurchasableItems.length > 0) {
          setPurchasableItems(enhancedState.cachedPurchasableItems);
          setPhase('shopping');
        } else {
          setPhase('requirements');
        }
      } else {
        // Ingredients changed, stay on raw phase
        setPhase('raw');
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

  const countMealsInPlan = (plan: Record<string, any>): number => {
    let count = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    Object.values(plan).forEach(day => {
      // Use robust local date comparison
      if (getLocalMidnight(day.date) >= today) {
        count += day.meals.length;
      }
    });
    return count;
  };

  const extractIngredientsFromPlan = (plan: Record<string, any>): Array<{ text: string, recipeId: string, recipeName: string }> => {
    const ingredients: Array<{ text: string, recipeId: string, recipeName: string }> = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    Object.values(plan).forEach(day => {
      const dayDate = getLocalMidnight(day.date);
      if (dayDate >= today) {
        day.meals.forEach((meal: any) => {
          const mealIngs = meal.ingredients;
          if (Array.isArray(mealIngs) && mealIngs.length > 0) {
            mealIngs.forEach((ing: string) => {
              ingredients.push({
                text: ing.trim(),
                recipeId: meal.id,
                recipeName: meal.name
              });
            });
          }
        });
      }
    });

    return ingredients;
  };

  const handleAnalyzeIngredients = async () => {
    try {
      setIsProcessing(true);
      setLoadingMessage('Analyzing ingredients with AI...');
      setError(null);

      await processIngredients(rawIngredients);

      setPhase('requirements');
      setIsProcessing(false);
    } catch (err) {
      console.error('Error analyzing ingredients:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze ingredients');
      setIsProcessing(false);
    }
  };

  const processIngredients = async (ingredientsToProcess: Array<{ text: string, recipeId: string, recipeName: string }>) => {
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
      quantity: p.quantity,
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
      ingredientsHash: currentHash
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
        // Ensure we keep existing purchased/removed if valid, but typically generation resets partial progress?
        // Let's assume generation implies a fresh start for valid items, but maybe we keep purchased?
        // For simplicity, let's just update cache and keep other state.
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

  const handleTogglePurchased = async (ingredientName: string) => {
    const isPurchasedItem = shoppingState.purchased.includes(ingredientName);

    const newPurchased = isPurchasedItem
      ? shoppingState.purchased.filter(name => name !== ingredientName)
      : [...shoppingState.purchased, ingredientName];

    const newState = {
      ...shoppingState,
      purchased: newPurchased
    };

    setShoppingState(newState);
    await saveEnhancedShoppingState(newState);
    // UI updates automatically via state
  };

  const handleRemoveItem = async (ingredientName: string) => {
    const newState = {
      ...shoppingState,
      removed: [...shoppingState.removed, ingredientName],
      purchased: shoppingState.purchased.filter(name => name !== ingredientName)
    };

    setShoppingState(newState);
    await saveEnhancedShoppingState(newState);

    // Update UI local state for immediate list removal
    setPurchasableItems(purchasableItems.filter(item => item.ingredientName !== ingredientName));
  };

  const handleResetList = async () => {
    if (confirm('This will clear all shopping list data and start fresh. Continue?')) {
      const newState = {
        pantryChecks: {},
        purchased: [],
        removed: [],
        lastGeneratedDate: '',
        cachedPurchasableItems: [],
        cachedParsedIngredients: [],
        cachedAggregatedIngredients: [],
        ingredientsHash: ''
      };

      await saveEnhancedShoppingState(newState);
      setShoppingState(newState);

      setPhase('requirements');
      setPurchasableItems([]);
      initializeShoppingList();
    }
  };

  const isPurchased = (ingredientName: string): boolean => {
    return shoppingState.purchased.includes(ingredientName);
  };

  // Calculate pantry counts
  const inPantryItems = aggregatedIngredients.filter(ing => isInPantry(ing.name));
  const needToBuyItems = aggregatedIngredients.filter(ing => !isInPantry(ing.name));

  // Calculate purchased counts
  const purchasedItems = purchasableItems.filter(item => isPurchased(item.ingredientName));
  const unpurchasedItems = purchasableItems.filter(item => !isPurchased(item.ingredientName));

  // Phase 0: Raw Ingredients (pre-analysis)
  if (phase === 'raw') {
    // Group ingredients by recipe
    const recipeGroups = new Map<string, { recipeName: string, ingredients: string[] }>();
    rawIngredients.forEach(ing => {
      if (!recipeGroups.has(ing.recipeId)) {
        recipeGroups.set(ing.recipeId, { recipeName: ing.recipeName, ingredients: [] });
      }
      recipeGroups.get(ing.recipeId)!.ingredients.push(ing.text);
    });

    return (
      <div className="space-y-8 pb-20 animate-fade-in">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="heading-1">Shopping List</h2>
            {rawIngredients.length === 0 ? (
              <p className="text-muted font-medium mt-2">No ingredients to analyze</p>
            ) : (
              <p className="text-muted font-medium mt-2">Your weekly meal plan needs {rawIngredients.length} ingredients</p>
            )}
          </div>
          <button
            onClick={handleResetList}
            className="btn-secondary btn-sm self-start md:self-auto"
          >
            Reset All
          </button>
        </header>

        {/* Info Card */}
        <div className="card card-padding bg-sky-50/50 border-sky-200">
          <div className="flex gap-3 items-start">
            <div className="text-2xl">📝</div>
            <div>
              <h3 className="heading-4 mb-1">Ready to Analyze</h3>
              <p className="text-muted text-sm">
                Click "Analyze Ingredients" to let AI parse and organize your grocery list.
                This uses smart categorization and won't run again unless your meal plan changes.
              </p>
            </div>
          </div>
        </div>

        {/* Recipe Groups */}
        <div className="space-y-4">
          {Array.from(recipeGroups.values()).map((group, index) => (
            <div key={index} className="card card-padding-sm">
              <h3 className="heading-4 mb-3">{group.recipeName}</h3>
              <ul className="space-y-1.5">
                {group.ingredients.map((ing, ingIndex) => (
                  <li key={ingIndex} className="text-sm text-muted flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{ing}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Analyze Button */}
        <div className="flex justify-center pt-4">
          <button
            onClick={handleAnalyzeIngredients}
            disabled={isProcessing}
            className={isProcessing ? 'btn-primary btn-lg flex items-center gap-3 opacity-50' : 'btn-primary btn-lg flex items-center gap-3'}
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
                <span>Analyze Ingredients</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (isProcessing) {
    return (
      <div className="space-y-8 pb-20 animate-fade-in">
        <header>
          <h2 className="text-4xl font-normal text-slate-900 tracking-tight font-serif">Shopping List</h2>
          <p className="text-slate-600 font-medium mt-1">Your smart grocery assistant</p>
        </header>

        <div className="p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-emerald-600 mb-4"></div>
          <p className="text-slate-600 font-medium">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-8 pb-20 animate-fade-in">
        <header className="section-header">
          <h2 className="section-title">Shopping List</h2>
          <p className="section-description">Your smart grocery assistant</p>
        </header>

        <div className="p-8 text-center text-red-600 bg-red-50 rounded-2xl border border-red-200">
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

  // Phase 0: Raw Ingredients (pre-analysis)
  if (phase === 'raw') {
    // Group ingredients by recipe
    const recipeGroups = new Map<string, { recipeName: string, ingredients: string[] }>();
    rawIngredients.forEach(ing => {
      if (!recipeGroups.has(ing.recipeId)) {
        recipeGroups.set(ing.recipeId, { recipeName: ing.recipeName, ingredients: [] });
      }
      recipeGroups.get(ing.recipeId)!.ingredients.push(ing.text);
    });

    return (
      <div className="space-y-8 pb-20 animate-fade-in">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="heading-1">Shopping List</h2>
            {rawIngredients.length === 0 ? (
              <p className="text-muted font-medium mt-2">No ingredients to analyze</p>
            ) : (
              <p className="text-muted font-medium mt-2">Your weekly meal plan needs {rawIngredients.length} ingredients</p>
            )}
          </div>
          <button
            onClick={handleResetList}
            className="btn-secondary btn-sm self-start md:self-auto"
          >
            Reset All
          </button>
        </header>

        {/* Info Card */}
        <div className="card card-padding bg-sky-50/50 border-sky-200">
          <div className="flex gap-3 items-start">
            <div className="text-2xl">📝</div>
            <div>
              <h3 className="heading-4 mb-1">Ready to Analyze</h3>
              <p className="text-muted text-sm">
                Click "Analyze Ingredients" to let AI parse and organize your grocery list.
                This uses smart categorization and won't run again unless your meal plan changes.
              </p>
            </div>
          </div>
        </div>

        {/* Recipe Groups */}
        <div className="space-y-4">
          {Array.from(recipeGroups.values()).map((group, index) => (
            <div key={index} className="card card-padding-sm">
              <h3 className="heading-4 mb-3">{group.recipeName}</h3>
              <ul className="space-y-1.5">
                {group.ingredients.map((ing, ingIndex) => (
                  <li key={ingIndex} className="text-sm text-muted flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{ing}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Analyze Button */}
        <div className="flex justify-center pt-4">
          <button
            onClick={handleAnalyzeIngredients}
            disabled={isProcessing}
            className={isProcessing ? 'btn-primary btn-lg flex items-center gap-3 opacity-50' : 'btn-primary btn-lg flex items-center gap-3'}
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
                <span>Analyze Ingredients</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Empty state - no meals planned (MOVED BELOW RAW PHASE)
  if (!isProcessing && aggregatedIngredients.length === 0 && phase !== 'raw') {
    return (
      <div className="space-y-8 pb-20 animate-fade-in">
        <header>
          <h2 className="text-4xl font-normal text-slate-900 tracking-tight font-serif">Shopping List</h2>
          <p className="text-slate-600 font-medium mt-1">Your smart grocery assistant</p>
        </header>

        <div className="p-12 text-center text-slate-600 bg-white rounded-3xl border border-dashed border-slate-200">
          <div className="text-4xl mb-4">🍽️</div>
          {totalPlannedMeals > 0 ? (
            <>
              <p className="text-lg font-medium text-slate-900 mb-2">No ingredients found</p>
              <p className="text-sm">You have {totalPlannedMeals} meals planned, but they don't list any ingredients to shop for.</p>
              <p className="text-sm mt-2 text-muted-foreground/60">(Custom meals or meals without ingredients won't appear here)</p>
            </>
          ) : (
            <>
              <p className="text-lg font-medium text-slate-900 mb-2">No meals planned yet</p>
              <p className="text-sm">Go to the Planner to add meals and generate your shopping list.</p>
            </>
          )}
        </div>
      </div>
    );
  }


  // Phase 1: Requirements Review
  if (phase === 'requirements') {
    return (
      <div className="space-y-8 pb-20 animate-fade-in">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-4xl font-medium text-main tracking-tight font-serif">Review Requirements</h2>
            <p className="text-muted font-medium mt-1">Mark what you already have in your pantry</p>
          </div>
          <button
            onClick={handleResetList}
            className="text-sm font-semibold text-main bg-surface border border-border px-4 py-2 rounded-xl hover:bg-background transition-colors self-start md:self-auto shadow-sm"
          >
            Reset All
          </button>
        </header>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-primary-light/50 border border-primary-light rounded-2xl p-4">
            <div className="text-primary text-sm font-medium mb-1">In Pantry</div>
            <div className="text-3xl font-bold" style={{ color: 'var(--primary)' }}>{inPantryItems.length}</div>
          </div>
          <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4">
            <div className="text-amber-600 text-sm font-medium mb-1">Need to Buy</div>
            <div className="text-3xl font-bold text-amber-900">{needToBuyItems.length}</div>
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
        <div className="flex justify-center pt-4">
          {needToBuyItems.length === 0 ? (
            <div className="text-center">
              <div className="text-4xl mb-2">🎉</div>
              <p className="text-lg font-medium text-main mb-2">You have everything!</p>
              <p className="text-sm text-muted">All ingredients are in your pantry.</p>
            </div>
          ) : (
            <button
              onClick={handleGenerateShoppingList}
              className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl transition-all text-lg font-semibold shadow-lg hover:shadow-xl active:scale-95"
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--primary)'}
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
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-medium text-main tracking-tight font-serif">Shopping List</h2>
          <p className="text-muted font-medium mt-1">Purchase these items at the store</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPhase('requirements')}
            className="text-sm font-semibold text-main bg-surface border border-border px-4 py-2 rounded-xl hover:bg-background transition-colors"
          >
            ← Back to Review
          </button>
          <button
            onClick={handleResetList}
            className="text-sm font-semibold text-main bg-surface border border-border px-4 py-2 rounded-xl hover:bg-background transition-colors"
          >
            Reset
          </button>
        </div>
      </header>

      {purchasableItems.length === 0 ? (
        <div className="p-12 text-center text-muted border-2 border-dashed border-border rounded-xl">
          <div className="text-4xl mb-4">✨</div>
          <p className="text-lg font-medium text-main mb-2">Perfect!</p>
          <p className="text-sm">You already have everything you need.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* To Buy Section */}
          <div className="bg-surface rounded-3xl premium-shadow border border-border overflow-hidden">
            <div className="p-5 bg-background border-b border-border flex justify-between items-center">
              <h3 className="font-normal text-main font-serif text-lg">To Purchase ({unpurchasedItems.length})</h3>
            </div>
            {unpurchasedItems.length === 0 ? (
              <div className="p-8 text-center text-primary">
                <p>🎉 All items purchased!</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                <AnimatePresence initial={false} mode="popLayout">
                  {unpurchasedItems.map(item => {
                    // Find the corresponding aggregated ingredient to get recipe info
                    const aggIng = aggregatedIngredients.find(ing => ing.name === item.ingredientName);

                    return (
                      <motion.li
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        key={item.ingredientName}
                        className="flex items-start justify-between p-4 hover:bg-background group transition-colors"
                      >
                        <div
                          className="flex items-start flex-1 cursor-pointer gap-3"
                          onClick={() => handleTogglePurchased(item.ingredientName)}
                        >
                          <div className="w-5 h-5 rounded border-2 border-muted mt-0.5 flex-shrink-0 flex items-center justify-center transition-colors group-hover:border-primary" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-main capitalize mb-1">{item.ingredientName}</div>
                            <div className="text-lg font-bold text-primary mb-1">{item.purchasableQuantity}</div>
                            <div className="text-xs text-muted">Recipe needs: {item.requiredQuantity}</div>
                            {aggIng && aggIng.recipes.length > 0 && (
                              <div className="text-xs text-muted mt-1">
                                For: {aggIng.recipes.map(r => r.name).join(', ')}
                              </div>
                            )}
                            {item.rationale && (
                              <div className="text-xs text-muted mt-1 italic">{item.rationale}</div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveItem(item.ingredientName)}
                          className="text-muted hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                          title="Remove from list"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            )}
          </div>

          {/* Purchased Section */}
          {purchasedItems.length > 0 && (
            <div className="bg-background/50 rounded-3xl border border-border overflow-hidden opacity-80">
              <div className="p-4 border-b border-border flex justify-between items-center">
                <h3 className="font-semibold text-muted text-sm uppercase tracking-wide">Purchased ({purchasedItems.length})</h3>
              </div>
              <ul className="divide-y divide-border">
                <AnimatePresence initial={false} mode="popLayout">
                  {purchasedItems.map(item => {
                    const aggIng = aggregatedIngredients.find(ing => ing.name === item.ingredientName);

                    return (
                      <motion.li
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        key={item.ingredientName}
                        className="flex items-start justify-between p-4 bg-background group"
                      >
                        <div
                          className="flex items-start flex-1 cursor-pointer gap-3"
                          onClick={() => handleTogglePurchased(item.ingredientName)}
                        >
                          <div className="w-5 h-5 rounded bg-primary border-2 border-primary flex-shrink-0 flex items-center justify-center text-primary-foreground mt-0.5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-muted line-through capitalize">{item.ingredientName}</div>
                            <div className="text-sm text-muted/80">{item.purchasableQuantity}</div>
                            {aggIng && aggIng.recipes.length > 0 && (
                              <div className="text-xs text-muted/60 mt-0.5">
                                For: {aggIng.recipes.map(r => r.name).join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveItem(item.ingredientName)}
                          className="text-muted/60 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                          title="Remove from list"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
