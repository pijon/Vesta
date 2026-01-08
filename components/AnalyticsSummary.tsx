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
        return { emoji: '📉', text: 'Losing', color: 'text-emerald-600' };
      case 'maintaining':
        return { emoji: '➡️', text: 'Maintaining', color: 'text-amber-600' };
      case 'gaining':
        return { emoji: '📈', text: 'Gaining', color: 'text-red-600' };
      default:
        return { emoji: '📊', text: 'Tracking', color: 'text-slate-600' };
    }
  };

  const trendDisplay = getTrendDisplay();

  return (
    <div className="space-y-4">
      {/* Progress Summary */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-6 border border-emerald-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-serif font-normal text-slate-900">Weight Loss Progress</h3>
          <span className={`text-2xl ${trendDisplay.color} font-medium text-sm`}>
            {trendDisplay.emoji} {trendDisplay.text}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-slate-600 mb-2">
            <span>Progress to goal</span>
            <span className="font-semibold text-emerald-700">{percentToGoal.toFixed(1)}%</span>
          </div>
          <div className="h-3 bg-white rounded-full overflow-hidden border border-emerald-200">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
              style={{ width: `${Math.min(100, percentToGoal)}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-slate-600 mb-1">Total Lost</div>
            <div className="text-2xl font-bold text-emerald-700">
              {totalLoss > 0 ? totalLoss.toFixed(1) : '0.0'} kg
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-600 mb-1">Remaining</div>
            <div className="text-2xl font-bold text-slate-700">
              {remainingLoss > 0 ? remainingLoss.toFixed(1) : '0.0'} kg
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-600 mb-1">Weekly Rate</div>
            <div className="text-2xl font-bold text-slate-700">
              {avgWeeklyLoss > 0 ? avgWeeklyLoss.toFixed(2) : '0.00'} kg
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-600 mb-1">Est. Goal Date</div>
            <div className="text-sm font-bold text-slate-700">
              {projectedGoalDate ? formatReadableDate(projectedGoalDate) : 'Calculating...'}
            </div>
            {daysToGoal && (
              <div className="text-xs text-slate-500 mt-0.5">
                ({formatDateDiff(daysToGoal)})
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Streak & Compliance Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Current Streak */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-slate-600">Current Streak</h4>
            <span className="text-2xl">🔥</span>
          </div>
          <div className="text-3xl font-bold text-slate-900 mb-1">
            {currentStreak} {currentStreak === 1 ? 'day' : 'days'}
          </div>
          <div className="text-xs text-slate-500">
            Longest: {longestStreak} {longestStreak === 1 ? 'day' : 'days'}
          </div>
        </div>

        {/* Compliance Rate */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-slate-600">Compliance Rate</h4>
            <span className="text-2xl">✅</span>
          </div>
          <div className="text-3xl font-bold text-slate-900 mb-1">
            {complianceRate.toFixed(0)}%
          </div>
          <div className="text-xs text-slate-500">
            {weeklySummary.daysLogged} days logged this week
          </div>
        </div>
      </div>

      {/* Weekly Summary */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-serif font-normal text-slate-900">This Week</h3>
          <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            Last 7 days
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-slate-600 mb-1">Avg Calories</div>
            <div className="text-xl font-bold text-slate-900">
              {weeklySummary.avgCalories.toFixed(0)}
            </div>
            <div className="text-xs text-slate-500">
              Net: {weeklySummary.avgNetCalories.toFixed(0)}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-600 mb-1">Workouts</div>
            <div className="text-xl font-bold text-purple-700">
              {weeklySummary.totalWorkouts}
            </div>
            <div className="text-xs text-slate-500">
              {weeklySummary.caloriesBurned.toFixed(0)} cal burned
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-600 mb-1">Days Logged</div>
            <div className="text-xl font-bold text-slate-900">
              {weeklySummary.daysLogged}/7
            </div>
            <div className="text-xs text-slate-500">
              {((weeklySummary.daysLogged / 7) * 100).toFixed(0)}% tracked
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-600 mb-1">On Track</div>
            <div className="text-xl font-bold text-emerald-700">
              {weeklySummary.complianceRate.toFixed(0)}%
            </div>
            <div className="text-xs text-slate-500">
              days under goal
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
