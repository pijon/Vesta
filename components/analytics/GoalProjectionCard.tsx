import React from 'react';
import { motion } from 'framer-motion';
import { WeightAnalysis } from '../../utils/analytics';
import { UserStats } from '../../types';
import { formatReadableDate, formatDateDiff } from '../../utils/analytics';

interface GoalProjectionCardProps {
  weightAnalysis: WeightAnalysis;
  stats: UserStats;
}

export const GoalProjectionCard: React.FC<GoalProjectionCardProps> = ({ weightAnalysis, stats }) => {
  const {
    totalLoss,
    remainingLoss,
    percentToGoal,
    projectedGoalDate,
    daysToGoal,
    trend
  } = weightAnalysis;

  const getTrendColor = () => {
    switch (trend) {
      case 'losing':
        return 'var(--primary)';
      case 'maintaining':
        return 'var(--warning)';
      case 'gaining':
        return 'var(--error)';
      default:
        return 'var(--muted)';
    }
  };

  const getTrendMessage = () => {
    if (trend === 'losing' && daysToGoal) {
      return 'On track to reach your goal!';
    } else if (trend === 'maintaining') {
      return 'Weight is stable. Consider adjusting your plan.';
    } else if (trend === 'gaining') {
      return 'Weight is increasing. Review your intake.';
    } else {
      return 'Keep logging to see your projection.';
    }
  };

  return (
    <div className="bg-gradient-to-br from-primary/5 via-surface to-weight-bg/10 rounded-3xl p-8 md:p-10 border-2 border-primary/20 shadow-xl relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-gradient-to-br from-primary/10 to-weight/10 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-gradient-to-br from-weight/10 to-primary/10 rounded-full blur-3xl"></div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-serif font-normal text-main mb-1">
              Goal Projection
            </h2>
            <p className="text-sm text-muted">{getTrendMessage()}</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted mb-1">Progress</div>
            <div className="text-3xl font-bold" style={{ color: getTrendColor() }}>
              {percentToGoal.toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {/* Total Weight Lost */}
          <div className="bg-surface/80 backdrop-blur-sm rounded-2xl p-6 border border-border/50">
            <div className="flex items-start justify-between mb-3">
              <div className="text-xs font-bold text-muted uppercase tracking-wider">
                Total Lost
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="m18 15-6-6-6 6"></path>
              </svg>
            </div>
            <div className="text-4xl md:text-5xl font-bold text-primary mb-2">
              {totalLoss > 0 ? totalLoss.toFixed(1) : '0.0'}
            </div>
            <div className="text-sm text-muted">
              kg since starting
            </div>
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="flex justify-between text-xs">
                <span className="text-muted">Start</span>
                <span className="font-semibold text-main">{stats.startWeight.toFixed(1)} kg</span>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-muted">Current</span>
                <span className="font-semibold text-primary">{stats.currentWeight.toFixed(1)} kg</span>
              </div>
            </div>
          </div>

          {/* Days to Goal */}
          <div className="bg-surface/80 backdrop-blur-sm rounded-2xl p-6 border border-border/50">
            <div className="flex items-start justify-between mb-3">
              <div className="text-xs font-bold text-muted uppercase tracking-wider">
                Days to Goal
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-weight">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </div>
            {daysToGoal ? (
              <>
                <div className="text-4xl md:text-5xl font-bold text-weight mb-2">
                  {daysToGoal}
                </div>
                <div className="text-sm text-muted">
                  {formatDateDiff(daysToGoal)}
                </div>
                <div className="mt-4 pt-4 border-t border-border/50">
                  <div className="text-xs text-muted mb-1">Estimated Date</div>
                  <div className="text-sm font-semibold text-main">
                    {projectedGoalDate ? formatReadableDate(projectedGoalDate) : 'Calculating...'}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm text-muted mt-4">
                Keep logging weight to see projection
              </div>
            )}
          </div>

          {/* Remaining to Goal */}
          <div className="bg-surface/80 backdrop-blur-sm rounded-2xl p-6 border border-border/50">
            <div className="flex items-start justify-between mb-3">
              <div className="text-xs font-bold text-muted uppercase tracking-wider">
                Remaining
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
            <div className="text-4xl md:text-5xl font-bold text-main mb-2">
              {remainingLoss > 0 ? remainingLoss.toFixed(1) : '0.0'}
            </div>
            <div className="text-sm text-muted">
              kg to reach goal
            </div>
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="flex justify-between text-xs">
                <span className="text-muted">Goal Weight</span>
                <span className="font-semibold text-main">{stats.goalWeight.toFixed(1)} kg</span>
              </div>
              {weightAnalysis.avgWeeklyLoss > 0 && (
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-muted">Weekly Rate</span>
                  <span className="font-semibold text-primary">{weightAnalysis.avgWeeklyLoss.toFixed(2)} kg/wk</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-8">
          <div className="flex justify-between text-sm text-muted mb-3">
            <span>Progress to Goal</span>
            <span className="font-semibold" style={{ color: getTrendColor() }}>
              {percentToGoal.toFixed(1)}%
            </span>
          </div>
          <div className="h-4 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--neutral-200)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(to right, ${getTrendColor()}, var(--primary-hover))`
              }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, percentToGoal)}%` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
