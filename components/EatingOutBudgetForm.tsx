import React, { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { MealSlot, Recipe } from '../types';
import { eatingOutBudgetMeal, roundBudget } from '../utils/planUtils';
import { QUICK_MEAL_PRESETS } from './QuickMealForm';

interface EatingOutBudgetFormProps {
  /** Form id, so the sheet footer's submit button can sit outside the form */
  id: string;
  slot: MealSlot;
  /** Calories left in the day before this meal; the budget starts here when there's room */
  caloriesLeft: number;
  onSubmit: (meal: Recipe) => void;
}

const STEP = 50;
const MIN = 100;
const MAX = 2000;

/** The budget to start from: what the day has left, else a regular-sized meal for the slot. */
export const defaultBudget = (slot: MealSlot, caloriesLeft: number) =>
  caloriesLeft >= MIN ? Math.min(MAX, roundBudget(caloriesLeft)) : QUICK_MEAL_PRESETS[slot][1];

/** Plan eating out before the place is known: just a calorie budget to stay within. */
export const EatingOutBudgetForm: React.FC<EatingOutBudgetFormProps> = ({ id, slot, caloriesLeft, onSubmit }) => {
  const [value, setValue] = useState(String(defaultBudget(slot, caloriesLeft)));
  const [error, setError] = useState('');
  const [auto, setAuto] = useState(true);

  const nudge = (delta: number) => {
    const current = Number(value);
    const base = Number.isFinite(current) && current > 0 ? current : defaultBudget(slot, caloriesLeft);
    setValue(String(Math.min(MAX, Math.max(MIN, roundBudget(base + delta)))));
    setError('');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const budget = Number(value);
    if (!Number.isFinite(budget) || budget < MIN || budget > MAX) { setError(`Enter a budget from ${MIN} to ${MAX} kcal`); return; }
    onSubmit(eatingOutBudgetMeal(slot, budget, auto));
  };

  return (
    <form id={id} onSubmit={submit} noValidate className="space-y-5">
      <p className="text-sm text-muted">
        Don't know where yet? Set a calorie budget now. The day plans around it, and you can pick the place later.
      </p>
      <fieldset>
        <legend className="text-sm font-semibold text-muted mb-1.5">Budget</legend>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => nudge(-STEP)} className="icon-btn bg-surface-sunken" aria-label={`${STEP} kcal less`}><Minus size={18} /></button>
          <label className="flex-1">
            <span className="sr-only">Budget in kcal</span>
            <input
              value={value}
              onChange={e => { setValue(e.target.value); setError(''); }}
              inputMode="numeric"
              className={`input w-full text-center font-display font-extrabold text-xl ${error ? 'input-error' : ''}`}
            />
          </label>
          <button type="button" onClick={() => nudge(STEP)} className="icon-btn bg-surface-sunken" aria-label={`${STEP} kcal more`}><Plus size={18} /></button>
        </div>
        <p className="text-xs text-muted mt-1.5">
          kcal{caloriesLeft >= MIN ? ` · starts at what's left of the day (${caloriesLeft} kcal)` : ''}
        </p>
      </fieldset>
      <label className="flex items-start gap-3 rounded-[14px] bg-surface-sunken px-4 py-3">
        <input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} className="mt-1 size-4 accent-[var(--ink)]" />
        <span>
          <span className="block font-semibold">Adjust as the day goes</span>
          <span className="block text-sm text-muted">Anything you eat beyond the plan, like a snack, comes off your eating-out budgets equally.</span>
        </span>
      </label>
      {error && <p className="text-sm text-error" role="alert">{error}</p>}
    </form>
  );
};
