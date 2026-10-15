import React from 'react';
import { DailySummary, WorkoutItem } from '../types';
import { Sheet } from './Sheet';
import { StreakFlame } from './StreakFlame';
import { localDateString, parseLocalDate } from '../utils/dateUtils';
import { workoutIconFor } from '../utils/workoutVisual';
import { useDevMode } from '../contexts/DevModeContext';

interface WorkoutOverviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    // Merged history including today's live data
    history: DailySummary[];
    // Today's specific workouts for detailed view
    todayWorkouts: WorkoutItem[];
    streak: number;
}

const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** Today's workouts in detail, then earlier active days. Opened from the Workouts tile. */
export const WorkoutOverviewModal: React.FC<WorkoutOverviewModalProps> = ({
    isOpen,
    onClose,
    history,
    todayWorkouts,
    streak
}) => {
    const market = useDevMode().isFeatureEnabled('marketTheme');
    if (!isOpen) return null;

    const totalWorkouts = history.reduce((acc, day) => acc + day.workoutCount, 0);
    const totalCalories = history.reduce((acc, day) => acc + day.caloriesBurned, 0);
    const today = localDateString();
    // Earlier days with any activity (today is shown in detail above)
    const activeDays = history.filter(day => day.date !== today && (day.workoutCount > 0 || day.caloriesBurned > 0));

    return (
        <Sheet
            title="Workouts"
            subtitle={`${totalWorkouts} ${totalWorkouts === 1 ? 'workout' : 'workouts'} · ${totalCalories.toLocaleString()} kcal burned`}
            onClose={onClose}
        >
            {streak > 1 && (
                <div className="tile tile-workout flex-row items-center gap-3 !py-3 mb-5">
                    <StreakFlame className="w-6 h-6 shrink-0" isActive={todayWorkouts.length > 0} />
                    <div>
                        <p className="font-semibold">{streak}-day streak</p>
                        <p className="text-sm">A workout a day keeps it going.</p>
                    </div>
                </div>
            )}

            {todayWorkouts.length > 0 && (
                <section className="mb-5">
                    <h3 className={market ? 'heading-3 mb-2' : 'font-sans text-sm font-semibold text-muted mb-2'}>Today</h3>
                    <ul className="space-y-2">
                        {todayWorkouts.map((workout) => {
                            const Icon = workoutIconFor(workout.type);
                            return (
                                <li key={workout.id} className="flex items-center gap-3 p-3 rounded-[14px] bg-surface-sunken">
                                    <span className={`size-10 shrink-0 bg-workout-bg text-workout-text flex items-center justify-center ${market ? 'rounded-full' : 'rounded-[12px]'}`}>
                                        <Icon size={22} stroke={1.75} aria-hidden="true" />
                                    </span>
                                    <span className="flex-1 min-w-0">
                                        <span className="block font-semibold truncate">{workout.type}</span>
                                        <span className="block text-xs text-muted">{formatTime(workout.timestamp)}</span>
                                    </span>
                                    <span className="shrink-0 text-right font-display font-extrabold text-lg leading-6 text-workout-text">
                                        −{workout.caloriesBurned}
                                        <span className="block font-sans text-[11px] font-semibold text-muted leading-3">kcal</span>
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            )}

            <section>
                <h3 className={market ? 'heading-3 mb-2' : 'font-sans text-sm font-semibold text-muted mb-2'}>Earlier</h3>
                {activeDays.length === 0 ? (
                    <p className="text-sm text-muted py-6 text-center">No earlier workouts yet.</p>
                ) : (
                    <ul>
                        {activeDays.map((summary) => {
                            const date = parseLocalDate(summary.date);
                            return (
                                <li key={summary.date} className="flex items-center gap-3 py-2.5 border-t border-border first:border-t-0">
                                    <span className={`size-10 shrink-0 bg-surface-sunken flex flex-col items-center justify-center leading-none ${market ? 'rounded-full' : 'rounded-[12px]'}`}>
                                        <span className="text-[11px] font-semibold text-muted">{date.toLocaleDateString(undefined, { month: 'short' })}</span>
                                        <span className="text-sm font-bold mt-0.5">{date.getDate()}</span>
                                    </span>
                                    <span className="flex-1 min-w-0 font-semibold truncate">
                                        {summary.workoutTypes && summary.workoutTypes.length > 0
                                            ? summary.workoutTypes.join(', ')
                                            : `${summary.workoutCount} ${summary.workoutCount === 1 ? 'workout' : 'workouts'}`}
                                    </span>
                                    <span className="shrink-0 font-display font-extrabold">
                                        {summary.caloriesBurned}<span className="font-sans text-xs font-semibold text-muted"> kcal</span>
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </Sheet>
    );
};
