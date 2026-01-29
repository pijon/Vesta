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

    const handleImageSelect = (downloadURL: string) => {
        setImageError(null);
        setUploadedImage(downloadURL);
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
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-4 animate-fade-in bg-stone-900/40 backdrop-blur-sm" onClick={onCancel}>
                <div
                    className="bg-[var(--background)] w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col scale-100"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header: Actions */}
                    <div className="flex justify-between items-center p-6 border-b border-border bg-[var(--surface)] z-20 transition-colors shrink-0">
                        <h2 className="text-2xl font-bold text-[var(--text-main)] font-serif">Edit Recipe Details</h2>
                        <div className="flex gap-3">
                            <button
                                onClick={onCancel}
                                className="px-5 py-2.5 text-[var(--text-secondary)] hover:bg-[var(--input-bg)] rounded-xl text-sm font-bold transition-colors"
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
                            <label className="block text-sm font-bold text-[var(--text-main)]">Recipe Photo</label>
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
                                <div className="bg-[var(--input-bg)] rounded-2xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/30 hover:bg-primary/5">
                                    <ImageInput
                                        recipeId={recipe.id}
                                        onImageSelect={handleImageSelect}
                                        onError={(err) => setImageError(err)}
                                        className="w-full flex justify-center"
                                    />
                                    <p className="text-[var(--text-secondary)] text-sm mt-3">Supports JPG, PNG, WEBP (Max 5MB)</p>
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
                                <label className="block text-sm font-bold text-[var(--text-main)]">Recipe Name</label>
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                    className="w-full p-4 border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none font-bold bg-[var(--input-bg)] text-[var(--text-main)] text-lg placeholder-[var(--text-muted)] transition-all"
                                    placeholder="e.g. Grandma's Famous Lasagna"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="block text-sm font-bold text-[var(--text-main)]">Servings</label>
                                <div className="bg-[var(--input-bg)] border border-border rounded-xl p-1.5 flex items-center gap-2 h-[62px]">
                                    <button
                                        className="w-10 h-full rounded-lg bg-[var(--card-bg)] border border-border flex items-center justify-center hover:bg-primary/10 hover:border-primary hover:text-primary transition-colors font-bold active:scale-95 text-lg"
                                        onClick={() => setEditForm({ ...editForm, servings: Math.max(1, (editForm.servings || 1) - 1) })}
                                    >
                                        -
                                    </button>
                                    <span className="text-lg font-bold text-[var(--text-main)] w-8 text-center">{editForm.servings || 1}</span>
                                    <button
                                        className="w-10 h-full rounded-lg bg-[var(--card-bg)] border border-border flex items-center justify-center hover:bg-primary/10 hover:border-primary hover:text-primary transition-colors font-bold active:scale-95 text-lg"
                                        onClick={() => setEditForm({ ...editForm, servings: (editForm.servings || 1) + 1 })}
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Tags Section */}
                        <div className="space-y-3">
                            <label className="block text-sm font-bold text-[var(--text-main)]">Tags</label>
                            <div className="space-y-3">
                                <div className="flex flex-wrap gap-1.5">
                                    {['breakfast', 'main meal', 'snack', 'light meal'].map(tag => (
                                        <button
                                            key={tag}
                                            onClick={() => handleTagClick(tag)}
                                            className={`px-2.5 py-1 rounded-md text-xs font-bold border transition-all active:scale-95 ${(editForm.tags || []).includes(tag)
                                                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                                : 'bg-[var(--card-bg)] text-[var(--text-secondary)] border-border hover:border-primary/50 hover:text-[var(--text-main)]'
                                                }`}
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                                <input
                                    type="text"
                                    placeholder="+ Add custom tag..."
                                    className="w-full p-3 border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none bg-[var(--input-bg)] text-sm font-medium text-[var(--text-main)] placeholder-[var(--text-muted)] transition-all"
                                    onKeyDown={handleAddCustomTag}
                                />
                                {/* Selected Custom Tags */}
                                <div className="flex flex-wrap gap-2 min-h-[1.5rem]">
                                    {(editForm.tags || []).filter(t => !['breakfast', 'main meal', 'snack', 'light meal'].includes(t)).map(tag => (
                                        <span key={tag} className="pl-2 pr-1 py-1 bg-[var(--card-bg)] border border-border rounded-md text-xs font-bold flex items-center gap-1 animate-scale-in text-[var(--text-main)]">
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
                            <label className="block text-sm font-bold text-[var(--text-main)]">Nutrition <span className="text-[var(--text-secondary)] font-normal text-xs">(per serving)</span></label>
                            <div className="grid grid-cols-4 divide-x divide-border bg-[var(--input-bg)] rounded-xl border border-border overflow-hidden">
                                {[
                                    { label: 'Calories', val: editForm.calories, key: 'calories', unit: 'kcal' },
                                    { label: 'Protein', val: editForm.protein, key: 'protein', unit: 'g' },
                                    { label: 'Fat', val: editForm.fat, key: 'fat', unit: 'g' },
                                    { label: 'Carbs', val: editForm.carbs, key: 'carbs', unit: 'g' }
                                ].map((item) => (
                                    <div key={item.key} className="p-3 text-center hover:bg-[var(--card-bg)] transition-colors group">
                                        <input
                                            type="number"
                                            min="0"
                                            value={item.val || 0}
                                            onChange={e => setEditForm({ ...editForm, [item.key]: parseInt(e.target.value) || 0 })}
                                            onFocus={e => e.target.select()}
                                            className="w-full text-center font-bold bg-transparent focus:outline-none text-[var(--text-main)] text-lg p-0"
                                        />
                                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mt-1 group-hover:text-primary transition-colors">{item.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Lists */}
                        {/* Lists */}
                        <div className="space-y-8">
                            <div className="space-y-3">
                                <label className="block text-sm font-bold text-[var(--text-main)]">
                                    Ingredients
                                    <span className="text-[var(--text-secondary)] font-normal ml-2 text-xs">(one per line)</span>
                                </label>
                                <textarea
                                    rows={10}
                                    value={(editForm.ingredients || []).join('\n')}
                                    onChange={e => setEditForm({ ...editForm, ingredients: e.target.value.split('\n') })}
                                    placeholder="e.g.\n200g Chicken Breast\n1 cup Rice\n..."
                                    className="w-full p-5 border border-border rounded-xl font-medium text-sm leading-relaxed focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none bg-[var(--input-bg)] text-[var(--text-main)] resize-none transition-all placeholder-[var(--text-muted)]"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="block text-sm font-bold text-[var(--text-main)]">
                                    Instructions
                                    <span className="text-[var(--text-secondary)] font-normal ml-2 text-xs">(one per line)</span>
                                </label>
                                <textarea
                                    rows={10}
                                    value={(editForm.instructions || []).join('\n')}
                                    onChange={e => setEditForm({ ...editForm, instructions: e.target.value.split('\n') })}
                                    placeholder="e.g.\n1. Preheat oven to 180°C\n2. Mix ingredients...\n..."
                                    className="w-full p-5 border border-border rounded-xl font-medium text-sm leading-relaxed focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none bg-[var(--input-bg)] text-[var(--text-main)] resize-none transition-all placeholder-[var(--text-muted)]"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Portal>
    );
};
