import React, { useState, useEffect } from 'react';
import { Recipe } from '../types';
import { getRecipes, saveRecipe, deleteRecipe } from '../services/storageService';
import { parseRecipeText } from '../services/geminiService';
import { RecipeCard } from './RecipeCard';
import { getCategoryColor } from '../utils';
import { Portal } from './Portal';
import { RecipeIllustration } from './RecipeIllustration';
import { RecipeDetailModal } from './RecipeDetailModal';
import { ImageInput } from './ImageInput';


export const RecipeLibrary: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<string>('name');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Selection and Editing State
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'ingredients' | 'instructions'>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Recipe | null>(null);

  // Image upload state
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    getRecipes().then(setRecipes);
  }, []);

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

  const saveEditing = async () => {
    if (editForm) {
      const updatedRecipe: Recipe = {
        ...editForm,
        calories: Number(editForm.calories) || 0,
        protein: Number(editForm.protein) || 0,
        fat: Number(editForm.fat) || 0,
        carbs: Number(editForm.carbs) || 0,
        servings: Number(editForm.servings) || 1,
        ingredients: editForm.ingredients.filter(i => i.trim()),
        instructions: (editForm.instructions || []).filter(i => i.trim()),
      };

      // Safely handle image field
      if (uploadedImage) {
        updatedRecipe.image = uploadedImage;
      } else if (editForm.image) {
        updatedRecipe.image = editForm.image;
      } else {
        delete updatedRecipe.image; // Ensure it's not undefined
      }

      await saveRecipe(updatedRecipe);
      setRecipes(await getRecipes());
      setSelectedRecipe(updatedRecipe);
      setIsEditing(false);
      setEditForm(null);
      setUploadedImage(null);
    }
  };


  const handleImageSelect = (base64: string, mimeType: string) => {
    setImageError(null);
    // Store as data URL for display and storage
    const dataUrl = `data:${mimeType};base64,${base64}`;
    setUploadedImage(dataUrl);
  };

  const handleRemoveImage = () => {
    setUploadedImage(null);
  };

  const handleAIAdd = async () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);
    try {
      const partialRecipe = await parseRecipeText(inputText);
      if (partialRecipe) {
        const newRecipe: Recipe = {
          id: crypto.randomUUID(),
          name: partialRecipe.name || 'Untitled Recipe',
          description: 'Imported from text',
          calories: partialRecipe.calories || 0,
          protein: partialRecipe.protein || 0,
          fat: partialRecipe.fat || 0,
          carbs: partialRecipe.carbs || 0,
          ingredients: partialRecipe.ingredients || [],
          instructions: partialRecipe.instructions || [],
          type: (partialRecipe.type as any) || 'main meal',
          servings: partialRecipe.servings || 1,
        };

        if (uploadedImage) {
          newRecipe.image = uploadedImage;
        }

        await saveRecipe(newRecipe);
        setRecipes(await getRecipes());
        setIsAdding(false);
        setInputText('');
        setUploadedImage(null);
        setImageError(null);

        // Open the newly created recipe
        setSelectedRecipe(newRecipe);
        setActiveTab('overview');
      }
    } catch (e: any) {
      console.error("AI Import Failed:", e);
      const errorMessage = e.message || "Unknown error occurred";
      alert(`Failed to parse recipe via AI. \n\nError: ${errorMessage}\n\nPlease check the console for more details.`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Delete this recipe?')) {
      await deleteRecipe(id);
      setRecipes(await getRecipes());
      if (selectedRecipe?.id === id) closeRecipe();
    }
  };

  const toggleFavorite = async (e: React.MouseEvent, recipe: Recipe) => {
    e.stopPropagation();
    const updatedRecipe = { ...recipe, isFavorite: !recipe.isFavorite };

    // Optimistic update
    setRecipes(prev => prev.map(r => r.id === recipe.id ? updatedRecipe : r));

    await saveRecipe(updatedRecipe);
  };

  const handleExport = async () => {
    const allRecipes = await getRecipes();
    const blob = new Blob([JSON.stringify(allRecipes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fast800_recipes_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredRecipes = recipes
    .filter(recipe => {
      const matchesSearch =
        recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        recipe.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        recipe.ingredients.some(i => i.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesFilter = activeFilter === 'all' || recipe.type === activeFilter;
      const matchesFavorite = !showFavoritesOnly || recipe.isFavorite;

      return matchesSearch && matchesFilter && matchesFavorite;
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

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="heading-1">Recipe Library</h2>
          <p className="text-muted font-medium mt-2 text-lg">Manage your expanding collection of healthy meals.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="btn-secondary btn-sm flex items-center gap-2"
            title="Export Recipes to JSON"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className={`btn-sm flex items-center gap-2 ${isAdding ? 'btn-secondary' : 'btn-primary'}`}
          >
            {isAdding ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                Cancel
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                New Recipe
              </>
            )}
          </button>
        </div>
      </header>

      {isAdding && (
        <div className="card card-padding-lg animate-slide-in-down relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="heading-3 mb-2 flex items-center gap-2">
              <span className="bg-emerald-100 text-emerald-700 p-1.5 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg></span>
              Import Recipe via AI
            </h3>
            <p className="text-muted mb-6 max-w-2xl">Paste a recipe URL, full text, or even a rough list of ingredients. Our smart AI will parse the nutrition, ingredients, and instructions for you.</p>

            {/* Image Upload */}
            <div className="mb-6">
              <label className="block text-sm font-bold text-main mb-3">Recipe Photo (Optional)</label>
              {uploadedImage ? (
                <div className="relative rounded-2xl overflow-hidden border border-border">
                  <img src={uploadedImage} alt="Recipe preview" className="w-full h-48 object-cover" />
                  <button
                    onClick={handleRemoveImage}
                    className="absolute top-3 right-3 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transition-all"
                    title="Remove image"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              ) : (
                <ImageInput
                  onImageSelect={handleImageSelect}
                  onError={(err) => setImageError(err)}
                  disabled={isProcessing}
                  className="w-full"
                />
              )}
              {imageError && (
                <p className="text-red-600 text-sm mt-2">{imageError}</p>
              )}
            </div>

            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full input min-h-[160px] mb-4"
              placeholder="Paste your recipe here... e.g. 'Chicken Stir Fry, serves 4. Ingredients: 500g chicken breast...'"
            />
            <button
              onClick={handleAIAdd}
              disabled={isProcessing}
              className={isProcessing ? 'btn-primary w-full flex justify-center items-center gap-3 text-lg opacity-50' : 'btn-primary w-full flex justify-center items-center gap-3 text-lg'}
            >
              {isProcessing ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Processing Recipe...
                </>
              ) : (
                <>
                  <span>Magic Import</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"></path><path d="M12 19V5"></path></svg>
                </>
              )}
            </button>
          </div>

          {/* Background Decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-background rounded-full -translate-y-1/2 translate-x-1/2 opacity-50 pointer-events-none"></div>
        </div>
      )}

      {/* Search, Sort & Filters */}
      <div className="space-y-4 glass-panel p-4 rounded-2xl">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              className="block w-full !pl-12 input"
              placeholder="Search recipes, ingredients, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="relative min-w-[200px]">
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              className="appearance-none w-full input cursor-pointer font-bold pr-10"
            >
              <option value="name">Sort: Name (A-Z)</option>
              <option value="caloriesLow">Sort: Calories (Low)</option>
              <option value="caloriesHigh">Sort: Calories (High)</option>
              <option value="protein">Sort: Highest Protein</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-muted">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar pt-1">
          {['all', 'breakfast', 'main meal', 'snack', 'light meal'].map(type => (
            <button
              key={type}
              onClick={() => setActiveFilter(type)}
              className={`badge-md whitespace-nowrap transition-all border ${activeFilter === type
                ? 'bg-primary text-primary-foreground border-primary shadow-md transform scale-105'
                : 'bg-surface text-muted border-transparent hover:border-primary/20 hover:bg-surface/80'
                }`}
            >
              {type}
            </button>
          ))}
          <div className="w-px h-6 bg-slate-200 mx-1 self-center"></div>
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`badge-md whitespace-nowrap transition-all border flex items-center gap-1.5 ${showFavoritesOnly
              ? 'bg-red-50 text-red-600 border-red-200 shadow-md transform scale-105'
              : 'bg-surface text-muted border-transparent hover:border-red-100 hover:bg-red-50/50 hover:text-red-500'
              }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill={showFavoritesOnly ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>
            Favourites
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
        {filteredRecipes.length === 0 ? (
          <div className="md:col-span-full py-24 text-center">
            <div className="w-24 h-24 bg-background rounded-full flex items-center justify-center mx-auto mb-6 text-muted/30">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            </div>
            <p className="font-medium text-xl text-main mb-2">{recipes.length === 0 ? "Your library is empty." : "No recipes match your search."}</p>
            <p className="text-muted">{recipes.length === 0 ? "Get started by adding your first recipe above." : "Try adjusting your filters or search terms."}</p>
          </div>
        ) : (
          filteredRecipes.map(recipe => (
            <RecipeCard
              key={recipe.id}
              meal={recipe}
              onClick={() => openRecipe(recipe)}
              showMacros={false}
              onToggleFavorite={(e) => toggleFavorite(e, recipe)}
            />
          ))
        )}
      </div>

      {/* Recipe Detail / Edit Modal */}
      {selectedRecipe && (
        isEditing && editForm ? (
          <Portal>
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-4 animate-fade-in bg-slate-900/60 backdrop-blur-sm" onClick={closeRecipe}>
              <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col scale-100 animate-scale-in" onClick={e => e.stopPropagation()}>
                {/* --- Edit Mode --- */}
                <div className="flex flex-col h-full">
                  <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-white sticky top-0 z-10">
                    <h2 className="text-2xl font-bold text-slate-900 font-serif">Edit Recipe</h2>
                    <div className="flex gap-2">
                      <button onClick={cancelEditing} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg text-sm font-bold">Cancel</button>
                      <button onClick={saveEditing} className="px-5 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-900/10">Save Changes</button>
                    </div>
                  </div>

                  <div className="p-8 space-y-8 overflow-y-auto">
                    <div className="space-y-6">
                      {/* Image Upload Section */}
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-3">Recipe Photo (Optional)</label>
                        {uploadedImage ? (
                          <div className="relative rounded-2xl overflow-hidden border border-slate-200">
                            <img src={uploadedImage} alt="Recipe preview" className="w-full h-64 object-cover" />
                            <button
                              onClick={handleRemoveImage}
                              className="absolute top-3 right-3 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transition-all"
                              title="Remove image"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                          </div>
                        ) : (
                          <ImageInput
                            onImageSelect={handleImageSelect}
                            onError={(err) => setImageError(err)}
                            className="w-full"
                          />
                        )}
                        {imageError && (
                          <p className="text-red-600 text-sm mt-2">{imageError}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Recipe Name</label>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full p-4 border border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:outline-none font-medium bg-slate-50 text-slate-900 text-lg"
                          placeholder="Recipe Name"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">Meal Type</label>
                          <select
                            value={editForm.type}
                            onChange={e => setEditForm({ ...editForm, type: e.target.value as any })}
                            className="w-full p-3.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:outline-none bg-slate-50 font-medium text-slate-900"
                          >
                            <option value="breakfast">Breakfast</option>
                            <option value="main meal">Main Meal</option>
                            <option value="snack">Snack</option>
                            <option value="light meal">Light Meal</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">Servings</label>
                          <input
                            type="number"
                            min="1"
                            value={editForm.servings}
                            onChange={e => setEditForm({ ...editForm, servings: parseInt(e.target.value) || 1 })}
                            className="w-full p-3.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:outline-none font-medium bg-slate-50 text-slate-900"
                          />
                        </div>
                      </div>

                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                        <label className="block text-sm font-bold text-slate-900 mb-4">Nutrition per serving</label>
                        <div className="grid grid-cols-4 gap-4">
                          {[
                            { label: 'Calories', val: editForm.calories, key: 'calories' },
                            { label: 'Protein (g)', val: editForm.protein, key: 'protein' },
                            { label: 'Fat (g)', val: editForm.fat, key: 'fat' },
                            { label: 'Carbs (g)', val: editForm.carbs, key: 'carbs' }
                          ].map((item) => (
                            <div key={item.key}>
                              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">{item.label}</label>
                              <input
                                type="number"
                                min="0"
                                value={item.val || 0}
                                onChange={e => setEditForm({ ...editForm, [item.key]: parseInt(e.target.value) || 0 })}
                                className="w-full p-3 border border-slate-200 rounded-xl text-sm text-center font-bold bg-white focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Ingredients <span className="text-slate-400 font-normal">(one per line)</span></label>
                        <textarea
                          rows={6}
                          value={editForm.ingredients.join('\n')}
                          onChange={e => setEditForm({ ...editForm, ingredients: e.target.value.split('\n') })}
                          className="w-full p-4 border border-slate-200 rounded-xl font-medium text-sm leading-relaxed focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:outline-none bg-slate-50 text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Instructions <span className="text-slate-400 font-normal">(one per line)</span></label>
                        <textarea
                          rows={6}
                          value={(editForm.instructions || []).join('\n')}
                          onChange={e => setEditForm({ ...editForm, instructions: e.target.value.split('\n') })}
                          className="w-full p-4 border border-slate-200 rounded-xl font-medium text-sm leading-relaxed focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:outline-none bg-slate-50 text-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Portal>
        ) : (
          <RecipeDetailModal
            recipe={selectedRecipe}
            onClose={closeRecipe}
            onEdit={startEditing}
            onDelete={(id, e) => handleDelete(e, id)}
          />
        )
      )}
    </div>
  );
};