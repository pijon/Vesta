import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ProgressRing } from './achievements/ProgressRing';

interface HydrationWidgetProps {
    intake: number;
    goal: number;
    onAdd: (amount: number) => void;
    onSet: (amount: number) => void;
    className?: string;
}

export const HydrationWidget: React.FC<HydrationWidgetProps> = ({ intake, goal, onAdd, onSet, className = "" }) => {
    const percentage = Math.min(100, (intake / goal) * 100);
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(intake.toString());

    useEffect(() => {
        setEditValue(intake.toString());
    }, [intake]);

    const handleSave = () => {
        const val = parseInt(editValue);
        if (!isNaN(val) && val >= 0) {
            onSet(val);
        } else {
            setEditValue(intake.toString());
        }
        setIsEditing(false);
    };

    return (
        <div className={`group bg-[var(--card-bg)] rounded-organic-md shadow-sm border border-border/50 overflow-hidden hover:shadow-md transition-all cursor-pointer h-full flex flex-col relative ${className}`}>

            {/* Header */}
            <div className="px-6 py-4 border-b border-border/30 flex items-center justify-between shrink-0 h-[60px]">
                <h3 className="font-serif text-lg font-medium text-charcoal dark:text-stone-200">Hydration</h3>
                {/* Badge - Increased contrast: text-sky-800 */}

            </div>

            {/* Content Body */}
            <div className="flex-1 flex flex-col items-center justify-center p-4 z-10 gap-2">
                <div className="relative">
                    <ProgressRing
                        progress={percentage}
                        size={140}
                        strokeWidth={12}
                        gradientId="water_bento_grad"
                        gradientColors={['var(--water)', 'var(--water)']} // Semantic Blue
                        trackColor="var(--water-border)"
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-1">
                        {isEditing ? (
                            <input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={handleSave}
                                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                                className="w-24 text-center bg-transparent text-3xl font-bold font-sans leading-none outline-none border-b border-water"
                                style={{ color: 'var(--text-charcoal dark:text-stone-200)' }}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <span
                                className="text-3xl font-bold font-sans leading-none text-water cursor-pointer hover:opacity-80 pointer-events-auto"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsEditing(true);
                                }}
                            >
                                {(intake / 1000).toFixed(1)}L
                            </span>
                        )}
                        <span className="text-xs font-semibold text-charcoal/60 dark:text-stone-400 uppercase tracking-wide mt-1">
                            Intake
                        </span>
                    </div>
                </div>

                {/* Secondary Info */}
                <div className="h-6" />
            </div>

            {/* Action Buttons */}
            <div className="p-4 z-10 mt-auto grid grid-cols-2 gap-3">
                <button
                    onClick={() => onAdd(250)}
                    className="py-2.5 rounded-xl bg-background text-water font-bold text-sm hover:bg-water/10 border border-border hover:border-water/20 transition-all flex items-center justify-center gap-1"
                >
                    +250ml
                </button>
                <button
                    onClick={() => onAdd(500)}
                    className="py-2.5 rounded-xl bg-water text-white font-bold text-sm shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-1"
                >
                    +500ml
                </button>
            </div>
        </div>
    );
};
