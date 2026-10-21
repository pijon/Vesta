import { mealKcalLabel } from '../utils/planUtils';
import { MarkdownText } from './MarkdownText';
import { sectionsOf, withoutHeadings } from '../utils/recipeSections';
import React, { useEffect, useRef, useState } from 'react';
import { Recipe } from '../types';
import { Portal } from './Portal';
import { useAnimatedClose } from '../hooks/useAnimatedClose';
import { mealVisualFor } from '../utils/mealVisual';
import { scaleIngredient } from '../utils/scaleIngredient';
import { uploadRecipeImage } from '../utils/storageUtils';
import { currentUid } from '../services/firebase';
import { CalendarPlus, Camera, Check, ChefHat, ExternalLink, Minus, MoreHorizontal, Pencil, Plus, Trash2, UsersRound, X } from 'lucide-react';
import { grams, isQuickMeal } from '../utils/planUtils';

interface RecipeDetailModalProps {
    recipe: Recipe;
    onClose: () => void;
    onEdit?: () => void;
    onDelete?: (id: string, e: React.MouseEvent) => void;
    onAddToPlan?: () => void;
    onCook?: () => void;
    /** Save an uploaded photo on the recipe (recipes without one) */
    onSetImage?: (url: string) => Promise<void>;
}

/**
 * Full recipe view: one scrolling page (no tabs) so ingredients and method can be
 * read together. Ingredients and steps can be ticked off while cooking.
 * Bottom sheet on mobile, centred dialog from md up.
 */
export const RecipeDetailModal: React.FC<RecipeDetailModalProps> = ({ recipe, onClose, onEdit, onDelete, onAddToPlan, onCook, onSetImage }) => {
    const baseServings = Math.max(1, recipe?.servings || 1);
    const [servings, setServings] = useState(baseServings);
    const [uploading, setUploading] = useState(false);
    const [photoError, setPhotoError] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const [haveIngredients, setHaveIngredients] = useState<Set<number>>(new Set());
    const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
    const closeRef = useRef<HTMLButtonElement>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    // Delete asks in the menu itself: window.confirm is silently skipped in some installed apps and web views
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    // Scrolled past the title: a solid bar with the name sits behind the controls, so text doesn't
    // run under them. Scrolled past Add to plan and Cook: they stay at the bottom.
    const scrollRef = useRef<HTMLDivElement>(null);
    const titleRef = useRef<HTMLHeadingElement>(null);
    const actionsRef = useRef<HTMLDivElement>(null);
    const [pastTitle, setPastTitle] = useState(false);
    const [pastActions, setPastActions] = useState(false);
    const handleScroll = () => {
        const top = (scrollRef.current?.getBoundingClientRect().top ?? 0) + 64;
        setPastTitle((titleRef.current?.getBoundingClientRect().bottom ?? Infinity) < top);
        setPastActions((actionsRef.current?.getBoundingClientRect().bottom ?? Infinity) < top);
    };
    useEffect(() => { if (!menuOpen) setConfirmingDelete(false); }, [menuOpen]);
    const menuOpenRef = useRef(menuOpen);
    menuOpenRef.current = menuOpen;
    const { closing, close } = useAnimatedClose(onClose);

    // Escape closes the menu, then the recipe; focus the close button on open; keep the page behind from scrolling
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (menuOpenRef.current) setMenuOpen(false); else close();
        };
        document.addEventListener('keydown', onKey);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        closeRef.current?.focus();
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = previousOverflow;
        };
    }, [close]);

    if (!recipe) return null;

    const visual = mealVisualFor(recipe);
    const ingredientSections = sectionsOf(recipe.ingredients || []);
    const stepSections = sectionsOf(recipe.instructions || []);
    const ingredients = withoutHeadings(recipe.ingredients || []).filter(line => line.trim());
    const steps = withoutHeadings(recipe.instructions || []).filter(line => line.trim());
    const toggle = (set: Set<number>, i: number) => {
        const next = new Set(set);
        if (next.has(i)) next.delete(i); else next.add(i);
        return next;
    };

    const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        const uid = currentUid();
        e.target.value = '';
        if (!file || !uid || !onSetImage) return;
        if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
            setPhotoError('Choose a photo (JPEG, PNG, WebP or HEIC) under 10 MB.');
            return;
        }
        setUploading(true);
        setPhotoError(null);
        try {
            await onSetImage(await uploadRecipeImage(file, uid, recipe.id));
        } catch (err) {
            console.error('Photo upload failed', err);
            setPhotoError("That photo couldn't be uploaded. Try again.");
        } finally {
            setUploading(false);
        }
    };

    const stats = [
        { label: 'Calories', value: mealKcalLabel(recipe), unit: '' },
        { label: 'Protein', value: recipe.protein != null ? grams(recipe.protein) : undefined, unit: 'g' },
        { label: 'Carbs', value: recipe.carbs != null ? grams(recipe.carbs) : undefined, unit: 'g' },
        { label: 'Fat', value: recipe.fat != null ? grams(recipe.fat) : undefined, unit: 'g' },
    ];

    const hasActions = !!(onAddToPlan || (onCook && steps.length > 0));
    const actions = (
        <div className="grid grid-cols-2 gap-2 [&>:only-child]:col-span-2">
            {onAddToPlan && (
                <button onClick={onAddToPlan} className="btn-primary btn-block px-4 whitespace-nowrap">
                    <CalendarPlus size={18} aria-hidden="true" /> Add to plan
                </button>
            )}
            {onCook && steps.length > 0 && (
                <button onClick={onCook} className="btn-secondary btn-block px-4 whitespace-nowrap">
                    <ChefHat size={18} aria-hidden="true" /> Cook
                </button>
            )}
        </div>
    );

    // "Imported from https://…" becomes a source link; "Imported from text" says nothing useful
    const importedFrom = recipe.description?.match(/^Imported from (https?:\/\/\S+)/)?.[1];
    const sourceHost = (() => {
        try { return importedFrom ? new URL(importedFrom).hostname.replace(/^www\./, '') : null; } catch { return null; }
    })();
    const description = importedFrom || recipe.description === 'Imported from text' || isQuickMeal(recipe)
        ? null
        : recipe.description;
    const hasMenu = !!(onEdit || onDelete);

    return (
        <Portal>
            <div
                className={`fixed inset-0 z-[100] flex items-end md:items-center justify-center md:p-4 bg-scrim modal-backdrop ${closing ? 'is-closing' : ''}`}
                onClick={close}
            >
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="recipe-title"
                    className={`relative bg-surface w-full md:max-w-5xl rounded-t-[32px] md:rounded-[32px] shadow-[var(--elev-lg)] max-h-[94vh] md:max-h-[92vh] flex flex-col overflow-hidden modal-panel ${closing ? 'is-closing' : ''}`}
                    onClick={e => { e.stopPropagation(); setMenuOpen(false); }}
                >
                    <div
                        className={`absolute inset-x-0 top-0 z-10 h-[72px] flex items-center pl-5 md:pl-8 pr-32 bg-surface border-b border-border transition-opacity duration-200 ${pastTitle ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                        aria-hidden="true"
                    >
                        <p className="font-display font-extrabold text-lg leading-6 truncate">{recipe.name}</p>
                    </div>

                    {/* Controls stay put while the recipe scrolls */}
                    <div className="absolute top-4 right-4 z-20 flex gap-2">
                        {hasMenu && (
                            <div className="relative">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
                                    className="icon-btn shadow-[var(--elev-sm)]"
                                    aria-label="More actions"
                                    aria-haspopup="menu"
                                    aria-expanded={menuOpen}
                                >
                                    <MoreHorizontal size={20} />
                                </button>
                                {menuOpen && (
                                    <div role="menu" className={`absolute right-0 top-12 ${confirmingDelete ? 'w-64' : 'w-44'} p-1.5 rounded-[16px] bg-surface border border-border shadow-[var(--elev-md)]`} onClick={e => e.stopPropagation()}>
                                        {confirmingDelete ? (
                                            <div className="p-2 space-y-3" role="alertdialog" aria-labelledby="delete-recipe-question">
                                                <p id="delete-recipe-question" className="text-sm">
                                                    <span className="font-semibold">Delete this recipe?</span> It goes for everyone in your family.
                                                </p>
                                                <div className="flex gap-2">
                                                    <button
                                                        autoFocus
                                                        onClick={(e) => { setMenuOpen(false); onDelete?.(recipe.id, e); }}
                                                        className="btn-base btn-sm flex-1 bg-error-bg text-error hover:opacity-90"
                                                    >
                                                        <Trash2 size={16} aria-hidden="true" /> Delete
                                                    </button>
                                                    <button onClick={() => setConfirmingDelete(false)} className="btn-secondary btn-sm flex-1">Cancel</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                {onEdit && (
                                                    <button role="menuitem" onClick={() => { setMenuOpen(false); onEdit(); }} className="w-full flex items-center gap-2.5 min-h-10 px-3 rounded-[10px] text-sm font-semibold hover:bg-surface-sunken">
                                                        <Pencil size={16} aria-hidden="true" /> Edit recipe
                                                    </button>
                                                )}
                                                {onDelete && (
                                                    <button role="menuitem" onClick={() => setConfirmingDelete(true)} className="w-full flex items-center gap-2.5 min-h-10 px-3 rounded-[10px] text-sm font-semibold text-error hover:bg-error-bg">
                                                        <Trash2 size={16} aria-hidden="true" /> Delete recipe
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                        <button
                            ref={closeRef}
                            onClick={close}
                            className="icon-btn shadow-[var(--elev-sm)]"
                            aria-label="Close recipe"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div ref={scrollRef} onScroll={handleScroll} className="overflow-y-auto overscroll-contain">
                        {/* Photo beside the essentials on wider screens, above them on phones */}
                        <div className="p-2 md:p-6 md:pb-2 md:grid md:grid-cols-[5fr_6fr] md:gap-8">
                            {recipe.image ? (
                                <img src={recipe.image} alt="" className="w-full aspect-[16/10] md:aspect-[4/3] object-cover rounded-[28px] bg-surface-sunken" />
                            ) : (
                                <div className={`w-full aspect-[16/9] md:aspect-[4/3] rounded-[28px] flex flex-col items-center justify-center gap-3 ${visual.tint}`}>
                                    <visual.Icon size={48} strokeWidth={2.25} aria-hidden="true" />
                                    {onSetImage && (
                                        <>
                                            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={handlePhoto} className="hidden" aria-hidden="true" tabIndex={-1} />
                                            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary btn-sm">
                                                <Camera size={16} aria-hidden="true" /> {uploading ? 'Uploading…' : 'Add photo'}
                                            </button>
                                        </>
                                    )}
                                    {photoError && <p className="text-sm text-error px-4 text-center" role="alert">{photoError}</p>}
                                </div>
                            )}

                            <div className="px-3 pt-5 md:p-0 md:pt-12 flex flex-col gap-5">
                                <div className="space-y-2.5">
                                    <div className="flex flex-wrap gap-1.5">
                                        <span className="badge badge-neutral"><visual.Icon size={12} aria-hidden="true" /> {visual.label}</span>
                                        {(recipe.tags || []).filter(t => t.toLowerCase() !== visual.label.toLowerCase()).map(tag => (
                                            <span key={tag} className="badge badge-neutral">{tag.charAt(0).toUpperCase() + tag.slice(1)}</span>
                                        ))}
                                        {recipe.ownerName && (
                                            <span className="badge badge-workout"><UsersRound size={12} aria-hidden="true" /> From {recipe.ownerName.split(' ')[0]}</span>
                                        )}
                                    </div>
                                    <h2 id="recipe-title" ref={titleRef} className="heading-1">{recipe.name}</h2>
                                    <p className="text-sm text-muted">
                                        {baseServings} {baseServings === 1 ? 'serving' : 'servings'}
                                        {ingredients.length > 0 && ` · ${ingredients.length} ingredients`}
                                        {steps.length > 0 && ` · ${steps.length} steps`}
                                        {sourceHost && (
                                            <> · <a href={importedFrom} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-main">{sourceHost}<ExternalLink size={12} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a></>
                                        )}
                                    </p>
                                </div>

                                {/* Nutrition (the importer always stores values per serving) */}
                                <div>
                                    <p className="text-xs font-semibold text-muted mb-1.5">Per serving</p>
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
                                </div>

                                {description && <p className="leading-relaxed">{description}</p>}

                                {hasActions && (
                                    <div ref={actionsRef} className="md:mt-auto">{actions}</div>
                                )}

                            </div>
                        </div>

                        <div className="p-5 md:p-8 md:pt-6 space-y-6">
                            {/* Ingredients and method */}
                            <div className="grid md:grid-cols-[2fr_3fr] gap-6 md:gap-10 border-t border-border pt-6">
                                <section aria-labelledby="ingredients-heading">
                                    <div className="flex items-center justify-between gap-3 mb-2">
                                        <h3 id="ingredients-heading" className="heading-2">Ingredients</h3>
                                        {ingredients.length > 0 && (
                                            <div className="flex items-center gap-1" role="group" aria-label="Servings">
                                                <button onClick={() => setServings(n => Math.max(1, n - 1))} disabled={servings <= 1} className="icon-btn !size-8" aria-label="One serving fewer"><Minus size={16} /></button>
                                                <span className="text-sm font-semibold min-w-[5.5rem] text-center" aria-live="polite">{servings} {servings === 1 ? 'serving' : 'servings'}</span>
                                                <button onClick={() => setServings(n => Math.min(24, n + 1))} className="icon-btn !size-8" aria-label="One serving more"><Plus size={16} /></button>
                                            </div>
                                        )}
                                    </div>
                                    {(haveIngredients.size > 0 || servings !== baseServings) && (
                                        <p className="text-xs text-muted mb-1">
                                            {servings !== baseServings && <>Amounts scaled from {baseServings}. <button onClick={() => setServings(baseServings)} className="underline underline-offset-2 hover:text-main">Reset</button></>}
                                            {servings !== baseServings && haveIngredients.size > 0 && ' · '}
                                            {haveIngredients.size > 0 && `${haveIngredients.size} of ${ingredients.length} ready`}
                                        </p>
                                    )}
                                    {ingredients.length === 0 ? (
                                        <p className="text-sm text-muted">No ingredients listed.</p>
                                    ) : (
                                        <div>
                                            {ingredientSections.map((section, n) => (
                                                <div key={n}>
                                                    {section.title && <h4 className="font-display font-extrabold mt-4 mb-1"><MarkdownText text={section.title} /></h4>}
                                                    <ul>
                                                        {section.items.map(({ text: ing, index: i }) => {
                                                            const have = haveIngredients.has(i);
                                                            return (
                                                                <li key={i}>
                                                                    <button
                                                                        onClick={() => setHaveIngredients(s => toggle(s, i))}
                                                                        aria-pressed={have}
                                                                        className="w-full flex items-start gap-3 py-2 px-1 rounded-[10px] text-left hover:bg-surface-sunken transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                                                                    >
                                                                        <span className={`mt-0.5 size-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${have ? 'bg-secondary border-secondary text-secondary-foreground' : 'border-border-control text-transparent'}`}>
                                                                            <Check size={14} strokeWidth={3} aria-hidden="true" />
                                                                        </span>
                                                                        <span className={`leading-snug ${have ? 'text-muted line-through' : ''}`}>{scaleIngredient(ing, servings / baseServings)}</span>
                                                                    </button>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                <section aria-labelledby="method-heading">
                                    <h3 id="method-heading" className="heading-2 mb-2">Method</h3>
                                    {steps.length === 0 ? (
                                        <p className="text-sm text-muted">No steps written down yet.</p>
                                    ) : (
                                        <div>
                                            {stepSections.map((section, n) => (
                                                <div key={n}>
                                                    {section.title && <h4 className="font-display font-extrabold mt-4 mb-1 px-2"><MarkdownText text={section.title} /></h4>}
                                                    <ol className="space-y-1">
                                                        {section.items.map(({ text: step, index: i }, k) => {
                                                            const done = doneSteps.has(i);
                                                            return (
                                                                <li key={i}>
                                                                    <button
                                                                        onClick={() => setDoneSteps(s => toggle(s, i))}
                                                                        aria-pressed={done}
                                                                        className="w-full flex items-start gap-3 p-2 rounded-[14px] text-left hover:bg-surface-sunken transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                                                                    >
                                                                        <span className={`size-8 shrink-0 rounded-full flex items-center justify-center font-display font-extrabold text-sm transition-colors ${done ? 'bg-secondary text-secondary-foreground' : 'bg-ink text-on-ink'}`}>
                                                                            {done ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : k + 1}
                                                                        </span>
                                                                        <span className={`pt-1 leading-relaxed ${done ? 'text-muted' : ''}`}><MarkdownText text={step} /></span>
                                                                    </button>
                                                                </li>
                                                            );
                                                        })}
                                                    </ol>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            </div>
                        </div>
                    </div>
                    {hasActions && pastActions && (
                        <div className="border-t border-border px-5 py-3 md:px-8 animate-fade-in">{actions}</div>
                    )}
                </div>
            </div>
        </Portal>
    );
};
