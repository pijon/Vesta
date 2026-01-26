import { DailySummary } from '../types';
import { getFastingHistory, getUserStats, getAllDailySummaries } from './storageService';

export interface AnalyticsDataPoint {
    date: string;
    weight: number | null;
    fastingHours: number | null;
    calories: number | null;
    caloriesBurned: number | null;
}

export const getAnalyticsData = async (): Promise<AnalyticsDataPoint[]> => {
    const [stats, fastingHistory, dailySummaries] = await Promise.all([
        getUserStats(),
        getFastingHistory(),
        getAllDailySummaries()
    ]);

    const dataMap = new Map<string, AnalyticsDataPoint>();

    // 1. Populate with Weight History
    (stats.weightHistory || []).forEach(entry => {
        dataMap.set(entry.date, {
            date: entry.date,
            weight: entry.weight,
            fastingHours: null,
            calories: null,
            caloriesBurned: null
        });
    });

    // 2. Merge Fasting History
    fastingHistory.forEach(entry => {
        // Fasting entries happen at a specific timestamp. We'll attribute it to the "End Time" date.
        const date = new Date(entry.endTime).toISOString().split('T')[0];

        const existing = dataMap.get(date) || {
            date,
            weight: null,
            fastingHours: 0,
            calories: null,
            caloriesBurned: null
        };

        // If multiple fasts end on same day (rare but possible), sum them up
        existing.fastingHours = (existing.fastingHours || 0) + entry.durationHours;
        dataMap.set(date, existing);
    });

    // 3. Merge Calories
    dailySummaries.forEach(summary => {
        const existing = dataMap.get(summary.date) || {
            date: summary.date,
            weight: null,
            fastingHours: null,
            calories: 0,
            caloriesBurned: 0
        };
        existing.calories = summary.caloriesConsumed;
        existing.caloriesBurned = summary.caloriesBurned;
        dataMap.set(summary.date, existing);
    });

    // Convert to array and sort
    return Array.from(dataMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

export const getGoalProjection = async (): Promise<{ daysRemaining: number, projectedDate: string } | null> => {
    const stats = await getUserStats();
    const history = stats.weightHistory || [];

    if (history.length < 2) return null;

    // Use last 14 days for projection to keep it relevant
    const recentHistory = history.slice(-14);
    if (recentHistory.length < 2) return null;

    const first = recentHistory[0];
    const last = recentHistory[recentHistory.length - 1];

    const daysDiff = (new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff === 0) return null;

    const weightDiff = last.weight - first.weight;
    const ratePerDay = weightDiff / daysDiff; // kg per day

    if (ratePerDay >= 0) return null; // Not losing weight

    const remainingWeight = last.weight - stats.goalWeight;
    if (remainingWeight <= 0) return { daysRemaining: 0, projectedDate: new Date().toISOString().split('T')[0] };

    const daysRemaining = Math.ceil(remainingWeight / Math.abs(ratePerDay));

    const projectedDateObj = new Date();
    projectedDateObj.setDate(projectedDateObj.getDate() + daysRemaining);

    return {
        daysRemaining,
        projectedDate: projectedDateObj.toISOString().split('T')[0]
    };
};
