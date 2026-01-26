import React from 'react';
import { StreakAnalysis, PeriodSummary } from '../../utils/analytics';

interface ConsistencyOverviewCardProps {
    streakAnalysis: StreakAnalysis;
    monthlySummary: PeriodSummary;
}

export const ConsistencyOverviewCard: React.FC<ConsistencyOverviewCardProps> = ({
    streakAnalysis,
    monthlySummary
}) => {
    return (
        <div className="bg-[var(--card-bg)] backdrop-blur-md rounded-3xl p-6">
            <div className="grid grid-cols-2 gap-6">

                {/* Goal Consistency - Simplified */}
                <div className="flex flex-col">
                    <div className="text-sm font-normal text-charcoal/60 dark:text-stone-400 mb-2">Goal Consistency</div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold font-serif bg-gradient-to-br from-emerald-600 to-emerald-400 bg-clip-text text-transparent">
                            {Math.round(streakAnalysis.complianceRate)}
                        </span>
                        <span className="text-xl font-semibold text-charcoal/60 dark:text-stone-400">%</span>
                    </div>
                    <div className="text-xs text-charcoal/60 dark:text-stone-400 mt-1">
                        Last {monthlySummary.daysLogged} days
                    </div>
                </div>

                {/* Current Streak - Simplified (removed Longest Streak) */}
                <div className="flex flex-col">
                    <div className="text-sm font-normal text-charcoal/60 dark:text-stone-400 mb-2">Current Streak</div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold font-serif bg-gradient-to-br from-orange-600 to-orange-400 bg-clip-text text-transparent">
                            {streakAnalysis.currentStreak}
                        </span>
                        <span className="text-xl font-semibold text-charcoal/60 dark:text-stone-400">days</span>
                    </div>
                    <div className="text-xs text-charcoal/60 dark:text-stone-400 mt-1">
                        Keep going!
                    </div>
                </div>

            </div>
        </div>
    );
};
