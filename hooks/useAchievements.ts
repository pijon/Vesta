import { useState, useEffect } from 'react';
import { DailyLog, FastingState, UserStats, DailyProgress } from '../types';
import { calculateDailyProgress, updateStreak } from '../services/achievementService';
import { saveUserStats } from '../services/storageService';
import { localDateString } from '../utils/dateUtils';

export const useAchievements = (
    log: DailyLog,
    fastingState: FastingState,
    stats: UserStats,
    onUpdateStats: (stats: UserStats) => void
) => {
    const [progress, setProgress] = useState<DailyProgress | null>(null);

    useEffect(() => {
        const today = localDateString();

        // 1. Calculate Progress
        const dailyProgress = calculateDailyProgress(log, fastingState, stats, today);
        setProgress(dailyProgress);

        // 2. Check Streak Updates (Side Effect)
        // Only run if stats loaded
        if (stats && stats.currentWeight !== 0) { // basic check if loaded
            const updatedStats = updateStreak(stats, dailyProgress, today);

            // Save if changed
            if (
                updatedStats.streaks?.currentStreak !== stats.streaks?.currentStreak ||
                updatedStats.streaks?.lastLogDate !== stats.streaks?.lastLogDate
            ) {
                onUpdateStats(updatedStats);
                saveUserStats(updatedStats);
            }
        }

    }, [log, fastingState, stats.dailyCalorieGoal, stats.dailyWaterGoal]); // Re-run when inputs change

    return { progress };
};
