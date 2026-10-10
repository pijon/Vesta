import React, { useState } from 'react';
import { MealSlot, Recipe } from '../types';
import { Sheet } from './Sheet';
import { getDayPlan, saveDayPlan } from '../services/storageService';
import { auth } from '../services/firebase';
import { familyData } from '../services/pageData';
import { usePrewarmed } from '../utils/prewarm';
import { MEAL_SLOTS, addDays, planRecipe, slotFor, slotLabel } from '../utils/planUtils';
import { localDateString, parseLocalDate } from '../utils/dateUtils';

interface AddToPlanSheetProps {
  recipe: Recipe;
  onClose: () => void;
  /** Called after the meal is saved, with a short confirmation */
  onAdded: (message: string, date: string) => void;
  onError: (message: string) => void;
}

const dayLabel = (date: string, today: string) =>
  date === today ? 'Today'
    : date === addDays(today, 1) ? 'Tomorrow'
    : parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

/** Pick a day (next two weeks) and a meal slot for a recipe, then add it to the plan. */
export const AddToPlanSheet: React.FC<AddToPlanSheetProps> = ({ recipe, onClose, onAdded, onError }) => {
  const today = localDateString();
  const dates = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const family = usePrewarmed(familyData);
  const [date, setDate] = useState(today);
  const [slot, setSlot] = useState<MealSlot>(slotFor(recipe));
  const [saving, setSaving] = useState(false);

  // "today's dinner", "tomorrow's lunch", "Thu 16 Oct breakfast"
  const target = date === today ? `today's ${slotLabel(slot).toLowerCase()}`
    : date === addDays(today, 1) ? `tomorrow's ${slotLabel(slot).toLowerCase()}`
    : `${dayLabel(date, today)} ${slotLabel(slot).toLowerCase()}`;

  const add = async () => {
    setSaving(true);
    try {
      const plan = await getDayPlan(date);
      const meal = planRecipe(recipe, slot, { familySize: family?.memberCount, addedBy: auth.currentUser?.uid });
      await saveDayPlan({ ...plan, meals: [...plan.meals, meal] });
      onAdded(`Added ${recipe.name} to ${target}`, date);
    } catch (e) {
      console.error('Failed to add to plan', e);
      onError("Couldn't add that to your plan. Check your connection.");
      setSaving(false);
    }
  };

  const choice = (active: boolean) =>
    `min-h-11 px-3 rounded-[14px] border text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] ${active ? 'bg-ink text-on-ink border-transparent' : 'bg-surface border-border hover:bg-surface-sunken'}`;

  return (
    <Sheet
      title="Add to plan"
      subtitle={recipe.name}
      onClose={onClose}
      footer={
        <button onClick={add} disabled={saving} className="btn-primary btn-block">
          {saving ? 'Adding…' : `Add to ${target}`}
        </button>
      }
    >
      <fieldset>
        <legend className="text-sm font-semibold text-muted mb-2">Day</legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {dates.map(d => (
            <button key={d} onClick={() => setDate(d)} aria-pressed={date === d} className={`${choice(date === d)} text-left`}>
              {dayLabel(d, today)}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-5">
        <legend className="text-sm font-semibold text-muted mb-2">Meal</legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MEAL_SLOTS.map(s => (
            <button key={s.slot} onClick={() => setSlot(s.slot)} aria-pressed={slot === s.slot} className={choice(slot === s.slot)}>
              {s.label}
            </button>
          ))}
        </div>
        {family && (
          <p className="text-xs text-muted mt-3">
            {slot === 'dinner' ? `Dinners are shared with your family and cooked for ${family.memberCount}.` : 'Breakfast, lunch and snacks are just yours.'}
          </p>
        )}
      </fieldset>
    </Sheet>
  );
};
