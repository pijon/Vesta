import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { DailySummary } from '../../types';
import { calculateCalorieBalance, CalorieBalanceData } from '../../utils/analytics';

interface CalorieBalanceChartProps {
  summaries: DailySummary[];
  goals: { fast: number; nonFast: number };
  dayTypes: Record<string, string>;
}

export const CalorieBalanceChart: React.FC<CalorieBalanceChartProps> = ({ summaries, goals, dayTypes }) => {
  const balanceData = useMemo(() => {
    // We only want the last 30 days for this chart
    const last30Days = summaries.slice(0, 30);
    return calculateCalorieBalance(last30Days, goals, dayTypes);
  }, [summaries, goals, dayTypes]);

  const stats = useMemo(() => {
    if (balanceData.length === 0) {
      return { avgBalance: 0, bestDay: null, worstDay: null };
    }

    const totalBalance = balanceData.reduce((sum, d) => sum + d.deficit, 0);
    const avgBalance = totalBalance / balanceData.length;

    const bestDay = balanceData.reduce((best, current) =>
      current.deficit > best.deficit ? current : best
    );

    const worstDay = balanceData.reduce((worst, current) =>
      current.deficit < worst.deficit ? current : worst
    );

    return {
      avgBalance,
      bestDay: bestDay.deficit > 0 ? bestDay : null,
      worstDay: worstDay.deficit < 0 ? worstDay : null
    };
  }, [balanceData]);

  if (balanceData.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-100 dark:border-slate-700">
        <h3 className="text-lg font-serif font-normal text-slate-800 dark:text-slate-200 mb-2">Daily Calorie Balance</h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          No data available yet. Start logging meals to see your daily balance.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex justify-end mb-4">
        <span className="text-xs text-charcoal/60 dark:text-stone-400 bg-stone-50 dark:bg-[#1A1714] px-3 py-1 rounded-full">
          Last 30 days
        </span>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={balanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="displayDate"
              tick={{ fill: 'var(--muted)', fontSize: 12 }}
              stroke="var(--border)"
            />
            <YAxis
              tick={{ fill: 'var(--muted)', fontSize: 12 }}
              stroke="var(--border)"
              label={{ value: 'kcal', angle: -90, position: 'insideLeft', fill: 'var(--muted)', fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: 'var(--muted)', opacity: 0.1 }}
              contentStyle={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '12px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
              }}
              labelStyle={{ color: 'var(--main)', fontWeight: 'bold', marginBottom: '8px' }}
              itemStyle={{ color: 'var(--main)' }}
              formatter={(value: number, name: string, props: any) => {
                const data = props.payload;
                const isFast = data.dayType === 'fast';
                const typeLabel = isFast ? ' (Fast)' : '';

                if (value > 0) {
                  return [`${Math.abs(value)} kcal under goal${typeLabel}`, `Under Goal (Goal: ${data.target})`];
                } else if (value < 0) {
                  return [`${Math.abs(value)} kcal over goal${typeLabel}`, `Over Goal (Goal: ${data.target})`];
                } else {
                  return [`At goal${typeLabel}`, `Perfect (Goal: ${data.target})`];
                }
              }}
            />
            <ReferenceLine y={0} stroke="var(--primary)" strokeWidth={2} strokeDasharray="5 5" />
            <Bar dataKey="deficit" radius={[4, 4, 0, 0]}>
              {balanceData.map((entry, index) => {
                // Visual Logic:
                // Fast Day + Compliant = Emerald (var(--calories))
                // Non-Fast Day + Compliant = Primary (e.g. Slate/Blue) -> var(--primary) or similar
                // Non-Compliant = Red (var(--error))

                let fill = 'var(--error)';
                if (entry.isCompliant) {
                  fill = entry.dayType === 'fast' ? 'var(--calories)' : 'var(--neutral-600)'; // Use neutral for standard days
                }

                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={fill}
                    opacity={entry.dayType === 'fast' ? 1 : 0.7} // Visual distinction
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-charcoal/10 dark:border-white/10">
        <div>
          <h4 className="text-xs font-bold text-charcoal/60 dark:text-stone-400 uppercase tracking-wider mb-1">Avg Balance</h4>
          <div className={`text-xl font-bold ${stats.avgBalance >= 0 ? 'text-calories' : 'text-error'}`}>
            {stats.avgBalance >= 0 ? '+' : ''}{stats.avgBalance.toFixed(0)} kcal
          </div>
          <div className="text-xs text-charcoal/60 dark:text-stone-400 mt-1">
            {stats.avgBalance >= 0 ? 'Under goal' : 'Over goal'}
          </div>
        </div>

        {stats.bestDay && (
          <div>
            <div className="text-xs text-charcoal/60 dark:text-stone-400 mb-1">Best Day</div>
            <div className="text-xl font-bold text-calories">
              +{stats.bestDay.deficit.toFixed(0)} kcal
            </div>
            <div className="text-xs text-charcoal/60 dark:text-stone-400">
              {stats.bestDay.displayDate}
            </div>
          </div>
        )}

        {stats.worstDay && (
          <div>
            <div className="text-xs text-charcoal/60 dark:text-stone-400 mb-1">Highest Surplus</div>
            <div className="text-xl font-bold text-error">
              {stats.worstDay.deficit.toFixed(0)} kcal
            </div>
            <div className="text-xs text-charcoal/60 dark:text-stone-400">
              {stats.worstDay.displayDate}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
