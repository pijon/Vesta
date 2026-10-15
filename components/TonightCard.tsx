import React from 'react';
import { CalendarDays, Check, Shuffle } from 'lucide-react';
import { Recipe } from '../types';
import { mealKcalLabel, slotFor, slotLabel, slotTime } from '../utils/planUtils';
import { mealVisualFor } from '../utils/mealVisual';

interface TonightCardProps {
    /** Tonight's dinner, else the next meal still to eat; none when nothing is planned */
    meal?: Recipe;
    eaten: boolean;
    onView: () => void;
    onSwap: () => void;
    onPlan: () => void;
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** The Today card for the meal ahead: a leaf-green block with the dish, who it's for and its recipe. */
export const TonightCard: React.FC<TonightCardProps> = ({ meal, eaten, onView, onSwap, onPlan }) => {
    if (!meal) {
        return (
            <section className="rounded-[28px] bg-secondary text-secondary-foreground p-5 md:p-6 flex flex-col gap-4" aria-label="Tonight">
                <div>
                    <p className="text-sm font-bold">Tonight</p>
                    <h2 className="font-display text-[28px] leading-none tracking-tight text-inherit mt-1.5">No dinner planned yet</h2>
                </div>
                <button onClick={onPlan} className="btn-base self-start bg-surface text-main">
                    <CalendarDays size={18} aria-hidden="true" /> Plan dinner
                </button>
            </section>
        );
    }

    const slot = slotFor(meal);
    const visual = mealVisualFor(meal);
    const when = slot === 'dinner' ? `Tonight · ${clock(slotTime('dinner'))}` : `Next up · ${slotLabel(slot)}`;
    const forWho = [
        meal.familyDinner ? 'Family dinner' : null,
        meal.cookingServings ? `for ${meal.cookingServings}` : null,
    ].filter(Boolean).join(' ');

    return (
        <section className="rounded-[28px] bg-secondary text-secondary-foreground p-5 md:p-6 flex flex-col gap-4" aria-label={slot === 'dinner' ? 'Tonight' : 'Next up'}>
            <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <p className="text-sm font-bold flex items-center gap-1.5">
                        {when}
                        {eaten && <><span aria-hidden="true">·</span><Check size={14} strokeWidth={3} aria-hidden="true" /> Eaten</>}
                    </p>
                    <h2 className="font-display text-[28px] leading-none tracking-tight text-inherit line-clamp-3">{meal.name}</h2>
                    <p className="text-sm">{[forWho, mealKcalLabel(meal)].filter(Boolean).join(' · ')}</p>
                </div>
                {meal.image ? (
                    <img src={meal.image} alt="" className="size-24 md:size-28 shrink-0 rounded-full object-cover border-4 border-surface" />
                ) : (
                    <span className={`size-24 md:size-28 shrink-0 rounded-full border-4 border-surface flex items-center justify-center ${visual.tint}`} aria-hidden="true">
                        <visual.Icon size={40} strokeWidth={1.75} />
                    </span>
                )}
            </div>
            <div className="flex gap-2">
                <button onClick={onView} className="btn-base flex-1 bg-surface text-main">Open recipe</button>
                <button onClick={onSwap} className="btn-base bg-secondary-hover text-secondary-foreground px-5" aria-label={`Swap ${meal.name}`}>
                    <Shuffle size={18} aria-hidden="true" /> Swap
                </button>
            </div>
        </section>
    );
};
