import React from 'react';

interface HearthWidgetProps {
    caloriesRemaining: number;
    caloriesTotal: number;
    caloriesGoal: number;
    // Water and fasting now have their own tiles; kept for call-site compatibility.
    waterLiters?: number;
    waterGoal?: number;
    fastingHours?: number;
    fastingGoal?: number;
    size?: 'sm' | 'md' | 'lg';
    onClick?: () => void;
}

/**
 * The Today hero: the screen's one solid primary block.
 * Calories left as a big figure, with a compact progress ring.
 */
export const HearthWidget: React.FC<HearthWidgetProps> = ({
    caloriesRemaining,
    caloriesTotal,
    caloriesGoal,
    size = 'lg',
    onClick
}) => {
    const isOver = caloriesRemaining < 0;
    const progress = caloriesGoal > 0 ? Math.min(caloriesTotal / caloriesGoal, 1) : 0;

    const ringSize = size === 'sm' ? 56 : 72;
    const stroke = size === 'sm' ? 7 : 8;
    const radius = (ringSize - stroke) / 2;
    const circumference = 2 * Math.PI * radius;

    return (
        <div
            onClick={onClick}
            className={`hero flex items-center justify-between gap-4 ${size === 'sm' ? 'px-5 py-4' : 'px-6 py-6'} ${onClick ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''}`}
        >
            <div className="min-w-0">
                <p className="text-sm font-semibold">{isOver ? 'Over today' : 'Calories left'}</p>
                <p className={`${size === 'sm' ? 'text-4xl' : 'text-5xl'} font-display font-extrabold tracking-tight leading-tight`}>
                    {Math.abs(caloriesRemaining)}
                    {isOver && <span className="text-lg font-bold"> kcal</span>}
                </p>
                <p className="text-sm">
                    {isOver ? "That's okay, tomorrow's a new day" : `${caloriesTotal} of ${caloriesGoal} eaten`}
                </p>
            </div>

            <svg
                width={ringSize}
                height={ringSize}
                className="shrink-0 -rotate-90"
                role="img"
                aria-label={`${Math.round(progress * 100)}% of today's calories eaten`}
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
                    className="transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none"
                />
            </svg>
        </div>
    );
};
