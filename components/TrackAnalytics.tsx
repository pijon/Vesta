import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, BarChart, Bar, ComposedChart, ReferenceLine } from 'recharts';
import { DayPlan, UserStats, DailyLog } from '../types';
import { getAllDailySummaries, getDayPlansInRange } from '../services/storageService';



import { GoalsHistoryChart } from './analytics/GoalsHistoryChart';

import { AnalyticsSection } from './AnalyticsSection';
import { WeeklyHabitPillars } from './analytics/WeeklyHabitPillars';

interface TrackAnalyticsProps {
    todayPlan: DayPlan;
    stats: UserStats;
    dailyLog: DailyLog;
}

export const TrackAnalytics: React.FC<TrackAnalyticsProps> = ({ stats, dailyLog }) => {
    const [dailySummaries, setDailySummaries] = useState<any[]>([]);
    const [dayTypes, setDayTypes] = useState<Record<string, string>>({});
    const [weightTimeRange, setWeightTimeRange] = useState<'7d' | '30d'>('7d');

    useEffect(() => {
        getAllDailySummaries().then(setDailySummaries);

        // Fetch day types for the analytical period (last 90 days)
        const fetchDayTypes = async () => {
            const today = new Date();
            const pastDate = new Date();
            pastDate.setDate(today.getDate() - 95); // Buffer slightly more than 90

            const startStr = pastDate.toISOString().split('T')[0];
            const endStr = today.toISOString().split('T')[0];

            const plans = await getDayPlansInRange(startStr, endStr);
            const mapping: Record<string, string> = {};

            Object.values(plans).forEach(plan => {
                if (plan.type) {
                    mapping[plan.date] = plan.type;
                }
            });

            setDayTypes(mapping);
        };
        fetchDayTypes();
    }, [dailyLog, stats]);

    // Calculate enhanced analytics


    // Weight chart data with projected trend line
    let allWeightData = stats.weightHistory ? [...stats.weightHistory] : [];
    if (allWeightData.length === 0) {
        allWeightData.push({
            date: new Date().toISOString().split('T')[0],
            weight: stats.startWeight
        });
    }

    // Filter weight data based on selected time range
    const daysToShow = weightTimeRange === '30d' ? 30 : 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToShow);

    const weightChartData = allWeightData
        .filter(entry => new Date(entry.date) >= cutoffDate)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Combine actual and projected data
    const formattedWeightData = weightChartData.map(entry => ({
        ...entry,
        displayDate: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }));

    // Calorie chart data (exclude today's incomplete data)
    const today = new Date().toISOString().split('T')[0];
    const formattedCalorieData = dailySummaries
        .filter(entry => entry.date !== today)
        .map(entry => ({
            ...entry,
            displayDate: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        }));

    // Workout chart data (exclude today's incomplete data)
    const formattedWorkoutData = dailySummaries
        .filter(entry => entry.date !== today && entry.workoutCount > 0)
        .map(entry => ({
            ...entry,
            displayDate: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        }));

    return (
        <div className="space-y-8">


            {/* ========================================
                PROGRESS - "Am I moving toward my goal?"
                ======================================== */}
            <AnalyticsSection
                title="Your Progress"
                mobileCollapsible={true}
                defaultCollapsed={false}
            >
                <div className="space-y-6">
                    {/* Weight Trends */}
                    <div className="">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-lg font-serif font-normal text-charcoal dark:text-stone-200">Weight Trend</h4>
                            <div className="inline-flex rounded-full bg-charcoal/5 dark:bg-white/5 p-1">
                                <button
                                    onClick={() => setWeightTimeRange('7d')}
                                    className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${weightTimeRange === '7d'
                                            ? 'bg-hearth text-white shadow-sm'
                                            : 'text-charcoal/60 dark:text-stone-400 hover:text-charcoal dark:hover:text-stone-200'
                                        }`}
                                >
                                    7 Days
                                </button>
                                <button
                                    onClick={() => setWeightTimeRange('30d')}
                                    className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${weightTimeRange === '30d'
                                            ? 'bg-hearth text-white shadow-sm'
                                            : 'text-charcoal/60 dark:text-stone-400 hover:text-charcoal dark:hover:text-stone-200'
                                        }`}
                                >
                                    30 Days
                                </button>
                            </div>
                        </div>
                        {formattedWeightData.length === 0 ? (
                            <div className="h-48 md:h-56 flex flex-col items-center justify-center gap-2">
                                <span className="text-3xl">⚖️</span>
                                <p className="text-sm text-charcoal/60 dark:text-stone-400">Track your weight to see trends</p>
                            </div>
                        ) : (
                            <div className="h-48 md:h-56 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={formattedWeightData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                                        {/* Goal line (horizontal reference) */}
                                        <ReferenceLine
                                            y={stats.goalWeight}
                                            stroke="var(--color-secondary)"
                                            strokeDasharray="3 3"
                                            label={{ value: 'Goal', fill: 'var(--color-secondary)', position: 'right', fontSize: 12 }}
                                        />
                                        {/* Actual weight (area chart) */}
                                        <Area
                                            type="monotone"
                                            dataKey="weight"
                                            stroke="var(--color-primary)"
                                            strokeWidth={2}
                                            fill="url(#colorWeight)"
                                            name="Weight (kg)"
                                            connectNulls={false}
                                        />

                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </div>
            </AnalyticsSection>

            {/* ========================================
                CONSISTENCY - "Am I building healthy habits?"
                ======================================== */}
            <AnalyticsSection
                title="Building Healthy Habits"
                mobileCollapsible={true}
                defaultCollapsed={true}
            >
                <div className="space-y-6">


                    {/* Weekly Habit Pillars - Visual snapshot */}
                    <WeeklyHabitPillars summaries={dailySummaries} stats={stats} />

                    {/* Daily Goals History */}
                    <div className="">
                        <h4 className="text-lg font-serif font-normal text-charcoal dark:text-stone-200 mb-4">Daily Goals History</h4>
                        <GoalsHistoryChart summaries={dailySummaries} stats={stats} />
                    </div>

                    {/* Daily Calorie Tracking */}
                    <div className="">
                        <h4 className="text-lg font-serif font-normal text-charcoal dark:text-stone-200 mb-4">Daily Calorie Tracking</h4>
                        {formattedCalorieData.length === 0 ? (
                            <div className="h-48 md:h-56 flex flex-col items-center justify-center gap-2">
                                <span className="text-3xl">🍽️</span>
                                <p className="text-sm text-charcoal/60 dark:text-stone-400">Log meals to track your calories</p>
                            </div>
                        ) : (
                            <div className="h-48 md:h-56 w-full">
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
                                            domain={['auto', 'auto']}
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: 'var(--color-muted)', fontSize: 12, fontWeight: 500 }}
                                            padding={{ top: 20, bottom: 20 }}
                                        />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}
                                        />
                                        <ReferenceLine
                                            y={stats.dailyCalorieGoal}
                                            stroke="var(--color-primary)"
                                            strokeDasharray="3 3"
                                            label={{ value: 'Target', fill: 'var(--color-primary)', position: 'right', fontSize: 12 }}
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

                </div>
            </AnalyticsSection>

            {/* ========================================
                PATTERNS - "What trends exist in my data?"
                ======================================== */}
            <AnalyticsSection
                title="Insights & Trends"
                mobileCollapsible={true}
                defaultCollapsed={true}
            >
                <div className="space-y-6">


                    {/* Workout Activity Pattern */}
                    <div className="">
                        <h4 className="text-lg font-serif font-normal text-charcoal dark:text-stone-200 mb-4">Workout Activity Pattern</h4>
                        {formattedWorkoutData.length === 0 ? (
                            <div className="h-48 md:h-56 flex flex-col items-center justify-center gap-2">
                                <span className="text-3xl">💪</span>
                                <p className="text-sm text-charcoal/60 dark:text-stone-400">Add workouts to see your activity</p>
                            </div>
                        ) : (
                            <div className="h-48 md:h-56 w-full">
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
                                            fill="var(--workout)"
                                            radius={[8, 8, 0, 0]}
                                            name="Calories Burned"
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    {/* Weekly Breakdown */}
                    {/* Weekly Breakdown */}

                </div>
            </AnalyticsSection>
        </div>
    );
};
