import React from 'react';
import { UserStats, DailyLog, DayPlan } from '../types';

interface CompactStatsWidgetProps {
    stats: UserStats;
    dailyLog: DailyLog;
    todayPlan: DayPlan;
}

export const CompactStatsWidget: React.FC<CompactStatsWidgetProps> = ({ stats, dailyLog, todayPlan }) => {
    // Calculate key metrics
    const consumed = (dailyLog.items || []).reduce((sum, item) => sum + item.calories, 0);
    const caloriesBurned = (dailyLog.workouts || []).reduce((sum, w) => sum + w.caloriesBurned, 0);
    const isNonFastDay = todayPlan.type === 'non-fast';
    const dailyTarget = isNonFastDay ? (stats.nonFastDayCalories || 2000) : stats.dailyCalorieGoal;
    const caloriesLeft = dailyTarget - consumed;
    const hydration = dailyLog.waterIntake || 0;
    const hydrationGoal = stats.dailyWaterGoal || 2000;
    const workoutCount = (dailyLog.workouts || []).length;
    const startWeight = stats.weightHistory.length > 0 ? stats.weightHistory[0].weight : stats.currentWeight;


    return (
        <div className="bg-surface rounded-2xl shadow-sm border border-border p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-main font-serif">Today's Summary</h3>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border border-transparent ${isNonFastDay ? 'bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100 dark:border-orange-600' : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-600'}`}>
                    {isNonFastDay ? 'Non-Fast' : 'Fast Day'}
                </span>
            </div>

            {/* Compact Grid - 2x2 */}
            <div className="grid grid-cols-2 gap-4">
                {/* Calories Left */}
                <div className="bg-background/50 rounded-xl p-4 border border-border/50">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-calories flex items-center justify-center shadow-none dark:shadow-lg dark:shadow-calories/30">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2v20M2 12h20" />
                            </svg>
                        </div>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-wide">Calories</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className={`text-2xl font-bold font-serif ${caloriesLeft < 0 ? 'text-red-600 dark:text-red-400' : 'text-main'}`}>
                            {Math.abs(caloriesLeft)}
                        </span>
                        <span className="text-xs text-muted font-semibold">{caloriesLeft < 0 ? 'over' : 'left'}</span>
                    </div>
                    <div className="text-[10px] text-muted mt-1">{consumed} / {dailyTarget}</div>
                </div>

                {/* Weight */}
                <div className="bg-background/50 rounded-xl p-4 border border-border/50">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-weight flex items-center justify-center shadow-none dark:shadow-lg dark:shadow-weight/30">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m18 15-6-6-6 6" />
                            </svg>
                        </div>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-wide">Weight</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-main font-serif">{stats.currentWeight}</span>
                        <span className="text-xs text-muted font-semibold">kg</span>
                    </div>
                    <div className="text-[10px] text-muted mt-1">
                        {Math.abs(startWeight - stats.currentWeight).toFixed(1)}kg {startWeight >= stats.currentWeight ? 'lost' : 'gained'}
                    </div>

                </div>

                {/* Hydration */}
                <div className="bg-background/50 rounded-xl p-4 border border-border/50">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-500 to-water flex items-center justify-center shadow-none dark:shadow-lg dark:shadow-water/30">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                            </svg>
                        </div>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-wide">Water</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-main font-serif">{hydration}</span>
                        <span className="text-xs text-muted font-semibold">ml</span>
                    </div>
                    <div className="text-[10px] text-muted mt-1">{Math.round((hydration / hydrationGoal) * 100)}% of {hydrationGoal}ml</div>
                </div>

                {/* Workouts */}
                <div className="bg-background/50 rounded-xl p-4 border border-border/50">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-500 to-workout flex items-center justify-center shadow-none dark:shadow-lg dark:shadow-workout/30">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12.1 3A1.9 1.9 0 1 1 14 4.9 1.898 1.898 0 0 1 12.1 3zm2.568 4.893c.26-1.262-1.399-1.861-2.894-2.385L7.09 6.71l.577 4.154c0 .708 1.611.489 1.587-.049l-.39-2.71 2.628-.48-.998 4.92 3.602 4.179-1.469 4.463a.95.95 0 0 0 .39 1.294c.523.196 1.124-.207 1.486-.923.052-.104 1.904-5.127 1.904-5.127l-2.818-3.236 1.08-5.303zm-5.974 8.848l-3.234.528a1.033 1.033 0 0 0-.752 1.158c.035.539.737.88 1.315.802l3.36-.662 2.54-2.831-1.174-1.361zm8.605-7.74l-1.954.578-.374 1.837 2.865-.781a.881.881 0 0 0-.537-1.633z" />
                            </svg>
                        </div>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-wide">Active</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-main font-serif">{caloriesBurned}</span>
                        <span className="text-xs text-muted font-semibold">kcal</span>
                    </div>
                    <div className="text-[10px] text-muted mt-1">
                        {Math.round((caloriesBurned / (stats.dailyWorkoutCalorieGoal || 400)) * 100)}% of {stats.dailyWorkoutCalorieGoal || 400}kcal
                    </div>
                </div>
            </div>
        </div>
    );
};
