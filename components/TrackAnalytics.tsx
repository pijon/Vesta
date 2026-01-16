import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, BarChart, Bar, ComposedChart, ReferenceLine } from 'recharts';
import { DayPlan, UserStats, DailyLog } from '../types';
import { getAllDailySummaries } from '../services/storageService';
import { analyzeWeightTrends, analyzeStreaks, getWeeklySummary, getMonthlySummary, enhancePeriodSummaryWithWeight } from '../utils/analytics';
import { GoalProjectionCard } from './analytics/GoalProjectionCard';
import { ComplianceOverviewCard } from './analytics/ComplianceOverviewCard';
import { PeriodicComparison } from './analytics/PeriodicComparison';
import { DeficitSurplusChart } from './analytics/DeficitSurplusChart';
import { WeeklySummary } from './WeeklySummary';
import { AnalyticsSection } from './AnalyticsSection';

interface TrackAnalyticsProps {
    todayPlan: DayPlan;
    stats: UserStats;
    dailyLog: DailyLog;
}

export const TrackAnalytics: React.FC<TrackAnalyticsProps> = ({ stats, dailyLog }) => {
    const [dailySummaries, setDailySummaries] = useState<any[]>([]);

    useEffect(() => {
        getAllDailySummaries().then(setDailySummaries);
    }, [dailyLog, stats]);

    // Calculate enhanced analytics
    const weightAnalysis = analyzeWeightTrends(stats);
    const streakAnalysis = analyzeStreaks(dailySummaries, stats.dailyCalorieGoal);
    const weeklySummary = getWeeklySummary(dailySummaries, stats.dailyCalorieGoal);
    const monthlySummary = getMonthlySummary(dailySummaries, stats.dailyCalorieGoal);
    const weeklyEnhanced = enhancePeriodSummaryWithWeight(weeklySummary, stats.weightHistory);
    const monthlyEnhanced = enhancePeriodSummaryWithWeight(monthlySummary, stats.weightHistory);

    // Weight chart data with projected trend line
    let weightChartData = stats.weightHistory ? [...stats.weightHistory] : [];
    if (weightChartData.length === 0) {
        weightChartData.push({
            date: new Date().toISOString().split('T')[0],
            weight: stats.startWeight
        });
    }

    // Add projected data points if we have a projection
    const projectedData: any[] = [];
    if (weightAnalysis.projectedGoalDate && weightAnalysis.daysToGoal && weightAnalysis.daysToGoal > 0) {
        const lastEntry = weightChartData[weightChartData.length - 1];
        const currentWeight = lastEntry.weight;
        const projectedDate = weightAnalysis.projectedGoalDate;

        // Add intermediate points for smoother projection line (every 7 days)
        const daysRemaining = weightAnalysis.daysToGoal;
        const weightToLose = currentWeight - stats.goalWeight;
        const dailyLossRate = weightToLose / daysRemaining;

        const today = new Date(lastEntry.date);
        const steps = Math.ceil(daysRemaining / 7); // One point per week

        for (let i = 1; i <= steps; i++) {
            const daysAhead = Math.min(i * 7, daysRemaining);
            const projDate = new Date(today);
            projDate.setDate(projDate.getDate() + daysAhead);
            const projWeight = currentWeight - (dailyLossRate * daysAhead);

            projectedData.push({
                date: projDate.toISOString().split('T')[0],
                weight: null, // Null for actual weight
                projectedWeight: Math.max(projWeight, stats.goalWeight),
                displayDate: projDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            });
        }
    }

    // Combine actual and projected data
    const formattedWeightData = [
        ...weightChartData.map(entry => ({
            ...entry,
            projectedWeight: null,
            displayDate: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        })),
        ...projectedData
    ];

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
            <header className="mb-8">
                <h2 className="text-3xl font-serif font-bold text-main mb-2">Analytics</h2>
                <p className="text-muted">Track your progress and insights</p>
            </header>

            {/* ========================================
                PROGRESS - "Am I moving toward my goal?"
                ======================================== */}
            <AnalyticsSection
                title="PROGRESS"
                mobileCollapsible={true}
                defaultCollapsed={false}
            >
                <div className="space-y-6">
                    {/* Goal Projection Hero Card */}
                    <GoalProjectionCard weightAnalysis={weightAnalysis} stats={stats} />

                    {/* Weight Trends with Projected Line */}
                    <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm">
                        <h4 className="text-sm font-medium text-muted mb-4">Weight Trend</h4>
                        {formattedWeightData.length === 0 ? (
                            <div className="h-48 md:h-56 flex items-center justify-center text-muted text-sm">
                                No weight data yet
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
                                            stroke="#10b981"
                                            strokeDasharray="3 3"
                                            label={{ value: 'Goal', fill: '#10b981', position: 'right', fontSize: 12 }}
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
                                        {/* Projected weight (dashed line) */}
                                        <Line
                                            type="monotone"
                                            dataKey="projectedWeight"
                                            stroke="var(--color-primary)"
                                            strokeWidth={2}
                                            strokeDasharray="5 5"
                                            dot={false}
                                            name="Projected"
                                            opacity={0.6}
                                            connectNulls={true}
                                        />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </div>
            </AnalyticsSection>

            {/* ========================================
                COMPLIANCE - "Am I following the plan?"
                ======================================== */}
            <AnalyticsSection
                title="COMPLIANCE"
                mobileCollapsible={true}
                defaultCollapsed={true}
            >
                <div className="space-y-6">
                    {/* Compliance Overview */}
                    <ComplianceOverviewCard
                        streakAnalysis={streakAnalysis}
                        monthlySummary={monthlySummary}
                    />

                    {/* Daily Calorie Tracking */}
                    <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm">
                        <h4 className="text-sm font-medium text-muted mb-4">Daily Calorie Tracking</h4>
                        {formattedCalorieData.length === 0 ? (
                            <div className="h-48 md:h-56 flex items-center justify-center text-muted text-sm">
                                No calorie data yet
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
                                            domain={[0, 'auto']}
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

                    {/* Daily Deficit/Surplus */}
                    <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm">
                        <h4 className="text-sm font-medium text-muted mb-4">Daily Deficit/Surplus</h4>
                        <DeficitSurplusChart summaries={dailySummaries} dailyGoal={stats.dailyCalorieGoal} />
                    </div>
                </div>
            </AnalyticsSection>

            {/* ========================================
                PATTERNS - "What trends exist in my data?"
                ======================================== */}
            <AnalyticsSection
                title="PATTERNS"
                mobileCollapsible={true}
                defaultCollapsed={true}
            >
                <div className="space-y-6">
                    {/* Time Period Comparison */}
                    <PeriodicComparison
                        weeklySummary={weeklyEnhanced}
                        monthlySummary={monthlyEnhanced}
                        dailyGoal={stats.dailyCalorieGoal}
                    />

                    {/* Workout Activity Pattern */}
                    <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm">
                        <h4 className="text-sm font-medium text-muted mb-4">Workout Activity Pattern</h4>
                        {formattedWorkoutData.length === 0 ? (
                            <div className="h-48 md:h-56 flex items-center justify-center text-muted text-sm">
                                No workout data yet
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
                                            fill="var(--chart-5)"
                                            radius={[8, 8, 0, 0]}
                                            name="Calories Burned"
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    {/* Weekly Breakdown */}
                    <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm">
                        <h4 className="text-sm font-medium text-muted mb-4">Weekly Breakdown</h4>
                        <WeeklySummary summaries={dailySummaries} />
                    </div>
                </div>
            </AnalyticsSection>
        </div>
    );
};
