import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  getWeeklyPlan,
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

type Phase = 'requirements' | 'shopping';

export const ShoppingList: React.FC = () => {
  const [phase, setPhase] = useState<Phase>('requirements');
  const [parsedIngredients, setParsedIngredients] = useState<ParsedIngredient[]>([]);
  const [aggregatedIngredients, setAggregatedIngredients] = useState<AggregatedIngredient[]>([]);
  const [purchasableItems, setPurchasableItems] = useState<PurchasableItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');

  // Initialize component
  useEffect(() => {
    initializeShoppingList();
  }, []);

  const initializeShoppingList = async () => {
    try {
      setIsProcessing(true);
      setLoadingMessage('Loading meal plan...');
      setError(null);

      // Migrate old shopping state if needed
      migrateShoppingState();

      // Extract ingredients from weekly plan
      const plan = getWeeklyPlan();
      const rawIngredients = extractIngredientsFromPlan(plan);

      if (rawIngredients.length === 0) {
        setIsProcessing(false);
        return;
      }

      // Check if we have cached data
      const enhancedState = getEnhancedShoppingState();
      const today = new Date().toISOString().split('T')[0];

      if (enhancedState.lastGeneratedDate === today && enhancedState.cachedPurchasableItems.length > 0) {
        // Load from cache
        setLoadingMessage('Loading cached data...');
        // We still need to parse and aggregate to show Phase 1
        await processIngredients(rawIngredients);
        setPurchasableItems(enhancedState.cachedPurchasableItems);
        setIsProcessing(false);
        return;
      }

      // Parse ingredients with AI
      await processIngredients(rawIngredients);
      setIsProcessing(false);

    } catch (err) {
      console.error('Error initializing shopping list:', err);
      setError(err instanceof Error ? err.message : 'Failed to load shopping list');
      setIsProcessing(false);
    }
  };

  const extractIngredientsFromPlan = (plan: Record<string, any>): Array<{text: string, recipeId: string, recipeName: string}> => {
    const ingredients: Array<{text: string, recipeId: string, recipeName: string}> = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    Object.values(plan).forEach(day => {
      if (new Date(day.date) >= today) {
        day.meals.forEach((meal: any) => {
          meal.ingredients.forEach((ing: string) => {
            ingredients.push({
              text: ing.trim(),
              recipeId: meal.id,
              recipeName: meal.name
            });
          });
        });
      }
    });

    return ingredients;
  };

  const processIngredients = async (rawIngredients: Array<{text: string, recipeId: string, recipeName: string}>) => {
    setLoadingMessage('Analyzing ingredients with AI...');

    // Parse ingredients
    const texts = rawIngredients.map(r => r.text);
    const parsed = await parseIngredients(texts);

    // Safety check: ensure arrays match in length
    if (parsed.length !== rawIngredients.length) {
      console.warn(`Array length mismatch: ${parsed.length} parsed vs ${rawIngredients.length} raw ingredients`);
      // Use the shorter length to avoid index errors
      const safeLength = Math.min(parsed.length, rawIngredients.length);
      parsed.splice(safeLength);
    }

    // Map parsed results back to include recipe info
    const parsedWithRecipeInfo: ParsedIngredient[] = parsed.map((p, index) => ({
      id: crypto.randomUUID(),
      originalText: rawIngredients[index].text,
      name: p.name,
      quantity: p.quantity,
      unit: p.unit,
      recipeId: rawIngredients[index].recipeId,
      recipeName: rawIngredients[index].recipeName
    }));

    setParsedIngredients(parsedWithRecipeInfo);

    // Aggregate by ingredient name
    const aggregated = aggregateIngredients(parsedWithRecipeInfo);
    setAggregatedIngredients(aggregated);
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

  const handleTogglePantry = (ingredientName: string, inPantry: boolean) => {
    if (inPantry) {
      addToPantry(ingredientName, true);
    } else {
      removeFromPantry(ingredientName);
    }

    // Force re-render by updating a state variable
    setAggregatedIngredients([...aggregatedIngredients]);
  };

  const isInPantry = (ingredientName: string): boolean => {
    const inventory = getPantryInventory();
    return inventory.items.some(item => item.name === ingredientName);
  };

  const handleGenerateShoppingList = async () => {
    try {
      setIsProcessing(true);
      setLoadingMessage('Converting to purchasable quantities...');
      setError(null);

      // Filter out pantry items
      const pantry = getPantryInventory();
      const pantryNames = new Set(pantry.items.map(item => item.name));
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
      saveEnhancedShoppingState({
        ...getEnhancedShoppingState(),
        lastGeneratedDate: today,
        cachedPurchasableItems: purchasable
      });

      setPhase('shopping');
      setIsProcessing(false);

    } catch (err) {
      console.error('Error generating shopping list:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate shopping list');
      setIsProcessing(false);
    }
  };

  const handleTogglePurchased = (ingredientName: string) => {
    const state = getEnhancedShoppingState();
    const isPurchased = state.purchased.includes(ingredientName);

    const newPurchased = isPurchased
      ? state.purchased.filter(name => name !== ingredientName)
      : [...state.purchased, ingredientName];

    saveEnhancedShoppingState({
      ...state,
      purchased: newPurchased
    });

    // Force re-render
    setPurchasableItems([...purchasableItems]);
  };

  const handleRemoveItem = (ingredientName: string) => {
    const state = getEnhancedShoppingState();
    saveEnhancedShoppingState({
      ...state,
      removed: [...state.removed, ingredientName],
      purchased: state.purchased.filter(name => name !== ingredientName)
    });

    // Update UI
    setPurchasableItems(purchasableItems.filter(item => item.ingredientName !== ingredientName));
  };

  const handleResetList = () => {
    if (confirm('This will clear all shopping list data and start fresh. Continue?')) {
      saveEnhancedShoppingState({
        pantryChecks: {},
        purchased: [],
        removed: [],
        lastGeneratedDate: '',
        cachedPurchasableItems: []
      });
      setPhase('requirements');
      setPurchasableItems([]);
      initializeShoppingList();
    }
  };

  const isPurchased = (ingredientName: string): boolean => {
    const state = getEnhancedShoppingState();
    return state.purchased.includes(ingredientName);
  };

  // Calculate pantry counts
  const inPantryItems = aggregatedIngredients.filter(ing => isInPantry(ing.name));
  const needToBuyItems = aggregatedIngredients.filter(ing => !isInPantry(ing.name));

  // Calculate purchased counts
  const purchasedItems = purchasableItems.filter(item => isPurchased(item.ingredientName));
  const unpurchasedItems = purchasableItems.filter(item => !isPurchased(item.ingredientName));

  // Empty state - no meals planned
  if (!isProcessing && aggregatedIngredients.length === 0) {
    return (
      <div className="space-y-6 pb-20 animate-fade-in">
        <header>
          <h2 className="text-4xl font-normal text-slate-900 tracking-tight font-serif">Shopping List</h2>
          <p className="text-slate-600 font-medium mt-1">Your smart grocery assistant</p>
        </header>

        <div className="p-12 text-center text-slate-600 bg-white rounded-3xl border border-dashed border-slate-200">
          <div className="text-4xl mb-4">🍽️</div>
          <p className="text-lg font-medium text-slate-900 mb-2">No meals planned yet</p>
          <p className="text-sm">Go to the Planner to add meals and generate your shopping list.</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isProcessing) {
    return (
      <div className="space-y-6 pb-20 animate-fade-in">
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
      <div className="space-y-6 pb-20 animate-fade-in">
        <header>
          <h2 className="text-4xl font-normal text-slate-900 tracking-tight font-serif">Shopping List</h2>
          <p className="text-slate-600 font-medium mt-1">Your smart grocery assistant</p>
        </header>

        <div className="p-8 text-center text-red-600 bg-red-50 rounded-3xl border border-red-200">
          <div className="text-3xl mb-2">⚠️</div>
          <p className="font-medium mb-2">Error</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={() => initializeShoppingList()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors text-sm font-medium"
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
      <div className="space-y-6 pb-20 animate-fade-in">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-4xl font-normal text-slate-900 tracking-tight font-serif">Review Requirements</h2>
            <p className="text-slate-600 font-medium mt-1">Mark what you already have in your pantry</p>
          </div>
          <button
            onClick={handleResetList}
            className="text-sm font-semibold text-slate-700 bg-white border border-slate-200 px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors self-start md:self-auto"
          >
            Reset All
          </button>
        </header>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <div className="text-emerald-600 text-sm font-medium mb-1">In Pantry</div>
            <div className="text-3xl font-bold text-emerald-900">{inPantryItems.length}</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
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
              <p className="text-lg font-medium text-slate-900 mb-2">You have everything!</p>
              <p className="text-sm text-slate-600">All ingredients are in your pantry.</p>
            </div>
          ) : (
            <button
              onClick={handleGenerateShoppingList}
              className="px-8 py-4 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all text-lg font-semibold shadow-lg hover:shadow-xl"
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
          <h2 className="text-4xl font-normal text-slate-900 tracking-tight font-serif">Shopping List</h2>
          <p className="text-slate-600 font-medium mt-1">Purchase these items at the store</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPhase('requirements')}
            className="text-sm font-semibold text-slate-700 bg-white border border-slate-200 px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors"
          >
            ← Back to Review
          </button>
          <button
            onClick={handleResetList}
            className="text-sm font-semibold text-slate-700 bg-white border border-slate-200 px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Reset
          </button>
        </div>
      </header>

      {purchasableItems.length === 0 ? (
        <div className="p-12 text-center">
          <div className="text-4xl mb-4">✨</div>
          <p className="text-lg font-medium text-slate-900 mb-2">Perfect!</p>
          <p className="text-sm text-slate-600">You already have everything you need.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* To Buy Section */}
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-normal text-slate-900 font-serif text-lg">To Purchase ({unpurchasedItems.length})</h3>
            </div>
            {unpurchasedItems.length === 0 ? (
              <div className="p-8 text-center text-emerald-600">
                <p>🎉 All items purchased!</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-200">
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
                        className="flex items-start justify-between p-4 hover:bg-slate-50 group transition-colors"
                      >
                        <div
                          className="flex items-start flex-1 cursor-pointer gap-3"
                          onClick={() => handleTogglePurchased(item.ingredientName)}
                        >
                          <div className="w-5 h-5 rounded border-2 border-slate-300 mt-0.5 flex-shrink-0 flex items-center justify-center transition-colors group-hover:border-emerald-600" />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-900 capitalize mb-1">{item.ingredientName}</div>
                            <div className="text-lg font-bold text-emerald-700 mb-1">{item.purchasableQuantity}</div>
                            <div className="text-xs text-slate-500">Recipe needs: {item.requiredQuantity}</div>
                            {aggIng && aggIng.recipes.length > 0 && (
                              <div className="text-xs text-slate-400 mt-1">
                                For: {aggIng.recipes.map(r => r.name).join(', ')}
                              </div>
                            )}
                            {item.rationale && (
                              <div className="text-xs text-slate-400 mt-1 italic">{item.rationale}</div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveItem(item.ingredientName)}
                          className="text-slate-400 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
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
            <div className="bg-slate-50 rounded-3xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-semibold text-slate-500 text-sm uppercase tracking-wide">Purchased ({purchasedItems.length})</h3>
              </div>
              <ul className="divide-y divide-slate-200">
                <AnimatePresence initial={false} mode="popLayout">
                  {purchasedItems.map(item => {
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
                        className="flex items-start justify-between p-4 hover:bg-white group"
                      >
                        <div
                          className="flex items-start flex-1 cursor-pointer gap-3"
                          onClick={() => handleTogglePurchased(item.ingredientName)}
                        >
                          <div className="w-5 h-5 rounded bg-emerald-600 border-2 border-emerald-600 flex-shrink-0 flex items-center justify-center text-white mt-0.5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-slate-500 line-through capitalize">{item.ingredientName}</div>
                            <div className="text-sm text-slate-400">{item.purchasableQuantity}</div>
                            {aggIng && aggIng.recipes.length > 0 && (
                              <div className="text-xs text-slate-400 mt-0.5">
                                For: {aggIng.recipes.map(r => r.name).join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveItem(item.ingredientName)}
                          className="text-slate-400 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
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
