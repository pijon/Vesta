import React, { useState, useEffect } from 'react';
import { Recipe } from '../types';
import { Portal } from './Portal';
import { ImageInput } from './ImageInput';

interface RecipeEditModalProps {
    recipe: Recipe;
    onSave: (updatedRecipe: Recipe) => void;
    onCancel: () => void;
}

export const RecipeEditModal: React.FC<RecipeEditModalProps> = ({ recipe, onSave, onCancel }) => {
    const [editForm, setEditForm] = useState<Recipe>({ ...recipe });
    const [uploadedImage, setUploadedImage] = useState<string | null>(recipe.image || null);
    const [imageError, setImageError] = useState<string | null>(null);

    // Sync state if recipe prop changes (though usually unmounted/remounted)
    useEffect(() => {
        setEditForm({ ...recipe });
        setUploadedImage(recipe.image || null);
    }, [recipe]);

    const handleSave = () => {
        const updatedRecipe: Recipe = {
            ...editForm,
            calories: Number(editForm.calories) || 0,
            protein: Number(editForm.protein) || 0,
            fat: Number(editForm.fat) || 0,
            carbs: Number(editForm.carbs) || 0,
            servings: Number(editForm.servings) || 1,
            ingredients: (editForm.ingredients || []).filter(i => i.trim()),
            instructions: (editForm.instructions || []).filter(i => i.trim()),
            image: uploadedImage || undefined // Explicitly handle undefined if null
        };
        onSave(updatedRecipe);
    };

    const handleImageSelect = (base64: string, mimeType: string) => {
        setImageError(null);
        const dataUrl = `data:${mimeType};base64,${base64}`;
        setUploadedImage(dataUrl);
    };

    const handleRemoveImage = () => {
        setUploadedImage(null);
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

    return (
        <Portal>
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-4 animate-fade-in bg-black/60 backdrop-blur-sm" onClick={onCancel}>
                <div
                    className="bg-white dark:bg-white/5 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col scale-100"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header: Actions */}
                    <div className="flex justify-between items-center p-6 border-b border-border bg-white dark:bg-white/5 z-20 transition-colors shrink-0">
                        <h2 className="text-2xl font-bold text-charcoal dark:text-stone-200 font-serif">Edit Recipe Details</h2>
                        <div className="flex gap-3">
                            <button
                                onClick={onCancel}
                                className="px-5 py-2.5 text-charcoal/60 dark:text-stone-400 hover:bg-stone-50 dark:bg-[#1A1714] rounded-xl text-sm font-bold transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="btn-primary btn-sm shadow-lg flex items-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                                Save Changes
                            </button>
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar flex-1 min-h-0 overscroll-contain">

                        {/* Image Section */}
                        <div className="space-y-3">
                            <label className="block text-sm font-bold text-charcoal dark:text-stone-200">Recipe Photo</label>
                            {uploadedImage ? (
                                <div className="relative rounded-2xl overflow-hidden border border-border shadow-sm group">
                                    <img src={uploadedImage} alt="Recipe preview" className="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-105" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                                    <button
                                        onClick={handleRemoveImage}
                                        className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white p-2.5 rounded-full shadow-lg transition-all transform hover:scale-110 active:scale-95"
                                        title="Remove image"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                </div>
                            ) : (
                                <div className="bg-stone-50 dark:bg-[#1A1714] rounded-2xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/30 hover:bg-primary/5">
                                    <ImageInput
                                        onImageSelect={handleImageSelect}
                                        onError={(err) => setImageError(err)}
                                        className="w-full flex justify-center"
                                    />
                                    <p className="text-charcoal/60 dark:text-stone-400 text-sm mt-3">Supports JPG, PNG, WEBP (Max 5MB)</p>
                                </div>
                            )}
                            {imageError && (
                                <p className="text-red-500 text-sm font-medium flex items-center gap-1.5 animate-pulse">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                    {imageError}
                                </p>
                            )}
                        </div>

                        <div className="flex gap-4">
                            <div className="space-y-3 flex-1">
                                <label className="block text-sm font-bold text-charcoal dark:text-stone-200">Recipe Name</label>
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                    className="w-full p-4 border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none font-bold bg-stone-50 dark:bg-[#1A1714] text-charcoal dark:text-stone-200 text-lg placeholder:text-charcoal/60 dark:text-stone-400/50 transition-all"
                                    placeholder="e.g. Grandma's Famous Lasagna"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="block text-sm font-bold text-charcoal dark:text-stone-200">Servings</label>
                                <div className="bg-stone-50 dark:bg-[#1A1714] border border-border rounded-xl p-1.5 flex items-center gap-2 h-[62px]">
                                    <button
                                        className="w-10 h-full rounded-lg bg-white dark:bg-white/5 border border-border flex items-center justify-center hover:bg-primary/10 hover:border-primary hover:text-primary transition-colors font-bold active:scale-95 text-lg"
                                        onClick={() => setEditForm({ ...editForm, servings: Math.max(1, (editForm.servings || 1) - 1) })}
                                    >
                                        -
                                    </button>
                                    <span className="text-lg font-bold text-charcoal dark:text-stone-200 w-8 text-center">{editForm.servings || 1}</span>
                                    <button
                                        className="w-10 h-full rounded-lg bg-white dark:bg-white/5 border border-border flex items-center justify-center hover:bg-primary/10 hover:border-primary hover:text-primary transition-colors font-bold active:scale-95 text-lg"
                                        onClick={() => setEditForm({ ...editForm, servings: (editForm.servings || 1) + 1 })}
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Tags Section */}
                        <div className="space-y-3">
                            <label className="block text-sm font-bold text-charcoal dark:text-stone-200">Tags</label>
                            <div className="space-y-3">
                                <div className="flex flex-wrap gap-1.5">
                                    {['breakfast', 'main meal', 'snack', 'light meal'].map(tag => (
                                        <button
                                            key={tag}
                                            onClick={() => handleTagClick(tag)}
                                            className={`px-2.5 py-1 rounded-md text-xs font-bold border transition-all active:scale-95 ${(editForm.tags || []).includes(tag)
                                                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                                : 'bg-white dark:bg-white/5 text-charcoal/60 dark:text-stone-400 border-border hover:border-primary/50 hover:text-charcoal dark:text-stone-200'
                                                }`}
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                                <input
                                    type="text"
                                    placeholder="+ Add custom tag..."
                                    className="w-full p-3 border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none bg-stone-50 dark:bg-[#1A1714] text-sm font-medium text-charcoal dark:text-stone-200 placeholder:text-charcoal/60 dark:text-stone-400/70 transition-all"
                                    onKeyDown={handleAddCustomTag}
                                />
                                {/* Selected Custom Tags */}
                                <div className="flex flex-wrap gap-2 min-h-[1.5rem]">
                                    {(editForm.tags || []).filter(t => !['breakfast', 'main meal', 'snack', 'light meal'].includes(t)).map(tag => (
                                        <span key={tag} className="pl-2 pr-1 py-1 bg-white dark:bg-white/5 border border-border rounded-md text-xs font-bold flex items-center gap-1 animate-scale-in text-charcoal dark:text-stone-200">
                                            {tag}
                                            <button onClick={() => handleTagClick(tag)} className="hover:bg-red-100 hover:text-red-600 rounded p-0.5 transition-colors">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Nutrition */}
                        <div className="space-y-3">
                            <label className="block text-sm font-bold text-charcoal dark:text-stone-200">Nutrition <span className="text-charcoal/60 dark:text-stone-400 font-normal text-xs">(per serving)</span></label>
                            <div className="grid grid-cols-4 divide-x divide-border bg-stone-50 dark:bg-[#1A1714] rounded-xl border border-border overflow-hidden">
                                {[
                                    { label: 'Calories', val: editForm.calories, key: 'calories', unit: 'kcal' },
                                    { label: 'Protein', val: editForm.protein, key: 'protein', unit: 'g' },
                                    { label: 'Fat', val: editForm.fat, key: 'fat', unit: 'g' },
                                    { label: 'Carbs', val: editForm.carbs, key: 'carbs', unit: 'g' }
                                ].map((item) => (
                                    <div key={item.key} className="p-3 text-center hover:bg-white dark:bg-white/5/50 transition-colors group">
                                        <input
                                            type="number"
                                            min="0"
                                            value={item.val || 0}
                                            onChange={e => setEditForm({ ...editForm, [item.key]: parseInt(e.target.value) || 0 })}
                                            onFocus={e => e.target.select()}
                                            className="w-full text-center font-bold bg-transparent focus:outline-none text-charcoal dark:text-stone-200 text-lg p-0"
                                        />
                                        <div className="text-[10px] font-bold text-charcoal/60 dark:text-stone-400 uppercase tracking-wider mt-1 group-hover:text-primary transition-colors">{item.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Lists */}
                        {/* Lists */}
                        <div className="space-y-8">
                            <div className="space-y-3">
                                <label className="block text-sm font-bold text-charcoal dark:text-stone-200">
                                    Ingredients
                                    <span className="text-charcoal/60 dark:text-stone-400 font-normal ml-2 text-xs">(one per line)</span>
                                </label>
                                <textarea
                                    rows={10}
                                    value={(editForm.ingredients || []).join('\n')}
                                    onChange={e => setEditForm({ ...editForm, ingredients: e.target.value.split('\n') })}
                                    placeholder="e.g.\n200g Chicken Breast\n1 cup Rice\n..."
                                    className="w-full p-5 border border-border rounded-xl font-medium text-sm leading-relaxed focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none bg-stone-50 dark:bg-[#1A1714] text-charcoal dark:text-stone-200 resize-none transition-all placeholder:text-charcoal/60 dark:text-stone-400/50"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="block text-sm font-bold text-charcoal dark:text-stone-200">
                                    Instructions
                                    <span className="text-charcoal/60 dark:text-stone-400 font-normal ml-2 text-xs">(one per line)</span>
                                </label>
                                <textarea
                                    rows={10}
                                    value={(editForm.instructions || []).join('\n')}
                                    onChange={e => setEditForm({ ...editForm, instructions: e.target.value.split('\n') })}
                                    placeholder="e.g.\n1. Preheat oven to 180°C\n2. Mix ingredients...\n..."
                                    className="w-full p-5 border border-border rounded-xl font-medium text-sm leading-relaxed focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none bg-stone-50 dark:bg-[#1A1714] text-charcoal dark:text-stone-200 resize-none transition-all placeholder:text-charcoal/60 dark:text-stone-400/50"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Portal>
    );
};
