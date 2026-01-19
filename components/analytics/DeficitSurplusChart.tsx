import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { DailySummary } from '../../types';
import { calculateDeficitSurplus, DeficitSurplusData } from '../../utils/analytics';

interface DeficitSurplusChartProps {
  summaries: DailySummary[];
  goals: { fast: number; nonFast: number };
  dayTypes: Record<string, string>;
}

export const DeficitSurplusChart: React.FC<DeficitSurplusChartProps> = ({ summaries, goals, dayTypes }) => {
  const deficitData = useMemo(() => {
    // Get last 30 days
    const last30Days = summaries.slice(-30);
    return calculateDeficitSurplus(last30Days, goals, dayTypes);
  }, [summaries, goals, dayTypes]);

  const stats = useMemo(() => {
    if (deficitData.length === 0) {
      return { avgDeficit: 0, bestDay: null, worstDay: null };
    }

    const totalDeficit = deficitData.reduce((sum, d) => sum + d.deficit, 0);
    const avgDeficit = totalDeficit / deficitData.length;

    const bestDay = deficitData.reduce((best, current) =>
      current.deficit > best.deficit ? current : best
    );

    const worstDay = deficitData.reduce((worst, current) =>
      current.deficit < worst.deficit ? current : worst
    );

    return {
      avgDeficit,
      bestDay: bestDay.deficit > 0 ? bestDay : null,
      worstDay: worstDay.deficit < 0 ? worstDay : null
    };
  }, [deficitData]);

  if (deficitData.length === 0) {
    return (
      <div className="bg-surface rounded-3xl p-8 border border-border">
        <h3 className="text-lg font-serif font-normal text-main mb-6">Calorie Deficit/Surplus Trend</h3>
        <div className="flex items-center justify-center h-64 text-muted">
          <p>No data available yet. Start logging meals to see your deficit trends.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-3xl p-8 border border-border">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-serif font-normal text-main">Calorie Deficit/Surplus Trend</h3>
        <span className="text-xs text-muted bg-background px-3 py-1 rounded-full">
          Last 30 days
        </span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={deficitData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                return [`${Math.abs(value)} kcal under goal${typeLabel}`, `Deficit (Goal: ${data.target})`];
              } else if (value < 0) {
                return [`${Math.abs(value)} kcal over goal${typeLabel}`, `Surplus (Goal: ${data.target})`];
              } else {
                return [`At goal${typeLabel}`, `Perfect (Goal: ${data.target})`];
              }
            }}
          />
          <ReferenceLine y={0} stroke="var(--primary)" strokeWidth={2} strokeDasharray="5 5" />
          <Bar dataKey="deficit" radius={[4, 4, 0, 0]}>
            {deficitData.map((entry, index) => {
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

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-border">
        <div>
          <div className="text-xs text-muted mb-1">Average Daily</div>
          <div className={`text-xl font-bold ${stats.avgDeficit >= 0 ? 'text-calories' : 'text-error'}`}>
            {stats.avgDeficit >= 0 ? '+' : ''}{stats.avgDeficit.toFixed(0)} kcal
          </div>
          <div className="text-xs text-muted">
            {stats.avgDeficit >= 0 ? 'Under goal' : 'Over goal'}
          </div>
        </div>

        {stats.bestDay && (
          <div>
            <div className="text-xs text-muted mb-1">Best Day</div>
            <div className="text-xl font-bold text-calories">
              +{stats.bestDay.deficit.toFixed(0)} kcal
            </div>
            <div className="text-xs text-muted">
              {stats.bestDay.displayDate}
            </div>
          </div>
        )}

        {stats.worstDay && (
          <div>
            <div className="text-xs text-muted mb-1">Highest Surplus</div>
            <div className="text-xl font-bold text-error">
              {stats.worstDay.deficit.toFixed(0)} kcal
            </div>
            <div className="text-xs text-muted">
              {stats.worstDay.displayDate}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
