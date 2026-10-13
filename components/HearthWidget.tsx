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
}

const fmt = (n: number) => Math.round(n).toLocaleString();

/** Bar that fills as the day's budget is used (0–1) */
const Bar: React.FC<{ value: number; label: string; now: number; max: number }> = ({ value, label, now, max }) => (
    <div
        className="mt-3 h-2 rounded-full bg-current/20 overflow-hidden"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Math.round(max)}
        aria-valuenow={Math.round(now)}
    >
        <div
            className="h-full rounded-full bg-current transition-[width] duration-700 motion-reduce:transition-none"
            style={{ width: `${Math.min(Math.max(value, 0), 1) * 100}%` }}
        />
    </div>
);

/** Labelled figures under a bar: Target 1,800 · Eaten 1,193 · Exercise +133, and an optional one at the far right */
const Breakdown: React.FC<{ items: [string, string][]; end?: { item: [string, string]; className: string } }> = ({ items, end }) => (
    <dl className="flex flex-wrap gap-x-5 gap-y-1 mt-2.5 text-[13px]">
        {items.map(([label, value]) => (
            <div key={label}>
                <dt>{label}</dt>
                <dd className="text-[15px] font-semibold tabular-nums">{value}</dd>
            </div>
        ))}
        {end && (
            <div className={`ml-auto text-right ${end.className}`}>
                <dt>{end.item[0]}</dt>
                <dd className="text-[15px] font-semibold tabular-nums">{end.item[1]}</dd>
            </div>
        )}
    </dl>
);

/**
 * The Today hero: the screen's one solid primary block. Calories left with a bar and how it's made
 * up, the day type, a quiet protein line beside the main action (log food) and the next planned meal.
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
}) => {
    const credited = Math.round(caloriesBurned * burnCredit);
    const budget = caloriesGoal + credited;
    const remaining = budget - caloriesEaten;
    const isOver = remaining < 0;

    return (
        <section className="hero px-5 py-5 md:px-6 md:py-6" aria-label="Today's calories">
            <div>
                {/* Calories: the headline */}
                <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
                        {isOver ? 'Over today' : 'Calories left'}
                        <span className="inline-flex items-center gap-1 rounded-full bg-ink/15 px-2 py-0.5 text-xs">
                            {isFastDay && <Flame size={12} aria-hidden="true" />}
                            {isFastDay ? 'Fast day' : 'Nourish day'}
                        </span>
                    </p>
                    <p className="text-5xl font-display font-extrabold tracking-tight leading-tight tabular-nums">
                        {fmt(Math.abs(remaining))}<span className="text-lg font-bold"> kcal{isOver ? ' over' : ''}</span>
                    </p>
                    <Bar
                        value={budget > 0 ? caloriesEaten / budget : 0}
                        label="Calories eaten of today's budget"
                        now={caloriesEaten}
                        max={budget}
                    />
                    <Breakdown items={[
                        ['Target', fmt(caloriesGoal)],
                        ['Eaten', fmt(caloriesEaten)],
                        // How much exercise counts is a Settings choice; nothing to add when it's off
                        ...(credited > 0 ? [['Exercise', `+${fmt(credited)}`] as [string, string]] : []),
                    ]} end={protein && {
                        // From md protein is the last figure of the row; phones show it beside Log food
                        item: ['Protein', `${fmt(protein.eaten)} of ${fmt(protein.target)} g`],
                        className: 'hidden md:block',
                    }} />
                </div>

                {/* Phones: protein as one quiet line beside Log food. From md, Log food goes (the log's Add is on screen) */}
                <div className="flex items-center justify-between gap-3 mt-4 md:hidden">
                    {protein && (
                        <p className="text-[13px] tabular-nums">
                            Protein <span className="font-semibold">{fmt(protein.eaten)}</span> of {fmt(protein.target)} g
                        </p>
                    )}
                    <button onClick={onLogFood} className="btn-primary btn-sm shrink-0">
                        <Plus size={16} aria-hidden="true" /> Log food
                    </button>
                </div>
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
