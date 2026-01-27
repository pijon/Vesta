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
    isOwned?: boolean;  // NEW
    onCopyToLibrary?: () => void;  // NEW
}

interface TabButtonProps {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        className={`px-6 py-4 text-sm font-bold transition-all border-b-2 relative ${active
            ? 'border-hearth text-hearth'
            : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--background)]'
            }`}
    >
        {children}
        {active && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-hearth shadow-[0_-2px_6px_rgba(224,122,95,0.4)]"></span>
        )}
    </button>
);

export const RecipeDetailModal: React.FC<RecipeDetailModalProps> = ({ recipe, onClose, onEdit, onDelete, isOwned = true, onCopyToLibrary }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'ingredients' | 'instructions'>('overview');
    const theme = getRecipeTheme(recipe?.tags);

    if (!recipe) return null;

    return (
        <Portal>
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-4 animate-fade-in bg-stone-900/40 backdrop-blur-sm" onClick={onClose}>
                <div className="bg-[var(--background)] w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col scale-100 animate-scale-in border border-border" onClick={e => e.stopPropagation()}>

                    {/* Header Image Area */}
                    <div className={`relative h-64 md:h-80 flex-shrink-0 overflow-hidden ${!recipe.image ? theme.bg : 'bg-[var(--background)]'}`}>
                        <div className="absolute inset-0 flex items-center justify-center">
                            {recipe.image ? (
                                <img
                                    src={recipe.image}
                                    alt={recipe.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <RecipeIllustration
                                    className="w-full h-full transform scale-110"
                                    theme={{
                                        bg: theme.bg,
                                        text: theme.text,
                                        accent: theme.bg.includes('bg-slate') ? '#94a3b8' : undefined
                                    }}
                                />
                            )}
                        </div>

                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none"></div>

                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-6 right-6 z-10 bg-black/20 backdrop-blur-md p-3 rounded-full text-white hover:bg-white hover:text-black transition-all border border-white/10"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>

                        <div className="absolute bottom-0 left-0 right-0 p-8 md:p-10 pt-0">
                            <div className="flex gap-2 mb-4 flex-wrap">
                                {!isOwned && recipe.ownerName && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-indigo-100 border border-indigo-200/30 backdrop-blur-md bg-indigo-500/30">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                        {recipe.ownerName}
                                    </span>
                                )}
                                {recipe.tags?.map(tag => (
                                    <span key={tag} className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white border border-white/30 backdrop-blur-md bg-white/10 shadow-sm`}>{tag}</span>
                                ))}
                            </div>
                            <h2 className="text-3xl md:text-5xl font-bold text-white font-serif leading-tight mb-3 drop-shadow-md">{recipe.name}</h2>
                            <div className="flex items-center text-white/90 text-sm md:text-base font-medium gap-6">
                                <span className="flex items-center gap-2">
                                    <span className="bg-hearth p-1 rounded-full"></span>
                                    {recipe.calories} kcal
                                </span>
                                <span className="w-1 h-1 rounded-full bg-white/50"></span>
                                <span>Serves {recipe.servings || 1}</span>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-border px-8 bg-[var(--surface)] sticky top-0 z-10 shadow-sm">
                        <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>Overview</TabButton>
                        <TabButton active={activeTab === 'ingredients'} onClick={() => setActiveTab('ingredients')}>Ingredients</TabButton>
                        <TabButton active={activeTab === 'instructions'} onClick={() => setActiveTab('instructions')}>Instructions</TabButton>
                    </div>

                    {/* Tab Content */}
                    <div className="p-8 md:p-10 overflow-y-auto bg-transparent flex-1">
                        {activeTab === 'overview' && (
                            <div className="space-y-8 animate-fade-in">
                                <div className="bg-[var(--surface)] p-8 rounded-3xl border border-border shadow-sm flex justify-between items-center">
                                    <div className="grid grid-cols-3 gap-8 w-full divide-x divide-border">
                                        <div className="text-center px-4">
                                            <p className="text-[var(--text-secondary)] text-xs font-black uppercase tracking-widest mb-2">Protein</p>
                                            <p className="text-3xl font-serif font-medium text-[var(--text-main)]">{recipe.protein || 0}<span className="text-sm font-bold text-[var(--text-muted)] ml-1 font-sans">g</span></p>
                                        </div>
                                        <div className="text-center px-4">
                                            <p className="text-[var(--text-secondary)] text-xs font-black uppercase tracking-widest mb-2">Fat</p>
                                            <p className="text-3xl font-serif font-medium text-[var(--text-main)]">{recipe.fat || 0}<span className="text-sm font-bold text-[var(--text-muted)] ml-1 font-sans">g</span></p>
                                        </div>
                                        <div className="text-center px-4">
                                            <p className="text-[var(--text-secondary)] text-xs font-black uppercase tracking-widest mb-2">Carbs</p>
                                            <p className="text-3xl font-serif font-medium text-[var(--text-main)]">{recipe.carbs || 0}<span className="text-sm font-bold text-[var(--text-muted)] ml-1 font-sans">g</span></p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-2xl font-serif text-[var(--text-main)] mb-4">About this meal</h3>
                                    <p className="text-[var(--text-secondary)] leading-relaxed text-lg">{recipe.description || 'No description available for this recipe.'}</p>
                                </div>

                                {(onDelete || onEdit || onCopyToLibrary) && (
                                    <div className="flex gap-3 justify-end pt-8 border-t border-border">
                                        {!isOwned && onCopyToLibrary && (
                                            <button
                                                onClick={onCopyToLibrary}
                                                className="btn-primary bg-hearth text-white hover:bg-hearth/90 flex items-center gap-2 shadow-lg shadow-hearth/20"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                                Copy to My Recipes
                                            </button>
                                        )}

                                        {isOwned && onDelete && (
                                            <button
                                                onClick={(e) => onDelete(recipe.id, e)}
                                                className="btn-secondary text-red-500 hover:bg-red-50/50 border-red-200/50 flex items-center gap-2"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                Delete
                                            </button>
                                        )}
                                        {isOwned && onEdit && (
                                            <button
                                                onClick={onEdit}
                                                className="btn-primary flex items-center gap-2 shadow-lg shadow-hearth/20 bg-charcoal text-white"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                Edit Recipe
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'ingredients' && (
                            <div className="space-y-6 animate-fade-in">
                                <h3 className="flex items-center gap-3 text-2xl font-serif text-[var(--text-main)] mb-6">
                                    <span className="bg-sage/10 text-sage p-2 rounded-xl"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 13.87A8 8 0 1 1 6 10a8 8 0 0 1 8-4 8 8 0 0 1 8 4"></path><polyline points="22 6 22 17 6 17 6 6"></polyline></svg></span>
                                    Shopping List
                                </h3>
                                <ul className="space-y-3">
                                    {recipe.ingredients.map((ing, i) => (
                                        <li key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-[var(--card-bg)] border border-border shadow-sm text-lg text-[var(--text-main)] font-medium hover:border-hearth/30 transition-colors group">
                                            <div className="mt-1.5 w-5 h-5 rounded-full border-2 border-border flex-shrink-0 group-hover:border-hearth transition-colors"></div>
                                            <span className="leading-relaxed">{ing}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {activeTab === 'instructions' && (
                            <div className="space-y-8 animate-fade-in">
                                <h3 className="flex items-center gap-3 text-2xl font-serif text-[var(--text-main)] mb-8">
                                    <span className="bg-hearth/10 text-hearth p-2 rounded-xl"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg></span>
                                    Preparation
                                </h3>
                                {recipe.instructions && recipe.instructions.length > 0 ? (
                                    <div className="space-y-0 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-border before:content-['']">
                                        {recipe.instructions.map((step, i) => (
                                            <div key={i} className="relative pl-16 pb-12 group last:pb-0">
                                                <span className="absolute left-0 top-0 w-10 h-10 rounded-full bg-[var(--surface)] text-[var(--text-secondary)] text-base font-bold flex items-center justify-center ring-4 ring-[var(--background)] group-hover:bg-hearth group-hover:text-white transition-colors border border-border shadow-sm">{i + 1}</span>
                                                <p className="text-[var(--text-main)] text-lg leading-relaxed pt-1">{step}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-16 bg-[var(--surface)] rounded-3xl border-2 border-dashed border-border">
                                        <p className="text-[var(--text-muted)] text-lg font-serif">No instructions available</p>
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
