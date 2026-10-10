import React, { useState } from 'react';
import { PurchasableItem } from '../types';
import { Reorder, useDragControls } from 'framer-motion';
import { Check, Copy, CopyCheck, GripVertical, Trash2 } from 'lucide-react';

interface ShoppingItemProps {
    item: PurchasableItem;
    recipes?: string[];
    onRemove: () => void;
    onCopy: () => void;
    onUpdate: (newQuantity: string) => void;
    isChecked: boolean;
    onToggleCheck: () => void;
    /** Checked items render outside the reorderable list */
    reorderable?: boolean;
}

const ShoppingItem: React.FC<ShoppingItemProps> = ({ item, recipes, onRemove, onCopy, onUpdate, isChecked, onToggleCheck, reorderable = true }) => {
    const [copied, setCopied] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');
    const dragControls = useDragControls();

    const quantity = item.purchasableQuantity || item.requiredQuantity;

    const handleCopy = () => {
        onCopy();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const startEditing = () => {
        setEditValue(quantity);
        setIsEditing(true);
    };

    const submitEdit = () => {
        setIsEditing(false);
        if (editValue && editValue !== quantity) onUpdate(editValue);
    };

    const content = (
        <>
            {reorderable && (
                <span
                    className="hidden md:flex size-8 shrink-0 items-center justify-center text-muted cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity touch-none"
                    onPointerDown={(e) => dragControls.start(e)}
                    aria-hidden="true"
                >
                    <GripVertical size={16} />
                </span>
            )}

            <button
                onClick={onToggleCheck}
                aria-pressed={isChecked}
                aria-label={isChecked ? `Put ${item.ingredientName} back on the list` : `Mark ${item.ingredientName} as in the basket`}
                className={`size-11 shrink-0 flex items-center justify-center rounded-full border-2 transition-colors active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${isChecked
                    ? 'bg-secondary border-secondary text-secondary-foreground'
                    : 'border-border-control text-transparent hover:text-muted hover:border-main'}`}
            >
                <Check size={20} strokeWidth={3} />
            </button>

            <div className="flex-1 min-w-0 py-2">
                <div className={`flex flex-wrap items-baseline gap-x-2 ${isChecked ? 'text-muted' : ''}`}>
                    {isEditing ? (
                        <input
                            autoFocus
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={submitEdit}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') submitEdit();
                                if (e.key === 'Escape') setIsEditing(false);
                            }}
                            aria-label={`Quantity of ${item.ingredientName}`}
                            className="input !min-h-9 !py-1 !px-2 w-32 font-bold"
                        />
                    ) : (
                        <button
                            onClick={startEditing}
                            disabled={isChecked}
                            className="font-display font-extrabold text-lg leading-6 underline decoration-dashed decoration-border-control underline-offset-4 disabled:no-underline hover:decoration-main rounded focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                            aria-label={`Edit quantity: ${quantity}`}
                        >
                            {quantity}
                        </button>
                    )}
                    <span className={`inline-block font-semibold first-letter:uppercase ${isChecked ? 'line-through decoration-1' : ''}`}>{item.ingredientName}</span>
                </div>
                {recipes && recipes.length > 0 && (
                    <p className="text-xs text-muted mt-0.5 line-clamp-1">For {recipes.join(', ')}</p>
                )}
            </div>

            <div className="flex shrink-0 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                <button
                    onClick={handleCopy}
                    aria-label={copied ? 'Copied' : `Copy ${item.ingredientName}`}
                    className="size-9 flex items-center justify-center rounded-full text-muted hover:bg-surface-sunken hover:text-main transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                >
                    {copied ? <CopyCheck size={16} className="text-weight-text" /> : <Copy size={16} />}
                </button>
                <button
                    onClick={onRemove}
                    aria-label={`Remove ${item.ingredientName}`}
                    className="size-9 flex items-center justify-center rounded-full text-muted hover:bg-error-bg hover:text-error transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </>
    );

    const rowClass = 'group flex items-center gap-2 md:gap-3 rounded-[14px] pl-1 pr-1 hover:bg-surface-sunken transition-colors select-none';

    if (!reorderable) {
        return <li className={rowClass}>{content}</li>;
    }

    return (
        <Reorder.Item
            value={item}
            dragListener={false}
            dragControls={dragControls}
            layout="position"
            transition={{ duration: 0.15 }}
            className={rowClass}
        >
            {content}
        </Reorder.Item>
    );
};

export default ShoppingItem;
