import React, { useState } from 'react';
import { Recipe } from '../types';
import { Portal } from './Portal';
import { getRecipeTheme } from '../utils';
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
            ? 'border-emerald-500 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-900/20'
            : 'border-transparent text-muted hover:text-main hover:bg-background'
            }`}
    >
        {children}
    </button>
);

export const RecipeDetailModal: React.FC<RecipeDetailModalProps> = ({ recipe, onClose, onEdit, onDelete }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'ingredients' | 'instructions'>('overview');
    const theme = getRecipeTheme(recipe?.tags);

    if (!recipe) return null;

    return (
        <Portal>
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-4 animate-fade-in bg-black/60 backdrop-blur-sm" onClick={onClose}>
                <div className="bg-surface w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col scale-100 animate-scale-in" onClick={e => e.stopPropagation()}>

                    {/* Header Image Area */}
                    <div className={`relative h-56 md:h-64 flex-shrink-0 overflow-hidden ${!recipe.image ? theme.bg : 'bg-background'}`}>
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
                                        bg: theme.bg,
                                        text: theme.text,
                                        accent: theme.bg.includes('bg-slate') ? '#94a3b8' : undefined
                                    }}
                                />
                            )}
                        </div>

                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30"></div>

                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-6 right-6 bg-black/20 backdrop-blur-md p-2.5 rounded-full text-white hover:bg-white hover:text-black transition-all"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>

                        <div className="absolute bottom-0 left-0 right-0 p-8 pt-0">
                            <div className="flex gap-2 mb-3">
                                {recipe.tags?.map(tag => (
                                    <span key={tag} className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white border border-white/30 backdrop-blur-md bg-white/10`}>{tag}</span>
                                ))}
                            </div>
                            <h2 className="text-3xl md:text-4xl font-bold text-white font-serif leading-tight mb-2 drop-shadow-sm">{recipe.name}</h2>
                            <div className="flex text-white/80 text-sm font-medium gap-4">
                                <span>{recipe.calories} kcal</span>
                                <span>•</span>
                                <span>Serves {recipe.servings || 1}</span>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-border px-6 pt-2 bg-surface sticky top-0 z-10">
                        <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>Overview</TabButton>
                        <TabButton active={activeTab === 'ingredients'} onClick={() => setActiveTab('ingredients')}>Ingredients</TabButton>
                        <TabButton active={activeTab === 'instructions'} onClick={() => setActiveTab('instructions')}>Instructions</TabButton>
                    </div>

                    {/* Tab Content */}
                    <div className="p-8 overflow-y-auto bg-surface flex-1">
                        {activeTab === 'overview' && (
                            <div className="space-y-8 animate-fade-in">
                                <div className="bg-background p-6 rounded-2xl border border-border flex justify-between items-center">
                                    <div className="grid grid-cols-3 gap-8 w-full">
                                        <div className="text-center">
                                            <p className="text-muted text-xs font-bold uppercase tracking-wider mb-1">Protein</p>
                                            <p className="text-2xl font-bold text-main">{recipe.protein || 0}<span className="text-sm font-medium text-muted">g</span></p>
                                        </div>
                                        <div className="text-center border-l border-border">
                                            <p className="text-muted text-xs font-bold uppercase tracking-wider mb-1">Fat</p>
                                            <p className="text-2xl font-bold text-main">{recipe.fat || 0}<span className="text-sm font-medium text-muted">g</span></p>
                                        </div>
                                        <div className="text-center border-l border-border">
                                            <p className="text-muted text-xs font-bold uppercase tracking-wider mb-1">Carbs</p>
                                            <p className="text-2xl font-bold text-main">{recipe.carbs || 0}<span className="text-sm font-medium text-muted">g</span></p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-bold text-main mb-2">Description</h3>
                                    <p className="text-muted leading-relaxed text-lg">{recipe.description || 'No description available for this recipe.'}</p>
                                </div>

                                {(onDelete || onEdit) && (
                                    <div className="flex gap-3 justify-end pt-8 border-t border-border">
                                        {onDelete && (
                                            <button
                                                onClick={(e) => onDelete(recipe.id, e)}
                                                className="px-5 py-2.5 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-300 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-xl transition-colors flex items-center gap-2"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                Delete Meal
                                            </button>
                                        )}
                                        {onEdit && (
                                            <button
                                                onClick={onEdit}
                                                className="px-6 py-2.5 bg-main text-surface hover:bg-emerald-600 rounded-xl text-sm font-bold transition-all shadow-lg flex items-center gap-2"
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
                                <h3 className="flex items-center gap-2 text-xl font-bold text-main font-serif mb-4">
                                    <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 p-1.5 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 13.87A8 8 0 1 1 6 10a8 8 0 0 1 8-4 8 8 0 0 1 8 4"></path><polyline points="22 6 22 17 6 17 6 6"></polyline></svg></span>
                                    Shopping List
                                </h3>
                                <ul className="space-y-3">
                                    {recipe.ingredients.map((ing, i) => (
                                        <li key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-surface border border-border shadow-sm text-base text-main font-medium hover:border-emerald-200 dark:hover:border-emerald-700 transition-colors">
                                            <div className="mt-1.5 w-4 h-4 rounded-full border-2 border-border flex-shrink-0"></div>
                                            <span className="leading-relaxed">{ing}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {activeTab === 'instructions' && (
                            <div className="space-y-6 animate-fade-in">
                                <h3 className="flex items-center gap-2 text-xl font-bold text-main font-serif mb-6">
                                    <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 p-1.5 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg></span>
                                    Preparation
                                </h3>
                                {recipe.instructions && recipe.instructions.length > 0 ? (
                                    <div className="space-y-0 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px before:h-full before:w-0.5 before:bg-border before:content-['']">
                                        {recipe.instructions.map((step, i) => (
                                            <div key={i} className="relative pl-12 pb-8 group">
                                                <span className="absolute left-0 top-0 w-8 h-8 rounded-full bg-background text-muted text-sm font-bold flex items-center justify-center ring-4 ring-surface group-hover:bg-emerald-500 group-hover:text-white transition-colors border border-border">{i + 1}</span>
                                                <p className="text-main/90 text-lg leading-relaxed pt-0.5">{step}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 bg-background rounded-2xl border border-dashed border-border">
                                        <p className="text-muted text-lg italic">No instructions provided.</p>
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
