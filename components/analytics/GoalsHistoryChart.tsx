import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Legend } from 'recharts';
import { DailySummary, UserStats } from '../../types';

interface GoalsHistoryChartProps {
    summaries: DailySummary[];
    stats: UserStats;
}

export const GoalsHistoryChart: React.FC<GoalsHistoryChartProps> = ({ summaries, stats }) => {
    // Calculate goal percentages for each day
    const chartData = summaries.slice(-14).map(summary => {
        const calorieGoal = stats.dailyCalorieGoal || 800;
        const waterGoal = stats.dailyWaterGoal || 2000;
        const fastingGoal = 16; // Standard IF target

        // Calculate percentage achieved (capped at 150% for display)
        const caloriePercent = Math.min(((summary.caloriesConsumed / calorieGoal) * 100), 150);
        const waterPercent = Math.min(((summary.waterIntake || 0) / waterGoal) * 100, 150);
        const fastingPercent = Math.min(((summary.maxFastingHours || 0) / fastingGoal) * 100, 150);

        return {
            date: summary.date,
            displayDate: new Date(summary.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            caloriePercent: Math.round(caloriePercent),
            waterPercent: Math.round(waterPercent),
            fastingPercent: Math.round(fastingPercent),

            // Raw values for tooltip
            calories: summary.caloriesConsumed,
            water: summary.waterIntake || 0,
            fasting: summary.maxFastingHours || 0
        };
    });

    const showFasting = chartData.some(d => d.fasting > 0);

    if (chartData.length === 0) {
        return (
            <div className="h-48 md:h-56 flex items-center justify-center text-charcoal/60 dark:text-stone-400 text-sm">
                No goal data yet. Start logging to see your history.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Chart */}
            <div className="h-48 md:h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorCalories" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--calories)" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="var(--calories)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorWater" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--water)" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="var(--water)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorFasting" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--fasting)" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="var(--fasting)" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                        <XAxis
                            dataKey="displayDate"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'var(--color-muted)', fontSize: 11, fontWeight: 500 }}
                            dy={10}
                            minTickGap={20}
                        />
                        <YAxis
                            domain={[0, 120]}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'var(--color-muted)', fontSize: 11, fontWeight: 500 }}
                            tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip
                            contentStyle={{
                                borderRadius: '12px',
                                border: '1px solid var(--color-border)',
                                backgroundColor: 'var(--color-surface)',
                                boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.1)',
                                padding: '12px'
                            }}
                            formatter={(value: number, name: string, props: any) => {
                                const entry = props.payload;
                                if (name === 'caloriePercent') return [`${entry.calories} kcal`, 'Calories'];
                                if (name === 'waterPercent') return [`${(entry.water / 1000).toFixed(1)}L`, 'Water'];
                                if (name === 'fastingPercent') return [`${entry.fasting.toFixed(1)}h`, 'Fasting'];
                                return [value, name];
                            }}
                        />
                        <Legend
                            verticalAlign="top"
                            height={36}
                            formatter={(value) => {
                                if (value === 'caloriePercent') return 'Calories';
                                if (value === 'waterPercent') return 'Water';
                                if (value === 'fastingPercent') return 'Fasting';
                                return value;
                            }}
                        />
                        {/* 100% Goal Line */}
                        <ReferenceLine
                            y={100}
                            stroke="var(--color-muted)"
                            strokeDasharray="3 3"
                            strokeOpacity={0.5}
                        />
                        {/* Areas */}
                        <Area
                            type="monotone"
                            dataKey="caloriePercent"
                            stroke="var(--calories)"
                            strokeWidth={2}
                            fill="url(#colorCalories)"
                            name="caloriePercent"
                        />
                        <Area
                            type="monotone"
                            dataKey="waterPercent"
                            stroke="var(--water)"
                            strokeWidth={2}
                            fill="url(#colorWater)"
                            name="waterPercent"
                        />

                        {showFasting && (
                            <Area
                                type="monotone"
                                dataKey="fastingPercent"
                                stroke="var(--fasting)"
                                strokeWidth={2}
                                fill="url(#colorFasting)"
                                name="fastingPercent"
                            />
                        )}
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
