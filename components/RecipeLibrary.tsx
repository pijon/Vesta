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
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  useEffect(() => {
    setRecipes(getRecipes());
  }, []);

  const handleAIAdd = async () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);
    try {
      const partialRecipe = await parseRecipeText(inputText);
      if (partialRecipe) {
        // Complete the recipe object
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
      if (selectedRecipe?.id === id) setSelectedRecipe(null);
    }
  };

  const filteredRecipes = recipes.filter(recipe => 
    recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    recipe.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    recipe.ingredients.some(i => i.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-20">
      <header className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">My Recipes</h2>
           <p className="text-slate-500 text-sm">Manage your 800kcal compliant meals</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors"
        >
          {isAdding ? 'Cancel' : '+ Add Recipe'}
        </button>
      </header>

      {isAdding && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-emerald-100 animate-fade-in">
          <h3 className="font-semibold text-slate-800 mb-2">Add New Recipe</h3>
          <p className="text-xs text-slate-500 mb-3">Paste a recipe URL, text, or just type ingredients. AI will format it.</p>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full p-3 border border-slate-200 rounded-lg text-sm mb-3 focus:ring-2 focus:ring-emerald-500 outline-none"
            rows={4}
            placeholder="e.g. Chicken Stir Fry, serves 4. Ingredients: 500g chicken breast..."
          />
          <button
            onClick={handleAIAdd}
            disabled={isProcessing}
            className="w-full bg-slate-800 text-white py-2 rounded-lg font-medium hover:bg-slate-900 transition-colors flex justify-center items-center gap-2"
          >
            {isProcessing ? (
              <>Processing...</>
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
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
        </div>
        <input
            type="text"
            className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm"
            placeholder="Search by name, type, or ingredient..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="grid gap-4">
        {filteredRecipes.length === 0 ? (
           <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
             <p>{recipes.length === 0 ? "No recipes yet." : "No recipes match your search."}</p>
             {recipes.length === 0 && <p className="text-sm">Click "Add Recipe" to start building your library.</p>}
           </div>
        ) : (
          filteredRecipes.map(recipe => (
            <div 
                key={recipe.id} 
                onClick={() => setSelectedRecipe(recipe)}
                className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex gap-4 cursor-pointer hover:shadow-md transition-shadow group"
            >
               <img 
                 src={`${PLACEHOLDER_IMAGE}?random=${recipe.id}`} 
                 className="w-20 h-20 rounded-lg object-cover bg-slate-100 flex-shrink-0"
                 alt={recipe.name}
               />
               <div className="flex-1 min-w-0">
                 <div className="flex justify-between items-start">
                    <h3 className="font-bold text-slate-800 truncate group-hover:text-emerald-700 transition-colors">{recipe.name}</h3>
                    <button onClick={(e) => handleDelete(e, recipe.id)} className="text-slate-400 hover:text-red-500 p-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                 </div>
                 <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase">{recipe.type}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 uppercase">Serves {recipe.servings || 1}</span>
                    <span className="text-sm font-semibold text-slate-600">{recipe.calories} kcal <span className="text-xs font-normal text-slate-400">/serving</span></span>
                 </div>
                 <p className="text-xs text-slate-500 mt-2 truncate">
                   {recipe.ingredients.length} ingredients
                 </p>
               </div>
            </div>
          ))
        )}
      </div>

      {/* Recipe Detail Modal */}
      {selectedRecipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedRecipe(null)}>
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="relative h-48 md:h-64 flex-shrink-0">
                    <img 
                        src={`${PLACEHOLDER_IMAGE}?random=${selectedRecipe.id}`} 
                        className="w-full h-full object-cover"
                        alt={selectedRecipe.name}
                    />
                    <button 
                        onClick={() => setSelectedRecipe(null)}
                        className="absolute top-4 right-4 bg-white/90 p-2 rounded-full text-slate-800 hover:bg-white transition-colors shadow-lg z-10"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 flex gap-2 pt-12">
                        <span className="px-3 py-1 bg-white/90 backdrop-blur rounded-full text-xs font-bold uppercase tracking-wider text-slate-800 shadow-sm">{selectedRecipe.type}</span>
                         <span className="px-3 py-1 bg-emerald-500/90 backdrop-blur rounded-full text-xs font-bold text-white shadow-sm">{selectedRecipe.calories} kcal</span>
                    </div>
                </div>
                
                <div className="p-6 md:p-8 space-y-6">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">{selectedRecipe.name}</h2>
                        <div className="flex flex-wrap gap-4 text-sm text-slate-500 font-medium">
                             <div className="flex items-center gap-1"><span className="text-emerald-600">Protein:</span> {selectedRecipe.protein || 0}g</div>
                             <div className="flex items-center gap-1"><span className="text-emerald-600">Fat:</span> {selectedRecipe.fat || 0}g</div>
                             <div className="flex items-center gap-1"><span className="text-emerald-600">Carbs:</span> {selectedRecipe.carbs || 0}g</div>
                             <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded-md"><span className="text-slate-600">Serves:</span> {selectedRecipe.servings || 1}</div>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2 text-lg">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
                                Ingredients
                            </h3>
                            <ul className="space-y-2 text-slate-600 text-sm">
                                {selectedRecipe.ingredients.map((ing, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0"></span>
                                        <span className="leading-relaxed">{ing}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                         <div>
                            <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2 text-lg">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                                Instructions
                            </h3>
                            {selectedRecipe.instructions && selectedRecipe.instructions.length > 0 ? (
                                <ol className="space-y-3 text-slate-600 text-sm list-decimal pl-4 marker:text-emerald-600 marker:font-bold">
                                    {selectedRecipe.instructions.map((step, i) => (
                                        <li key={i} className="pl-1 leading-relaxed">{step}</li>
                                    ))}
                                </ol>
                            ) : (
                                <p className="text-slate-400 text-sm italic">No instructions provided.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};