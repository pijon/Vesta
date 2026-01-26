import { DailyLog, FastingState, UserStats, DailyProgress } from '../types';

/**
 * Calculates the progress for the 3 daily rings: Calories, Water, Fasting.
 */
export const calculateDailyProgress = (
    log: DailyLog,
    fastingState: FastingState,
    stats: UserStats,
    todayDate: string
): DailyProgress => {
    // 1. Calories (Goal is a CEILING)
    // "Consumed" vs "Goal". 
    // If 5:2 fasting day logic is needed, we'd need that context, but assuming 'dailyCalorieGoal' is correct for today.
    const consumed = log.items.reduce((sum, item) => sum + item.calories, 0);
    const calorieGoal = stats.dailyCalorieGoal || 2000;

    let calorieStatus: 'under' | 'perfect' | 'over' = 'under';
    const caloriePercentage = (consumed / calorieGoal) * 100;

    if (consumed > calorieGoal) {
        calorieStatus = 'over';
    } else if (caloriePercentage >= 90) {
        // 90-100% is considered "Perfectly hit the target" without going over? 
        // OR is it just "Under is good"? 
        // User Plan: "Green: 0% -> 100% (Under or Equal to Goal). Red: >100%".
        // Let's treat anything <= 100% as "Good". 
        // But for "Perfect Day", we usually want them to eat *enough* but not too much.
        // For simplicity V1: Under or Equal is GOOD.
        calorieStatus = 'perfect';
    } else {
        // If they barely ate, is it perfect? Maybe. Let's assume yes for weight loss context.
        // Actually, let's keep it simple: <= Goal is SUCCESS.
        calorieStatus = 'perfect';
    }

    // Explicit override: If consumed > goal, it's OVER.
    if (consumed > calorieGoal) calorieStatus = 'over';

    // 2. Water (Goal is a FLOOR)
    const waterIntake = log.waterIntake || 0;
    const waterGoal = stats.dailyWaterGoal || 2000;
    const waterMet = waterIntake >= waterGoal;

    // 3. Fasting (Goal is a TARGET)
    // We check if they have a COMPLETED fast ending today that met the target
    // OR if their CURRENT active fast has already exceeded the target.
    const targetHours = fastingState.config.targetFastHours || 16;
    let fastingHours = 0;

    // Check active fast
    if (fastingState.lastAteTime) {
        const now = Date.now();
        const diffHours = (now - fastingState.lastAteTime) / (1000 * 60 * 60);
        if (diffHours > fastingHours) fastingHours = diffHours;
    }

    // Check completed fasts for today
    if (log.maxFastingHours && log.maxFastingHours > fastingHours) {
        fastingHours = log.maxFastingHours;
    }

    // Note: This logic assumes if you are currently fasting > 16h OR have completed a fast > 16h today, you win.
    const fastingMet = fastingHours >= targetHours;

    return {
        calories: {
            current: consumed,
            target: calorieGoal,
            status: calorieStatus
        },
        water: {
            current: waterIntake,
            target: waterGoal,
            isMet: waterMet
        },
        fasting: {
            hours: fastingHours,
            target: targetHours,
            isMet: fastingMet
        },
        isPerfectDay: calorieStatus !== 'over' && waterMet && fastingMet
    };
};

/**
 * Checks and updates the user's streak based on yesterday/today's performance.
 * Should be called once on app load or when returning to foreground.
 */
export const updateStreak = (
    stats: UserStats,
    dailyProgress: DailyProgress,
    todayDate: string
): UserStats => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Helper to update a single streak category
    const updateCategory = (
        current: { current: number; best: number; lastLogDate: string } | undefined,
        isSuccess: boolean
    ) => {
        const streak = current || { current: 0, best: 0, lastLogDate: '' };

        // Gap detection: If last log was older than yesterday, reset
        if (streak.lastLogDate && streak.lastLogDate !== todayDate && streak.lastLogDate !== yesterdayStr) {
            streak.current = 0;
        }

        if (isSuccess) {
            if (streak.lastLogDate !== todayDate) {
                streak.current += 1;
                streak.lastLogDate = todayDate;
                if (streak.current > streak.best) streak.best = streak.current;
            }
        } else {
            // If today is NOT a success, and we previously marked it as one (same date), decrement
            if (streak.lastLogDate === todayDate) {
                streak.current = Math.max(0, streak.current - 1);
                // We don't revert date, effectively "pausing" or "breaking" it for today.
            }
        }
        return streak;
    };

    // Initialize or copy streaks
    const streaks = {
        currentStreak: stats.streaks?.currentStreak || 0,
        bestStreak: stats.streaks?.bestStreak || 0,
        lastLogDate: stats.streaks?.lastLogDate || '',
        perfectDaysCount: stats.streaks?.perfectDaysCount || 0,
        calories: stats.streaks?.calories || { current: 0, best: 0, lastLogDate: '' },
        water: stats.streaks?.water || { current: 0, best: 0, lastLogDate: '' },
        fasting: stats.streaks?.fasting || { current: 0, best: 0, lastLogDate: '' },
    };

    let newStats = { ...stats, streaks };

    // 1. Global Perfect Day Streak
    // Logic: Gap check
    if (streaks.lastLogDate && streaks.lastLogDate !== todayDate && streaks.lastLogDate !== yesterdayStr) {
        newStats.streaks.currentStreak = 0;
    }

    if (dailyProgress.isPerfectDay) {
        if (streaks.lastLogDate !== todayDate) {
            newStats.streaks.currentStreak += 1;
            newStats.streaks.perfectDaysCount += 1;
            newStats.streaks.lastLogDate = todayDate;
            if (newStats.streaks.currentStreak > newStats.streaks.bestStreak) {
                newStats.streaks.bestStreak = newStats.streaks.currentStreak;
            }
        }
    } else {
        if (streaks.lastLogDate === todayDate) {
            newStats.streaks.currentStreak = Math.max(0, newStats.streaks.currentStreak - 1);
            newStats.streaks.perfectDaysCount = Math.max(0, newStats.streaks.perfectDaysCount - 1);
        }
    }

    // 2. Category Streaks
    newStats.streaks.calories = updateCategory(streaks.calories, dailyProgress.calories.status === 'perfect'); // perfect/under is success
    newStats.streaks.water = updateCategory(streaks.water, dailyProgress.water.isMet);
    newStats.streaks.fasting = updateCategory(streaks.fasting, dailyProgress.fasting.isMet);

    return newStats;
};
