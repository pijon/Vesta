import React from 'react';
import { WeightAnalysis, StreakAnalysis, PeriodSummary } from '../utils/analytics';
import { formatDateDiff, formatReadableDate } from '../utils/analytics';

interface AnalyticsSummaryProps {
  weightAnalysis: WeightAnalysis;
  streakAnalysis: StreakAnalysis;
  weeklySummary: PeriodSummary;
}

export const AnalyticsSummary: React.FC<AnalyticsSummaryProps> = ({
  weightAnalysis,
  streakAnalysis,
  weeklySummary
}) => {
  const {
    totalLoss,
    remainingLoss,
    percentToGoal,
    avgWeeklyLoss,
    projectedGoalDate,
    daysToGoal,
    trend
  } = weightAnalysis;

  const {
    currentStreak,
    longestStreak,
    complianceRate
  } = streakAnalysis;

  // Trend emoji and color
  const getTrendDisplay = () => {
    switch (trend) {
      case 'losing':
        return { emoji: '📉', text: 'Losing', color: 'var(--primary)' };
      case 'maintaining':
        return { emoji: '➡️', text: 'Maintaining', color: 'var(--warning)' };
      case 'gaining':
        return { emoji: '📈', text: 'Gaining', color: 'var(--error)' };
      default:
        return { emoji: '📊', text: 'Tracking', color: 'var(--muted)' };
    }
  };

  const trendDisplay = getTrendDisplay();

  return (
    <div className="space-y-8">
      {/* Progress Summary */}
      <div className="bg-surface rounded-3xl p-8 border border-border">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-serif font-normal text-main">Weight Loss Progress</h3>
          <span className="text-2xl font-medium text-sm" style={{ color: trendDisplay.color }}>
            {trendDisplay.emoji} {trendDisplay.text}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-muted mb-3">
            <span>Progress to goal</span>
            <span className="font-semibold" style={{ color: 'var(--primary)' }}>{percentToGoal.toFixed(1)}%</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--neutral-200)' }}>
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${Math.min(100, percentToGoal)}%`,
                background: 'linear-gradient(to right, var(--primary), var(--primary-hover))'
              }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs text-muted mb-1">Total Lost</div>
            <div className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
              {totalLoss > 0 ? totalLoss.toFixed(1) : '0.0'} kg
            </div>
          </div>
          <div>
            <div className="text-xs text-muted mb-1">Remaining</div>
            <div className="text-2xl font-bold text-main">
              {remainingLoss > 0 ? remainingLoss.toFixed(1) : '0.0'} kg
            </div>
          </div>
          <div>
            <div className="text-xs text-muted mb-1">Weekly Rate</div>
            <div className="text-2xl font-bold text-main">
              {avgWeeklyLoss > 0 ? avgWeeklyLoss.toFixed(2) : '0.00'} kg
            </div>
          </div>
          <div>
            <div className="text-xs text-muted mb-1">Est. Goal Date</div>
            <div className="text-sm font-bold text-main">
              {projectedGoalDate ? formatReadableDate(projectedGoalDate) : 'Calculating...'}
            </div>
            {daysToGoal && (
              <div className="text-xs text-muted mt-0.5">
                ({formatDateDiff(daysToGoal)})
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Streak & Compliance Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Current Streak */}
        <div className="bg-surface rounded-2xl p-6 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-muted">Current Streak</h4>
            <span className="text-2xl">🔥</span>
          </div>
          <div className="text-3xl font-bold text-main mb-2">
            {currentStreak} {currentStreak === 1 ? 'day' : 'days'}
          </div>
          <div className="text-xs text-muted">
            Longest: {longestStreak} {longestStreak === 1 ? 'day' : 'days'}
          </div>
        </div>

        {/* Compliance Rate */}
        <div className="bg-surface rounded-2xl p-6 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-muted">Compliance Rate</h4>
            <span className="text-2xl">✅</span>
          </div>
          <div className="text-3xl font-bold text-main mb-2">
            {complianceRate.toFixed(0)}%
          </div>
          <div className="text-xs text-muted">
            {weeklySummary.daysLogged} days logged this week
          </div>
        </div>
      </div>

      {/* Weekly Summary */}
      <div className="bg-surface rounded-3xl p-8 border border-border">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-serif font-normal text-main">This Week</h3>
          <span className="text-xs text-muted bg-background px-3 py-1 rounded-full">
            Last 7 days
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <div className="text-xs text-muted mb-1">Avg Calories</div>
            <div className="text-xl font-bold text-main">
              {weeklySummary.avgCalories.toFixed(0)}
            </div>
            <div className="text-xs text-muted">
              Net: {weeklySummary.avgNetCalories.toFixed(0)}
            </div>
          </div>

          <div>
            <div className="text-xs text-muted mb-1">Workouts</div>
            <div className="text-xl font-bold text-primary">
              {weeklySummary.totalWorkouts}
            </div>
            <div className="text-xs text-muted">
              {weeklySummary.caloriesBurned.toFixed(0)} cal burned
            </div>
          </div>

          <div>
            <div className="text-xs text-muted mb-1">Days Logged</div>
            <div className="text-xl font-bold text-main">
              {weeklySummary.daysLogged}/7
            </div>
            <div className="text-xs text-muted">
              {((weeklySummary.daysLogged / 7) * 100).toFixed(0)}% tracked
            </div>
          </div>

          <div>
            <div className="text-xs text-muted mb-1">On Track</div>
            <div className="text-xl font-bold" style={{ color: 'var(--primary)' }}>
              {weeklySummary.complianceRate.toFixed(0)}%
            </div>
            <div className="text-xs text-muted">
              days under goal
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
