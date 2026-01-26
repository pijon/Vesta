import React, { useState, useEffect } from 'react';
import { Portal } from './Portal';

interface WeightEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentWeight: number;
    onSave: (weight: number) => void;
}

export const WeightEntryModal: React.FC<WeightEntryModalProps> = ({
    isOpen,
    onClose,
    currentWeight,
    onSave
}) => {
    const [weightInput, setWeightInput] = useState(currentWeight.toString());

    useEffect(() => {
        setWeightInput(currentWeight.toString());
    }, [currentWeight, isOpen]);

    const handleSave = () => {
        const w = parseFloat(weightInput);
        if (w > 0) {
            onSave(w);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <Portal>
            <div
                className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-900/60 backdrop-blur-sm px-4 py-4 animate-fade-in"
                onClick={onClose}
            >
                <div
                    className="bg-[var(--color-stone)] dark:bg-[#1A1714] w-full max-w-md rounded-[2.5rem] border border-white/50 dark:border-white/5 shadow-2xl overflow-hidden"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="p-6 md:p-8 border-b border-charcoal/5 dark:border-white/5 flex justify-between items-center bg-transparent">
                        <h3 className="font-normal text-2xl md:text-3xl text-charcoal dark:text-stone-200 font-serif">Update Weight</h3>
                        <button
                            onClick={onClose}
                            className="p-2 bg-charcoal/5 dark:bg-white/5 border border-transparent rounded-full text-charcoal/60 dark:text-stone-400 hover:text-charcoal dark:text-stone-200 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-charcoal dark:text-stone-200 mb-2">Current Weight (kg)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={weightInput}
                                onChange={(e) => setWeightInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                                className="w-full p-3 bg-white dark:bg-white/5 border border-transparent focus:border-sage/50 rounded-xl focus:ring-2 focus:ring-sage/20 outline-none font-medium text-lg text-charcoal dark:text-stone-200 placeholder:text-charcoal/40 dark:placeholder:text-stone-600"
                                placeholder="e.g. 75.5"
                                autoFocus
                            />
                            <p className="text-xs text-charcoal/60 dark:text-stone-400 mt-2 ml-1">Enter your current weight to update your progress</p>
                        </div>
                    </div>
                    <div className="p-6 md:p-8 pt-0 flex gap-3 md:gap-4">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 bg-white/50 dark:bg-white/5 border border-charcoal/5 dark:border-transparent text-charcoal dark:text-stone-200 font-bold rounded-xl hover:bg-white dark:hover:bg-white/10 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!weightInput || parseFloat(weightInput) <= 0}
                            className={`flex-1 py-3 font-bold rounded-xl transition-colors shadow-lg ${!weightInput || parseFloat(weightInput) <= 0
                                ? 'bg-muted/20 text-charcoal/60 dark:text-stone-400 cursor-not-allowed'
                                : 'bg-primary text-primary-foreground hover:bg-primary-hover'
                                }`}
                        >
                            Update Weight
                        </button>
                    </div>
                </div>
            </div>
        </Portal>
    );
};
