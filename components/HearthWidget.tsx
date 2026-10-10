import React from 'react';
import { Flame, Plus } from 'lucide-react';

interface HearthWidgetProps {
    /** Today's calorie target (depends on fast or nourish day) */
    caloriesGoal: number;
    caloriesEaten: number;
    caloriesBurned: number;
    isFastDay: boolean;
    onLogFood: () => void;
    size?: 'sm' | 'md' | 'lg';
}

const fmt = (n: number) => Math.round(n).toLocaleString();

/**
 * The Today hero: the screen's one solid primary block. Calories left, how that number is made
 * up (target − eaten + burned), the day type, and the main action: log food.
 */
export const HearthWidget: React.FC<HearthWidgetProps> = ({
    caloriesGoal,
    caloriesEaten,
    caloriesBurned,
    isFastDay,
    onLogFood,
    size = 'lg',
}) => {
    const remaining = caloriesGoal - caloriesEaten + caloriesBurned;
    const isOver = remaining < 0;
    const net = caloriesEaten - caloriesBurned;
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
                        {fmt(caloriesGoal)} target − {fmt(caloriesEaten)} eaten{caloriesBurned > 0 && ` + ${fmt(caloriesBurned)} burned`}
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

            <button onClick={onLogFood} className="btn-primary btn-sm mt-4">
                <Plus size={16} aria-hidden="true" /> Log food
            </button>
        </section>
    );
};
