import React, { useState, useEffect, useRef } from 'react';
import { Minus, Plus, Save, X } from 'lucide-react';
import { Recipe, RecipeSaveOptions, UserExperience } from '../types';
import { ImageInput } from './ImageInput';
import { calorieAvailability } from '../utils/recipeNutrition';
import { Sheet } from './Sheet';

interface RecipeEditModalProps {
    recipe: Recipe;
    onSave: (updatedRecipe: Recipe, options?: RecipeSaveOptions) => void | Promise<void>;
    experience?: UserExperience;
    onCancel: () => void;
    isSaving?: boolean;
}

const MEAL_TAGS = ['breakfast', 'main meal', 'snack', 'light meal'];

const label = 'block text-sm font-semibold mb-1.5';

// What an import writes as the description: the source link (the detail sheet shows it as one)
// or a note that it came from text. Neither is the user's own text to edit, so the field starts
// empty and leaving it empty keeps the marker.
const isImportMarker = (description?: string) =>
    description === 'Imported from text' || /^Imported from https?:\/\//.test(description || '');

/** Edit a recipe's photo, name, servings, tags, nutrition, ingredients and steps. */
export const RecipeEditModal: React.FC<RecipeEditModalProps> = ({ recipe, onSave, onCancel, isSaving = false, experience = 'tracking' }) => {
    const [editForm, setEditForm] = useState<Recipe>({ ...recipe });
    const [uploadedImage, setUploadedImage] = useState<string | null>(recipe.image || null);
    const [imageError, setImageError] = useState<string | null>(null);
    const descriptionFor = (r: Recipe) => isImportMarker(r.description) ? '' : r.description || '';
    const [description, setDescription] = useState(() => descriptionFor(recipe));

    const fieldsFor = (r: Recipe) => ({calories:calorieAvailability(r)==='unknown'?'':String(r.calories),protein:r.protein===undefined?'':String(r.protein),fat:r.fat===undefined?'':String(r.fat),carbs:r.carbs===undefined?'':String(r.carbs)});
    const [nutrition, setNutrition] = useState(() => fieldsFor(recipe));
    const [nutritionTouched, setNutritionTouched] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const savingRef = useRef(false);
    const busy = saving || isSaving;

    // Sync state if recipe prop changes (though usually unmounted/remounted)
    useEffect(() => {
        setEditForm({ ...recipe });
        setNutrition(fieldsFor(recipe));
        setNutritionTouched(false);
        setUploadedImage(recipe.image || null);
        setDescription(descriptionFor(recipe));
    }, [recipe]);

    const handleSave = async () => {
        if (savingRef.current || isSaving) return;
        if (!editForm.name.trim()) { setError('Enter a recipe name.'); return; }
        if (!Number.isFinite(editForm.servings) || editForm.servings < 1) {setError('Choose at least one serving.');return;}
        const replace = experience === 'tracking' && nutritionTouched;
        const values: Partial<Recipe> = {};
        if (replace) {
            for (const key of ['calories','protein','fat','carbs'] as const) {
                const text = nutrition[key].trim();
                if (text && (!Number.isFinite(Number(text)) || Number(text)<0)) {setError('Enter valid nonnegative nutrition values.');return;}
                values[key] = text ? Number(text) : undefined;
            }
            values.calorieStatus = nutrition.calories.trim() ? 'known' : 'unknown';
            values.calories = values.calories ?? 0;
            values.caloriesEstimated = false;
        }
        const updatedRecipe: Recipe = {
            ...editForm, ...values, name:editForm.name.trim(),
            description: description.trim() || (isImportMarker(recipe.description) ? recipe.description : undefined),
            ingredients: (editForm.ingredients || []).filter(i => i.trim()),
            instructions: (editForm.instructions || []).filter(i => i.trim()),
            image: uploadedImage || undefined,
        };
        savingRef.current=true;setSaving(true);setError('');
        try { await onSave(updatedRecipe, {nutrition:replace?'replace':'preserve'}); }
        catch {setError("That recipe couldn't be saved. Your changes are still here. Try again.");}
        finally {savingRef.current=false;setSaving(false);}
    };

    const handleImageSelect = (downloadURL: string) => {
        setImageError(null);
        setUploadedImage(downloadURL);
    };

    const handleTagClick = (tag: string) => {
        const currentTags = editForm.tags || [];
        const newTags = currentTags.includes(tag)
            ? currentTags.filter(t => t !== tag)
            : [...currentTags, tag];
        setEditForm({ ...editForm, tags: newTags });
    };

    const handleAddCustomTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = e.currentTarget.value.trim();
            if (val) {
                const newTags = [...(editForm.tags || []), ...val.split(',').map(t => t.trim()).filter(Boolean)];
                setEditForm({ ...editForm, tags: Array.from(new Set(newTags)) }); // Dedupe
                e.currentTarget.value = '';
            }
        }
    };

    const servings = editForm.servings || 1;

    return (
        <Sheet
            title="Edit recipe"
            size="xl"
            onClose={onCancel}
            footer={
                <div className="flex gap-2">
                    <button onClick={onCancel} disabled={busy} className="btn-ghost">Cancel</button>
                    <button onClick={handleSave} disabled={busy} className="btn-primary flex-1">
                        {busy ? <span className="spinner spinner-sm" aria-hidden="true" /> : <Save size={18} aria-hidden="true" />}
                        {busy ? 'Saving…' : 'Save changes'}
                    </button>
                </div>
            }
        >
            <div className="space-y-6 pt-1">
                {/* Photo */}
                <div>
                    <p className={label}>Photo</p>
                    {uploadedImage ? (
                        <div className="relative rounded-[18px] overflow-hidden">
                            <img src={uploadedImage} alt="Recipe photo" className="w-full h-56 md:h-64 object-cover" />
                            <button onClick={() => setUploadedImage(null)} className="icon-btn absolute top-3 right-3 shadow-[var(--elev-sm)]" aria-label="Remove photo">
                                <X size={18} />
                            </button>
                        </div>
                    ) : (
                        <div className="rounded-[18px] border-2 border-dashed border-border-control p-6 text-center">
                            <ImageInput
                                recipeId={recipe.id}
                                onImageSelect={handleImageSelect}
                                onError={(err) => setImageError(err)}
                                className="w-full flex justify-center"
                            />
                            <p className="text-sm text-muted mt-3">JPG, PNG or WEBP, up to 5 MB</p>
                        </div>
                    )}
                    {imageError && <p className="text-sm text-error mt-2" role="alert">{imageError}</p>}
                </div>

                {/* Name and servings */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 min-w-0">
                        <label htmlFor="recipe-name" className={label}>Name</label>
                        <input
                            id="recipe-name"
                            type="text"
                            value={editForm.name}
                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                            className="input w-full text-lg font-bold"
                            placeholder="Grandma's lasagne"
                        />
                    </div>
                    <div>
                        <p className={label}>Servings</p>
                        <div className="flex items-center gap-1" role="group" aria-label="Servings">
                            <button onClick={() => setEditForm({ ...editForm, servings: Math.max(1, servings - 1) })} disabled={servings <= 1} className="icon-btn" aria-label="One serving fewer"><Minus size={18} /></button>
                            <span className="w-10 text-center font-display font-extrabold text-xl" aria-live="polite">{servings}</span>
                            <button onClick={() => setEditForm({ ...editForm, servings: servings + 1 })} className="icon-btn" aria-label="One serving more"><Plus size={18} /></button>
                        </div>
                    </div>
                </div>

                <div>
                    <label htmlFor="recipe-description" className={label}>Description <span className="font-normal text-muted">optional</span></label>
                    <textarea
                        id="recipe-description"
                        rows={3}
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="A weeknight favourite. Make the sauce a day ahead."
                        className="input w-full resize-none leading-relaxed"
                    />
                </div>

                {/* Tags */}
                <div>
                    <p className={label}>Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                        {MEAL_TAGS.map(tag => (
                            <button
                                key={tag}
                                onClick={() => handleTagClick(tag)}
                                aria-pressed={(editForm.tags || []).includes(tag)}
                                className="chip"
                            >
                                {tag.charAt(0).toUpperCase() + tag.slice(1)}
                            </button>
                        ))}
                    </div>
                    <label htmlFor="recipe-tag" className="sr-only">Add a tag</label>
                    <input
                        id="recipe-tag"
                        type="text"
                        placeholder="Add a tag and press Enter"
                        className="input w-full mt-3"
                        onKeyDown={handleAddCustomTag}
                    />
                    {(editForm.tags || []).some(t => !MEAL_TAGS.includes(t)) && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                            {(editForm.tags || []).filter(t => !MEAL_TAGS.includes(t)).map(tag => (
                                <span key={tag} className="badge badge-neutral !pr-1">
                                    {tag}
                                    <button onClick={() => handleTagClick(tag)} className="hit-target size-5 inline-flex items-center justify-center rounded-full hover:bg-surface" aria-label={`Remove tag ${tag}`}>
                                        <X size={12} />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {error && <p role="alert" className="text-error">{error}</p>}
                {/* Nutrition */}
                {experience === 'tracking' && <div>
                    <p className={label}>Nutrition <span className="font-normal text-muted">per serving</span></p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                            { label: 'Calories', val: nutrition.calories, key: 'calories', unit: 'kcal' },
                            { label: 'Protein', val: nutrition.protein, key: 'protein', unit: 'g' },
                            { label: 'Fat', val: nutrition.fat, key: 'fat', unit: 'g' },
                            { label: 'Carbs', val: nutrition.carbs, key: 'carbs', unit: 'g' }
                        ].map((item) => (
                            <label key={item.key} className="block">
                                <span className="block text-xs font-semibold text-muted mb-1">{item.label}</span>
                                <span className="relative block">
                                    <input
                                        type="number"
                                        min="0"
                                        value={item.val}
                                        onChange={e => {setNutrition({...nutrition,[item.key]:e.target.value});setNutritionTouched(true);}}
                                        onFocus={e => e.target.select()}
                                        className={`input w-full font-bold ${item.unit === 'kcal' ? '!pr-12' : '!pr-8'}`}
                                    />
                                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">{item.unit}</span>
                                </span>
                            </label>
                        ))}
                    </div>
                    {calorieAvailability(recipe)==='unconfirmed' && !nutritionTouched && <div className="mt-3 space-y-2"><p className="text-sm text-muted">This older recipe has 0 calories, which may mean no amount was entered.</p><button className="btn-secondary" onClick={()=>{setNutrition({...nutrition,calories:'0'});setNutritionTouched(true);}}>Confirm 0 kcal</button></div>}
                    <p className="text-sm text-muted mt-3">Leave values blank when unavailable. Zero means a confirmed zero.</p>
                </div>}

                {/* Ingredients and steps */}
                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="recipe-ingredients" className={label}>Ingredients <span className="font-normal text-muted">one per line. Start a new dish with ## Name</span></label>
                        <textarea
                            id="recipe-ingredients"
                            rows={10}
                            value={(editForm.ingredients || []).join('\n')}
                            onChange={e => setEditForm({ ...editForm, ingredients: e.target.value.split('\n') })}
                            placeholder={'## Chicken\n200 g chicken breast\n## Sauce\n1 dl cream'}
                            className="input w-full resize-none leading-relaxed"
                        />
                    </div>
                    <div>
                        <label htmlFor="recipe-steps" className={label}>Steps <span className="font-normal text-muted">one per line. ## Name starts a dish, **bold** works</span></label>
                        <textarea
                            id="recipe-steps"
                            rows={10}
                            value={(editForm.instructions || []).join('\n')}
                            onChange={e => setEditForm({ ...editForm, instructions: e.target.value.split('\n') })}
                            placeholder={'## Chicken\nHeat the oven to 180 °C\n## Sauce\nMix the **cream** and herbs'}
                            className="input w-full resize-none leading-relaxed"
                        />
                    </div>
                </div>
            </div>
        </Sheet>
    );
};
