import React from 'react';
import { motion } from 'framer-motion';
import { ProgressRing } from './achievements/ProgressRing';

interface CaloriesWidgetProps {
    consumed: number;
    target: number;
    burned: number;
    isNonFastDay: boolean;
    onLogFood: () => void;
}

export const CaloriesWidget: React.FC<CaloriesWidgetProps> = ({ consumed, target, burned, isNonFastDay, onLogFood }) => {
    const netCalories = consumed - burned;
    const remaining = target - netCalories;
    const progress = Math.min(100, (netCalories / target) * 100);
    const isOver = netCalories > target;

    // Semantic Colors based on state
    const ringColors = isOver
        ? ['var(--error)', 'var(--error)'] // Burnt Rose if over
        : ['var(--calories)', 'var(--calories)']; // Terracotta default

    return (
        <div
            className="group bg-[var(--card-bg)] rounded-organic-md shadow-sm border border-border/50 overflow-hidden hover:shadow-md transition-all cursor-pointer h-full flex flex-col relative"
            onClick={onLogFood}
        >
            {/* Header */}
            <div className="px-6 py-4 border-b border-border/30 flex items-center justify-between shrink-0 h-[60px]">
                <div className="flex items-center gap-2">
                    <h3 className="font-serif text-lg font-medium text-charcoal dark:text-stone-200">Calories</h3>
                </div>
                {/* Badge - Ceramic Style */}
                {!isNonFastDay && (
                    <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-md border bg-calories-bg/10 text-calories border-calories-border/50">
                        Fast Day
                    </span>
                )}
            </div>

            {/* Content Body */}
            <div className="flex-1 flex flex-col items-center justify-center p-4 relative z-10 gap-2">
                <div className="relative">
                    <ProgressRing
                        progress={isOver ? 100 : progress}
                        size={140}
                        strokeWidth={12}
                        gradientId="cals_bento_grad"
                        gradientColors={ringColors}
                        trackColor="var(--calories-border)"
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-1">
                        <span className={`text-3xl font-bold font-sans leading-none ${isOver ? 'text-error' : 'text-calories'}`}>
                            {netCalories}
                        </span>
                        <span className="text-xs font-semibold text-charcoal/60 dark:text-stone-400 uppercase tracking-wide mt-1">
                            / {target}
                        </span>
                    </div>
                </div>

                {/* Secondary Info */}
                <div className="h-6 flex items-center gap-3 text-sm font-medium opacity-80">
                    <span className={`${remaining < 0 ? 'text-error font-bold' : 'text-charcoal/60 dark:text-stone-400'}`}>
                        {remaining < 0 ? `${Math.abs(remaining)} over` : `${remaining} left`}
                    </span>
                    {burned > 0 && (
                        <span className="text-workout">
                            • -{burned} active
                        </span>
                    )}
                </div>
            </div>

            {/* Action Button */}
            <div className="p-4 z-10 mt-auto">
                <button className="w-full py-2.5 rounded-xl bg-calories text-white font-bold text-sm shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                    Log Food
                </button>
            </div>
        </div>
    );
};
