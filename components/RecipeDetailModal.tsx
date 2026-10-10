import React, { useEffect, useRef, useState } from 'react';
import { Recipe } from '../types';
import { Portal } from './Portal';
import { mealVisualFor } from '../utils/mealVisual';
import { Check, Copy, Pencil, Trash2, UsersRound, X } from 'lucide-react';

interface RecipeDetailModalProps {
    recipe: Recipe;
    onClose: () => void;
    onEdit?: () => void;
    onDelete?: (id: string, e: React.MouseEvent) => void;
    isOwned?: boolean;
    onCopyToLibrary?: () => void;
}

/**
 * Full recipe view: one scrolling page (no tabs) so ingredients and method can be
 * read together. Ingredients and steps can be ticked off while cooking.
 * Bottom sheet on mobile, centred dialog from md up.
 */
export const RecipeDetailModal: React.FC<RecipeDetailModalProps> = ({ recipe, onClose, onEdit, onDelete, isOwned = true, onCopyToLibrary }) => {
    const [haveIngredients, setHaveIngredients] = useState<Set<number>>(new Set());
    const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
    const closeRef = useRef<HTMLButtonElement>(null);

    // Escape closes; focus the close button on open; keep the page behind from scrolling
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        closeRef.current?.focus();
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = previousOverflow;
        };
    }, [onClose]);

    if (!recipe) return null;

    const visual = mealVisualFor(recipe);
    const ingredients = recipe.ingredients || [];
    const steps = recipe.instructions || [];
    const toggle = (set: Set<number>, i: number) => {
        const next = new Set(set);
        if (next.has(i)) next.delete(i); else next.add(i);
        return next;
    };

    const stats = [
        { label: 'Calories', value: recipe.calories, unit: 'kcal' },
        { label: 'Protein', value: recipe.protein, unit: 'g' },
        { label: 'Carbs', value: recipe.carbs, unit: 'g' },
        { label: 'Fat', value: recipe.fat, unit: 'g' },
    ];

    return (
        <Portal>
            <div
                className="fixed inset-0 z-[100] flex items-end md:items-center justify-center md:p-4 bg-ink/40 animate-fade-in"
                onClick={onClose}
            >
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="recipe-title"
                    className="bg-surface w-full md:max-w-4xl rounded-t-[24px] md:rounded-[24px] shadow-[var(--elev-lg)] max-h-[94vh] md:max-h-[90vh] flex flex-col overflow-hidden animate-slide-up md:animate-scale-in"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="overflow-y-auto">
                        {/* Image */}
                        <div className="relative p-2 pb-0">
                            {recipe.image ? (
                                <img src={recipe.image} alt="" className="w-full aspect-[16/9] max-h-80 object-cover rounded-[18px]" />
                            ) : (
                                <div className={`w-full aspect-[16/7] max-h-56 rounded-[18px] flex items-center justify-center ${visual.tint}`}>
                                    <visual.Icon size={64} strokeWidth={1.5} aria-hidden="true" />
                                </div>
                            )}
                            <button
                                ref={closeRef}
                                onClick={onClose}
                                className="icon-btn absolute top-4 right-4 shadow-[var(--elev-sm)]"
                                aria-label="Close recipe"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-5 md:p-8 space-y-6">
                            {/* Title and meta */}
                            <div className="space-y-3">
                                <div className="flex flex-wrap gap-1.5">
                                    <span className="badge badge-neutral">{visual.label}</span>
                                    {recipe.tags?.filter(t => t.toLowerCase() !== visual.label.toLowerCase()).map(tag => (
                                        <span key={tag} className="badge badge-neutral first-letter:uppercase">{tag}</span>
                                    ))}
                                    {!isOwned && recipe.ownerName && (
                                        <span className="badge badge-workout"><UsersRound size={12} aria-hidden="true" /> From {recipe.ownerName.split(' ')[0]}</span>
                                    )}
                                </div>
                                <h2 id="recipe-title" className="heading-1">{recipe.name}</h2>
                                <p className="text-sm text-muted">
                                    Serves {recipe.servings || 1}
                                    {ingredients.length > 0 && ` · ${ingredients.length} ingredients`}
                                    {steps.length > 0 && ` · ${steps.length} steps`}
                                </p>
                            </div>

                            {/* Nutrition */}
                            <dl className="grid grid-cols-4 gap-2">
                                {stats.map((s, i) => (
                                    <div key={s.label} className={`tile !p-3 ${i === 0 ? 'tile-calories' : 'tile-neutral'}`}>
                                        <dt className="text-xs font-semibold">{s.label}</dt>
                                        <dd className="font-display font-extrabold text-lg md:text-xl leading-7 whitespace-nowrap">
                                            {s.value ?? '–'}<span className="font-sans text-xs font-semibold"> {s.unit}</span>
                                        </dd>
                                    </div>
                                ))}
                            </dl>

                            {recipe.description && (
                                <p className="text-base leading-relaxed">{recipe.description}</p>
                            )}

                            {/* Actions */}
                            {(onEdit || onDelete || onCopyToLibrary) && (
                                <div className="flex flex-wrap gap-2">
                                    {!isOwned && onCopyToLibrary && (
                                        <button onClick={onCopyToLibrary} className="btn-primary btn-sm">
                                            <Copy size={16} aria-hidden="true" /> Copy to my recipes
                                        </button>
                                    )}
                                    {isOwned && onEdit && (
                                        <button onClick={onEdit} className="btn-secondary btn-sm">
                                            <Pencil size={16} aria-hidden="true" /> Edit
                                        </button>
                                    )}
                                    {isOwned && onDelete && (
                                        <button onClick={(e) => onDelete(recipe.id, e)} className="btn-ghost btn-sm text-error hover:bg-error-bg">
                                            <Trash2 size={16} aria-hidden="true" /> Delete
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Ingredients and method */}
                            <div className="grid md:grid-cols-[2fr_3fr] gap-6 md:gap-8 border-t border-border pt-6">
                                <section aria-labelledby="ingredients-heading">
                                    <div className="flex items-baseline justify-between mb-2">
                                        <h3 id="ingredients-heading" className="heading-2">Ingredients</h3>
                                        {haveIngredients.size > 0 && (
                                            <span className="text-xs text-muted">{haveIngredients.size} of {ingredients.length} ready</span>
                                        )}
                                    </div>
                                    {ingredients.length === 0 ? (
                                        <p className="text-sm text-muted">No ingredients listed.</p>
                                    ) : (
                                        <ul>
                                            {ingredients.map((ing, i) => {
                                                const have = haveIngredients.has(i);
                                                return (
                                                    <li key={i}>
                                                        <button
                                                            onClick={() => setHaveIngredients(s => toggle(s, i))}
                                                            aria-pressed={have}
                                                            className="w-full flex items-start gap-3 py-2 px-1 rounded-[10px] text-left hover:bg-surface-sunken transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                                                        >
                                                            <span className={`mt-0.5 size-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${have ? 'bg-secondary border-secondary text-secondary-foreground' : 'border-border-control text-transparent'}`}>
                                                                <Check size={14} strokeWidth={3} aria-hidden="true" />
                                                            </span>
                                                            <span className={`leading-snug ${have ? 'text-muted line-through' : ''}`}>{ing}</span>
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </section>

                                <section aria-labelledby="method-heading">
                                    <h3 id="method-heading" className="heading-2 mb-2">Method</h3>
                                    {steps.length === 0 ? (
                                        <p className="text-sm text-muted">No steps written down yet.</p>
                                    ) : (
                                        <ol className="space-y-1">
                                            {steps.map((step, i) => {
                                                const done = doneSteps.has(i);
                                                return (
                                                    <li key={i}>
                                                        <button
                                                            onClick={() => setDoneSteps(s => toggle(s, i))}
                                                            aria-pressed={done}
                                                            className="w-full flex items-start gap-3 p-2 rounded-[14px] text-left hover:bg-surface-sunken transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                                                        >
                                                            <span className={`size-8 shrink-0 rounded-full flex items-center justify-center font-display font-extrabold text-sm transition-colors ${done ? 'bg-secondary text-secondary-foreground' : 'bg-ink text-on-ink'}`}>
                                                                {done ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : i + 1}
                                                            </span>
                                                            <span className={`pt-1 leading-relaxed ${done ? 'text-muted' : ''}`}>{step}</span>
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ol>
                                    )}
                                </section>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Portal>
    );
};
