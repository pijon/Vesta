import React from 'react';
import { DailySummary, UserStats } from '../../types';
import { motion } from 'framer-motion';

interface WeeklyHabitPillarsProps {
    summaries: DailySummary[];
    stats: UserStats;
}

interface PillarConfig {
    title: string;
    icon: string;
    colorBg: string;
    colorBorder: string;
    colorText: string;
    colorDot: string;
    checkFn: (s: DailySummary | undefined) => boolean;
}

export const WeeklyHabitPillars: React.FC<WeeklyHabitPillarsProps> = ({ summaries, stats }) => {
    // Get last 7 days of data
    const getLast7Days = () => {
        const days = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const summary = summaries.find(s => s.date === dateStr);
            days.push({
                date: dateStr,
                dayName: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
                summary
            });
        }
        return days;
    };

    const weekData = getLast7Days();

    // Goals
    const calorieGoal = stats.dailyCalorieGoal || 800;
    const waterGoal = stats.dailyWaterGoal || 2000;
    const workoutGoal = stats.dailyWorkoutCountGoal ?? 1;

    // Pillar configurations using semantic color tokens
    const pillars: PillarConfig[] = [
        {
            title: 'Nutrition',
            icon: '🥗',
            // Using the semantic pattern: bg-[color]-500/10, text-[color]-600, border-[color]-500/20
            colorBg: 'bg-calories/10',
            colorBorder: 'border-calories/20',
            colorText: 'text-calories',
            colorDot: 'bg-calories',
            checkFn: (s) => !!s && s.caloriesConsumed <= calorieGoal && s.caloriesConsumed > 0
        },
        {
            title: 'Hydration',
            icon: '💧',
            colorBg: 'bg-water/10',
            colorBorder: 'border-water/20',
            colorText: 'text-water',
            colorDot: 'bg-water',
            checkFn: (s) => !!s && (s.waterIntake || 0) >= waterGoal
        },
        {
            title: 'Movement',
            icon: '🏃',
            colorBg: 'bg-workout/10',
            colorBorder: 'border-workout/20',
            colorText: 'text-workout',
            colorDot: 'bg-workout',
            checkFn: (s) => !!s && s.workoutCount >= workoutGoal
        }
    ];

    // Helper to render a pillar row
    const renderPillarRow = (config: PillarConfig) => (
        <div key={config.title} className="flex items-center justify-between py-4 border-b border-charcoal/10 dark:border-white/10 last:border-0">
            {/* Label - Using spacing heuristic: generous padding, tight icon-text gap */}
            <div className="flex items-center gap-2 w-28 md:w-36">
                <span className="text-base">{config.icon}</span>
                <span className={`text-sm font-normal ${config.colorText}`}>{config.title}</span>
            </div>

            {/* Day Indicators - Using 1rem (gap-4) between unrelated items, 0.5rem for tight grouping */}
            <div className="flex items-center gap-3 md:gap-4 flex-1 justify-end">
                {weekData.map((day, idx) => {
                    const isMet = config.checkFn(day.summary);
                    const isToday = idx === 6;

                    return (
                        <div key={day.date} className="flex flex-col items-center gap-1">
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: idx * 0.04 }}
                                className={`
                                    w-7 h-9 md:w-8 md:h-10 rounded-lg flex items-center justify-center
                                    border transition-colors
                                    ${!day.summary
                                        ? 'bg-stone-50 dark:bg-white/5 border-transparent'
                                        : isMet
                                            ? `${config.colorBg} ${config.colorBorder}`
                                            : 'bg-stone-50 dark:bg-white/5 border-transparent'
                                    }
                                `}
                            >
                                {isMet && (
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ delay: idx * 0.04 + 0.1, type: 'spring', stiffness: 300 }}
                                        className={`w-2.5 h-2.5 rounded-full ${config.colorDot}`}
                                    />
                                )}
                            </motion.div>
                            <span className={`text-[10px] ${isToday ? 'font-bold text-charcoal dark:text-stone-200' : 'text-charcoal/60 dark:text-stone-400'}`}>
                                {day.dayName}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div>
            {/* Header - Using generous padding (px-6 py-4) */}
            <div className="px-6 py-4 border-b border-charcoal/5 dark:border-white/5 flex justify-between items-center bg-transparent">
                <h3 className="font-serif font-normal text-lg text-charcoal dark:text-stone-200">Habit Pillars</h3>
                <span className="text-[10px] text-charcoal/60 dark:text-stone-400 uppercase tracking-wide">Last 7 Days</span>
            </div>

            {/* Content - Using generous padding (p-6) */}
            <div className="px-6 py-2">
                {pillars.map(renderPillarRow)}
            </div>
        </div>
    );
};
