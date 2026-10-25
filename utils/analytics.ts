import { DailySummary } from '../types';
import { localDateString, parseLocalDate } from './dateUtils';

export interface StreakAnalysis {
  currentStreak: number; // Days
  longestStreak: number;
  totalCompliantDays: number;
  complianceRate: number; // Percentage
  lastStreakEndDate: string | null;
}

/**
 * Calculate activity streak (days with ANY workout or > 0 calories burned)
 */
export function analyzeActivityStreaks(summaries: DailySummary[]): StreakAnalysis {
  if (summaries.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalCompliantDays: 0,
      complianceRate: 0,
      lastStreakEndDate: null
    };
  }

  // Map all active dates for O(1) lookup
  const activityMap = new Map<string, boolean>();
  let totalActiveDays = 0;
  // Days marked unwell pause the streak: they neither count nor break it
  const unwell = new Set(summaries.filter(s => s.unwell).map(s => s.date));

  summaries.forEach(s => {
    if (s.caloriesBurned > 0 || s.workoutCount > 0) {
      activityMap.set(s.date, true);
      totalActiveDays++;
    }
  });

  // Calculate Current Streak
  // Logic: Streak includes today if active. If not, it continues from yesterday.
  let currentStreak = 0;
  let d = new Date();
  let dStr = localDateString(d);

  // 1. Check Today
  if (activityMap.get(dStr)) {
    currentStreak++;
  }

  // 2. Check Backwards from Yesterday
  d.setDate(d.getDate() - 1); // Move to yesterday

  while (true) {
    dStr = localDateString(d);
    if (activityMap.get(dStr)) {
      currentStreak++;
      d.setDate(d.getDate() - 1);
    } else if (unwell.has(dStr)) {
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  // Calculate Longest Streak
  // Iterate through the full date range of the summaries to handle gaps correctly
  let longestStreak = 0;

  if (summaries.length > 0) {
    // Sort logic to find range
    const sorted = [...summaries].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const startDate = parseLocalDate(sorted[0].date);
    const endDate = parseLocalDate(sorted[sorted.length - 1].date);

    // We scan from start to end (or end to start, doesn't matter for max)
    let tempStreak = 0;
    const scanner = new Date(startDate);

    while (scanner <= endDate) {
      const s = localDateString(scanner);
      if (activityMap.get(s)) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else if (!unwell.has(s)) {
        tempStreak = 0;
      }
      scanner.setDate(scanner.getDate() + 1);
    }

    // Edge case: Note that 'longest streak' based on summaries might be limited 
    // if summaries has gaps where data just doesn't exist (not loaded). 
    // But within loaded data, this is accurate.
  }

  return {
    currentStreak,
    longestStreak,
    totalCompliantDays: totalActiveDays,
    complianceRate: (totalActiveDays / summaries.length) * 100,
    lastStreakEndDate: null // TODO: Calculate if needed
  };
}
