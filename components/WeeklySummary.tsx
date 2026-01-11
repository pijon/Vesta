import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { DAILY_CALORIE_LIMIT } from '../constants';
import { formatReadableDate } from '../utils/analytics';
import { DailySummary } from '../types';

interface DayData {
  date: string;
  dayName: string;
  caloriesConsumed: number;
  caloriesBurned: number;
  netCalories: number;
  workoutCount: number;
  isCompliant: boolean;
  isLogged: boolean;
}

interface WeeklySummaryProps {
  summaries: DailySummary[];
}

export const WeeklySummary: React.FC<WeeklySummaryProps> = ({ summaries }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get last 7 days of data
  const getLast7Days = (): DayData[] => {
    const days: DayData[] = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const summary = summaries.find(s => s.date === dateStr);

      days.push({
        date: dateStr,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        caloriesConsumed: summary?.caloriesConsumed || 0,
        caloriesBurned: summary?.caloriesBurned || 0,
        netCalories: summary?.netCalories || 0,
        workoutCount: summary?.workoutCount || 0,
        isCompliant: summary ? summary.netCalories <= DAILY_CALORIE_LIMIT : false,
        isLogged: !!summary
      });
    }

    return days;
  };

  const weekData = getLast7Days();
  const loggedDays = weekData.filter(d => d.isLogged);
  const compliantDays = weekData.filter(d => d.isCompliant);
  const workoutDays = weekData.filter(d => d.workoutCount > 0);

  // Calculate averages
  const avgCalories = loggedDays.length > 0
    ? loggedDays.reduce((sum, d) => sum + d.caloriesConsumed, 0) / loggedDays.length
    : 0;

  const avgNetCalories = loggedDays.length > 0
    ? loggedDays.reduce((sum, d) => sum + d.netCalories, 0) / loggedDays.length
    : 0;

  const totalBurned = loggedDays.reduce((sum, d) => sum + d.caloriesBurned, 0);
  const complianceRate = loggedDays.length > 0 ? (compliantDays.length / loggedDays.length) * 100 : 0;

  // Find best and worst days
  const bestDay = loggedDays.reduce((best, day) =>
    day.netCalories < best.netCalories ? day : best
    , loggedDays[0] || weekData[0]);

  const worstDay = loggedDays.reduce((worst, day) =>
    day.netCalories > worst.netCalories ? day : worst
    , loggedDays[0] || weekData[0]);

  // Insights
  const getInsights = () => {
    const insights: string[] = [];

    if (complianceRate === 100 && loggedDays.length === 7) {
      insights.push("🎉 Perfect week! You stayed under your calorie goal every day!");
    } else if (complianceRate >= 80) {
      insights.push("💪 Great week! You're staying consistent with your goals.");
    } else if (complianceRate >= 50) {
      insights.push("📈 Good progress, but there's room for improvement this week.");
    }

    if (workoutDays.length >= 5) {
      insights.push("🏃 Excellent workout consistency! Keep up the activity.");
    } else if (workoutDays.length >= 3) {
      insights.push("💪 Good workout week. Try to add one more session next week.");
    } else if (workoutDays.length === 0) {
      insights.push("🚶 No workouts logged. Adding exercise can boost your results!");
    }

    if (loggedDays.length < 7) {
      insights.push(`📝 You logged ${loggedDays.length}/7 days. Daily tracking helps you stay on track!`);
    }

    if (avgNetCalories > DAILY_CALORIE_LIMIT && avgNetCalories < DAILY_CALORIE_LIMIT + 100) {
      insights.push("⚡ You're very close to your goal! Small tweaks can make a big difference.");
    }

    return insights;
  };

  const insights = getInsights();

  // Chart data
  const chartData = weekData.map(day => ({
    day: day.dayName,
    calories: day.caloriesConsumed,
    target: DAILY_CALORIE_LIMIT,
    isCompliant: day.isCompliant,
    isLogged: day.isLogged
  }));

  return (
    <div className="bg-surface rounded-3xl border border-border overflow-hidden">
      {/* Header */}
      <div
        className="p-6 flex justify-between items-center cursor-pointer hover:bg-background/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div>
          <h3 className="text-lg font-serif font-normal text-main">Weekly Summary</h3>
          <p className="text-sm text-muted mt-1">
            {loggedDays.length}/7 days logged • {complianceRate.toFixed(0)}% compliant
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <div className="text-2xl font-bold text-main">{avgNetCalories.toFixed(0)}</div>
            <div className="text-xs text-muted">avg net calories/day</div>
          </div>
          <button className="text-muted hover:text-main transition-colors">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border">
          {/* Stats Grid */}
          <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4 bg-background/50">
            <div>
              <div className="text-xs text-muted mb-1">Avg Calories</div>
              <div className="text-xl font-bold text-main">{avgCalories.toFixed(0)}</div>
              <div className="text-xs text-muted">consumed/day</div>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">Avg Net</div>
              <div className="text-xl font-bold text-main">{avgNetCalories.toFixed(0)}</div>
              <div className="text-xs text-muted">after workouts</div>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">Total Burned</div>
              <div className="text-xl font-bold text-primary">{totalBurned.toFixed(0)}</div>
              <div className="text-xs text-muted">calories</div>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">Workouts</div>
              <div className="text-xl font-bold text-primary">{workoutDays.length}</div>
              <div className="text-xs text-muted">days active</div>
            </div>
          </div>

          {/* Weekly Chart */}
          <div className="p-6 border-t border-border">
            <h4 className="text-sm font-semibold text-main mb-4">Daily Breakdown</h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--text-muted)', fontSize: 12, fontWeight: 500 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--text-muted)', fontSize: 12, fontWeight: 500 }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--surface)',
                      color: 'var(--text-main)',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                    }}
                    labelStyle={{ color: 'var(--text-main)' }}
                  />
                  <Bar dataKey="calories" radius={[8, 8, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={!entry.isLogged ? 'var(--neutral-200)' : entry.isCompliant ? 'var(--color-emerald-500)' : 'var(--color-red-500)'}
                      />
                    ))}
                  </Bar>
                  <Bar dataKey="target" fill="var(--text-muted)" opacity={0.3} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 mt-4 text-xs justify-center">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-emerald-500"></div>
                <span className="text-muted">Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-red-500"></div>
                <span className="text-muted">Over Goal</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-neutral-200 dark:bg-neutral-800"></div>
                <span className="text-muted">Not Logged</span>
              </div>
            </div>
          </div>

          {/* Day-by-Day Grid */}
          <div className="p-6 border-t border-border">
            <h4 className="text-sm font-semibold text-main mb-4">Day by Day</h4>
            <div className="space-y-2">
              {weekData.map((day) => (
                <div
                  key={day.date}
                  className={`p-3 rounded-xl flex items-center justify-between ${!day.isLogged
                    ? 'bg-background border border-border'
                    : day.isCompliant
                      ? 'bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30'
                      : 'bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${!day.isLogged ? 'bg-neutral-300 dark:bg-neutral-700' : day.isCompliant ? 'bg-emerald-500' : 'bg-red-500'
                      }`}></div>
                    <div>
                      <div className="font-medium text-main">{day.dayName}</div>
                      <div className="text-xs text-muted">
                        {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  </div>

                  {day.isLogged ? (
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-sm font-bold text-main">{day.netCalories}</div>
                        <div className="text-xs text-muted">net kcal</div>
                      </div>
                      {day.workoutCount > 0 && (
                        <div className="flex items-center gap-1 text-primary bg-primary/10 px-2 py-1 rounded-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m13.73 4 2.54 2.54 2.54-2.54 2.54 2.54L18.81 9l2.54 2.54-2.54 2.54L16.27 11.54 13.73 14.08 11.19 11.54 8.65 14.08 6.11 11.54 3.57 14.08 1.03 11.54 3.57 9 1.03 6.46 3.57 3.92 6.11 6.46 8.65 3.92 11.19 6.46z" />
                          </svg>
                          <span className="text-xs font-semibold">{day.caloriesBurned}</span>
                        </div>
                      )}
                      {day.isCompliant && (
                        <div className="text-emerald-500">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-muted italic">Not logged</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Best & Worst Days */}
          {loggedDays.length >= 2 && (
            <div className="p-6 border-t border-border grid md:grid-cols-2 gap-4">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-200 dark:border-emerald-900/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">🏆</span>
                  <h5 className="text-sm font-semibold text-emerald-900 dark:text-emerald-300">Best Day</h5>
                </div>
                <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                  {bestDay.dayName} - {bestDay.netCalories} kcal
                </div>
                <div className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">
                  {formatReadableDate(bestDay.date)}
                </div>
              </div>

              <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-200 dark:border-amber-900/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">⚠️</span>
                  <h5 className="text-sm font-semibold text-amber-900 dark:text-amber-300">Highest Day</h5>
                </div>
                <div className="text-lg font-bold text-amber-700 dark:text-amber-400">
                  {worstDay.dayName} - {worstDay.netCalories} kcal
                </div>
                <div className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                  {formatReadableDate(worstDay.date)}
                </div>
              </div>
            </div>
          )}

          {/* Insights */}
          {insights.length > 0 && (
            <div className="p-6 border-t border-border bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10">
              <h4 className="text-sm font-semibold text-main mb-3 flex items-center gap-2">
                <span className="text-lg">💡</span>
                Insights & Recommendations
              </h4>
              <div className="space-y-2">
                {insights.map((insight, index) => (
                  <div key={index} className="text-sm text-main bg-white/60 dark:bg-black/20 p-3 rounded-lg">
                    {insight}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
