import React, { useState } from 'react';
import { Recipe } from '../types';
import { Portal } from './Portal';
import { getCategoryColor } from '../utils';
import { RecipeIllustration } from './RecipeIllustration';

interface RecipeDetailModalProps {
    recipe: Recipe;
    onClose: () => void;
    onEdit?: () => void;
    onDelete?: (id: string, e: React.MouseEvent) => void;
}

interface TabButtonProps {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${active
            ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50'
            : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
    >
        {children}
    </button>
);

export const RecipeDetailModal: React.FC<RecipeDetailModalProps> = ({ recipe, onClose, onEdit, onDelete }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'ingredients' | 'instructions'>('overview');

    if (!recipe) return null;

    return (
        <Portal>
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-4 animate-fade-in bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
                <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col scale-100 animate-scale-in" onClick={e => e.stopPropagation()}>

                    {/* Header Image Area */}
                    <div className={`relative h-56 md:h-64 flex-shrink-0 overflow-hidden ${!recipe.image ? getCategoryColor(recipe.type).bg : 'bg-slate-900'}`}>
                        <div className="absolute inset-0 flex items-center justify-center">
                            {recipe.image ? (
                                <img
                                    src={recipe.image}
                                    alt={recipe.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <RecipeIllustration
                                    className="w-full h-full"
                                    theme={{
                                        bg: getCategoryColor(recipe.type).bg,
                                        text: getCategoryColor(recipe.type).text,
                                        accent: recipe.type === 'breakfast' ? '#F59E0B' : undefined
                                    }}
                                />
                            )}
                        </div>

                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-slate-900/30"></div>

                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-6 right-6 bg-slate-900/20 backdrop-blur-md p-2.5 rounded-full text-white hover:bg-white hover:text-slate-900 transition-all"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>

                        <div className="absolute bottom-0 left-0 right-0 p-8 pt-0">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 text-white border border-white/30 backdrop-blur-md bg-white/10`}>{recipe.type}</span>
                            <h2 className="text-3xl md:text-4xl font-bold text-white font-serif leading-tight mb-2 drop-shadow-sm">{recipe.name}</h2>
                            <div className="flex text-white/80 text-sm font-medium gap-4">
                                <span>{recipe.calories} kcal</span>
                                <span>•</span>
                                <span>Serves {recipe.servings || 1}</span>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-slate-100 px-6 pt-2 bg-white sticky top-0 z-10">
                        <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>Overview</TabButton>
                        <TabButton active={activeTab === 'ingredients'} onClick={() => setActiveTab('ingredients')}>Ingredients</TabButton>
                        <TabButton active={activeTab === 'instructions'} onClick={() => setActiveTab('instructions')}>Instructions</TabButton>
                    </div>

                    {/* Tab Content */}
                    <div className="p-8 overflow-y-auto bg-white flex-1">
                        {activeTab === 'overview' && (
                            <div className="space-y-8 animate-fade-in">
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex justify-between items-center">
                                    <div className="grid grid-cols-3 gap-8 w-full">
                                        <div className="text-center">
                                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Protein</p>
                                            <p className="text-2xl font-bold text-slate-900">{recipe.protein || 0}<span className="text-sm font-medium text-slate-400">g</span></p>
                                        </div>
                                        <div className="text-center border-l border-slate-200">
                                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Fat</p>
                                            <p className="text-2xl font-bold text-slate-900">{recipe.fat || 0}<span className="text-sm font-medium text-slate-400">g</span></p>
                                        </div>
                                        <div className="text-center border-l border-slate-200">
                                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Carbs</p>
                                            <p className="text-2xl font-bold text-slate-900">{recipe.carbs || 0}<span className="text-sm font-medium text-slate-400">g</span></p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 mb-2">Description</h3>
                                    <p className="text-slate-600 leading-relaxed text-lg">{recipe.description || 'No description available for this recipe.'}</p>
                                </div>

                                {(onDelete || onEdit) && (
                                    <div className="flex gap-3 justify-end pt-8 border-t border-slate-50">
                                        {onDelete && (
                                            <button
                                                onClick={(e) => onDelete(recipe.id, e)}
                                                className="px-5 py-2.5 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors flex items-center gap-2"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                Delete Meal
                                            </button>
                                        )}
                                        {onEdit && (
                                            <button
                                                onClick={onEdit}
                                                className="px-6 py-2.5 bg-slate-900 text-white hover:bg-emerald-600 rounded-xl text-sm font-bold transition-all shadow-lg shadow-slate-900/10 flex items-center gap-2"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                Edit Recipe
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'ingredients' && (
                            <div className="space-y-4 animate-fade-in">
                                <h3 className="flex items-center gap-2 text-xl font-bold text-slate-900 font-serif mb-4">
                                    <span className="bg-emerald-100 text-emerald-700 p-1.5 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 13.87A8 8 0 1 1 6 10a8 8 0 0 1 8-4 8 8 0 0 1 8 4"></path><polyline points="22 6 22 17 6 17 6 6"></polyline></svg></span>
                                    Shopping List
                                </h3>
                                <ul className="space-y-3">
                                    {recipe.ingredients.map((ing, i) => (
                                        <li key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm text-base text-slate-700 font-medium hover:border-emerald-200 transition-colors">
                                            <div className="mt-1.5 w-4 h-4 rounded-full border-2 border-slate-200 flex-shrink-0"></div>
                                            <span className="leading-relaxed">{ing}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {activeTab === 'instructions' && (
                            <div className="space-y-6 animate-fade-in">
                                <h3 className="flex items-center gap-2 text-xl font-bold text-slate-900 font-serif mb-6">
                                    <span className="bg-emerald-100 text-emerald-700 p-1.5 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg></span>
                                    Preparation
                                </h3>
                                {recipe.instructions && recipe.instructions.length > 0 ? (
                                    <div className="space-y-0 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px before:h-full before:w-0.5 before:bg-slate-100 before:content-['']">
                                        {recipe.instructions.map((step, i) => (
                                            <div key={i} className="relative pl-12 pb-8 group">
                                                <span className="absolute left-0 top-0 w-8 h-8 rounded-full bg-slate-100 text-slate-600 text-sm font-bold flex items-center justify-center ring-4 ring-white group-hover:bg-emerald-500 group-hover:text-white transition-colors">{i + 1}</span>
                                                <p className="text-slate-700 text-lg leading-relaxed pt-0.5">{step}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                        <p className="text-slate-400 text-lg italic">No instructions provided.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Portal>
    );
};
