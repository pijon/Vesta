import React from 'react';
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Legend, Area } from 'recharts';
import { UserStats } from '../../types';
import { calculateRegressionLine } from '../../utils/analytics';

interface WeightProjectionChartProps {
    stats: UserStats;
}

export const WeightProjectionChart: React.FC<WeightProjectionChartProps> = ({ stats }) => {
    const history = stats.weightHistory || [];

    if (history.length < 3) {
        return (
            <div className="h-64 flex items-center justify-center text-charcoal/60 dark:text-stone-400 text-sm italic">
                Log at least 3 days of weight to see projection.
            </div>
        );
    }

    // 1. Prepare Data
    // Use regression to project out
    const { slope, intercept, rSquared } = calculateRegressionLine(history);

    // Sort history
    const sortedHistory = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const firstDate = new Date(sortedHistory[0].date);

    // Create data points for history
    const data = sortedHistory.map(entry => ({
        date: entry.date,
        displayDate: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        weight: entry.weight,
        projected: null as number | null,
    }));

    // Add projection points if losing weight (slope < 0)
    let projectedDateLabel = '';

    if (slope < 0) {
        // Find how many days until goal
        const currentWeight = stats.currentWeight;
        const goalWeight = stats.goalWeight;
        const remaining = currentWeight - goalWeight;

        if (remaining > 0) {
            const kgPerDay = Math.abs(slope);
            const daysToGoal = Math.ceil(remaining / kgPerDay);

            // Limit projection to 90 days to avoid crazy long charts
            const daysToShow = Math.min(daysToGoal, 90);

            const lastEntry = sortedHistory[sortedHistory.length - 1];
            const lastDate = new Date(lastEntry.date);

            // Add point for today/start of projection
            data[data.length - 1].projected = lastEntry.weight;

            // Add final projection point
            const targetDate = new Date(lastDate);
            targetDate.setDate(targetDate.getDate() + daysToShow);

            const projectedWeight = lastEntry.weight - (kgPerDay * daysToShow);

            data.push({
                date: targetDate.toISOString().split('T')[0],
                displayDate: targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                weight: null as any,
                projected: Number(projectedWeight.toFixed(1))
            });

            projectedDateLabel = targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    }

    const minWeight = Math.min(...history.map(w => w.weight), stats.goalWeight) - 2;
    const maxWeight = Math.max(...history.map(w => w.weight)) + 1;

    return (
        <div className="h-64 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.5} />
                    <XAxis
                        dataKey="displayDate"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'var(--color-muted)', fontSize: 10 }}
                        minTickGap={30}
                    />
                    <YAxis
                        domain={[Math.floor(minWeight), Math.ceil(maxWeight)]}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'var(--color-muted)', fontSize: 10 }}
                        width={30}
                    />
                    <Tooltip
                        contentStyle={{
                            borderRadius: '12px',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-surface)',
                            boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.1)',
                            padding: '8px',
                            fontSize: '12px'
                        }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />

                    {/* Goal Line */}
                    <ReferenceLine
                        y={stats.goalWeight}
                        label={{
                            value: 'Goal',
                            fill: 'var(--color-muted)',
                            fontSize: 10,
                            position: 'right'
                        }}
                        stroke="var(--color-success)"
                        strokeDasharray="3 3"
                        opacity={0.7}
                    />

                    {/* History Area */}
                    <Area
                        type="monotone"
                        dataKey="weight"
                        name="History"
                        stroke="var(--primary)"
                        strokeWidth={2}
                        fill="url(#weightGradient)"
                        activeDot={{ r: 4, fill: 'var(--primary)' }}
                    />

                    {/* Projection Line */}
                    <Line
                        type="monotone"
                        dataKey="projected"
                        name="Projection"
                        stroke="var(--primary)"
                        strokeDasharray="5 5"
                        strokeWidth={2}
                        dot={{ r: 3, fill: 'var(--primary)', strokeWidth: 0, opacity: 0.5 }}
                        connectNulls
                        opacity={0.6}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
};
