import React, { useState, useEffect, useMemo, useId } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowUpDown, ChefHat, Copy, Download, Flame, Heart, LayoutGrid, Link2, List, Plus, Search, Sparkles, X } from 'lucide-react';
import { getCachedRecipes } from '../utils/cacheService';
import { addDays } from '../utils/planUtils';
import { Recipe } from '../types';
import { getRecipes, saveRecipe, deleteRecipe, setRecipeFavorite } from '../services/storageService';
import { recordFamilyUpdate } from '../services/activityService';
import { currentUid } from '../services/firebase';
import { isAddedBy, withAuthorNames } from '../utils/recipeAuthors';
import { familyData, recipeHistoryData } from '../services/pageData';
import { ensureWarm, usePrewarmed } from '../utils/prewarm';
import { AddToPlanSheet } from './AddToPlanSheet';
import { CookingMode } from './CookingMode';
import { parseRecipeText, getRecipeUrl, fetchRecipeFromUrl } from '../services/geminiService';
import { RecipeCard, RecipeRow } from './RecipeCard';
import { RecipeDetailModal } from './RecipeDetailModal';
import { ImageInput } from './ImageInput';
import { importRecipeImageFromUrl } from '../utils/storageUtils';
import { IngredientRecipeModal } from './IngredientRecipeModal';
import { RecipeEditModal } from './RecipeEditModal';
import { localDateString, parseLocalDate } from '../utils/dateUtils';
import { SelectionPill } from './SelectionPill';
import { duplicateRecipeIds, findSameName } from '../utils/recipeDuplicates';



/** Meal-type tags have their own chips; the rest (diet, style, cuisine) become tag chips. */
const MEAL_TYPE_TAGS = new Set(['breakfast', 'lunch', 'dinner', 'main meal', 'light meal', 'snack', 'side dish']);
const FAST_DAY_KCAL = 400;
const VIEW_KEY = 'vesta_recipes_view';

const normalizeTag = (tag: string) => tag.trim().toLowerCase();
const tagLabel = (tag: string) => tag.charAt(0).toUpperCase() + tag.slice(1);

const daysAgo = (date: string, today: string) =>
  Math.round((parseLocalDate(today).getTime() - parseLocalDate(date).getTime()) / 86_400_000);

/** "Planned today", "Planned tomorrow", "Planned Thu" */
const plannedLabelFor = (date: string | undefined, today: string) => {
  if (!date) return undefined;
  if (date === today) return 'Planned today';
  if (date === addDays(today, 1)) return 'Planned tomorrow';
  return `Planned ${parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'short' })}`;
};

/** "Had today", "Had 4 days ago", "Had 3 weeks ago" */
const historyLabelFor = (date: string | undefined, today: string) => {
  if (!date) return undefined;
  const days = daysAgo(date, today);
  if (days <= 0) return 'Had today';
  if (days === 1) return 'Had yesterday';
  if (days < 14) return `Had ${days} days ago`;
  return `Had ${Math.round(days / 7)} weeks ago`;
};

interface RecipeLibraryProps {
  onSelect?: (recipe: Recipe) => void;
}

export const RecipeLibrary: React.FC<RecipeLibraryProps> = ({ onSelect }) => {
  // The whole library, starting from the local cache so the page renders immediately
  const [recipes, setRecipes] = useState<Recipe[]>(() => getCachedRecipes() ?? []);
  const [isLoading, setIsLoading] = useState(() => !getCachedRecipes()?.length);
  // Member names (for "From …" badges) and plan history load in the background after sign-in
  const familyNames = usePrewarmed(familyData)?.names;
  const history = usePrewarmed(recipeHistoryData);
  const today = localDateString();

  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [fastDayFriendly, setFastDayFriendly] = useState(false);
  const layoutPillId = useId();
  const [view, setView] = useState<'grid' | 'list'>(() => {
    try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'; } catch { return 'grid'; }
  });
  const changeView = (next: 'grid' | 'list') => {
    setView(next);
    try { localStorage.setItem(VIEW_KEY, next); } catch { /* per-device preference only */ }
  };
  const [planTarget, setPlanTarget] = useState<Recipe | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  useEffect(() => {
    if (!addMenuOpen) return;
    const close = () => setAddMenuOpen(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', onKey); };
  }, [addMenuOpen]);
  const [cookRecipe, setCookRecipe] = useState<Recipe | null>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<string>('name');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  // The Family page links here with ?filter=family
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = searchParams.get('filter');
  useEffect(() => {
    if (filterParam === 'family') setActiveFilter('family');
  }, [filterParam]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showIngredientModal, setShowIngredientModal] = useState(false);

  // Selection and Editing State
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Recipe | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Image upload state
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [newRecipeId, setNewRecipeId] = useState<string>(crypto.randomUUID()); // Generate ID upfront for Storage upload
  const [importError, setImportError] = useState<string | null>(null);
  // An import whose name matches a recipe already in the library, waiting for the user's call
  const [sameName, setSameName] = useState<{ existing: Recipe; recipe: Recipe } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(t => (t === message ? null : t)), 2500);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const fresh = await getRecipes();
      // Keep the cached library if the refresh comes back empty (offline)
      if (fresh.length > 0 || !getCachedRecipes()?.length) setRecipes(fresh);
    } catch (e) {
      console.error("Failed to load recipe data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const openRecipe = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
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

  // The shopping list links here with ?edit=<recipe id> to add a recipe's missing ingredients
  const editParam = searchParams.get('edit');
  useEffect(() => {
    if (!editParam) return;
    const recipe = recipes.find(r => r.id === editParam);
    if (!recipe) {
      if (!isLoading) setSearchParams(prev => { prev.delete('edit'); return prev; }, { replace: true });
      return;
    }
    setSelectedRecipe(recipe);
    setEditForm({ ...recipe });
    setUploadedImage(recipe.image || null);
    setIsEditing(true);
    setSearchParams(prev => { prev.delete('edit'); return prev; }, { replace: true });
  }, [editParam, recipes, isLoading]);

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
      showToast("That recipe couldn't be saved. Try again.");
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

        // Importing the same recipe twice is easy to do; ask before adding a second copy
        const existing = findSameName(recipes, newRecipe.name);
        if (existing) {
          setSameName({ existing, recipe: newRecipe });
          return;
        }
        await finishImport(newRecipe);
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

  const resetImport = () => {
    setIsAdding(false);
    setInputText('');
    setUploadedImage(null);
    setImageError(null);
    setSameName(null);
    setNewRecipeId(crypto.randomUUID()); // Generate new ID for next recipe
  };

  /** Saves a recipe the user just added, and tells the family */
  const saveNewRecipe = async (recipe: Recipe) => {
    await saveRecipe(recipe);
    void recordFamilyUpdate({ type: 'recipe', name: recipe.name, recipeId: recipe.id }, recipe.id);
  };

  const finishImport = async (newRecipe: Recipe) => {
    await saveNewRecipe(newRecipe);
    await loadData();
    resetImport();
    // Open the newly created recipe
    setSelectedRecipe(newRecipe);
  };

  const handleSaveGeneratedRecipe = async (recipe: Recipe) => {
    await saveNewRecipe(recipe);
    await loadData();

    // Open the newly saved recipe
    setSelectedRecipe(recipe);
  };

  // The recipe sheet has already asked
  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteRecipe(id);
      if (selectedRecipe?.id === id) closeRecipe();
      setRecipes(prev => prev.filter(r => r.id !== id));
      showToast('Recipe deleted');
      await loadData();
    } catch (err) {
      console.error('Failed to delete recipe', err);
      showToast("That recipe couldn't be deleted. Try again.");
    }
  };

  const toggleFavorite = async (e: React.MouseEvent, recipe: Recipe) => {
    e.stopPropagation();
    const favorite = !recipe.isFavorite;
    const uid = currentUid();
    const favoritedBy = (recipe.favoritedBy || []).filter(id => id !== uid).concat(favorite && uid ? [uid] : []);
    const updatedRecipe = { ...recipe, isFavorite: favorite, favoritedBy };

    // Optimistic update. Favourites are per member, so only this user is added or removed.
    setRecipes(prev => prev.map(r => r.id === recipe.id ? updatedRecipe : r));
    try {
      await setRecipeFavorite(recipe.id, favorite);
    } catch (err) {
      console.error('Failed to update favourite', err);
      setRecipes(prev => prev.map(r => r.id === recipe.id ? recipe : r));
      showToast(`Couldn't update favourites`);
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

  // Every recipe is the family's; ones another member added carry their name
  const myUid = currentUid();
  const allRecipes = useMemo(() => withAuthorNames(recipes, myUid, familyNames), [recipes, myUid, familyNames]);

  // Tag chips from the library itself: the most used diet, style and cuisine tags
  const tagChips = useMemo(() => {
    const counts = new Map<string, number>();
    allRecipes.forEach(r => new Set<string>((r.tags || []).map(normalizeTag)).forEach(tag => {
      if (tag && !MEAL_TYPE_TAGS.has(tag)) counts.set(tag, (counts.get(tag) || 0) + 1);
    }));
    return [...counts.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 12);
  }, [allRecipes]);
  const fastDayCount = useMemo(() => allRecipes.filter(r => r.calories > 0 && r.calories <= FAST_DAY_KCAL).length, [allRecipes]);

  // Recipes that share a name with another, usually the same recipe imported twice
  const duplicateIds = useMemo(() => duplicateRecipeIds(allRecipes), [allRecipes]);
  useEffect(() => {
    if (activeFilter === 'duplicates' && duplicateIds.size === 0) setActiveFilter('all');
  }, [activeFilter, duplicateIds]);

  const query = searchQuery.trim().toLowerCase();
  const lastHad = (r: Recipe) => history?.lastHad[r.id] ?? '';
  const filteredRecipes = allRecipes
    .filter(recipe => {
      const tags = (recipe.tags || []).map(normalizeTag);
      const matchesSearch = !query ||
        recipe.name.toLowerCase().includes(query) ||
        tags.some(tag => tag.includes(query)) ||
        (recipe.ingredients || []).some(i => i.toLowerCase().includes(query));

      const matchesFilter = activeFilter === 'all' ||
        (activeFilter === 'duplicates' && duplicateIds.has(recipe.id)) ||
        (activeFilter === 'mine' && isAddedBy(recipe, myUid)) ||
        (activeFilter === 'family' && !isAddedBy(recipe, myUid)) ||
        tags.includes(activeFilter);

      const matchesTag = !activeTag || tags.includes(activeTag);
      const matchesFastDay = !fastDayFriendly || (recipe.calories > 0 && recipe.calories <= FAST_DAY_KCAL);
      const matchesFavorite = !showFavoritesOnly || recipe.isFavorite;

      return matchesSearch && matchesFilter && matchesTag && matchesFastDay && matchesFavorite;
    })
    .sort((a, b) => {
      // Copies side by side, whatever the sort
      switch (activeFilter === 'duplicates' ? 'name' : sortOption) {
        case 'caloriesLow':
          return a.calories - b.calories;
        case 'caloriesHigh':
          return b.calories - a.calories;
        case 'protein':
          return (b.protein || 0) - (a.protein || 0);
        case 'lastHad':
          // Never had first, then longest ago
          return lastHad(a).localeCompare(lastHad(b)) || a.name.localeCompare(b.name);
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

  /** Filter chip: ink when on (fast day uses its own tint) */
  const chip = (label: React.ReactNode, active: boolean, onClick: () => void, tone: 'ink' | 'fasting' = 'ink') => (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`chip shrink-0 ${active && tone === 'fasting' ? '!bg-fasting-bg !text-fasting-text' : ''}`}
    >
      {label}
    </button>
  );

  const filtersActive = !!query || activeFilter !== 'all' || !!activeTag || fastDayFriendly || showFavoritesOnly;
  const clearFilters = () => {
    setSearchQuery(''); setActiveFilter('all'); setActiveTag(null); setFastDayFriendly(false); setShowFavoritesOnly(false);
  };

  const familyCount = allRecipes.filter(r => !isAddedBy(r, myUid)).length;

  const handleSetImage = async (recipe: Recipe, image: string) => {
    const updated = { ...recipe, image };
    await saveRecipe(updated);
    setRecipes(prev => prev.map(r => r.id === recipe.id ? updated : r));
    setSelectedRecipe(updated);
    showToast('Photo added');
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Count and add actions */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          <span className="font-semibold text-main">{recipes.length}</span> {recipes.length === 1 ? 'recipe' : 'recipes'}
          {familyCount > 0 && ` · ${familyCount} from family`}
          {filtersActive && ` · ${filteredRecipes.length} shown`}
        </p>
        {/* Picking a meal (onSelect) is no place to import or write one */}
        {!onSelect && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setIsAdding(!isAdding); setImportError(null); }}
              aria-expanded={isAdding}
              className={isAdding ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'}
            >
              {isAdding ? <X size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
              {isAdding ? 'Close' : 'Import'}
            </button>
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setAddMenuOpen(v => !v); }}
                className="icon-btn !size-9"
                aria-label="More ways to add recipes"
                aria-haspopup="menu"
                aria-expanded={addMenuOpen}
              >
                <Plus size={18} />
              </button>
              {addMenuOpen && (
                <div role="menu" className="absolute right-0 top-11 z-30 w-56 p-1.5 rounded-[16px] bg-surface border border-border shadow-[var(--elev-md)]">
                  {([
                    [<Plus size={16} aria-hidden="true" />, 'Write a recipe', handleManualAdd],
                    [<Sparkles size={16} aria-hidden="true" />, 'Create from ingredients', () => setShowIngredientModal(true)],
                    [<Download size={16} aria-hidden="true" />, 'Export all as JSON', handleExport],
                  ] as const).map(([icon, label, action]) => (
                    <button
                      key={label}
                      role="menuitem"
                      onClick={() => { setAddMenuOpen(false); action(); }}
                      className="w-full flex items-center gap-2.5 min-h-10 px-3 rounded-[10px] text-sm font-semibold text-left hover:bg-surface-sunken"
                    >
                      {icon} {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
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
            onChange={(e) => { setInputText(e.target.value); setImportError(null); setSameName(null); }}
            className={`input w-full min-h-[140px] ${importError ? 'input-error' : ''}`}
            placeholder="https://… or: Chicken stir fry, serves 4. 500 g chicken breast, 2 peppers…"
            aria-invalid={!!importError}
            aria-describedby={importError ? 'import-error' : undefined}
          />
          {importError && <p id="import-error" className="text-sm text-error -mt-2">{importError}</p>}

          {sameName && (
            <div className="tile tile-neutral gap-3" role="alert">
              <p className="text-sm">
                <span className="font-semibold">You already have “{sameName.existing.name}”.</span> Open it, or import this one as a second copy.
              </p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => { const { existing } = sameName; resetImport(); openRecipe(existing); }} className="btn-primary btn-sm">Open it</button>
                <button onClick={() => finishImport(sameName.recipe)} className="btn-secondary btn-sm">Import anyway</button>
              </div>
            </div>
          )}

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

      {/* Search, sort and layout, then one row of filter chips */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden="true" />
            <label htmlFor="recipe-search" className="sr-only">Search recipes</label>
            <input
              id="recipe-search"
              type="search"
              className="input w-full !pl-11"
              placeholder="Search recipes"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {/* Sort: full menu from sm, an icon over the same menu on phones */}
          <label className="relative shrink-0">
            <span className="sr-only">Sort by</span>
            <ArrowUpDown size={18} className="sm:hidden absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <select
              id="recipe-sort"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              className="input h-full w-11 sm:w-48 !px-0 sm:!px-4 !text-transparent sm:!text-[var(--text-main)] appearance-none sm:appearance-auto cursor-pointer [&_option]:!text-[var(--text-main)]"
            >
              <option value="name">Name A–Z</option>
              <option value="caloriesLow">Fewest calories</option>
              <option value="caloriesHigh">Most calories</option>
              <option value="protein">Most protein</option>
              <option value="lastHad">Not had in a while</option>
            </select>
          </label>
          {!onSelect && (
            <div className="segmented pill-group shrink-0 self-center" role="radiogroup" aria-label="Layout">
              {([['grid', LayoutGrid, 'Grid'], ['list', List, 'List']] as const).map(([value, Icon, label]) => (
                <button
                  key={value}
                  role="radio"
                  aria-checked={view === value}
                  aria-label={label}
                  title={label}
                  onClick={() => changeView(value)}
                  className="segment size-9 justify-center !px-0"
                >
                  {view === value && <SelectionPill group={layoutPillId} />}
                  <Icon size={18} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Phones scroll the chips sideways; from md they wrap, so none hide past the edge */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 py-0.5 md:flex-wrap md:overflow-visible" role="group" aria-label="Filter recipes">
          {chip(<><Heart size={14} fill={showFavoritesOnly ? 'currentColor' : 'none'} aria-hidden="true" /> Favourites</>, showFavoritesOnly, () => setShowFavoritesOnly(v => !v))}
          {duplicateIds.size > 0 && chip(<><Copy size={14} aria-hidden="true" /> Duplicates · {duplicateIds.size}</>, activeFilter === 'duplicates', () => setActiveFilter(f => (f === 'duplicates' ? 'all' : 'duplicates')))}
          {(familyCount > 0
            ? [['mine', 'Mine'], ['family', 'Family'], ['breakfast', 'Breakfast'], ['main meal', 'Main meals'], ['light meal', 'Light meals'], ['snack', 'Snacks']]
            : [['breakfast', 'Breakfast'], ['main meal', 'Main meals'], ['light meal', 'Light meals'], ['snack', 'Snacks']]
          ).map(([value, label]) => (
            <React.Fragment key={value}>
              {chip(label, activeFilter === value, () => setActiveFilter(f => (f === value ? 'all' : value)))}
            </React.Fragment>
          ))}
          {/* Space, rather than a line, between the kinds of meal and the tags */}
          <span className="shrink-0 w-2" aria-hidden="true" />
          {fastDayCount > 0 && chip(<><Flame size={14} aria-hidden="true" /> Fast day friendly</>, fastDayFriendly, () => setFastDayFriendly(v => !v), 'fasting')}
          {tagChips.map(([tag]) => (
            <React.Fragment key={tag}>
              {chip(tagLabel(tag), activeTag === tag, () => setActiveTag(t => (t === tag ? null : tag)))}
            </React.Fragment>
          ))}
        </div>
      </div>

      {activeFilter === 'duplicates' && (
        <p className="text-sm text-muted" role="status">
          These recipes share a name with another. Open the copy you don't need and delete it from its ⋯ menu.
        </p>
      )}

      {/* Grid or list */}
      <div className={view === 'list' && !onSelect && filteredRecipes.length > 0 && !(isLoading && recipes.length === 0) ? 'card p-1.5' : `grid gap-2.5 md:gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 ${isLoading && recipes.length === 0 ? '' : 'stagger'}`}>
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
              !onSelect && <button onClick={() => setIsAdding(true)} className="btn-primary btn-sm mt-4"><Link2 size={16} aria-hidden="true" /> Import a recipe</button>
            ) : (
              <button onClick={clearFilters} className="btn-secondary btn-sm mt-4">
                Clear filters
              </button>
            )}
          </div>
        ) : view === 'list' && !onSelect ? (
          <ul className="stagger">
            {filteredRecipes.map(recipe => (
              <RecipeRow
                key={recipe.id}
                meal={recipe}
                onClick={() => openRecipe(recipe)}
                ownerName={recipe.ownerName}
                onToggleFavorite={(e) => toggleFavorite(e, recipe)}
                onAddToPlan={() => setPlanTarget(recipe)}
                plannedLabel={plannedLabelFor(history?.next[recipe.id], today)}
                historyLabel={historyLabelFor(history?.lastHad[recipe.id], today)}
                tags={(recipe.tags || []).map(normalizeTag).filter(t => !MEAL_TYPE_TAGS.has(t)).map(tagLabel)}
              />
            ))}
          </ul>
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
              onAddToPlan={onSelect ? undefined : () => setPlanTarget(recipe)}
              plannedLabel={onSelect ? undefined : plannedLabelFor(history?.next[recipe.id], today)}
            />
          ))
        )}
      </div>

      {/* Feedback toast, kept clear of the bottom nav */}
      {toast && (
        <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-[calc(var(--tab-bar-bottom)+94px)] nav:bottom-8 z-[60] badge-ink !rounded-full !px-4 !py-2.5 text-sm font-semibold shadow-[var(--elev-md)] toast-in">
          {toast}
        </div>
      )}

      {planTarget && (
        <AddToPlanSheet
          recipe={planTarget}
          onClose={() => setPlanTarget(null)}
          onAdded={(message) => {
            setPlanTarget(null);
            showToast(message);
            ensureWarm(recipeHistoryData, true).catch(() => { /* badge updates next refresh */ });
          }}
          onError={showToast}
        />
      )}

      {cookRecipe && <CookingMode recipe={cookRecipe} onClose={() => setCookRecipe(null)} />}

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
              onEdit={startEditing}
              onDelete={(id, e) => handleDelete(e, id)}
              onAddToPlan={onSelect ? undefined : () => { setPlanTarget(selectedRecipe); closeRecipe(); }}
              onCook={() => setCookRecipe(selectedRecipe)}
              onSetImage={!selectedRecipe.image ? (url) => handleSetImage(selectedRecipe, url) : undefined}
            />
          )
        )
      }
    </div >
  );
};