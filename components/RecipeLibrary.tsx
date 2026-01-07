import React, { useState, useEffect } from 'react';
import { Recipe } from '../types';
import { getRecipes, saveRecipe, deleteRecipe } from '../services/storageService';
import { parseRecipeText } from '../services/geminiService';
import { RecipeIllustration } from './RecipeIllustration';
import { RecipeCard } from './RecipeCard';

export const RecipeLibrary: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<string>('name');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  
  // Selection and Editing State
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Recipe | null>(null);

  useEffect(() => {
    setRecipes(getRecipes());
  }, []);

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
        setIsEditing(true);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditForm(null);
  };

  const saveEditing = () => {
    if (editForm) {
        const updatedRecipe: Recipe = {
            ...editForm,
            calories: Number(editForm.calories) || 0,
            protein: Number(editForm.protein) || 0,
            fat: Number(editForm.fat) || 0,
            carbs: Number(editForm.carbs) || 0,
            servings: Number(editForm.servings) || 1,
            ingredients: editForm.ingredients.filter(i => i.trim()),
            instructions: (editForm.instructions || []).filter(i => i.trim())
        };

        saveRecipe(updatedRecipe);
        setRecipes(getRecipes());
        setSelectedRecipe(updatedRecipe);
        setIsEditing(false);
        setEditForm(null);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                // Resize image to max 800x800 to save storage
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 800;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                
                // Compress to JPEG 0.7
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                setEditForm(prev => prev ? ({ ...prev, image: dataUrl }) : null);
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
      setEditForm(prev => prev ? ({ ...prev, image: undefined }) : null);
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
          servings: partialRecipe.servings || 1
        };
        saveRecipe(newRecipe);
        setRecipes(getRecipes());
        setIsAdding(false);
        setInputText('');
      }
    } catch (e) {
      alert("Failed to parse recipe. Please try manual entry or simpler text.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Delete this recipe?')) {
      deleteRecipe(id);
      setRecipes(getRecipes());
      if (selectedRecipe?.id === id) closeRecipe();
    }
  };

  const handleExport = () => {
      const allRecipes = getRecipes();
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

      return matchesSearch && matchesFilter;
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
    <div className="space-y-8 animate-fade-in">
      <header className="flex justify-between items-center">
        <div>
           <h2 className="text-3xl font-normal text-slate-900 tracking-tight font-serif">Recipe Library</h2>
           <p className="text-slate-500 font-medium mt-1">Manage your collection.</p>
        </div>
        <div className="flex gap-2">
            <button 
              onClick={handleExport}
              className="px-4 py-2 rounded-xl text-sm font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2"
              title="Export Recipes to JSON"
            >
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
               <span className="hidden sm:inline">Export</span>
            </button>
            <button 
              onClick={() => setIsAdding(!isAdding)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm ${isAdding ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
            >
              {isAdding ? 'Cancel' : '+ New Recipe'}
            </button>
        </div>
      </header>

      {isAdding && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 animate-fade-in">
          <h3 className="text-lg font-medium text-slate-900 mb-2 font-serif">Import Recipe</h3>
          <p className="text-sm text-slate-500 mb-4">Paste a recipe URL, text, or just type ingredients. Our AI will format it for you.</p>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm mb-4 focus:ring-2 focus:ring-emerald-500 focus:outline-none min-h-[120px] text-slate-900 placeholder-slate-400"
            placeholder="e.g. Chicken Stir Fry, serves 4. Ingredients: 500g chicken breast..."
          />
          <button
            onClick={handleAIAdd}
            disabled={isProcessing}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors flex justify-center items-center gap-2 shadow-sm disabled:opacity-50"
          >
            {isProcessing ? 'Processing...' : 'Save to Library'}
          </button>
        </div>
      )}

      {/* Search, Sort & Filters */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
                <input
                    type="text"
                    className="block w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm text-slate-900"
                    placeholder="Search recipes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            
            <div className="relative min-w-[180px]">
                <select 
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value)}
                    className="appearance-none w-full bg-white border border-slate-200 text-slate-900 py-3 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer font-medium shadow-sm"
                >
                    <option value="name">Name (A-Z)</option>
                    <option value="caloriesLow">Calories (Low)</option>
                    <option value="caloriesHigh">Calories (High)</option>
                    <option value="protein">Highest Protein</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
            </div>
        </div>

        {/* Filter Chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {['all', 'breakfast', 'main meal', 'snack', 'light meal'].map(type => (
                <button
                    key={type}
                    onClick={() => setActiveFilter(type)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase whitespace-nowrap transition-all border ${
                        activeFilter === type 
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                >
                    {type}
                </button>
            ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredRecipes.length === 0 ? (
           <div className="md:col-span-full text-center py-16 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
             <p className="font-medium text-lg">{recipes.length === 0 ? "No recipes yet." : "No recipes match your search."}</p>
             {recipes.length === 0 && <p className="text-sm mt-2">Click "New Recipe" to start building your library.</p>}
           </div>
        ) : (
          filteredRecipes.map(recipe => (
             <RecipeCard 
                key={recipe.id} 
                meal={recipe} 
                onClick={() => openRecipe(recipe)}
             />
          ))
        )}
      </div>

      {/* Recipe Detail / Edit Modal */}
      {selectedRecipe && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 pb-4 animate-fade-in" onClick={closeRecipe}>
            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl max-h-[80vh] overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Image Header */}
                <div className="relative h-48 md:h-64 flex-shrink-0 bg-slate-100 overflow-hidden">
                    {/* Conditionally render Image or Illustration */}
                    {!isEditing && selectedRecipe.image ? (
                         <img src={selectedRecipe.image} alt={selectedRecipe.name} className="w-full h-full object-cover" />
                    ) : (
                        <RecipeIllustration 
                            name={selectedRecipe.name} 
                            ingredients={selectedRecipe.ingredients} 
                            type={selectedRecipe.type} 
                            className="w-full h-full"
                        />
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                    <button 
                        onClick={closeRecipe}
                        className="absolute top-6 right-6 bg-white/20 backdrop-blur-md p-2 rounded-full text-white hover:bg-white/40 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                    {!isEditing && (
                         <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
                            <div>
                                <h2 className="text-3xl font-normal text-white mb-2 font-serif">{selectedRecipe.name}</h2>
                                <div className="flex gap-2">
                                    <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-lg text-xs font-bold uppercase tracking-wider text-white border border-white/20">{selectedRecipe.type}</span>
                                    <span className="px-3 py-1 bg-emerald-500 rounded-lg text-xs font-bold text-white">{selectedRecipe.calories} kcal</span>
                                    <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-lg text-xs font-bold uppercase tracking-wider text-white border border-white/20">Serves {selectedRecipe.servings || 1}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                {isEditing && editForm ? (
                    // --- Edit Mode ---
                    <div className="p-6 space-y-6">
                         <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                            <h2 className="text-2xl font-normal text-slate-900 font-serif">Edit Recipe</h2>
                            <div className="flex gap-2">
                                <button onClick={cancelEditing} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg text-sm font-bold">Cancel</button>
                                <button onClick={saveEditing} className="px-5 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-emerald-700">Save Changes</button>
                            </div>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Recipe Image</label>
                                <div className="flex items-center gap-4">
                                    <div className="w-20 h-20 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 flex-shrink-0">
                                        {editForm.image ? (
                                            <img src={editForm.image} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <input 
                                            type="file" 
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 mb-2"
                                        />
                                        {editForm.image && (
                                            <button 
                                                onClick={handleRemoveImage}
                                                className="text-xs text-red-500 hover:text-red-700 font-bold"
                                            >
                                                Remove Image
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Recipe Name</label>
                                <input 
                                    type="text" 
                                    value={editForm.name} 
                                    onChange={e => setEditForm({...editForm, name: e.target.value})}
                                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium bg-slate-50 text-slate-900"
                                />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                     <label className="block text-sm font-bold text-slate-700 mb-1.5">Meal Type</label>
                                     <select 
                                        value={editForm.type}
                                        onChange={e => setEditForm({...editForm, type: e.target.value as any})}
                                        className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50 font-medium text-slate-900"
                                     >
                                        <option value="breakfast">Breakfast</option>
                                        <option value="main meal">Main Meal</option>
                                        <option value="snack">Snack</option>
                                        <option value="light meal">Light Meal</option>
                                     </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Servings</label>
                                    <input 
                                         type="number"
                                         min="1"
                                         value={editForm.servings}
                                         onChange={e => setEditForm({...editForm, servings: parseInt(e.target.value) || 1})}
                                         className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium bg-slate-50 text-slate-900"
                                    />
                                </div>
                             </div>

                             <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                                 <label className="block text-sm font-bold text-slate-700 mb-3">Nutrition per serving</label>
                                 <div className="grid grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">Calories</label>
                                        <input type="number" min="0" value={editForm.calories} onChange={e => setEditForm({...editForm, calories: parseInt(e.target.value) || 0})} className="w-full p-2 border border-slate-200 rounded-lg text-sm text-center font-bold bg-white" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">Protein (g)</label>
                                        <input type="number" min="0" value={editForm.protein || 0} onChange={e => setEditForm({...editForm, protein: parseInt(e.target.value) || 0})} className="w-full p-2 border border-slate-200 rounded-lg text-sm text-center font-bold bg-white" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">Fat (g)</label>
                                        <input type="number" min="0" value={editForm.fat || 0} onChange={e => setEditForm({...editForm, fat: parseInt(e.target.value) || 0})} className="w-full p-2 border border-slate-200 rounded-lg text-sm text-center font-bold bg-white" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">Carbs (g)</label>
                                        <input type="number" min="0" value={editForm.carbs || 0} onChange={e => setEditForm({...editForm, carbs: parseInt(e.target.value) || 0})} className="w-full p-2 border border-slate-200 rounded-lg text-sm text-center font-bold bg-white" />
                                    </div>
                                </div>
                             </div>

                             <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Ingredients <span className="text-slate-400 font-normal">(one per line)</span></label>
                                <textarea 
                                    rows={5}
                                    value={editForm.ingredients.join('\n')}
                                    onChange={e => setEditForm({...editForm, ingredients: e.target.value.split('\n')})}
                                    className="w-full p-3 border border-slate-200 rounded-xl font-medium text-sm leading-relaxed focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50 text-slate-900"
                                />
                             </div>

                             <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Instructions <span className="text-slate-400 font-normal">(one per line)</span></label>
                                <textarea 
                                    rows={5}
                                    value={(editForm.instructions || []).join('\n')}
                                    onChange={e => setEditForm({...editForm, instructions: e.target.value.split('\n')})}
                                    className="w-full p-3 border border-slate-200 rounded-xl font-medium text-sm leading-relaxed focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50 text-slate-900"
                                />
                             </div>
                        </div>
                    </div>
                ) : (
                    // --- View Mode ---
                    <div className="p-6 space-y-6">
                        <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                             <div className="flex gap-6 text-sm">
                                 <div className="text-center"><p className="text-slate-400 text-xs uppercase font-bold">Protein</p><p className="font-bold text-slate-900 text-lg">{selectedRecipe.protein || 0}<span className="text-xs font-normal text-slate-400">g</span></p></div>
                                 <div className="w-px h-auto bg-slate-200"></div>
                                 <div className="text-center"><p className="text-slate-400 text-xs uppercase font-bold">Fat</p><p className="font-bold text-slate-900 text-lg">{selectedRecipe.fat || 0}<span className="text-xs font-normal text-slate-400">g</span></p></div>
                                 <div className="w-px h-auto bg-slate-200"></div>
                                 <div className="text-center"><p className="text-slate-400 text-xs uppercase font-bold">Carbs</p><p className="font-bold text-slate-900 text-lg">{selectedRecipe.carbs || 0}<span className="text-xs font-normal text-slate-400">g</span></p></div>
                             </div>
                             <div className="flex gap-2">
                                <button 
                                    onClick={(e) => handleDelete(e, selectedRecipe.id)}
                                    className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 rounded-lg transition-colors"
                                    title="Delete"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </button>
                                <button 
                                    onClick={startEditing}
                                    className="px-5 py-2.5 bg-slate-900 text-white hover:bg-emerald-700 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                    Edit Recipe
                                </button>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-10">
                            <div>
                                <h3 className="font-medium text-slate-900 mb-4 flex items-center gap-2 text-xl font-serif">
                                    Ingredients
                                </h3>
                                <ul className="space-y-3">
                                    {selectedRecipe.ingredients.map((ing, i) => (
                                        <li key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-700 font-medium">
                                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"></span>
                                            <span className="leading-relaxed">{ing}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                             <div>
                                <h3 className="font-medium text-slate-900 mb-4 flex items-center gap-2 text-xl font-serif">
                                    Instructions
                                </h3>
                                {selectedRecipe.instructions && selectedRecipe.instructions.length > 0 ? (
                                    <div className="space-y-4">
                                        {selectedRecipe.instructions.map((step, i) => (
                                            <div key={i} className="flex gap-4">
                                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center mt-0.5">{i+1}</span>
                                                <p className="text-slate-600 text-sm leading-relaxed">{step}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-slate-400 text-sm italic">No instructions provided.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
};