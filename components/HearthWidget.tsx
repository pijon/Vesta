import React from 'react';
import { GlassCard } from './GlassCard';

interface HearthWidgetProps {
    caloriesRemaining: number;
    caloriesTotal: number;
    caloriesGoal: number;
    waterLiters: number;
    waterGoal: number;
    fastingHours: number;
    fastingGoal: number;
    size?: 'sm' | 'md' | 'lg';
}

export const HearthWidget: React.FC<HearthWidgetProps> = ({
    caloriesRemaining,
    caloriesTotal,
    caloriesGoal,
    waterLiters,
    waterGoal,
    fastingHours,
    fastingGoal,
    size = 'lg' // Default to large as it was originally
}) => {
    // Calculate progress percentages (max 100)
    const calProgress = Math.min((caloriesTotal / caloriesGoal) * 100, 100);
    const waterProgress = Math.min((waterLiters / waterGoal) * 100, 100);
    const fastingProgress = Math.min((fastingHours / fastingGoal) * 100, 100);

    // Circumferences for circles (r=120, r=100, r=80)
    const CIRCLE_1 = 2 * Math.PI * 120; // ~754
    const CIRCLE_2 = 2 * Math.PI * 100; // ~628
    const CIRCLE_3 = 2 * Math.PI * 80;  // ~502

    const isSmall = size === 'sm';

    return (
        <GlassCard className={`relative flex flex-col items-center justify-center overflow-hidden ${isSmall ? 'p-4 min-h-[160px]' : 'py-12 px-4'}`}>

            <div className={`relative flex items-center justify-center ${isSmall ? 'w-32 h-32 mb-1' : 'w-72 h-72'}`}>
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 288 288">
                    <defs>
                        <linearGradient id="hearth-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" style={{ stopColor: 'var(--color-hearth)' }} />
                            <stop offset="100%" style={{ stopColor: 'var(--color-flame)' }} />
                        </linearGradient>
                    </defs>

                    {/* Track Backgrounds */}
                    <circle cx="144" cy="144" r="120" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-charcoal/5 dark:text-white/5" />
                    <circle cx="144" cy="144" r="100" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-charcoal/5 dark:text-white/5" />
                    <circle cx="144" cy="144" r="80" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-charcoal/5 dark:text-white/5" />

                    {/* Progress Rings */}
                    {/* Calories (Hearth) */}
                    <circle
                        cx="144" cy="144" r="120"
                        stroke="url(#hearth-grad)"
                        strokeWidth="14"
                        fill="transparent"
                        strokeDasharray={CIRCLE_1}
                        strokeDashoffset={CIRCLE_1 - (calProgress / 100) * CIRCLE_1}
                        strokeLinecap="round"
                        className="hearth-glow transition-all duration-1000 ease-out"
                    />

                    {/* Water (Ocean) */}
                    <circle
                        cx="144" cy="144" r="100"
                        stroke="currentColor"
                        strokeWidth="10"
                        fill="transparent"
                        strokeDasharray={CIRCLE_2}
                        strokeDashoffset={CIRCLE_2 - (waterProgress / 100) * CIRCLE_2}
                        strokeLinecap="round"
                        className="text-ocean transition-all duration-1000 ease-out delay-150"
                    />

                    {/* Fasting (Flame) */}
                    <circle
                        cx="144" cy="144" r="80"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray={CIRCLE_3}
                        strokeDashoffset={CIRCLE_3 - (fastingProgress / 100) * CIRCLE_3}
                        strokeLinecap="round"
                        className="text-flame transition-all duration-1000 ease-out delay-300"
                    />
                </svg>

                <div className="absolute flex flex-col items-center text-center">
                    {!isSmall && <span className="text-xs font-black text-charcoal/30 dark:text-stone-500 uppercase tracking-[0.2em] mb-1">Remaining</span>}
                    <span className={`${isSmall ? 'text-2xl' : 'text-6xl'} font-serif font-bold text-charcoal dark:text-stone-100`}>{Math.max(0, caloriesRemaining)}</span>
                    {isSmall && <span className="text-[8px] font-bold text-charcoal/40 dark:text-stone-500 uppercase">kcal</span>}
                </div>
            </div>

            {!isSmall && (
                <div className="mt-10 grid grid-cols-3 w-full gap-4 max-w-sm">
                    <div className="text-center">
                        <p className="text-[10px] font-black text-charcoal/40 dark:text-stone-500 uppercase mb-1">Calories</p>
                        <p className="font-serif text-lg text-charcoal dark:text-stone-200">{caloriesTotal}<span className="text-xs opacity-40">/{Math.round(caloriesGoal / 1000)}k</span></p>
                    </div>
                    <div className="text-center border-x border-charcoal/10 dark:border-white/10">
                        <p className="text-[10px] font-black text-charcoal/40 dark:text-stone-500 uppercase mb-1">Water</p>
                        <p className="font-serif text-lg text-ocean">{parseFloat(waterLiters.toFixed(2))}<span className="text-xs opacity-60">/{waterGoal}L</span></p>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] font-black text-charcoal/40 dark:text-stone-500 uppercase mb-1">Fasting</p>
                        <p className="font-serif text-lg text-hearth">{Math.round(fastingHours)}<span className="text-xs opacity-60">/{fastingGoal}h</span></p>
                    </div>
                </div>
            )}
        </GlassCard>
    );
};
