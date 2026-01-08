import { UserStats, WeightEntry, DailyLog } from '../types';
import { getAllDailySummaries } from '../services/storageService';
import { DAILY_CALORIE_LIMIT } from '../constants';

export interface WeightAnalysis {
  currentWeight: number;
  startWeight: number;
  goalWeight: number;
  totalLoss: number;
  remainingLoss: number;
  percentToGoal: number;
  avgWeeklyLoss: number; // kg per week
  projectedGoalDate: string | null; // YYYY-MM-DD
  daysToGoal: number | null;
  trend: 'losing' | 'maintaining' | 'gaining' | 'insufficient-data';
}

export interface StreakAnalysis {
  currentStreak: number; // Days
  longestStreak: number;
  totalCompliantDays: number;
  complianceRate: number; // Percentage
  lastStreakEndDate: string | null;
}

export interface MacroAverages {
  avgCalories: number;
  avgProtein: number;
  avgFat: number;
  avgCarbs: number;
  avgNetCalories: number; // After workouts
}

export interface PeriodSummary {
  period: 'week' | 'month';
  startDate: string;
  endDate: string;
  daysLogged: number;
  avgCalories: number;
  avgNetCalories: number;
  totalWorkouts: number;
  caloriesBurned: number;
  complianceRate: number;
  weightChange: number | null; // kg
}

/**
 * Analyze weight loss trends and project goal date
 */
export function analyzeWeightTrends(stats: UserStats): WeightAnalysis {
  const { currentWeight, startWeight, goalWeight, weightHistory } = stats;

  const totalLoss = startWeight - currentWeight;
  const remainingLoss = currentWeight - goalWeight;
  const percentToGoal = totalLoss / (startWeight - goalWeight) * 100;

  // Calculate average weekly loss from weight history
  let avgWeeklyLoss = 0;
  let trend: WeightAnalysis['trend'] = 'insufficient-data';
  let projectedGoalDate: string | null = null;
  let daysToGoal: number | null = null;

  if (weightHistory && weightHistory.length >= 2) {
    // Sort by date
    const sortedHistory = [...weightHistory].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const firstEntry = sortedHistory[0];
    const lastEntry = sortedHistory[sortedHistory.length - 1];

    const daysDiff = (new Date(lastEntry.date).getTime() - new Date(firstEntry.date).getTime()) / (1000 * 60 * 60 * 24);
    const weightDiff = firstEntry.weight - lastEntry.weight;

    if (daysDiff >= 7) { // At least a week of data
      avgWeeklyLoss = (weightDiff / daysDiff) * 7; // Convert to per week

      // Determine trend
      if (avgWeeklyLoss > 0.1) {
        trend = 'losing';
      } else if (avgWeeklyLoss < -0.1) {
        trend = 'gaining';
      } else {
        trend = 'maintaining';
      }

      // Project goal date if losing weight
      if (avgWeeklyLoss > 0 && remainingLoss > 0) {
        const weeksToGoal = remainingLoss / avgWeeklyLoss;
        daysToGoal = Math.ceil(weeksToGoal * 7);

        const today = new Date();
        const goalDate = new Date(today.getTime() + daysToGoal * 24 * 60 * 60 * 1000);
        projectedGoalDate = goalDate.toISOString().split('T')[0];
      }
    }
  }

  return {
    currentWeight,
    startWeight,
    goalWeight,
    totalLoss,
    remainingLoss,
    percentToGoal: Math.min(100, Math.max(0, percentToGoal)),
    avgWeeklyLoss,
    projectedGoalDate,
    daysToGoal,
    trend
  };
}

/**
 * Calculate calorie streak and compliance
 */
export function analyzeStreaks(): StreakAnalysis {
  const summaries = getAllDailySummaries();

  if (summaries.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalCompliantDays: 0,
      complianceRate: 0,
      lastStreakEndDate: null
    };
  }

  // Sort by date descending (most recent first)
  const sorted = [...summaries].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  let totalCompliantDays = 0;
  let lastStreakEndDate: string | null = null;

  // Calculate current streak (from today backwards)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < sorted.length; i++) {
    const summary = sorted[i];
    const summaryDate = new Date(summary.date);
    summaryDate.setHours(0, 0, 0, 0);

    const isCompliant = summary.netCalories <= DAILY_CALORIE_LIMIT;

    if (isCompliant) {
      totalCompliantDays++;
    }

    // For current streak, check consecutive days from today
    if (i === 0 || currentStreak > 0) {
      const expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() - i);

      if (summaryDate.getTime() === expectedDate.getTime() && isCompliant) {
        currentStreak++;
      } else if (currentStreak === 0 && i === 0) {
        // Today is not logged or not compliant
        currentStreak = 0;
      } else {
        // Streak broken
        if (currentStreak === 0 && isCompliant) {
          lastStreakEndDate = summary.date;
        }
      }
    }

    // Calculate longest streak (scan all history)
    if (isCompliant) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }

  const complianceRate = (totalCompliantDays / summaries.length) * 100;

  return {
    currentStreak,
    longestStreak,
    totalCompliantDays,
    complianceRate,
    lastStreakEndDate
  };
}

/**
 * Calculate macro averages for a time period
 */
export function analyzeMacros(days: number = 7): MacroAverages {
  const summaries = getAllDailySummaries();

  if (summaries.length === 0) {
    return {
      avgCalories: 0,
      avgProtein: 0,
      avgFat: 0,
      avgCarbs: 0,
      avgNetCalories: 0
    };
  }

  // Get last N days
  const sorted = [...summaries]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, days);

  const totalCalories = sorted.reduce((sum, s) => sum + s.caloriesConsumed, 0);
  const totalNetCalories = sorted.reduce((sum, s) => sum + s.netCalories, 0);

  return {
    avgCalories: totalCalories / sorted.length,
    avgNetCalories: totalNetCalories / sorted.length,
    avgProtein: 0, // TODO: Calculate from meal logs when we track this
    avgFat: 0,
    avgCarbs: 0
  };
}

/**
 * Generate weekly summary report
 */
export function getWeeklySummary(): PeriodSummary {
  const summaries = getAllDailySummaries();

  // Get last 7 days
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const weekData = summaries.filter(s => {
    const date = new Date(s.date);
    return date >= weekAgo && date <= today;
  });

  if (weekData.length === 0) {
    return {
      period: 'week',
      startDate: weekAgo.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
      daysLogged: 0,
      avgCalories: 0,
      avgNetCalories: 0,
      totalWorkouts: 0,
      caloriesBurned: 0,
      complianceRate: 0,
      weightChange: null
    };
  }

  const totalCalories = weekData.reduce((sum, s) => sum + s.caloriesConsumed, 0);
  const totalNetCalories = weekData.reduce((sum, s) => sum + s.netCalories, 0);
  const totalWorkouts = weekData.reduce((sum, s) => sum + s.workoutCount, 0);
  const totalBurned = weekData.reduce((sum, s) => sum + s.caloriesBurned, 0);
  const compliantDays = weekData.filter(s => s.netCalories <= DAILY_CALORIE_LIMIT).length;

  return {
    period: 'week',
    startDate: weekAgo.toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0],
    daysLogged: weekData.length,
    avgCalories: totalCalories / weekData.length,
    avgNetCalories: totalNetCalories / weekData.length,
    totalWorkouts,
    caloriesBurned: totalBurned,
    complianceRate: (compliantDays / weekData.length) * 100,
    weightChange: null // TODO: Calculate from weight history
  };
}

/**
 * Generate monthly summary report
 */
export function getMonthlySummary(): PeriodSummary {
  const summaries = getAllDailySummaries();

  // Get last 30 days
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const monthData = summaries.filter(s => {
    const date = new Date(s.date);
    return date >= monthAgo && date <= today;
  });

  if (monthData.length === 0) {
    return {
      period: 'month',
      startDate: monthAgo.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
      daysLogged: 0,
      avgCalories: 0,
      avgNetCalories: 0,
      totalWorkouts: 0,
      caloriesBurned: 0,
      complianceRate: 0,
      weightChange: null
    };
  }

  const totalCalories = monthData.reduce((sum, s) => sum + s.caloriesConsumed, 0);
  const totalNetCalories = monthData.reduce((sum, s) => sum + s.netCalories, 0);
  const totalWorkouts = monthData.reduce((sum, s) => sum + s.workoutCount, 0);
  const totalBurned = monthData.reduce((sum, s) => sum + s.caloriesBurned, 0);
  const compliantDays = monthData.filter(s => s.netCalories <= DAILY_CALORIE_LIMIT).length;

  return {
    period: 'month',
    startDate: monthAgo.toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0],
    daysLogged: monthData.length,
    avgCalories: totalCalories / monthData.length,
    avgNetCalories: totalNetCalories / monthData.length,
    totalWorkouts,
    caloriesBurned: totalBurned,
    complianceRate: (compliantDays / monthData.length) * 100,
    weightChange: null // TODO: Calculate from weight history
  };
}

/**
 * Format date difference in human readable way
 */
export function formatDateDiff(days: number): string {
  if (days < 7) {
    return `${days} day${days !== 1 ? 's' : ''}`;
  } else if (days < 30) {
    const weeks = Math.floor(days / 7);
    const remainingDays = days % 7;
    if (remainingDays === 0) {
      return `${weeks} week${weeks !== 1 ? 's' : ''}`;
    }
    return `${weeks} week${weeks !== 1 ? 's' : ''}, ${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
  } else {
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    if (remainingDays === 0) {
      return `${months} month${months !== 1 ? 's' : ''}`;
    }
    return `${months} month${months !== 1 ? 's' : ''}, ${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
  }
}

/**
 * Format date in readable format
 */
export function formatReadableDate(dateStr: string): string {
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}
