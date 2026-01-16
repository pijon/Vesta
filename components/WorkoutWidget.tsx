import React from 'react';
import { WorkoutItem } from '../types';

interface WorkoutWidgetProps {
    workouts: WorkoutItem[];
    onLogWorkout: () => void;
}

export const WorkoutWidget: React.FC<WorkoutWidgetProps> = ({ workouts, onLogWorkout }) => {
    const caloriesBurned = workouts.reduce((sum, w) => sum + w.caloriesBurned, 0);
    const workoutCount = workouts.length;

    return (
        <div
            className="bg-surface p-6 rounded-3xl shadow-sm border border-border flex flex-col h-64 relative overflow-hidden group hover:shadow-md transition-all duration-500 cursor-pointer"
            onClick={onLogWorkout}
        >
            {/* Decorative gradient orb */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-orange-400/5 to-workout/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>

            {/* Header */}
            <div className="flex justify-between items-center mb-4 relative z-10">
                <p className="text-muted text-xs font-bold uppercase tracking-widest">Workouts</p>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-workout flex items-center justify-center text-white shadow-none dark:shadow-lg dark:shadow-workout/30">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.1 3A1.9 1.9 0 1 1 14 4.9 1.898 1.898 0 0 1 12.1 3zm2.568 4.893c.26-1.262-1.399-1.861-2.894-2.385L7.09 6.71l.577 4.154c0 .708 1.611.489 1.587-.049l-.39-2.71 2.628-.48-.998 4.92 3.602 4.179-1.469 4.463a.95.95 0 0 0 .39 1.294c.523.196 1.124-.207 1.486-.923.052-.104 1.904-5.127 1.904-5.127l-2.818-3.236 1.08-5.303zm-5.974 8.848l-3.234.528a1.033 1.033 0 0 0-.752 1.158c.035.539.737.88 1.315.802l3.36-.662 2.54-2.831-1.174-1.361zm8.605-7.74l-1.954.578-.374 1.837 2.865-.781a.881.881 0 0 0-.537-1.633z" />
                    </svg>
                </div>
            </div>

            {/* Content Area */}
            <div className="h-28 flex flex-col relative z-10">
                <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl lg:text-5xl font-bold bg-gradient-to-br from-neutral-800 to-neutral-600 dark:from-neutral-100 dark:to-neutral-400 bg-clip-text text-transparent font-serif tracking-tight leading-none">
                        {caloriesBurned}
                    </span>
                    <span className="text-muted font-semibold text-lg">kcal</span>
                </div>

                <div className="mt-auto h-8 flex items-center">
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-transparent shadow-sm ${workoutCount > 0 ? 'bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100 dark:border-orange-600' : 'bg-surface border-border text-muted'}`}>
                        <span className="text-[10px] font-bold">
                            {workoutCount > 0 ? `${workoutCount} active session${workoutCount !== 1 ? 's' : ''}` : 'No sessions yet'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Progress Bar (Visual indicator of activity) */}
            <div className="relative z-10 h-10 mt-auto">
                <div className="w-full bg-slate-100 dark:bg-white/10 h-2 rounded-full overflow-hidden shadow-inner mt-4">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-orange-500 to-workout shadow-none dark:shadow-lg dark:shadow-orange-500/30 transition-all duration-1000 ease-out"
                        style={{ width: `${Math.min(100, (caloriesBurned / 500) * 100)}%` }} // Arbitrary 500 cal target for visual
                    />
                </div>
                <div className="flex justify-between items-center text-xs text-muted font-semibold mt-1.5">
                    <span>{workoutCount > 0 ? 'Keep it up!' : 'Get moving'}</span>
                </div>
            </div>
        </div>
    );
};
