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
                className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-900/40 backdrop-blur-sm px-4 py-4 animate-fade-in"
                onClick={onClose}
            >
                <div
                    className="bg-[var(--background)] w-full max-w-md rounded-3xl border border-border shadow-2xl overflow-hidden backdrop-blur-md"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="p-6 md:p-8 border-b border-border flex justify-between items-center bg-transparent">
                        <h3 className="font-normal text-2xl md:text-3xl text-[var(--text-main)] font-serif">Update Weight</h3>
                        <button
                            onClick={onClose}
                            className="p-2 bg-[var(--input-bg)] border border-transparent rounded-full text-muted hover:text-[var(--text-main)] transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-2">Current Weight (kg)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={weightInput}
                                onChange={(e) => setWeightInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                                className="w-full p-3 bg-[var(--input-bg)] border border-transparent focus:border-sage/50 rounded-xl focus:ring-2 focus:ring-sage/20 outline-none font-medium text-lg text-[var(--text-main)] placeholder:text-muted transition-all shadow-sm"
                                placeholder="e.g. 75.5"
                                autoFocus
                            />
                            <p className="text-xs text-muted mt-2 ml-1">Enter your current weight to update your progress</p>
                        </div>
                    </div>
                    <div className="p-6 md:p-8 pt-0 flex gap-3 md:gap-4">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 bg-transparent text-muted font-bold rounded-xl hover:text-[var(--text-main)] hover:bg-[var(--input-bg)] transition-all border border-border"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!weightInput || parseFloat(weightInput) <= 0}
                            className={`flex-1 py-3 font-bold rounded-xl transition-all shadow-sm hover:shadow-md active:scale-95 ${!weightInput || parseFloat(weightInput) <= 0
                                ? 'bg-[var(--input-bg)] text-muted cursor-not-allowed shadow-none'
                                : 'bg-primary text-primary-foreground hover:bg-primary/90'
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
