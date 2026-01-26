import React, { useState } from 'react';
import { PurchasableItem } from '../types';
import { TrashIcon, ClipboardDocumentIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

interface ShoppingItemProps {
    item: PurchasableItem;
    recipes?: string[];
    onRemove: () => void;
    onCopy: () => void;
    onUpdate?: (newQuantity: string) => void;
}

const ShoppingItem: React.FC<ShoppingItemProps> = ({ item, recipes, onRemove, onCopy, onUpdate }) => {
    const [copied, setCopied] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');

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
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ scale: 1.01 }}
            transition={{ duration: 0.2 }}
            className="group relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl glass-panel hover:shadow-md hover:border-primary/30 transition-all"
        >
            <div className="flex-1 min-w-0 pr-2">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                    {isEditing ? (
                        <input
                            autoFocus
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={submitEdit}
                            onKeyDown={(e) => e.key === 'Enter' && submitEdit()}
                            className="bg-primary/5 border border-primary/20 rounded px-1.5 py-0.5 text-lg font-bold text-primary min-w-[60px] max-w-[120px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    ) : (
                        <span
                            onClick={startEditing}
                            className={`text-lg font-bold text-primary whitespace-nowrap decoration-dashed decoration-primary/30 underline-offset-4 ${onUpdate ? 'cursor-pointer hover:underline' : ''}`}
                            title={onUpdate ? "Click to edit quantity" : undefined}
                        >
                            {item.purchasableQuantity || item.requiredQuantity}
                        </span>
                    )}
                    <span className="text-base font-semibold text-charcoal dark:text-stone-200">
                        {item.ingredientName}
                    </span>

                    {(recipes && recipes.length > 0) && (
                        <span className="text-xs text-primary/70 font-medium">
                            for {recipes.join(', ')}
                        </span>
                    )}

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
        </motion.div>
    );
};

export default ShoppingItem;
