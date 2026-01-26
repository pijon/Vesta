import React from 'react';
import { PeriodSummary } from '../../utils/analytics';
import { formatWeightChange } from '../../utils/analytics';

interface PeriodicComparisonProps {
  weeklySummary: PeriodSummary;
  monthlySummary: PeriodSummary;
  dailyGoal: number;
}

export const PeriodicComparison: React.FC<PeriodicComparisonProps> = ({
  weeklySummary,
  monthlySummary,
  dailyGoal
}) => {
  const getComparisonIndicator = (weeklyValue: number, monthlyValue: number) => {
    if (weeklyValue > monthlyValue * 1.05) {
      return { arrow: '↑', color: 'text-error', text: 'Higher' };
    } else if (weeklyValue < monthlyValue * 0.95) {
      return { arrow: '↓', color: 'text-calories', text: 'Lower' };
    } else {
      return { arrow: '→', color: 'text-warning', text: 'Similar' };
    }
  };

  const calorieComparison = getComparisonIndicator(
    weeklySummary.avgCalories,
    monthlySummary.avgCalories
  );

  const consistencyComparison = getComparisonIndicator(
    weeklySummary.complianceRate,
    monthlySummary.complianceRate
  );

  return (
    <div className="bg-[var(--card-bg)] backdrop-blur-md rounded-3xl p-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-serif font-normal text-charcoal dark:text-stone-200">Period Comparison</h3>
        <span className="text-xs text-charcoal/60 dark:text-stone-400">Weekly vs Monthly Averages</span>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Weekly Summary */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <h4 className="text-base font-semibold text-charcoal dark:text-stone-200">Last 7 Days</h4>
            <span className="text-xs bg-calories-bg text-calories px-2 py-0.5 rounded-full font-bold">
              Weekly
            </span>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs text-charcoal/60 dark:text-stone-400">Avg Calories</div>
                <div className="text-2xl font-bold text-charcoal dark:text-stone-200">
                  {weeklySummary.avgCalories.toFixed(0)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-charcoal/60 dark:text-stone-400">Net</div>
                <div className="text-lg font-semibold text-charcoal/60 dark:text-stone-400">
                  {weeklySummary.avgNetCalories.toFixed(0)}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs text-charcoal/60 dark:text-stone-400">Consistency</div>
                <div className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
                  {weeklySummary.complianceRate.toFixed(0)}%
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-charcoal/60 dark:text-stone-400">Days Logged</div>
                <div className="text-lg font-semibold text-charcoal/60 dark:text-stone-400">
                  {weeklySummary.daysLogged}/7
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs text-charcoal/60 dark:text-stone-400">Workouts</div>
                <div className="text-2xl font-bold text-workout">
                  {weeklySummary.totalWorkouts}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-charcoal/60 dark:text-stone-400">Calories Burned</div>
                <div className="text-lg font-semibold text-charcoal/60 dark:text-stone-400">
                  {weeklySummary.caloriesBurned.toFixed(0)}
                </div>
              </div>
            </div>

            {weeklySummary.weightChange !== null && (
              <div className="pt-4 border-t border-charcoal/10 dark:border-white/10">
                <div className="text-xs text-charcoal/60 dark:text-stone-400">Weight Trend</div>
                <div className={`text-lg font-bold ${weeklySummary.weightChange <= 0 ? 'text-calories' : 'text-charcoal dark:text-stone-200'}`}>
                  {formatWeightChange(weeklySummary.weightChange)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Monthly Summary */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <h4 className="text-base font-semibold text-charcoal dark:text-stone-200">Last 30 Days</h4>
            <span className="text-xs bg-weight-bg text-weight px-2 py-0.5 rounded-full font-bold">
              Monthly
            </span>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs text-charcoal/60 dark:text-stone-400">Avg Calories</div>
                <div className="text-2xl font-bold text-charcoal dark:text-stone-200">
                  {monthlySummary.avgCalories.toFixed(0)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-charcoal/60 dark:text-stone-400">Net</div>
                <div className="text-lg font-semibold text-charcoal/60 dark:text-stone-400">
                  {monthlySummary.avgNetCalories.toFixed(0)}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs text-charcoal/60 dark:text-stone-400">Consistency</div>
                <div className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
                  {monthlySummary.complianceRate.toFixed(0)}%
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-charcoal/60 dark:text-stone-400">Days Logged</div>
                <div className="text-lg font-semibold text-charcoal/60 dark:text-stone-400">
                  {monthlySummary.daysLogged}/30
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs text-charcoal/60 dark:text-stone-400">Workouts</div>
                <div className="text-2xl font-bold text-workout">
                  {monthlySummary.totalWorkouts}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-charcoal/60 dark:text-stone-400">Calories Burned</div>
                <div className="text-lg font-semibold text-charcoal/60 dark:text-stone-400">
                  {monthlySummary.caloriesBurned.toFixed(0)}
                </div>
              </div>
            </div>

            {monthlySummary.weightChange !== null && (
              <div className="pt-4 border-t border-charcoal/10 dark:border-white/10">
                <div className="text-xs text-charcoal/60 dark:text-stone-400">Weight Trend</div>
                <div className={`text-lg font-bold ${monthlySummary.weightChange <= 0 ? 'text-calories' : 'text-charcoal dark:text-stone-200'}`}>
                  {formatWeightChange(monthlySummary.weightChange)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comparison Insights */}
      <div className="mt-6 pt-6 border-t border-charcoal/10 dark:border-white/10">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className={`text-2xl ${calorieComparison.color}`}>
              {calorieComparison.arrow}
            </span>
            <div>
              <div className="text-xs text-charcoal/60 dark:text-stone-400">Weekly Calories</div>
              <div className="font-semibold text-charcoal dark:text-stone-200">{calorieComparison.text}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className={`text-2xl ${consistencyComparison.color}`}>
              {consistencyComparison.arrow}
            </span>
            <div>
              <div className="text-xs text-charcoal/60 dark:text-stone-400">Weekly Consistency</div>
              <div className="font-semibold text-charcoal dark:text-stone-200">{consistencyComparison.text}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm col-span-2 md:col-span-1">
            <span className="text-2xl">📊</span>
            <div>
              <div className="text-xs text-charcoal/60 dark:text-stone-400">Data Quality</div>
              <div className="font-semibold text-charcoal dark:text-stone-200">
                {monthlySummary.daysLogged >= 20 ? 'Excellent' : monthlySummary.daysLogged >= 10 ? 'Good' : 'Limited'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
