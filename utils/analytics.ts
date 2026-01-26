import { UserStats, WeightEntry, DailyLog, DailySummary } from '../types';
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
  projectedDailyRate: number; // kg per day (positive = losing in this context, or maybe handle sign consistently)
}

/**
 * Calculate linear regression for weight data
 * Returns slope (kg per day) and intercept
 */
function linearRegression(weightHistory: WeightEntry[]): { slope: number; intercept: number; rSquared: number } {
  const n = weightHistory.length;

  // Convert dates to days since first entry
  const firstDate = new Date(weightHistory[0].date).getTime();
  const points = weightHistory.map(entry => ({
    x: (new Date(entry.date).getTime() - firstDate) / (1000 * 60 * 60 * 24), // days since start
    y: entry.weight
  }));

  // Calculate means
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n;

  // Calculate slope and intercept
  let numerator = 0;
  let denominator = 0;

  for (const point of points) {
    numerator += (point.x - meanX) * (point.y - meanY);
    denominator += (point.x - meanX) ** 2;
  }

  const slope = numerator / denominator;
  const intercept = meanY - slope * meanX;

  // Calculate R² (coefficient of determination)
  let ssRes = 0; // Sum of squared residuals
  let ssTot = 0; // Total sum of squares

  for (const point of points) {
    const predicted = slope * point.x + intercept;
    ssRes += (point.y - predicted) ** 2;
    ssTot += (point.y - meanY) ** 2;
  }

  const rSquared = 1 - (ssRes / ssTot);

  return { slope, intercept, rSquared };
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
  let projectedDailyRate = 0;

  if (weightHistory && weightHistory.length >= 2) {
    // Sort by date
    const sortedHistory = [...weightHistory].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const firstEntry = sortedHistory[0];
    const lastEntry = sortedHistory[sortedHistory.length - 1];
    const daysDiff = (new Date(lastEntry.date).getTime() - new Date(firstEntry.date).getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff >= 3) { // At least 3 days of data

      // Filter for recent history (last 30 days) to reflect current trend
      // rather than all-time average which might be outdated
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let recentHistory = sortedHistory.filter(entry => new Date(entry.date) >= thirtyDaysAgo);

      // Fallback to full history if insufficient recent data (need at least 3 points for meaningful trend)
      // Check if recent history covers enough time span (at least 3 days span)
      let usedHistory = recentHistory;
      if (recentHistory.length < 3) {
        usedHistory = sortedHistory;
      } else {
        const firstRecent = recentHistory[0];
        const lastRecent = recentHistory[recentHistory.length - 1];
        const recentSpan = (new Date(lastRecent.date).getTime() - new Date(firstRecent.date).getTime()) / (1000 * 60 * 60 * 24);
        if (recentSpan < 3) {
          usedHistory = sortedHistory;
        }
      }

      // Use linear regression for more accurate trend
      const { slope, rSquared } = linearRegression(usedHistory);

      // slope is in kg per day, convert to kg per week
      avgWeeklyLoss = -slope * 7; // Negative slope means weight going down (losing)

      // Cap at realistic maximum (1kg/week is aggressive but achievable)
      // This prevents unrealistic projections from initial water weight loss
      avgWeeklyLoss = -slope * 7; // Negative slope means weight going down (losing)

      // Cap at realistic maximum (1.5kg/week is aggressive but achievable)
      // This prevents unrealistic projections from initial water weight loss
      const MAX_WEEKLY_LOSS = 1.5; // kg per week
      const cappedWeeklyLoss = Math.min(Math.abs(avgWeeklyLoss), MAX_WEEKLY_LOSS);

      projectedDailyRate = avgWeeklyLoss > 0 ? cappedWeeklyLoss / 7 : 0;

      // Determine trend
      if (avgWeeklyLoss > 0.1) {
        trend = 'losing';
      } else if (avgWeeklyLoss < -0.1) {
        trend = 'gaining';
      } else {
        trend = 'maintaining';
      }

      // Project goal date if losing weight (use capped rate for projection)
      // Only project if we have good data quality (R² > 0.5 means regression fits well)
      if (avgWeeklyLoss > 0 && remainingLoss > 0 && rSquared > 0.5) {
        const weeksToGoal = remainingLoss / cappedWeeklyLoss;
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
    trend,
    projectedDailyRate
  };
}

/**
 * Calculate calorie streak and compliance
 */
export function analyzeStreaks(summaries: DailySummary[], dailyGoal: number = DAILY_CALORIE_LIMIT): StreakAnalysis {

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

    const isCompliant = summary.netCalories <= dailyGoal;

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
export function analyzeMacros(summaries: DailySummary[], days: number = 7): MacroAverages {

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
export function getWeeklySummary(summaries: DailySummary[], dailyGoal?: number): PeriodSummary {

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
  const compliantDays = weekData.filter(s => s.netCalories <= (dailyGoal || DAILY_CALORIE_LIMIT)).length;

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
export function getMonthlySummary(summaries: DailySummary[], dailyGoal?: number): PeriodSummary {

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
  const compliantDays = monthData.filter(s => s.netCalories <= (dailyGoal || DAILY_CALORIE_LIMIT)).length;

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

/**
 * Calculate deficit/surplus for each day
 */
export interface CalorieBalanceData {
  date: string;
  deficit: number;  // positive = under goal, negative = over goal
  displayDate: string;
  isCompliant: boolean;
  target: number;
  dayType: 'fast' | 'non-fast' | 'normal'; // 'normal' for daily mode fallback or unspecified
}

export function calculateCalorieBalance(
  summaries: DailySummary[],
  goals: { fast: number; nonFast: number },
  dayTypes: Record<string, 'fast' | 'non-fast'>
): CalorieBalanceData[] {

  if (summaries.length === 0) {
    return [];
  }

  return summaries.map(summary => {
    // Determine target based on day type
    // Default to nonFast goal if not specified (assuming standard day)
    const type = (dayTypes[summary.date] || 'non-fast') as 'fast' | 'non-fast';
    const dailyGoal = type === 'fast' ? goals.fast : goals.nonFast;

    const deficit = dailyGoal - summary.netCalories;
    const isCompliant = summary.netCalories <= dailyGoal;

    const date = new Date(summary.date);
    const displayDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return {
      date: summary.date,
      deficit,
      displayDate,
      isCompliant,
      target: dailyGoal,
      dayType: type
    };
  });
}

/**
 * Enhance period summary with weight change
 */
export function enhancePeriodSummaryWithWeight(
  summary: PeriodSummary,
  weightHistory: WeightEntry[]
): PeriodSummary {

  if (!weightHistory || weightHistory.length === 0) {
    return { ...summary, weightChange: null };
  }

  // Sort by date
  const sortedHistory = [...weightHistory].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Find weight entries within the period
  const startDate = new Date(summary.startDate);
  const endDate = new Date(summary.endDate);

  const startWeight = sortedHistory.find(entry => {
    const entryDate = new Date(entry.date);
    return entryDate >= startDate;
  });

  const endWeight = [...sortedHistory].reverse().find(entry => {
    const entryDate = new Date(entry.date);
    return entryDate <= endDate;
  });

  let weightChange: number | null = null;
  if (startWeight && endWeight) {
    weightChange = startWeight.weight - endWeight.weight; // Positive = lost weight
  }

  return {
    ...summary,
    weightChange
  };
}

/**
 * Format weight change with descriptive text
 */
export function formatWeightChange(change: number | null): string {
  if (change === null) {
    return 'No data';
  }

  const absChange = Math.abs(change);

  if (change > 0) {
    return `${absChange.toFixed(1)} kg lost`;
  } else if (change < 0) {
    return `${absChange.toFixed(1)} kg gained`;
  } else {
    return 'No change';
  }
}
