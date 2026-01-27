import React, { useState } from 'react';
import { PurchasableItem } from '../types';
import { TrashIcon, ClipboardDocumentIcon, ClipboardDocumentCheckIcon, Bars2Icon } from '@heroicons/react/24/outline';
import { Reorder, useDragControls } from 'framer-motion';

interface ShoppingItemProps {
    item: PurchasableItem;
    recipes?: string[];
    onRemove: () => void;
    onCopy: () => void;
    onUpdate: (newQuantity: string) => void;
    isChecked: boolean;
    onToggleCheck: () => void;
}

const ShoppingItem: React.FC<ShoppingItemProps> = ({ item, recipes, onRemove, onCopy, onUpdate, isChecked, onToggleCheck }) => {
    const [copied, setCopied] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');
    const dragControls = useDragControls();

    const handleCopy = () => {
        onCopy();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const startEditing = () => {
        if (!onUpdate) return;
        setEditValue(item.purchasableQuantity || item.requiredQuantity);
        setIsEditing(true);
    };

    const submitEdit = () => {
        setIsEditing(false);
        if (editValue && editValue !== (item.purchasableQuantity || item.requiredQuantity)) {
            onUpdate?.(editValue);
        }
    };

    return (
        <Reorder.Item
            value={item}
            dragListener={false}
            dragControls={dragControls}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ scale: 1.01 }}
            transition={{ duration: 0.2 }}
            className={`group relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl card hover:shadow-md hover:border-primary/30 select-none ${isChecked ? 'opacity-60 bg-stone-100 dark:bg-white/5' : ''}`}
        >
            <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
                {/* Drag Handle */}
                <div
                    className="cursor-grab active:cursor-grabbing text-charcoal/30 hover:text-primary transition-colors p-1"
                    onPointerDown={(e) => dragControls.start(e)}
                >
                    <Bars2Icon className="w-5 h-5" />
                </div>

                {/* Checkbox */}
                <div
                    onClick={onToggleCheck}
                    className={`
                        w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all flex-shrink-0
                        ${isChecked
                            ? 'bg-secondary border-secondary text-white'
                            : 'border-border hover:border-secondary'
                        }
                    `}
                >
                    {isChecked && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                        {isEditing ? (
                            <input
                                autoFocus
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={submitEdit}
                                onKeyDown={(e) => e.key === 'Enter' && submitEdit()}
                                className="bg-white dark:bg-white/5 border border-border rounded-lg px-2 py-1 text-lg font-bold text-primary min-w-[60px] max-w-[120px] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                            />
                        ) : (
                            <span
                                onClick={startEditing}
                                className={`text-lg font-bold text-primary whitespace-nowrap decoration-dashed decoration-primary/30 underline-offset-4 ${onUpdate ? 'cursor-pointer hover:underline' : ''} ${isChecked ? 'line-through opacity-70' : ''}`}
                                title={onUpdate ? "Click to edit quantity" : undefined}
                            >
                                {item.purchasableQuantity || item.requiredQuantity}
                            </span>
                        )}
                        <span className={`text-base font-semibold text-charcoal dark:text-stone-200 ${isChecked ? 'line-through opacity-70' : ''}`}>
                            {item.ingredientName}
                        </span>

                        {(recipes && recipes.length > 0) && (
                            <span className="text-xs text-primary/70 font-medium ml-2">
                                for {recipes.join(', ')}
                            </span>
                        )}

                    </div>
                </div>
            </div>

            <div className="flex items-center gap-1 w-full sm:w-auto justify-end">
                <button
                    onClick={handleCopy}
                    className="p-2 rounded-lg text-charcoal/60 dark:text-stone-400 hover:text-primary hover:bg-primary/10 transition-colors"
                    title="Copy to clipboard"
                >
                    {copied ? (
                        <ClipboardDocumentCheckIcon className="w-5 h-5 text-primary" />
                    ) : (
                        <ClipboardDocumentIcon className="w-5 h-5" />
                    )}
                </button>

                <button
                    onClick={onRemove}
                    className="p-2 rounded-lg text-charcoal/60 dark:text-stone-400 hover:text-error hover:bg-error/10 transition-colors"
                    title="Remove item"
                >
                    <TrashIcon className="w-5 h-5" />
                </button>
            </div>
        </Reorder.Item>
    );
};

export default ShoppingItem;
