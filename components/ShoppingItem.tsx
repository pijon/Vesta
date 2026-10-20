import React, { useState } from 'react';
import { Check, House, Trash2 } from 'lucide-react';

interface ShoppingItemProps {
    name: string;
    /** "1.2 kg"; empty for an item typed in without one */
    amount: string;
    /** The meals it's for */
    meals: string[];
    isChecked: boolean;
    onToggleCheck: () => void;
    onRemove: () => void;
    onUpdateAmount: (amount: string) => void;
    /** Marks the food as at home (meal ingredients still to buy) */
    onHaveIt?: () => void;
}

/** One thing to buy: tick it into the basket, tap the amount to change it, mark it as at home, or remove it. */
const ShoppingItem: React.FC<ShoppingItemProps> = ({ name, amount, meals, isChecked, onToggleCheck, onRemove, onUpdateAmount, onHaveIt }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');

    const startEditing = () => {
        setEditValue(amount);
        setIsEditing(true);
    };

    const submitEdit = () => {
        setIsEditing(false);
        if (editValue.trim() !== amount) onUpdateAmount(editValue.trim());
    };

    return (
        <li className="group flex items-center gap-2 md:gap-3 rounded-[14px] pl-1 pr-1 hover:bg-surface-sunken transition-colors">
            <button
                onClick={onToggleCheck}
                aria-pressed={isChecked}
                aria-label={isChecked ? `Put ${name} back on the list` : `Mark ${name} as in the basket`}
                className={`size-11 shrink-0 flex items-center justify-center rounded-full border-2 transition-colors active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${isChecked
                    ? 'bg-ink border-ink text-on-ink'
                    : 'border-border-control text-transparent hover:text-muted hover:border-main'}`}
            >
                <Check size={20} strokeWidth={3} />
            </button>

            <div className="flex-1 min-w-0 py-2">
                {/* The name leads, since that's what you look for in the shop; the amount follows, tap to change it */}
                <div className={`flex flex-wrap items-baseline gap-x-2 ${isChecked ? 'text-muted' : ''}`}>
                    <span className={`font-semibold first-letter:uppercase [overflow-wrap:anywhere] ${isChecked ? 'line-through decoration-1' : ''}`}>{name}</span>
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
                            aria-label={`Amount of ${name}`}
                            className="input min-h-9 py-1 px-2 w-32 text-sm font-semibold"
                        />
                    ) : amount && (
                        // Typed onto the list without one: type it with the item instead
                        <button
                            onClick={startEditing}
                            disabled={isChecked}
                            className="hit-target text-sm font-semibold text-muted underline decoration-dashed decoration-border-control underline-offset-4 disabled:no-underline hover:text-main hover:decoration-main rounded focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                            aria-label={`Change amount: ${amount}`}
                        >
                            {amount}
                        </button>
                    )}
                </div>
                {meals.length > 0 && (
                    <p className="text-xs text-muted mt-0.5 line-clamp-1">For {meals.join(', ')}</p>
                )}
            </div>

            {onHaveIt && (
                <button
                    onClick={onHaveIt}
                    aria-label={`Have ${name} at home`}
                    title="Have it at home"
                    className="hit-target size-9 shrink-0 flex items-center justify-center rounded-full text-muted hover:bg-surface-sunken hover:text-main transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                >
                    <House size={16} />
                </button>
            )}
            <button
                onClick={onRemove}
                aria-label={`Remove ${name}`}
                className="hit-target size-9 shrink-0 flex items-center justify-center rounded-full text-muted hover:bg-error-bg hover:text-error transition-colors md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
            >
                <Trash2 size={16} />
            </button>
        </li>
    );
};

export default ShoppingItem;
