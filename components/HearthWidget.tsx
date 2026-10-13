import React from 'react';
import { Check, Flame, Plus } from 'lucide-react';
import { Recipe } from '../types';
import { mealKcalLabel, slotFor, slotLabel } from '../utils/planUtils';

interface HearthWidgetProps {
    /** Today's calorie target (depends on fast or nourish day) */
    caloriesGoal: number;
    caloriesEaten: number;
    caloriesBurned: number;
    /** Share of workout calories added to the budget (Settings): 1, 0.5 or 0 */
    burnCredit?: number;
    isFastDay: boolean;
    /** Protein eaten today (from items with a known amount) and the daily target, in grams */
    protein?: { eaten: number; target: number };
    onLogFood: () => void;
    /** The next planned meal not yet eaten, with one tap to tick it off */
    nextMeal?: { meal: Recipe; onAte: () => void; onView: () => void };
    size?: 'sm' | 'md' | 'lg';
}

const fmt = (n: number) => Math.round(n).toLocaleString();

/**
 * The Today hero: the screen's one solid primary block. Calories left, how that number is made
 * up (target − eaten + workout calories, as much as Settings adds back), the day type, the next planned meal and the main action: log food.
 */
export const HearthWidget: React.FC<HearthWidgetProps> = ({
    caloriesGoal,
    caloriesEaten,
    caloriesBurned,
    burnCredit = 1,
    isFastDay,
    protein,
    onLogFood,
    nextMeal,
    size = 'lg',
}) => {
    const credited = Math.round(caloriesBurned * burnCredit);
    const remaining = caloriesGoal - caloriesEaten + credited;
    const isOver = remaining < 0;
    const net = caloriesEaten - credited;
    const burnedPart = caloriesBurned <= 0 ? ''
        : burnCredit >= 1 ? ` + ${fmt(caloriesBurned)} burned`
        : burnCredit > 0 ? ` + ${fmt(credited)} (half of ${fmt(caloriesBurned)} burned)`
        : ` · ${fmt(caloriesBurned)} burned, not added`;
    const progress = caloriesGoal > 0 ? Math.min(Math.max(net / caloriesGoal, 0), 1) : 0;

    const ringSize = size === 'sm' ? 56 : 72;
    const stroke = size === 'sm' ? 7 : 8;
    const radius = (ringSize - stroke) / 2;
    const circumference = 2 * Math.PI * radius;

    return (
        <section className={`hero ${size === 'sm' ? 'px-5 py-4' : 'px-5 py-5 md:px-6 md:py-6'}`} aria-label="Calories today">
            <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
                        {isOver ? 'Over today' : 'Calories left'}
                        <span className="inline-flex items-center gap-1 rounded-full bg-ink/15 px-2 py-0.5 text-xs">
                            {isFastDay && <Flame size={12} aria-hidden="true" />}
                            {isFastDay ? 'Fast day' : 'Nourish day'}
                        </span>
                    </p>
                    <p className={`${size === 'sm' ? 'text-4xl' : 'text-5xl'} font-display font-extrabold tracking-tight leading-tight`}>
                        {fmt(Math.abs(remaining))}<span className="text-lg font-bold"> kcal{isOver ? ' over' : ''}</span>
                    </p>
                    <p className="text-sm">
                        {fmt(caloriesGoal)} target − {fmt(caloriesEaten)} eaten{burnedPart}
                    </p>
                </div>

                <svg
                    width={ringSize}
                    height={ringSize}
                    className="shrink-0 -rotate-90"
                    role="img"
                    aria-label={`${Math.round(progress * 100)}% of today's calories used`}
                >
                    <circle
                        cx={ringSize / 2} cy={ringSize / 2} r={radius}
                        fill="none" strokeWidth={stroke}
                        stroke="currentColor" strokeOpacity={0.3}
                    />
                    <circle
                        cx={ringSize / 2} cy={ringSize / 2} r={radius}
                        fill="none" strokeWidth={stroke} strokeLinecap="round"
                        stroke="currentColor"
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference * (1 - progress)}
                        style={{ '--ring-empty': circumference } as React.CSSProperties}
                        className="ring-fill transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none"
                    />
                </svg>
            </div>

            <div className="flex items-center gap-4 mt-4">
                <button onClick={onLogFood} className="btn-primary btn-sm shrink-0">
                    <Plus size={16} aria-hidden="true" /> Log food
                </button>
                {protein && (
                    <div className="flex-1 min-w-0 max-w-56 ml-auto">
                        <p className="flex justify-between gap-2 text-sm">
                            <span className="font-semibold">Protein</span>
                            <span>{fmt(protein.eaten)} of {fmt(protein.target)} g</span>
                        </p>
                        <div
                            className="mt-1 h-1.5 rounded-full bg-current/20 overflow-hidden"
                            role="progressbar"
                            aria-label="Protein today"
                            aria-valuemin={0}
                            aria-valuemax={protein.target}
                            aria-valuenow={Math.round(protein.eaten)}
                        >
                            <div className="h-full rounded-full bg-current transition-[width] duration-700" style={{ width: `${Math.min(protein.eaten / Math.max(protein.target, 1), 1) * 100}%` }} />
                        </div>
                    </div>
                )}
            </div>

            {nextMeal && (
                <div className="flex items-center gap-3 mt-4 pt-3 border-t border-current/20">
                    <button
                        onClick={nextMeal.onView}
                        className="flex-1 min-w-0 text-left rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                        aria-label={`View recipe: ${nextMeal.meal.name}`}
                    >
                        <span className="block text-xs font-semibold">Next up · {slotLabel(slotFor(nextMeal.meal))} · {mealKcalLabel(nextMeal.meal)}</span>
                        <span className="block font-semibold truncate">{nextMeal.meal.name}</span>
                    </button>
                    <button
                        onClick={nextMeal.onAte}
                        className="hit-target shrink-0 inline-flex items-center gap-1.5 min-h-9 px-3 rounded-full bg-ink/15 hover:bg-ink/25 text-sm font-semibold transition-colors active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                        aria-label={`Mark ${nextMeal.meal.name} as eaten`}
                    >
                        <Check size={16} strokeWidth={3} aria-hidden="true" /> Ate it
                    </button>
                </div>
            )}
        </section>
    );
};
