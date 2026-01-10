import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, BarChart, Bar, ComposedChart, ReferenceLine, Legend } from 'recharts';
import { DayPlan, UserStats, DailyLog } from '../types';
import { getAllDailySummaries } from '../services/storageService';
import { getAnalyticsData, getGoalProjection } from '../services/analyticsService';

interface TrackTrendsProps {
  todayPlan: DayPlan;
  stats: UserStats;
  dailyLog: DailyLog;
}

export const TrackTrends: React.FC<TrackTrendsProps> = ({ stats, dailyLog }) => {
  const [dailySummaries, setDailySummaries] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [projection, setProjection] = useState<{ daysRemaining: number, projectedDate: string } | null>(null);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);

  useEffect(() => {
    getAllDailySummaries().then(setDailySummaries);
    getAnalyticsData().then(setAnalyticsData);
    getGoalProjection().then(setProjection);
  }, [dailyLog, stats]);

  // Weight chart data
  let weightChartData = stats.weightHistory ? [...stats.weightHistory] : [];
  if (weightChartData.length === 0) {
    weightChartData.push({
      date: new Date().toISOString().split('T')[0],
      weight: stats.startWeight
    });
  }
  const formattedWeightData = weightChartData.map(entry => ({
    ...entry,
    displayDate: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }));

  // Calorie chart data
  const formattedCalorieData = dailySummaries.map(entry => ({
    ...entry,
    displayDate: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }));

  // Workout chart data
  const formattedWorkoutData = dailySummaries
    .filter(entry => entry.workoutCount > 0)
    .map(entry => ({
      ...entry,
      displayDate: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }));

  // Analytics data
  const formattedAnalyticsData = analyticsData.map(d => ({
    ...d,
    shortDate: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    netCalories: (d.calories || 0) - (d.caloriesBurned || 0)
  }));

  // Calculate consistency
  const calculateConsistency = () => {
    const last30Days = formattedAnalyticsData.slice(-30);
    const daysTracked = last30Days.filter(d => d.calories !== null && d.calories > 0).length;
    const daysOnTarget = last30Days.filter(d =>
      d.calories !== null &&
      d.calories > 0 &&
      ((d.calories || 0) - (d.caloriesBurned || 0)) <= stats.dailyCalorieGoal
    ).length;

    return {
      consistencyScore: daysTracked > 0 ? Math.round((daysOnTarget / daysTracked) * 100) : 0,
      daysOnTarget,
      daysTracked
    };
  };

  const consistency = calculateConsistency();

  const latestNetCalories = formattedAnalyticsData.length > 0
    ? formattedAnalyticsData[formattedAnalyticsData.length - 1].netCalories
    : 0;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-serif font-bold text-slate-800 mb-1">Trends & Analytics</h2>
        <p className="text-slate-600">Track your progress and insights</p>
      </header>

      {/* Insight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Goal Projection Card */}
        <div className="bg-surface rounded-2xl p-6 shadow-lg border border-border">
          <div className="flex justify-between items-start mb-4">
            <h4 className="text-sm font-bold text-muted uppercase tracking-wider">Goal Projection</h4>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
          </div>
          {projection ? (
            <div>
              <div className="text-3xl font-serif text-main mb-1">{projection.daysRemaining} Days</div>
              <p className="text-sm text-muted">
                Goal date: <span className="font-medium text-main">{new Date(projection.projectedDate).toLocaleDateString()}</span>
              </p>
            </div>
          ) : (
            <div className="text-muted text-sm italic py-2">
              Not enough data yet
            </div>
          )}
        </div>

        {/* Consistency Card */}
        <div className="bg-surface rounded-2xl p-6 shadow-lg border border-border">
          <div className="flex justify-between items-start mb-4">
            <h4 className="text-sm font-bold text-muted uppercase tracking-wider">Diet Consistency</h4>
            <div className={`p-2 rounded-lg ${consistency.consistencyScore >= 80 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
          </div>
          <div>
            <div className="text-3xl font-serif text-main mb-1">{consistency.consistencyScore}%</div>
            <p className="text-sm text-muted">
              On target: <span className="font-medium text-main">{consistency.daysOnTarget}/{consistency.daysTracked}</span> days
            </p>
          </div>
        </div>

        {/* Latest Net Calories Card */}
        <div className="bg-surface rounded-2xl p-6 shadow-lg border border-border">
          <div className="flex justify-between items-start mb-4">
            <h4 className="text-sm font-bold text-muted uppercase tracking-wider">Latest Net</h4>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12"></path>
              </svg>
            </div>
          </div>
          <div>
            <div className="text-3xl font-serif text-main mb-1">{latestNetCalories}</div>
            <p className="text-sm text-muted">
              Target: <span className="font-medium text-main">{stats.dailyCalorieGoal}</span> kcal
            </p>
          </div>
        </div>
      </div>

      {/* Weight Trend Chart */}
      <div className="bg-surface p-6 rounded-2xl shadow-lg border border-border">
        <h3 className="font-medium text-main mb-6 font-serif text-lg">Weight Trend</h3>
        {formattedWeightData.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-slate-400 text-sm">
            No weight data yet
          </div>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={formattedWeightData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="displayDate"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--color-muted)', fontSize: 12, fontWeight: 500 }}
                  dy={10}
                  minTickGap={30}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--color-muted)', fontSize: 12, fontWeight: 500 }}
                  padding={{ top: 20, bottom: 20 }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}
                />
                <Area
                  type="monotone"
                  dataKey="weight"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fill="url(#colorWeight)"
                  name="Weight (kg)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Calorie Trends Chart */}
      <div className="bg-surface p-6 rounded-2xl shadow-lg border border-border">
        <h3 className="font-medium text-main mb-6 font-serif text-lg">Daily Calories</h3>
        {formattedCalorieData.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-slate-400 text-sm">
            No calorie data yet
          </div>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={formattedCalorieData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="displayDate"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--color-muted)', fontSize: 12, fontWeight: 500 }}
                  dy={10}
                  minTickGap={30}
                />
                <YAxis
                  domain={[0, 'auto']}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--color-muted)', fontSize: 12, fontWeight: 500 }}
                  padding={{ top: 20, bottom: 20 }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}
                />
                <Line
                  type="monotone"
                  dataKey="caloriesConsumed"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'var(--color-primary)' }}
                  name="Consumed"
                />
                <Line
                  type="monotone"
                  dataKey="netCalories"
                  stroke="var(--color-muted)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3, fill: 'var(--color-muted)' }}
                  name="Net"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Workout Activity Chart */}
      <div className="bg-surface p-6 rounded-2xl shadow-lg border border-border">
        <h3 className="font-medium text-main mb-6 font-serif text-lg">Workout Activity</h3>
        {formattedWorkoutData.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-muted text-sm">
            No workout data yet
          </div>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={formattedWorkoutData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="displayDate"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--color-muted)', fontSize: 12, fontWeight: 500 }}
                  dy={10}
                  minTickGap={30}
                />
                <YAxis
                  domain={[0, 'auto']}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--color-muted)', fontSize: 12, fontWeight: 500 }}
                  padding={{ top: 20, bottom: 20 }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}
                />
                <Bar
                  dataKey="caloriesBurned"
                  fill="var(--chart-5)"
                  radius={[8, 8, 0, 0]}
                  name="Calories Burned"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Advanced Analytics - Collapsible */}
      <div className="bg-surface rounded-2xl shadow-lg border border-border overflow-hidden">
        <button
          onClick={() => setAdvancedExpanded(!advancedExpanded)}
          className="w-full p-5 flex justify-between items-center hover:bg-background/50 transition-colors"
        >
          <h3 className="font-medium text-main text-lg font-serif">Advanced Analytics</h3>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${advancedExpanded ? 'rotate-180' : ''}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {advancedExpanded && (
          <div className="p-6 pt-0 space-y-6">
            {/* Weight vs Fasting Chart */}
            <div>
              <h4 className="text-lg font-bold text-main mb-6">Weight vs Fasting Hours</h4>
              {formattedAnalyticsData.length === 0 ? (
                <div className="h-96 flex items-center justify-center text-muted">
                  No data yet
                </div>
              ) : (
                <div className="h-96 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={formattedAnalyticsData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="shortDate"
                        stroke="var(--color-muted)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                      />
                      <YAxis
                        yAxisId="left"
                        orientation="left"
                        stroke="var(--color-muted)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        domain={['auto', 'auto']}
                        unit="kg"
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke="var(--color-muted)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        unit="h"
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Bar
                        yAxisId="right"
                        dataKey="fastingHours"
                        name="Fasting Hours"
                        fill="var(--color-primary)"
                        opacity={0.2}
                        barSize={20}
                        radius={[4, 4, 0, 0]}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="weight"
                        name="Weight (kg)"
                        stroke="var(--color-primary)"
                        strokeWidth={3}
                        dot={{ fill: 'var(--color-primary)', r: 4 }}
                        connectNulls
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Calorie Consistency Heatmap */}
            <div>
              <h4 className="text-lg font-bold text-main mb-6">Calorie Consistency (Last 14 Days)</h4>
              {formattedAnalyticsData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted">
                  No data yet
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={formattedAnalyticsData.slice(-14)} margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                      <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="shortDate"
                        stroke="var(--color-muted)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                      />
                      <YAxis
                        stroke="var(--color-muted)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                      />
                      <ReferenceLine
                        y={stats.dailyCalorieGoal}
                        stroke="var(--color-primary)"
                        strokeDasharray="3 3"
                        label={{ value: 'Goal', fill: 'var(--color-primary)', position: 'right' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="netCalories"
                        name="Net Calories"
                        stroke="var(--chart-2)"
                        fill="url(#colorCalories)"
                        strokeWidth={2}
                      />
                      <defs>
                        <linearGradient id="colorCalories" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
