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
        <div className="bg-[var(--card-bg)] rounded-3xl p-6">
            <div className="grid grid-cols-2 gap-6">

                {/* Goal Consistency - Simplified */}
                <div className="flex flex-col">
                    <div className="text-sm font-normal text-muted dark:text-muted mb-2">Goal Consistency</div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-display font-extrabold bg-gradient-to-br from-sage-600 to-sage-400 bg-clip-text text-transparent">
                            {Math.round(streakAnalysis.complianceRate)}
                        </span>
                        <span className="text-xl font-semibold text-muted dark:text-muted">%</span>
                    </div>
                    <div className="text-xs text-muted dark:text-muted mt-1">
                        Last {monthlySummary.daysLogged} days
                    </div>
                </div>

                {/* Current Streak - Simplified (removed Longest Streak) */}
                <div className="flex flex-col">
                    <div className="text-sm font-normal text-muted dark:text-muted mb-2">Current Streak</div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-display font-extrabold bg-gradient-to-br from-terracotta-600 to-terracotta-400 bg-clip-text text-transparent">
                            {streakAnalysis.currentStreak}
                        </span>
                        <span className="text-xl font-semibold text-muted dark:text-muted">days</span>
                    </div>
                    <div className="text-xs text-muted dark:text-muted mt-1">
                        Keep going!
                    </div>
                </div>

            </div>
        </div>
    );
};
