import React, { useState } from 'react';
import {
  ArrowLeft, BookOpen, ChefHat, Copy, Minus, MoveRight, Package, Plus, Repeat, Shuffle, Trash2, UsersRound, X,
} from 'lucide-react';
import { MealSlot, Recipe } from '../types';
import { Sheet } from './Sheet';
import { mealVisualFor } from '../utils/mealVisual';
import { MEAL_SLOTS, mealCalories } from '../utils/planUtils';
import { parseLocalDate } from '../utils/dateUtils';

interface PlannerMealSheetProps {
  meal: Recipe;
  date: string;
  slot: MealSlot;
  /** Dates offered for move and copy */
  dates: string[];
  /** Name of the family member who planned a family dinner */
  addedByName?: string;
  inFamily: boolean;
  onView: () => void;
  onCook: () => void;
  onSwap: () => void;
  onAddSide: () => void;
  onRemoveSide: (index: number) => void;
  onMove: (date: string, slot: MealSlot) => void;
  onCopy: (date: string, slot: MealSlot) => void;
  onPlanLeftovers: () => void;
  onSetCookingServings: (servings: number) => void;
  onTogglePacked: () => void;
  onRemove: () => void;
  onClose: () => void;
}

const dayName = (date: string, style: 'long' | 'short' = 'long') =>
  parseLocalDate(date).toLocaleDateString(undefined, { weekday: style, day: 'numeric', month: 'short' });

/** Everything you can do with one planned meal. */
export const PlannerMealSheet: React.FC<PlannerMealSheetProps> = ({
  meal, date, slot, dates, addedByName, inFamily,
  onView, onCook, onSwap, onAddSide, onRemoveSide, onMove, onCopy, onPlanLeftovers,
  onSetCookingServings, onTogglePacked, onRemove, onClose,
}) => {
  const [picker, setPicker] = useState<'move' | 'copy' | null>(null);
  const [pickDate, setPickDate] = useState(date);
  const [pickSlot, setPickSlot] = useState<MealSlot>(slot);
  const visual = mealVisualFor(meal);
  const portions = meal.cookingServings || 1;
  const isCustom = meal.description === 'Eat Out / Custom Meal';
  const hasRecipe = !isCustom && ((meal.ingredients?.length ?? 0) > 0 || (meal.instructions?.length ?? 0) > 0);

  const action = (icon: React.ReactNode, label: string, onClick: () => void, tone: 'default' | 'danger' = 'default', pressed?: boolean) => (
    <li>
      <button
        onClick={onClick}
        aria-pressed={pressed}
        className={`w-full flex items-center gap-3 min-h-12 px-3 rounded-[14px] text-left font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] ${tone === 'danger' ? 'text-error hover:bg-error-bg' : 'hover:bg-surface-sunken'}`}
      >
        <span className={`size-9 shrink-0 rounded-full flex items-center justify-center ${tone === 'danger' ? 'bg-error-bg' : pressed ? 'bg-water-bg text-water-text' : 'bg-surface-sunken'}`} aria-hidden="true">{icon}</span>
        <span className="flex-1">{label}</span>
      </button>
    </li>
  );

  if (picker) {
    const verb = picker === 'move' ? 'Move' : 'Copy';
    return (
      <Sheet
        title={`${verb} ${meal.name}`}
        subtitle={`Now: ${dayName(date)} · ${MEAL_SLOTS.find(s => s.slot === slot)!.label.toLowerCase()}`}
        onClose={onClose}
        footer={
          <div className="flex gap-2">
            <button onClick={() => setPicker(null)} className="btn-secondary flex-1"><ArrowLeft size={16} aria-hidden="true" /> Back</button>
            <button
              onClick={() => (picker === 'move' ? onMove : onCopy)(pickDate, pickSlot)}
              disabled={picker === 'move' && pickDate === date && pickSlot === slot}
              className="btn-primary flex-1"
            >
              {verb} here
            </button>
          </div>
        }
      >
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-muted mb-2">Day</legend>
          <div className="grid grid-cols-2 gap-2">
            {dates.map(d => (
              <button
                key={d}
                onClick={() => setPickDate(d)}
                aria-pressed={pickDate === d}
                className={`min-h-11 px-3 rounded-[14px] border text-sm font-semibold text-left transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] ${pickDate === d ? 'bg-ink text-on-ink border-transparent' : 'bg-surface border-border hover:bg-surface-sunken'}`}
              >
                {dayName(d, 'short')}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="mt-5">
          <legend className="text-sm font-semibold text-muted mb-2">Meal</legend>
          <div className="grid grid-cols-2 gap-2">
            {MEAL_SLOTS.map(s => (
              <button
                key={s.slot}
                onClick={() => setPickSlot(s.slot)}
                aria-pressed={pickSlot === s.slot}
                className={`min-h-11 px-3 rounded-[14px] border text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] ${pickSlot === s.slot ? 'bg-ink text-on-ink border-transparent' : 'bg-surface border-border hover:bg-surface-sunken'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {inFamily && (
            <p className="text-xs text-muted mt-3">
              {pickSlot === 'dinner' ? 'Dinners are shared with your family.' : 'Breakfast, lunch and snacks are just yours.'}
            </p>
          )}
        </fieldset>
      </Sheet>
    );
  }

  return (
    <Sheet
      title={meal.name}
      subtitle={<>{dayName(date)} · {MEAL_SLOTS.find(s => s.slot === slot)!.label.toLowerCase()} · {mealCalories(meal)} kcal</>}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          <span className="badge badge-neutral"><visual.Icon size={12} aria-hidden="true" /> {visual.label}</span>
          {meal.familyDinner && (
            <span className="badge badge-workout"><UsersRound size={12} aria-hidden="true" /> Family dinner{addedByName ? ` · planned by ${addedByName}` : ''}</span>
          )}
          {meal.isLeftover && <span className="badge badge-neutral"><Repeat size={12} aria-hidden="true" /> Leftovers</span>}
          {meal.isPacked && <span className="badge badge-water"><Package size={12} aria-hidden="true" /> Packed</span>}
        </div>

        {!meal.isLeftover && (
          <div className="flex items-center justify-between gap-3 rounded-[14px] bg-surface-sunken px-4 py-3">
            <div>
              <p className="font-semibold">Cooking for</p>
              <p className="text-xs text-muted">Scales the shopping list</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => onSetCookingServings(Math.max(1, portions - 1))} disabled={portions <= 1} className="icon-btn bg-surface" aria-label="One portion fewer"><Minus size={18} /></button>
              <span className="w-8 text-center font-display font-extrabold text-xl" aria-live="polite">{portions}</span>
              <button onClick={() => onSetCookingServings(Math.min(20, portions + 1))} className="icon-btn bg-surface" aria-label="One portion more"><Plus size={18} /></button>
            </div>
          </div>
        )}

        {meal.sides && meal.sides.length > 0 && (
          <section aria-labelledby="sides-heading">
            <h3 id="sides-heading" className="text-sm font-semibold text-muted mb-1">Sides</h3>
            <ul>
              {meal.sides.map((side, i) => (
                <li key={side.instanceId || `${side.id}-${i}`} className="flex items-center gap-3 py-1.5">
                  <span className="flex-1 min-w-0 truncate font-semibold">{side.name}</span>
                  <span className="text-sm text-muted">{side.calories} kcal</span>
                  <button onClick={() => onRemoveSide(i)} className="icon-btn size-9" aria-label={`Remove side ${side.name}`}><X size={16} /></button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <ul className="-mx-1">
          {!isCustom && action(<BookOpen size={18} />, 'View recipe', onView)}
          {hasRecipe && action(<ChefHat size={18} />, 'Cook', onCook)}
          {action(<Shuffle size={18} />, 'Swap for another meal', onSwap)}
          {action(<Plus size={18} />, 'Add a side', onAddSide)}
          {!meal.isLeftover && action(<Repeat size={18} />, 'Make extra for leftovers tomorrow', onPlanLeftovers)}
          {action(<MoveRight size={18} />, 'Move to another day', () => setPicker('move'))}
          {action(<Copy size={18} />, 'Copy to another day', () => setPicker('copy'))}
          {slot === 'lunch' && action(<Package size={18} />, meal.isPacked ? 'Packed lunch' : 'Mark as packed lunch', onTogglePacked, 'default', !!meal.isPacked)}
          {action(<Trash2 size={18} />, meal.familyDinner ? 'Remove from family dinner' : 'Remove', onRemove, 'danger')}
        </ul>
      </div>
    </Sheet>
  );
};
