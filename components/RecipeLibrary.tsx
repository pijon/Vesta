import React, { useState, useEffect } from 'react';
import { ChefHat, ChevronDown, Download, Heart, Link2, Plus, Search, Sparkles, X } from 'lucide-react';
import { getCachedRecipes } from '../utils/cacheService';
import { Recipe, Group } from '../types';
import { getRecipes, saveRecipe, deleteRecipe, getDayPlan, saveDayPlan } from '../services/storageService';
import { getUserGroup, getFamilyMemberRecipes, copyRecipeToMyLibrary } from '../services/groupService';
import { parseRecipeText, generateRecipeFromIngredients, getRecipeUrl, fetchRecipeFromUrl } from '../services/geminiService';
import { RecipeCard } from './RecipeCard';
import { Portal } from './Portal';
import { RecipeDetailModal } from './RecipeDetailModal';
import { ImageInput } from './ImageInput';
import { importRecipeImageFromUrl } from '../utils/storageUtils';
import { IngredientRecipeModal } from './IngredientRecipeModal';
import { RecipeEditModal } from './RecipeEditModal';
import { localDateString } from '../utils/dateUtils';



interface RecipeLibraryProps {
  onSelect?: (recipe: Recipe) => void;
}

export const RecipeLibrary: React.FC<RecipeLibraryProps> = ({ onSelect }) => {
  // Start from the local cache so revisiting the page renders immediately
  const [recipes, setRecipes] = useState<Recipe[]>(() => getCachedRecipes() ?? []);
  const [familyRecipes, setFamilyRecipes] = useState<Recipe[]>([]);
  const [userGroup, setUserGroup] = useState<Group | null>(null);
  const [isLoading, setIsLoading] = useState(() => !getCachedRecipes()?.length);

  const [isAdding, setIsAdding] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<string>('name');
  const [calorieFilter, setCalorieFilter] = useState<string>('all'); // 'all' or number as string
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showIngredientModal, setShowIngredientModal] = useState(false);

  // Selection and Editing State
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'ingredients' | 'instructions'>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Recipe | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Image upload state
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [newRecipeId, setNewRecipeId] = useState<string>(crypto.randomUUID()); // Generate ID upfront for Storage upload
  const [importError, setImportError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(t => (t === message ? null : t)), 2500);
  };

  useEffect(() => {
    loadData(false);
  }, []);

  const [hasLoadedAll, setHasLoadedAll] = useState(false);

  // Automatically load the rest of the recipes if the user starts searching, filtering, or sorting
  useEffect(() => {
    if (!hasLoadedAll && !isLoading) {
      const isSearching = searchQuery.trim().length > 0;
      const isFiltering = activeFilter !== 'all' || calorieFilter !== 'all';
      const isSorting = sortOption !== 'name'; // Assuming 'name' describes the implicit default or random order we accepted, actually default state is 'name'

      if (isSearching || isFiltering || isSorting) {
        loadData(true);
      }
    }
  }, [searchQuery, activeFilter, calorieFilter, sortOption]);

  const loadData = async (loadAll: boolean = false) => {
    // Prevent double loading if already loading all
    if (isLoading && loadAll) return;

    setIsLoading(true);
    try {
      const limit = (loadAll || hasLoadedAll) ? undefined : 24;

      // Parallelize: Fetch Own Recipes AND (Group + Family Recipes)
      const [userRecipes, group] = await Promise.all([
        getRecipes(limit),
        getUserGroup()
      ]);

      // Set user recipes immediately
      if (loadAll) {
        setHasLoadedAll(true);
        setRecipes(userRecipes);
      } else {
        if (userRecipes.length < 24) {
          setHasLoadedAll(true);
        } else {
          setHasLoadedAll(false);
        }
        setRecipes(userRecipes);
      }

      setUserGroup(group);

      if (group) {
        // Now fetch family recipes using the group we just got
        // We pass the group object to avoid re-fetching it inside the service
        const familyRecipes = await getFamilyMemberRecipes(group);
        setFamilyRecipes(familyRecipes);
      }
    } catch (e) {
      console.error("Failed to load recipe data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = () => {
    loadData(true);
  };

  const openRecipe = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setActiveTab('overview');
    setIsEditing(false);
    setEditForm(null);
  };

  const closeRecipe = () => {
    setSelectedRecipe(null);
    setIsEditing(false);
    setEditForm(null);
  };

  const startEditing = () => {
    if (selectedRecipe) {
      setEditForm({ ...selectedRecipe });
      setUploadedImage(selectedRecipe.image || null);
      setIsEditing(true);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditForm(null);
  };

  const handleSaveEdit = async (updatedRecipe: Recipe) => {
    setIsSaving(true);
    try {
      await saveRecipe(updatedRecipe);
      await loadData();
      setSelectedRecipe(updatedRecipe);
      setIsEditing(false);
      setEditForm(null); // Cleanup
    } catch (e) {
      console.error("Failed to save recipe", e);
      alert("That recipe couldn't be saved. Try again.");
    } finally {
      setIsSaving(false);
    }
  };


  const handleImageSelect = (downloadURL: string) => {
    setImageError(null);
    setUploadedImage(downloadURL);
  };

  const handleRemoveImage = () => {
    setUploadedImage(null);
  };

  const handleManualAdd = () => {
    // If user was using AI import, close it
    setIsAdding(false);

    const newId = crypto.randomUUID();
    const emptyRecipe: Recipe = {
      id: newId,
      name: '',
      description: '',
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      ingredients: [],
      instructions: [],
      tags: [],
      servings: 1
    };

    setEditForm(emptyRecipe);
    setSelectedRecipe(emptyRecipe); // Required for modal to render in some flows, or as placeholder
    setUploadedImage(null);
    setIsEditing(true);
  };

  const handleAIAdd = async () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);
    setImportError(null);
    try {
      const sourceUrl = getRecipeUrl(inputText);
      // Copy the page's photo in parallel with reading the recipe; a user upload wins.
      const pageImage = sourceUrl && !uploadedImage
        ? importRecipeImageFromUrl(sourceUrl, newRecipeId)
        : Promise.resolve(null);
      const recipeText = sourceUrl ? await fetchRecipeFromUrl(sourceUrl) : inputText;
      const partialRecipe = await parseRecipeText(recipeText);
      if (partialRecipe) {
        const newRecipe: Recipe = {
          id: newRecipeId, // Use pre-generated ID
          name: partialRecipe.name || 'Untitled Recipe',
          description: sourceUrl ? `Imported from ${sourceUrl}` : 'Imported from text',
          calories: partialRecipe.calories || 0,
          protein: partialRecipe.protein || 0,
          fat: partialRecipe.fat || 0,
          carbs: partialRecipe.carbs || 0,
          ingredients: partialRecipe.ingredients || [],
          instructions: partialRecipe.instructions || [],
          tags: partialRecipe.tags || ['main meal'],
          servings: partialRecipe.servings || 1,
        };

        const image = uploadedImage ?? await pageImage;
        if (image) {
          newRecipe.image = image;
        }


        await saveRecipe(newRecipe);
        await loadData();
        setIsAdding(false);
        setInputText('');
        setUploadedImage(null);
        setImageError(null);
        setNewRecipeId(crypto.randomUUID()); // Generate new ID for next recipe

        // Open the newly created recipe
        setSelectedRecipe(newRecipe);
        setActiveTab('overview');
      }
    } catch (e: any) {
      console.error("AI Import Failed:", e);
      setImportError(getRecipeUrl(inputText)
        ? "We couldn't read a recipe from that link. Try pasting the recipe text instead."
        : "We couldn't make sense of that recipe. Check the text and try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveGeneratedRecipe = async (recipe: Recipe) => {
    await saveRecipe(recipe);
    await loadData();

    // Open the newly saved recipe
    setSelectedRecipe(recipe);
    setActiveTab('overview');
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Delete this recipe?')) {
      await deleteRecipe(id);
      await loadData();
      if (selectedRecipe?.id === id) closeRecipe();
    }
  };

  const toggleFavorite = async (e: React.MouseEvent, recipe: Recipe) => {
    e.stopPropagation();
    const updatedRecipe = { ...recipe, isFavorite: !recipe.isFavorite };

    // Optimistic update. Only the user's own recipes can be favourited: saveRecipe
    // writes to users/{uid}/recipes, so favouriting a family recipe would create a copy.
    // RecipeCard hides the heart for family recipes.
    setRecipes(prev => prev.map(r => r.id === recipe.id ? updatedRecipe : r));
    await saveRecipe(updatedRecipe);
  };

  /* Deprecated manual sharing
  const handleShare = async (e: React.MouseEvent, recipe: Recipe) => { ... } 
  */

  const handleCopyToMyLibrary = async (e: React.MouseEvent, recipe: Recipe) => {
    e.stopPropagation();
    if (!recipe.ownerId) return; // Only for family recipes

    try {
      const copied = await copyRecipeToMyLibrary(recipe);
      await loadData();
      setSelectedRecipe(copied);
      showToast(`Copied to your recipes`);
    } catch (err) {
      console.error('Failed to copy recipe', err);
      showToast(`Couldn't copy that recipe`);
    }
  };

  const handleExport = async () => {
    const allRecipes = await getRecipes();
    const blob = new Blob([JSON.stringify(allRecipes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vesta_recipes_${localDateString()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredRecipes = [...recipes, ...familyRecipes]
    .filter(recipe => {
      const matchesSearch =
        recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        recipe.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
        recipe.ingredients.some(i => i.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesFilter = activeFilter === 'all' ||
        (activeFilter === 'mine' && !recipe.ownerId) ||
        (activeFilter === 'family' && !!recipe.ownerId) ||
        recipe.tags?.includes(activeFilter);

      const matchesCalories = calorieFilter === 'all' || recipe.calories <= parseInt(calorieFilter);

      const matchesFavorite = !showFavoritesOnly || recipe.isFavorite;

      return matchesSearch && matchesFilter && matchesCalories && matchesFavorite;
    })
    .sort((a, b) => {
      switch (sortOption) {
        case 'caloriesLow':
          return a.calories - b.calories;
        case 'caloriesHigh':
          return b.calories - a.calories;
        case 'protein':
          return (b.protein || 0) - (a.protein || 0);
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

  const familyCount = familyRecipes.length;
  const handleAddToToday = async (recipe: Recipe) => {
    try {
      const today = localDateString();
      const plan = await getDayPlan(today);
      const newMeals = [...plan.meals, recipe];
      const totalCals = newMeals.reduce((acc, m) => acc + m.calories, 0);
      await saveDayPlan({ ...plan, meals: newMeals, totalCalories: totalCals });
      showToast(`Added ${recipe.name} to today`);
    } catch (err) {
      console.error('Failed to add to plan', err);
      showToast(`Couldn't add that to today`);
    }
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Title and actions */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="heading-2">Your cookbook</h2>
          <p className="text-sm text-muted mt-0.5">
            {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}
            {familyCount > 0 && ` · ${familyCount} from family`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setIsAdding(!isAdding); setImportError(null); }}
            aria-expanded={isAdding}
            className={isAdding ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'}
          >
            {isAdding ? <X size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
            {isAdding ? 'Close import' : 'Import'}
          </button>
          <button onClick={() => setShowIngredientModal(true)} className="btn-secondary btn-sm">
            <Sparkles size={16} aria-hidden="true" /> From ingredients
          </button>
          <button onClick={handleManualAdd} className="btn-secondary btn-sm">
            <Plus size={16} aria-hidden="true" /> New
          </button>
          <button onClick={handleExport} className="icon-btn !size-9" aria-label="Export recipes as JSON" title="Export recipes as JSON">
            <Download size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Import panel */}
      {isAdding && (
        <section className="card p-5 md:p-6 space-y-4" aria-labelledby="import-heading">
          <div>
            <h3 id="import-heading" className="heading-3">Import a recipe</h3>
            <p className="text-sm text-muted mt-0.5">Paste a link or the recipe text. Vesta reads the ingredients, steps and nutrition for you.</p>
          </div>

          <label htmlFor="import-text" className="sr-only">Recipe link or text</label>
          <textarea
            id="import-text"
            value={inputText}
            onChange={(e) => { setInputText(e.target.value); setImportError(null); }}
            className={`input w-full min-h-[140px] ${importError ? 'input-error' : ''}`}
            placeholder="https://… or: Chicken stir fry, serves 4. 500 g chicken breast, 2 peppers…"
            aria-invalid={!!importError}
            aria-describedby={importError ? 'import-error' : undefined}
          />
          {importError && <p id="import-error" className="text-sm text-error -mt-2">{importError}</p>}

          <div>
            <p className="text-sm font-semibold mb-2">Photo <span className="font-normal text-muted">(optional)</span></p>
            {uploadedImage ? (
              <div className="relative w-40">
                <img src={uploadedImage} alt="Recipe photo preview" className="w-40 aspect-[4/3] object-cover rounded-[14px]" />
                <button onClick={handleRemoveImage} className="icon-btn !size-8 absolute -top-2 -right-2 shadow-[var(--elev-sm)]" aria-label="Remove photo">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <ImageInput
                recipeId={newRecipeId}
                onImageSelect={handleImageSelect}
                onError={(err) => setImageError(err)}
                disabled={isProcessing}
                className="w-full"
              />
            )}
            {imageError && <p className="text-sm text-error mt-2">{imageError}</p>}
          </div>

          <button onClick={handleAIAdd} disabled={isProcessing || !inputText.trim()} className="btn-primary btn-block">
            {isProcessing ? <span className="spinner spinner-sm" aria-hidden="true" /> : <Sparkles size={18} aria-hidden="true" />}
            {isProcessing ? 'Reading recipe…' : 'Import recipe'}
          </button>
        </section>
      )}

      {/* Search, filters, sort */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden="true" />
            <label htmlFor="recipe-search" className="sr-only">Search recipes</label>
            <input
              id="recipe-search"
              type="search"
              className="input w-full !pl-11"
              placeholder="Search by name, ingredient or tag"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="recipe-calories">Maximum calories</label>
            <select id="recipe-calories" value={calorieFilter} onChange={(e) => setCalorieFilter(e.target.value)} className="input flex-1 sm:flex-none sm:w-40">
              <option value="all">Any calories</option>
              {Array.from({ length: 8 }, (_, i) => (i + 1) * 100).map(cal => (
                <option key={cal} value={cal.toString()}>Under {cal} kcal</option>
              ))}
            </select>
            <label className="sr-only" htmlFor="recipe-sort">Sort by</label>
            <select id="recipe-sort" value={sortOption} onChange={(e) => setSortOption(e.target.value)} className="input flex-1 sm:flex-none sm:w-44">
              <option value="name">Name A–Z</option>
              <option value="caloriesLow">Fewest calories</option>
              <option value="caloriesHigh">Most calories</option>
              <option value="protein">Most protein</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 py-0.5" role="group" aria-label="Filter recipes">
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            aria-pressed={showFavoritesOnly}
            className={`shrink-0 inline-flex items-center gap-1.5 min-h-9 px-3.5 rounded-full text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${showFavoritesOnly ? 'bg-calories-bg text-calories-text' : 'bg-surface border border-border hover:bg-surface-sunken'}`}
          >
            <Heart size={14} fill={showFavoritesOnly ? 'currentColor' : 'none'} aria-hidden="true" /> Favourites
          </button>
          {[['all', 'All'], ['mine', 'Mine'], ['family', 'Family'], ['breakfast', 'Breakfast'], ['main meal', 'Main meals'], ['light meal', 'Light meals'], ['snack', 'Snacks']].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setActiveFilter(value)}
              aria-pressed={activeFilter === value}
              className={`shrink-0 min-h-9 px-3.5 rounded-full text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${activeFilter === value ? 'bg-ink text-on-ink' : 'bg-surface border border-border hover:bg-surface-sunken'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-2.5 md:gap-4 grid-cols-2 lg:grid-cols-3">
        {isLoading && recipes.length === 0 ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-2 animate-pulse" aria-hidden="true">
              <div className="aspect-[4/3] rounded-[14px] bg-surface-sunken" />
              <div className="p-2 pt-4 space-y-2">
                <div className="h-5 w-3/4 rounded bg-surface-sunken" />
                <div className="h-4 w-1/3 rounded bg-surface-sunken" />
              </div>
            </div>
          ))
        ) : filteredRecipes.length === 0 ? (
          <div className="col-span-full tile tile-neutral items-center text-center py-14">
            <ChefHat size={32} className="text-muted mb-3" aria-hidden="true" />
            <p className="font-semibold">{recipes.length === 0 ? 'Your cookbook is empty' : 'No recipes match'}</p>
            <p className="text-sm text-muted mt-1 max-w-sm">
              {recipes.length === 0
                ? 'Import a recipe from a link, or write your own.'
                : 'Try a different search or clear a filter.'}
            </p>
            {recipes.length === 0 ? (
              <button onClick={() => setIsAdding(true)} className="btn-primary btn-sm mt-4"><Link2 size={16} aria-hidden="true" /> Import a recipe</button>
            ) : (
              <button
                onClick={() => { setSearchQuery(''); setActiveFilter('all'); setCalorieFilter('all'); setShowFavoritesOnly(false); }}
                className="btn-secondary btn-sm mt-4"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          filteredRecipes.map(recipe => (
            <RecipeCard
              key={recipe.id}
              meal={recipe}
              onClick={onSelect ? () => onSelect(recipe) : () => openRecipe(recipe)}
              showMacros={false}
              onToggleFavorite={(e) => toggleFavorite(e, recipe)}
              actionLabel={onSelect ? 'Select' : undefined}
              onAction={onSelect ? () => onSelect(recipe) : undefined}
              ownerName={recipe.ownerName}
              isOwned={!recipe.ownerId}
              onCopyToLibrary={recipe.ownerId ? (e) => handleCopyToMyLibrary(e, recipe) : undefined}
              onAddToPlan={onSelect ? undefined : () => handleAddToToday(recipe)}
            />
          ))
        )}
      </div>

      {!hasLoadedAll && !isLoading && recipes.length > 0 && (
        <div className="flex justify-center pt-2">
          <button onClick={handleLoadMore} className="btn-secondary btn-sm">
            Show all recipes <ChevronDown size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Feedback toast, kept clear of the bottom nav */}
      {toast && (
        <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-28 z-[60] badge-ink !rounded-full !px-4 !py-2.5 text-sm font-semibold shadow-[var(--elev-md)] animate-fade-in">
          {toast}
        </div>
      )}

      {/* Ingredient Recipe Modal */}
      {
        showIngredientModal && (
          <IngredientRecipeModal
            onSave={handleSaveGeneratedRecipe}
            onClose={() => setShowIngredientModal(false)}
          />
        )
      }

      {/* Recipe Detail / Edit Modal */}
      {
        selectedRecipe && (
          isEditing && editForm ? (
            <RecipeEditModal
              recipe={editForm || selectedRecipe}
              onSave={handleSaveEdit}
              onCancel={cancelEditing}
              isSaving={isSaving}
            />
          ) : (
            <RecipeDetailModal
              recipe={selectedRecipe}
              onClose={closeRecipe}
              onEdit={!selectedRecipe.ownerId ? startEditing : undefined}
              onDelete={!selectedRecipe.ownerId ? (id, e) => handleDelete(e, id) : undefined}
              isOwned={!selectedRecipe.ownerId}
              onCopyToLibrary={selectedRecipe.ownerId ? async () => {
                await handleCopyToMyLibrary({ stopPropagation: () => { } } as React.MouseEvent, selectedRecipe);
              } : undefined}
            />
          )
        )
      }
    </div >
  );
};