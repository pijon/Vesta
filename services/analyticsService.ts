import { DailySummary } from '../types';
import { getFastingHistory, getUserStats, getDailySummaries } from './storageService';
import { calculateRegressionLine } from '../utils/analytics';

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
        getDailySummaries()
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

export const getGoalProjection = async (): Promise<{ daysRemaining: number, projectedDate: string, ratePerWeek: number } | null> => {
    const stats = await getUserStats();
    const history = stats.weightHistory || [];

    if (history.length < 3) return null;

    // Use last 30 days for projection to keep it relevant but stable
    // Mirroring logic in analyzeWeightTrends
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sortedHistory = [...history].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let recentHistory = sortedHistory.filter(entry => new Date(entry.date) >= thirtyDaysAgo);

    if (recentHistory.length < 3) {
        recentHistory = sortedHistory; // Fallback to full history
    }

    if (recentHistory.length < 3) return null;

    const { slope } = calculateRegressionLine(recentHistory);

    // slope is kg/day. Negative slope = losing weight.
    // If slope >= 0, we are not losing weight.
    if (slope >= 0) return null;

    const ratePerDay = Math.abs(slope);
    const remainingWeight = stats.currentWeight - stats.goalWeight;

    if (remainingWeight <= 0) {
        return {
            daysRemaining: 0,
            projectedDate: new Date().toISOString().split('T')[0],
            ratePerWeek: ratePerDay * 7
        };
    }

    const daysRemaining = Math.ceil(remainingWeight / ratePerDay);

    const projectedDateObj = new Date();
    projectedDateObj.setDate(projectedDateObj.getDate() + daysRemaining);

    return {
        daysRemaining,
        projectedDate: projectedDateObj.toISOString().split('T')[0],
        ratePerWeek: ratePerDay * 7
    };
};
