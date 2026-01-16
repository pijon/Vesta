import React from 'react';
import { StreakAnalysis, PeriodSummary } from '../../utils/analytics';

interface ComplianceOverviewCardProps {
  streakAnalysis: StreakAnalysis;
  monthlySummary: PeriodSummary;
}

export const ComplianceOverviewCard: React.FC<ComplianceOverviewCardProps> = ({
  streakAnalysis,
  monthlySummary
}) => {
  const avgDeficit = monthlySummary.avgNetCalories - monthlySummary.avgCalories;

  return (
    <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Compliance Rate */}
        <div className="flex flex-col">
          <div className="text-sm font-medium text-muted mb-2">Compliance Rate</div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold font-serif bg-gradient-to-br from-emerald-600 to-emerald-400 bg-clip-text text-transparent">
              {Math.round(streakAnalysis.complianceRate)}
            </span>
            <span className="text-xl font-semibold text-muted">%</span>
          </div>
          <div className="text-xs text-muted mt-1">
            {streakAnalysis.totalCompliantDays} of {monthlySummary.daysLogged} days on target
          </div>
        </div>

        {/* Current Streak */}
        <div className="flex flex-col">
          <div className="text-sm font-medium text-muted mb-2">Current Streak</div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold font-serif bg-gradient-to-br from-orange-600 to-orange-400 bg-clip-text text-transparent">
              {streakAnalysis.currentStreak}
            </span>
            <span className="text-xl font-semibold text-muted">days</span>
          </div>
          <div className="text-xs text-muted mt-1">
            Longest: {streakAnalysis.longestStreak} days
          </div>
        </div>

        {/* Average Deficit */}
        <div className="flex flex-col">
          <div className="text-sm font-medium text-muted mb-2">Avg Daily Deficit</div>
          <div className="flex items-baseline gap-2">
            <span className={`text-4xl font-bold font-serif bg-gradient-to-br ${
              avgDeficit < 0
                ? 'from-emerald-600 to-emerald-400'
                : 'from-red-600 to-red-400'
            } bg-clip-text text-transparent`}>
              {Math.abs(Math.round(avgDeficit))}
            </span>
            <span className="text-xl font-semibold text-muted">kcal</span>
          </div>
          <div className="text-xs text-muted mt-1">
            {avgDeficit < 0 ? 'Under target' : 'Over target'}
          </div>
        </div>

      </div>
    </div>
  );
};
