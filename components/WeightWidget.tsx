import React from 'react';
import { motion } from 'framer-motion';
import { ProgressRing } from './achievements/ProgressRing';
import { UserStats } from '../types';

interface WeightWidgetProps {
    stats: UserStats;
    onUpdateWeight: () => void;
}

export const WeightWidget: React.FC<WeightWidgetProps> = ({ stats, onUpdateWeight }) => {
    const startWeight = stats.startWeight || stats.currentWeight + 5; // Fallback
    const totalLost = startWeight - stats.currentWeight;
    const goal = stats.goalWeight;

    // Calculate progress towards goal
    const totalGap = startWeight - goal;
    const currentGap = stats.currentWeight - goal;
    const progress = Math.min(100, Math.max(0, ((totalGap - currentGap) / totalGap) * 100));

    return (
        <div
            className="group bg-[var(--card-bg)] rounded-organic-md shadow-sm border border-border/50 overflow-hidden hover:shadow-md transition-all cursor-pointer h-full flex flex-col relative"
            onClick={onUpdateWeight}
        >
            {/* Header */}
            <div className="px-6 py-4 border-b border-border/30 flex items-center justify-between shrink-0 h-[60px]">
                <div className="flex items-center gap-2">
                    <h3 className="font-serif text-lg font-medium text-charcoal dark:text-stone-200">Weight</h3>
                </div>
                {/* Badge - High contrast solid colors for maximum readability */}

            </div>

            {/* Content Body */}
            <div className="flex-1 flex flex-col items-center justify-center p-4 z-10 gap-2">
                <div className="relative">
                    <ProgressRing
                        progress={progress}
                        size={140}
                        strokeWidth={12}
                        gradientId="weight_bento_grad"
                        gradientColors={['var(--weight)', 'var(--weight)']} // Semantic Teal
                        trackColor="var(--weight-border)"
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-1">
                        <span className="text-3xl font-bold font-sans leading-none text-weight">
                            {stats.currentWeight}
                        </span>
                        <span className="text-xs font-semibold text-charcoal/60 dark:text-stone-400 uppercase tracking-wide mt-1">
                            KG
                        </span>
                    </div>
                </div>

                {/* Secondary Info */}
                <div className="h-6 flex items-center justify-center">
                    <span className="text-sm font-bold text-weight">
                        {totalLost > 0 ? `${totalLost.toFixed(1)}kg lost` : 'Start Journey'}
                    </span>
                </div>
            </div>

            {/* Action Button */}
            <div className="p-4 z-10 mt-auto">
                <button className="w-full py-2.5 rounded-xl bg-weight text-white font-bold text-sm shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                    Update Weight
                </button>
            </div>
        </div>
    );
};
