import React from 'react';
import { WorkoutItem } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { TrophyIcon } from './TrophyIcon';

interface WorkoutWidgetProps {
    workouts: WorkoutItem[];
    dailyCountGoal: number;
    onLogWorkout: () => void;
}

export const WorkoutWidget: React.FC<WorkoutWidgetProps> = ({ workouts, dailyCountGoal = 1, onLogWorkout }) => {
    const caloriesBurned = workouts.reduce((sum, w) => sum + w.caloriesBurned, 0);
    const workoutCount = workouts.length;
    const progressPercent = Math.min(100, (workoutCount / dailyCountGoal) * 100);
    const isGoalMet = workoutCount >= dailyCountGoal && dailyCountGoal > 0;

    return (
        <div
            className="group bg-surface rounded-2xl shadow-sm border border-workout-border overflow-hidden hover:shadow-md transition-all cursor-pointer h-full flex flex-col"
            onClick={onLogWorkout}
        >
            {/* Header */}
            <div className="p-6 border-b border-workout-border bg-workout-bg/50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--workout)' }}>
                        <path d="M12.1 3A1.9 1.9 0 1 1 14 4.9 1.898 1.898 0 0 1 12.1 3zm2.568 4.893c.26-1.262-1.399-1.861-2.894-2.385L7.09 6.71l.577 4.154c0 .708 1.611.489 1.587-.049l-.39-2.71 2.628-.48-.998 4.92 3.602 4.179-1.469 4.463a.95.95 0 0 0 .39 1.294c.523.196 1.124-.207 1.486-.923.052-.104 1.904-5.127 1.904-5.127l-2.818-3.236 1.08-5.303zm-5.974 8.848l-3.234.528a1.033 1.033 0 0 0-.752 1.158c.035.539.737.88 1.315.802l3.36-.662 2.54-2.831-1.174-1.361zm8.605-7.74l-1.954.578-.374 1.837 2.865-.781a.881.881 0 0 0-.537-1.633z" />
                    </svg>
                    <h3 className="font-medium text-lg font-serif" style={{ color: 'var(--workout)' }}>Workouts</h3>
                </div>
                {/* Checkmark if goal reached */}
                {workoutCount >= dailyCountGoal ? (
                    <div className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 p-1 rounded-full animate-fade-in">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                ) : (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--workout)' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="p-6 flex flex-col flex-1 relative">
                <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl lg:text-5xl font-bold font-serif tracking-tight leading-none" style={{ color: 'var(--text-main)' }}>
                        {workoutCount}
                    </span>
                    <span className="text-muted font-semibold text-lg">/ {dailyCountGoal} sessions</span>
                </div>

                {/* Secondary Info: Active Calories & Goal Status */}
                <div className="mt-auto h-8 flex items-center gap-2">
                    {caloriesBurned > 0 && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md dark:bg-purple-900/40 dark:text-purple-100" style={{ color: 'var(--workout)', backgroundColor: 'var(--workout-bg)' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.1.2-2.2.6-3.3.4 1.8 1.4 2.8 2.9 3.3z"></path>
                            </svg>
                            <span className="text-[10px] font-bold">
                                {caloriesBurned} kcal
                            </span>
                        </div>
                    )}

                    {isGoalMet && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md dark:bg-purple-900/40 dark:text-purple-100 animate-fade-in" style={{ color: 'var(--workout)', backgroundColor: 'var(--workout-bg)' }}>
                            <TrophyIcon className="w-3 h-3 shrink-0" />
                            <span className="text-[10px] font-bold uppercase tracking-wide">Goal Hit</span>
                        </div>
                    )}

                    {caloriesBurned === 0 && !isGoalMet && (
                        <span className="text-xs text-muted">No active calories yet</span>
                    )}
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                    <div className="w-full bg-slate-100 dark:bg-white/10 h-2 rounded-full overflow-hidden shadow-inner">
                        <motion.div
                            className="h-full rounded-full shadow-none dark:shadow-lg dark:shadow-purple-500/30"
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercent}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            style={{
                                backgroundColor: 'var(--workout)'
                            }}
                        />
                    </div>
                    <div className="flex justify-between items-center mt-1.5 h-6">
                        <span className="text-xs text-muted font-semibold">
                            {isGoalMet
                                ? 'Target reached!'
                                : `${dailyCountGoal - workoutCount} session${dailyCountGoal - workoutCount !== 1 ? 's' : ''} left`
                            }
                        </span>
                    </div>
                </div>

                {/* Hover Action Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onLogWorkout();
                    }}
                    className="absolute bottom-6 left-6 right-6 py-2.5 text-white font-bold rounded-xl transition-all shadow-lg opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2"
                    style={{ backgroundColor: 'var(--workout)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--workout-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--workout)'}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                    </svg>
                    Log Workout
                </button>
            </div>
        </div>
    );
};
