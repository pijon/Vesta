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
      if (remainingLoss <= 0) return 'Goal achieved! Maintaining healthy balance.';
      return 'On track to reach your health goal!';
    } else if (trend === 'maintaining') {
      return 'Weight is stable. Consider adjusting your plan.';
    } else if (trend === 'gaining') {
      return 'Weight is increasing. Review your intake.';
    } else {
      return 'Keep logging to see your projection.';
    }
  };

  return (
    <div className="bg-[var(--card-bg)] backdrop-blur-md rounded-3xl relative overflow-hidden p-6 md:p-8">
      {/* Decorative Background Elements */}
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-gradient-to-br from-primary/10 to-weight/10 rounded-full blur-3xl opacity-50"></div>
      <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-gradient-to-br from-weight/10 to-primary/10 rounded-full blur-3xl opacity-50"></div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl md:text-2xl font-serif font-normal text-charcoal dark:text-stone-200 mb-1">
              {remainingLoss <= 0 ? 'Goal Achieved' : 'Goal Projection'}
            </h2>
            <p className="text-sm text-charcoal/60 dark:text-stone-400">{getTrendMessage()}</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-charcoal/60 dark:text-stone-400 uppercase tracking-wide mb-1">Progress</div>
            <div className="text-3xl font-bold" style={{ color: getTrendColor() }}>
              {percentToGoal.toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {/* Total Weight Lost */}
          <div className="bg-white dark:bg-white/5/80 backdrop-blur-sm rounded-2xl p-6 border border-charcoal/10 dark:border-white/10">
            <div className="flex items-start justify-between mb-3">
              <div className="text-xs font-bold text-charcoal/60 dark:text-stone-400 uppercase tracking-wider">
                Total Lost
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="m18 15-6-6-6 6"></path>
              </svg>
            </div>
            <div className="text-4xl md:text-5xl font-bold text-primary mb-2">
              {totalLoss > 0 ? totalLoss.toFixed(1) : '0.0'}
            </div>
            <div className="text-sm text-charcoal/60 dark:text-stone-400">
              kg lost
            </div>
            <div className="mt-4 pt-4 border-t border-charcoal/10 dark:border-white/10">
              <div className="flex justify-between text-xs">
                <span className="text-charcoal/60 dark:text-stone-400">Current</span>
                <span className="font-semibold text-primary">{stats.currentWeight.toFixed(1)} kg</span>
              </div>
            </div>
          </div>

          {/* Days to Goal */}
          <div className="bg-white dark:bg-white/5/80 backdrop-blur-sm rounded-2xl p-6 border border-charcoal/10 dark:border-white/10">
            <div className="flex items-start justify-between mb-3">
              <div className="text-xs font-bold text-charcoal/60 dark:text-stone-400 uppercase tracking-wider">
                {remainingLoss <= 0 ? 'Status' : 'Days to Goal'}
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-weight">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </div>
            {daysToGoal || remainingLoss <= 0 ? (
              <>
                <div className="text-4xl md:text-5xl font-bold text-weight mb-2">
                  {remainingLoss <= 0 ? (
                    <span className="text-secondary">Active</span>
                  ) : (
                    daysToGoal
                  )}
                </div>
                <div className="text-sm text-charcoal/60 dark:text-stone-400">
                  {remainingLoss <= 0 ? 'Maintaining' : 'days remaining'}
                </div>
              </>
            ) : (
              <div className="text-sm text-charcoal/60 dark:text-stone-400 mt-4">
                Keep logging weight to see projection
              </div>
            )}
          </div>

          {/* Remaining to Goal */}
          <div className="bg-white dark:bg-white/5/80 backdrop-blur-sm rounded-2xl p-6 border border-charcoal/10 dark:border-white/10">
            <div className="flex items-start justify-between mb-3">
              <div className="text-xs font-bold text-charcoal/60 dark:text-stone-400 uppercase tracking-wider">
                {remainingLoss <= 0 ? 'Current Status' : 'Remaining'}
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
            <div className="text-4xl md:text-5xl font-bold text-charcoal dark:text-stone-200 mb-2">
              {remainingLoss > 0 ? remainingLoss.toFixed(1) : '0.0'}
            </div>
            <div className="text-sm text-charcoal/60 dark:text-stone-400">
              kg to reach goal
            </div>
            <div className="mt-4 pt-4 border-t border-charcoal/10 dark:border-white/10">
              <div className="flex justify-between text-xs">
                <span className="text-charcoal/60 dark:text-stone-400">Goal</span>
                <span className="font-semibold text-charcoal dark:text-stone-200">{stats.goalWeight.toFixed(1)} kg</span>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-8">
          <div className="flex justify-between text-sm text-charcoal/60 dark:text-stone-400 mb-3">
            <span>Progress to Goal</span>
            <span className="font-semibold" style={{ color: getTrendColor() }}>
              {percentToGoal.toFixed(1)}%
            </span>
          </div>
          <div className="h-4 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
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
