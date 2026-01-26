import React from 'react';
import { WorkoutItem } from '../types';
import { motion } from 'framer-motion';
import { ProgressRing } from './achievements/ProgressRing';

interface WorkoutWidgetProps {
    workouts: WorkoutItem[];
    dailyCountGoal: number;
    onLogWorkout: () => void;
}

export const WorkoutWidget: React.FC<WorkoutWidgetProps> = ({ workouts, dailyCountGoal = 1, onLogWorkout }) => {
    const caloriesBurned = workouts.reduce((sum, w) => sum + w.caloriesBurned, 0);
    const workoutCount = workouts.length;
    const progressPercent = Math.min(100, (workoutCount / dailyCountGoal) * 100);

    return (
        <div
            className="group bg-[var(--card-bg)] rounded-organic-md shadow-sm border border-border/50 overflow-hidden hover:shadow-md transition-all cursor-pointer h-full flex flex-col relative"
            onClick={onLogWorkout}
        >
            {/* Header */}
            <div className="px-6 py-4 border-b border-border/30 flex items-center justify-between shrink-0 h-[60px]">
                <h3 className="font-serif text-lg font-medium text-charcoal dark:text-stone-200">Workouts</h3>
                {/* Badge - Increased contrast: text-purple-800 */}

            </div>

            {/* Content Body */}
            <div className="flex-1 flex flex-col items-center justify-center p-4 z-10 gap-2">
                <div className="relative">
                    <ProgressRing
                        progress={progressPercent}
                        size={140}
                        strokeWidth={12}
                        gradientId="workout_bento_grad"
                        gradientColors={['var(--workout)', 'var(--workout)']} // Semantic Plum
                        trackColor="var(--workout-border)"
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-1">
                        <span className="text-3xl font-bold font-sans leading-none text-workout">
                            {workoutCount}
                        </span>
                        <span className="text-xs font-semibold text-charcoal/60 dark:text-stone-400 uppercase tracking-wide mt-1">
                            Session{workoutCount !== 1 ? 's' : ''}
                        </span>
                    </div>
                </div>

                {/* Secondary Info */}
                <div className="h-6 flex items-center justify-center">
                    {caloriesBurned > 0 ? (
                        <span className="text-sm font-bold text-workout flex items-center gap-1">
                            🔥 {caloriesBurned} kcal
                        </span>
                    ) : (
                        <span className="text-xs text-charcoal/60 dark:text-stone-400">No activity yet</span>
                    )}
                </div>
            </div>

            {/* Action Button */}
            <div className="p-4 z-10 mt-auto">
                <button className="w-full py-2.5 rounded-xl bg-workout text-white font-bold text-sm shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Log Workout
                </button>
            </div>
        </div>
    );
};
