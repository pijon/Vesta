import React from 'react';
import { Flame, Plus } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';

interface CaloriesHeroProps {
    caloriesGoal: number;
    caloriesEaten: number;
    caloriesBurned: number;
    /** Share of workout calories added to the budget (Settings): 1, 0.5 or 0 */
    burnCredit?: number;
    isFastDay: boolean;
    onLogFood: () => void;
}

const fmt = (n: number) => Math.round(n).toLocaleString();

/**
 * The Today hero: calories left as one huge figure, a bar with a segment per
 * planned meal (the day's budget when fewer than two are planned), one line of detail and Log food.
 */
export const CaloriesHero: React.FC<CaloriesHeroProps> = ({
    caloriesGoal,
    caloriesEaten,
    caloriesBurned,
    burnCredit = 1,
    isFastDay,
    onLogFood,
}) => {
    const credited = Math.round(caloriesBurned * burnCredit);
    const budget = caloriesGoal + credited;
    const remaining = budget - caloriesEaten;
    const isOver = remaining < 0;
    const detail = [
        // The target as set, with any workout credit after it, so the sum reads at a glance
        `${fmt(caloriesEaten)} eaten of ${fmt(caloriesGoal)}`,
        ...(credited > 0 ? [`+${fmt(credited)} from exercise`] : []),
    ].join(' · ');

    return (
        <section className="hero flex flex-col gap-4 p-5 md:p-6" aria-label="Today's calories">
            <div className="flex items-center justify-between gap-3">
                <p className="text-[15px] font-bold">{isOver ? 'Over today' : 'Calories left'}</p>
                <p className="badge badge-ink">
                    {isFastDay && <Flame size={14} aria-hidden="true" />}
                    {isFastDay ? 'Fast day' : 'Nourish day'}
                </p>
            </div>

            <p className="font-display font-extrabold text-[80px] leading-[0.9] tracking-[-0.05em] tabular-nums">
                <AnimatedNumber value={Math.abs(remaining)} />
                <span className="sr-only"> kcal{isOver ? ' over' : ' left'}</span>
            </p>

            <div
                className="h-2.5 rounded-full bg-current/20 overflow-hidden"
                role="progressbar"
                aria-label="Calories eaten of today's budget"
                aria-valuemin={0}
                aria-valuemax={Math.round(budget)}
                aria-valuenow={Math.round(caloriesEaten)}
            >
                <div
                    className="h-full rounded-full bg-current transition-[width] duration-700 motion-reduce:transition-none"
                    style={{ width: `${Math.min(Math.max(budget > 0 ? caloriesEaten / budget : 0, 0), 1) * 100}%` }}
                />
            </div>

            {/* Full width on phones; from md the button sits beside the detail line */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <p className="text-sm font-medium tabular-nums">{detail}</p>

                {/* Ink on tomato in both modes (btn-primary's ink turns cream in dark mode) */}
                <button
                    onClick={onLogFood}
                    className="btn-base btn-block min-h-[52px] text-base hover:opacity-90 md:w-auto md:shrink-0 md:min-h-11 md:px-6"
                    style={{ background: 'var(--hero-foreground)', color: 'var(--hero)' }}
                >
                    <Plus size={20} strokeWidth={2.75} aria-hidden="true" /> Log food
                </button>
            </div>
        </section>
    );
};
