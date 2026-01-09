import React, { useMemo } from 'react';
import {
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Area,
    ReferenceLine
} from 'recharts';
import { getAnalyticsData, getGoalProjection } from '../services/analyticsService';
import { UserStats } from '../types';

interface AnalyticsProps {
    userStats: UserStats;
}

export const Analytics: React.FC<AnalyticsProps> = ({ userStats }) => {
    // const data = useMemo(() => getAnalyticsData(), []);
    // const projection = useMemo(() => getGoalProjection(), [userStats]);
    const [data, setData] = React.useState<any[]>([]);
    const [projection, setProjection] = React.useState<{ daysRemaining: number, projectedDate: string } | null>(null);

    React.useEffect(() => {
        getAnalyticsData().then(setData);
        getGoalProjection().then(setProjection);
    }, [userStats]);

    // Format date for display
    const formattedData = data.map(d => ({
        ...d,
        shortDate: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        netCalories: (d.calories || 0) - (d.caloriesBurned || 0)
    }));

    // Filter for charts (e.g. last 30 days) if needed, currently showing all history

    // Calculate consistency
    const calculateConsistency = () => {
        const last30Days = formattedData.slice(-30);
        const daysTracked = last30Days.filter(d => d.calories !== null && d.calories > 0).length;
        const daysOnTarget = last30Days.filter(d =>
            d.calories !== null &&
            d.calories > 0 &&
            ((d.calories || 0) - (d.caloriesBurned || 0)) <= userStats.dailyCalorieGoal
        ).length;

        return {
            consistencyScore: daysTracked > 0 ? Math.round((daysOnTarget / daysTracked) * 100) : 0,
            daysOnTarget,
            daysTracked
        };
    };

    const consistency = calculateConsistency();

    if (formattedData.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted">
                <div className="bg-surface/50 p-6 rounded-full mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                </div>
                <h3 className="text-xl font-medium text-main mb-2">No Data Yet</h3>
                <p className="max-w-xs">Start logging your weight and meals to unlock deep insights into your progress.</p>
            </div>
        );
    }

    return (
        <div className="pb-24 space-y-6 animate-fade-in">
            <header className="mb-6">
                <h2 className="text-3xl font-serif text-main mb-1">Deep Insights</h2>
                <p className="text-muted">Analyze your progress and fasting correlations.</p>
            </header>

            {/* Top Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Projection Card */}
                <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border">
                    <div className="flex justify-between items-start mb-4">
                        <h4 className="text-sm font-bold text-muted uppercase tracking-wider">Goal Projection</h4>
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        </div>
                    </div>
                    {projection ? (
                        <div>
                            <div className="text-3xl font-serif text-main mb-1">{projection.daysRemaining} Days</div>
                            <p className="text-sm text-muted">Estimated goal date: <span className="font-medium text-main">{new Date(projection.projectedDate).toLocaleDateString()}</span></p>
                        </div>
                    ) : (
                        <div className="text-muted text-sm italic py-2">
                            Not enough weight data to project success yet. Keep logging!
                        </div>
                    )}
                </div>

                {/* Consistency Card */}
                <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border">
                    <div className="flex justify-between items-start mb-4">
                        <h4 className="text-sm font-bold text-muted uppercase tracking-wider">Diet Consistency</h4>
                        <div className={`p-2 rounded-lg ${consistency.consistencyScore >= 80 ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        </div>
                    </div>
                    <div>
                        <div className="text-3xl font-serif text-main mb-1">{consistency.consistencyScore}%</div>
                        <p className="text-sm text-muted">Days on target (last 30 days): <span className="font-medium text-main">{consistency.daysOnTarget}/{consistency.daysTracked}</span></p>
                    </div>
                </div>

                {/* Current Deficit Card - Simple Logic based on latest entry */}
                <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border">
                    <div className="flex justify-between items-start mb-4">
                        <h4 className="text-sm font-bold text-muted uppercase tracking-wider">Latest Net Calories</h4>
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                        </div>
                    </div>
                    {formattedData.length > 0 ? (
                        <div>
                            <div className="text-3xl font-serif text-main mb-1">{formattedData[formattedData.length - 1].netCalories}</div>
                            <p className="text-sm text-muted">Target: <span className="font-medium text-main">{userStats.dailyCalorieGoal}</span></p>
                        </div>
                    ) : (
                        <div className="text-muted text-sm italic py-2">No recent logs</div>
                    )}
                </div>
            </div>

            {/* Main Chart: Weight vs Fasting */}
            <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border">
                <h3 className="text-lg font-bold text-main mb-6">Weight vs Fasting Hours</h3>
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={formattedData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                            <XAxis
                                dataKey="shortDate"
                                stroke="var(--color-muted)"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                dy={10}
                            />
                            {/* Weight Axis (Left) */}
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
                            {/* Fasting Axis (Right) */}
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
                                itemStyle={{ fontSize: '13px', fontWeight: 500 }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />

                            {/* Fasting Bars */}
                            <Bar
                                yAxisId="right"
                                dataKey="fastingHours"
                                name="Fasting Hours"
                                fill="var(--color-primary)"
                                opacity={0.2}
                                barSize={20}
                                radius={[4, 4, 0, 0]}
                            />

                            {/* Weight Line */}
                            <Line
                                yAxisId="left"
                                type="monotone"
                                dataKey="weight"
                                name="Weight (kg)"
                                stroke="var(--color-primary)"
                                strokeWidth={3}
                                dot={{ fill: 'var(--color-primary)', r: 4, strokeWidth: 2, stroke: 'var(--color-surface)' }}
                                activeDot={{ r: 6, strokeWidth: 0 }}
                                connectNulls
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Calorie Consistency Heatmap (Last 14 days detail) */}
            <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border">
                <h3 className="text-lg font-bold text-main mb-6">Calorie Consistency (Last 14 Days)</h3>
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={formattedData.slice(-14)} margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
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
                            <ReferenceLine y={userStats.dailyCalorieGoal} stroke="var(--color-primary)" strokeDasharray="3 3" label={{ value: 'Goal', fill: 'var(--color-primary)', position: 'right' }} />
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
            </div>
        </div>
    );
};
