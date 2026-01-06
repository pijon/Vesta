import React, { useState, useEffect } from 'react';
import { Recipe } from '../types';
import { getRecipes, saveRecipe, deleteRecipe } from '../services/storageService';
import { parseRecipeText } from '../services/geminiService';
import { PLACEHOLDER_IMAGE } from '../constants';

export const RecipeLibrary: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
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
          type: (partialRecipe.type as any) || 'lunch',
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

  const filteredRecipes = recipes.filter(recipe => 
    recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    recipe.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    recipe.ingredients.some(i => i.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="flex justify-between items-center">
        <div>
           <h2 className="text-4xl font-normal text-[#1F2823] tracking-tight font-serif">Recipe Library</h2>
           <p className="text-[#1F2823]/70 font-medium mt-1">Manage your collection.</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg ${isAdding ? 'bg-white text-[#1F2823] hover:bg-white/80' : 'bg-[#1F2823] text-white hover:bg-[#1F2823]/90'}`}
        >
          {isAdding ? 'Cancel' : '+ New Recipe'}
        </button>
      </header>

      {isAdding && (
        <div className="bg-[#1F2823] p-8 rounded-3xl shadow-xl shadow-[#1F2823]/10 border border-[#2A362F] animate-fade-in">
          <h3 className="text-xl font-normal text-white mb-2 font-serif">Import Recipe</h3>
          <p className="text-sm text-[#9CA3AF] mb-4">Paste a recipe URL, text, or just type ingredients. Our AI will format it for you.</p>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full p-4 bg-[#2A362F] border border-[#3E4C43] rounded-2xl text-sm mb-4 focus:ring-1 focus:ring-[#A3E635] outline-none min-h-[120px] text-white placeholder-[#52525B]"
            placeholder="e.g. Chicken Stir Fry, serves 4. Ingredients: 500g chicken breast..."
          />
          <button
            onClick={handleAIAdd}
            disabled={isProcessing}
            className="w-full bg-[#A3E635] text-[#1F2823] py-3 rounded-xl font-bold hover:bg-[#bef264] transition-colors flex justify-center items-center gap-2 shadow-sm"
          >
            {isProcessing ? (
              <>
                 <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                 Processing...
              </>
            ) : (
              <>
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
               Save to Library
              </>
            )}
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#1F2823]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
        </div>
        <input
            type="text"
            className="block w-full pl-11 pr-4 py-3.5 border border-[#1F2823]/10 rounded-2xl leading-5 bg-white placeholder-[#1F2823]/40 focus:outline-none focus:ring-1 focus:ring-[#1F2823] transition-all shadow-sm text-[#1F2823]"
            placeholder="Search by name, type, or ingredient..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {filteredRecipes.length === 0 ? (
           <div className="md:col-span-2 text-center py-16 text-[#1F2823]/50 bg-white rounded-3xl border border-dashed border-[#1F2823]/10">
             <p className="font-medium text-lg">{recipes.length === 0 ? "No recipes yet." : "No recipes match your search."}</p>
             {recipes.length === 0 && <p className="text-sm mt-2">Click "New Recipe" to start building your library.</p>}
           </div>
        ) : (
          filteredRecipes.map(recipe => (
            <div 
                key={recipe.id} 
                onClick={() => openRecipe(recipe)}
                className="bg-[#1F2823] p-5 rounded-3xl shadow-lg border border-[#2A362F] flex gap-5 cursor-pointer hover:border-[#A3E635]/50 transition-all group"
            >
               <img 
                 src={`${PLACEHOLDER_IMAGE}?random=${recipe.id}`} 
                 className="w-24 h-24 rounded-2xl object-cover bg-[#2A362F] flex-shrink-0 opacity-90 group-hover:opacity-100 transition-opacity"
                 alt={recipe.name}
               />
               <div className="flex-1 min-w-0 flex flex-col justify-center">
                 <div className="flex justify-between items-start mb-1">
                    <h3 className="font-normal text-white text-xl truncate font-serif">{recipe.name}</h3>
                    <button onClick={(e) => handleDelete(e, recipe.id)} className="text-[#52525B] hover:text-red-400 p-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                 </div>
                 <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#2A362F] text-[#9CA3AF] uppercase tracking-wide">{recipe.type}</span>
                    <span className="text-sm font-bold text-[#A3E635]">{recipe.calories} kcal</span>
                 </div>
                 <p className="text-xs text-[#9CA3AF] truncate">
                   {recipe.ingredients.length} ingredients • Serves {recipe.servings || 1}
                 </p>
               </div>
            </div>
          ))
        )}
      </div>

      {/* Recipe Detail / Edit Modal - Using Light Mode for Detail View for readability */}
      {selectedRecipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1F2823]/70 backdrop-blur-md animate-fade-in" onClick={closeRecipe}>
            <div className="bg-[#D4E0D1] w-full max-w-3xl rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col border border-[#1F2823]/10" onClick={e => e.stopPropagation()}>
                {/* Image Header */}
                <div className="relative h-48 md:h-64 flex-shrink-0 bg-[#2A362F]">
                    <img 
                        src={`${PLACEHOLDER_IMAGE}?random=${selectedRecipe.id}`} 
                        className="w-full h-full object-cover"
                        alt={selectedRecipe.name}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1F2823]/90 to-transparent"></div>
                    <button 
                        onClick={closeRecipe}
                        className="absolute top-6 right-6 bg-[#1F2823]/40 backdrop-blur-md p-2 rounded-full text-white hover:bg-[#1F2823]/60 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                    {!isEditing && (
                         <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
                            <div>
                                <h2 className="text-4xl font-normal text-white mb-2 font-serif">{selectedRecipe.name}</h2>
                                <div className="flex gap-2">
                                    <span className="px-3 py-1 bg-[#2A362F]/60 backdrop-blur-md rounded-lg text-xs font-bold uppercase tracking-wider text-white border border-white/10">{selectedRecipe.type}</span>
                                    <span className="px-3 py-1 bg-[#A3E635] rounded-lg text-xs font-bold text-[#1F2823]">{selectedRecipe.calories} kcal</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                {isEditing && editForm ? (
                    // --- Edit Mode ---
                    <div className="p-8 space-y-6 bg-[#D4E0D1]">
                         <div className="flex justify-between items-center pb-4 border-b border-[#1F2823]/10">
                            <h2 className="text-2xl font-normal text-[#1F2823] font-serif">Edit Recipe</h2>
                            <div className="flex gap-2">
                                <button onClick={cancelEditing} className="px-4 py-2 text-[#1F2823]/60 hover:bg-[#1F2823]/10 rounded-xl text-sm font-bold">Cancel</button>
                                <button onClick={saveEditing} className="px-5 py-2 bg-[#1F2823] text-white rounded-xl text-sm font-bold hover:bg-[#1F2823]/90">Save Changes</button>
                            </div>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-[#1F2823] mb-1.5">Recipe Name</label>
                                <input 
                                    type="text" 
                                    value={editForm.name} 
                                    onChange={e => setEditForm({...editForm, name: e.target.value})}
                                    className="w-full p-3 border border-[#1F2823]/10 rounded-xl focus:ring-1 focus:ring-[#1F2823] focus:outline-none font-medium bg-white text-[#1F2823]"
                                />
                            </div>
                            {/* ... inputs ... */}
                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                     <label className="block text-sm font-bold text-[#1F2823] mb-1.5">Meal Type</label>
                                     <select 
                                        value={editForm.type}
                                        onChange={e => setEditForm({...editForm, type: e.target.value as any})}
                                        className="w-full p-3 border border-[#1F2823]/10 rounded-xl focus:ring-1 focus:ring-[#1F2823] focus:outline-none bg-white font-medium text-[#1F2823]"
                                     >
                                        <option value="breakfast">Breakfast</option>
                                        <option value="lunch">Lunch</option>
                                        <option value="dinner">Dinner</option>
                                        <option value="snack">Snack</option>
                                     </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-[#1F2823] mb-1.5">Servings</label>
                                    <input 
                                         type="number"
                                         min="1"
                                         value={editForm.servings}
                                         onChange={e => setEditForm({...editForm, servings: parseInt(e.target.value) || 1})}
                                         className="w-full p-3 border border-[#1F2823]/10 rounded-xl focus:ring-1 focus:ring-[#1F2823] focus:outline-none font-medium bg-white text-[#1F2823]"
                                    />
                                </div>
                             </div>

                             <div className="bg-white p-5 rounded-2xl border border-[#1F2823]/10">
                                 <label className="block text-sm font-bold text-[#1F2823] mb-3">Nutrition per serving</label>
                                 <div className="grid grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-[#1F2823]/60 mb-1">Calories</label>
                                        <input type="number" min="0" value={editForm.calories} onChange={e => setEditForm({...editForm, calories: parseInt(e.target.value) || 0})} className="w-full p-2 border border-[#1F2823]/10 rounded-lg text-sm text-center font-bold bg-[#F6F8FA]" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-[#1F2823]/60 mb-1">Protein (g)</label>
                                        <input type="number" min="0" value={editForm.protein || 0} onChange={e => setEditForm({...editForm, protein: parseInt(e.target.value) || 0})} className="w-full p-2 border border-[#1F2823]/10 rounded-lg text-sm text-center font-bold bg-[#F6F8FA]" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-[#1F2823]/60 mb-1">Fat (g)</label>
                                        <input type="number" min="0" value={editForm.fat || 0} onChange={e => setEditForm({...editForm, fat: parseInt(e.target.value) || 0})} className="w-full p-2 border border-[#1F2823]/10 rounded-lg text-sm text-center font-bold bg-[#F6F8FA]" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-[#1F2823]/60 mb-1">Carbs (g)</label>
                                        <input type="number" min="0" value={editForm.carbs || 0} onChange={e => setEditForm({...editForm, carbs: parseInt(e.target.value) || 0})} className="w-full p-2 border border-[#1F2823]/10 rounded-lg text-sm text-center font-bold bg-[#F6F8FA]" />
                                    </div>
                                 </div>
                             </div>

                             <div>
                                <label className="block text-sm font-bold text-[#1F2823] mb-1.5">Ingredients <span className="text-[#1F2823]/40 font-normal">(one per line)</span></label>
                                <textarea 
                                    rows={5}
                                    value={editForm.ingredients.join('\n')}
                                    onChange={e => setEditForm({...editForm, ingredients: e.target.value.split('\n')})}
                                    className="w-full p-3 border border-[#1F2823]/10 rounded-xl font-medium text-sm leading-relaxed focus:ring-1 focus:ring-[#1F2823] focus:outline-none bg-white text-[#1F2823]"
                                />
                             </div>

                             <div>
                                <label className="block text-sm font-bold text-[#1F2823] mb-1.5">Instructions <span className="text-[#1F2823]/40 font-normal">(one per line)</span></label>
                                <textarea 
                                    rows={5}
                                    value={(editForm.instructions || []).join('\n')}
                                    onChange={e => setEditForm({...editForm, instructions: e.target.value.split('\n')})}
                                    className="w-full p-3 border border-[#1F2823]/10 rounded-xl font-medium text-sm leading-relaxed focus:ring-1 focus:ring-[#1F2823] focus:outline-none bg-white text-[#1F2823]"
                                />
                             </div>
                        </div>
                    </div>
                ) : (
                    // --- View Mode (Light) ---
                    <div className="p-8 space-y-8 bg-[#D4E0D1]">
                        <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-[#1F2823]/10">
                             <div className="flex gap-6 text-sm">
                                 <div className="text-center"><p className="text-[#1F2823]/50 text-xs uppercase font-bold">Protein</p><p className="font-bold text-[#1F2823] text-lg">{selectedRecipe.protein || 0}<span className="text-xs font-normal text-[#1F2823]/50">g</span></p></div>
                                 <div className="w-px h-auto bg-[#1F2823]/10"></div>
                                 <div className="text-center"><p className="text-[#1F2823]/50 text-xs uppercase font-bold">Fat</p><p className="font-bold text-[#1F2823] text-lg">{selectedRecipe.fat || 0}<span className="text-xs font-normal text-[#1F2823]/50">g</span></p></div>
                                 <div className="w-px h-auto bg-[#1F2823]/10"></div>
                                 <div className="text-center"><p className="text-[#1F2823]/50 text-xs uppercase font-bold">Carbs</p><p className="font-bold text-[#1F2823] text-lg">{selectedRecipe.carbs || 0}<span className="text-xs font-normal text-[#1F2823]/50">g</span></p></div>
                             </div>
                             <div className="flex gap-2">
                                <button 
                                    onClick={(e) => handleDelete(e, selectedRecipe.id)}
                                    className="p-2.5 bg-transparent border border-[#1F2823]/10 text-[#1F2823]/40 hover:text-red-600 hover:border-red-200 rounded-xl transition-colors"
                                    title="Delete"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </button>
                                <button 
                                    onClick={startEditing}
                                    className="px-5 py-2.5 bg-[#1F2823] text-white hover:bg-[#1F2823]/90 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                    Edit Recipe
                                </button>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-10">
                            <div>
                                <h3 className="font-normal text-[#1F2823] mb-4 flex items-center gap-2 text-xl font-serif">
                                    Ingredients
                                </h3>
                                <ul className="space-y-3">
                                    {selectedRecipe.ingredients.map((ing, i) => (
                                        <li key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white border border-[#1F2823]/10 text-sm text-[#1F2823] font-medium">
                                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#A3E635] flex-shrink-0"></span>
                                            <span className="leading-relaxed">{ing}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                             <div>
                                <h3 className="font-normal text-[#1F2823] mb-4 flex items-center gap-2 text-xl font-serif">
                                    Instructions
                                </h3>
                                {selectedRecipe.instructions && selectedRecipe.instructions.length > 0 ? (
                                    <div className="space-y-4">
                                        {selectedRecipe.instructions.map((step, i) => (
                                            <div key={i} className="flex gap-4">
                                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#1F2823] text-white text-xs font-bold flex items-center justify-center mt-0.5">{i+1}</span>
                                                <p className="text-[#1F2823]/80 text-sm leading-relaxed">{step}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[#1F2823]/40 text-sm italic">No instructions provided.</p>
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