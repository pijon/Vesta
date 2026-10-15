import React, { useId, useState } from 'react';
import { EatingOutDish, Recipe } from '../types';
import { Sheet } from './Sheet';
import { EatingOutDishList } from './EatingOutDishList';
import { usePrewarmed } from '../utils/prewarm';
import { eatingOutDishesData } from '../services/pageData';
import { dishLabel, suggestDishes } from '../utils/eatingOutHistory';
import { isBudgetMeal, mealCalories, slotFor, slotLabel } from '../utils/planUtils';

interface EatingOutDecideSheetProps {
  /** The budget meal being filled in */
  meal: Recipe;
  /** Footer button, e.g. "Update the plan" in the planner or "Log it" on Today */
  confirmLabel?: string;
  /** The real meal; it replaces the budget in the same slot */
  onDecide: (name: string, calories: number, options: { estimated: boolean; protein?: number; place: string; dish: string }) => void;
  onClose: () => void;
}

/** Turn "eating out, place TBD" into what you're actually having, with the dishes you've had before. */
export const EatingOutDecideSheet: React.FC<EatingOutDecideSheetProps> = ({ meal, confirmLabel = 'Update the plan', onDecide, onClose }) => {
  const formId = useId();
  const budget = mealCalories(meal);
  const isBudget = isBudgetMeal(meal);
  const [place, setPlace] = useState(meal.quick?.place ?? '');
  const [dish, setDish] = useState(isBudget ? '' : (meal.quick?.dish ?? meal.name));
  const [kcal, setKcal] = useState(String(budget));
  const [estimated, setEstimated] = useState(true);
  const [protein, setProtein] = useState<number | undefined>(isBudget ? undefined : meal.protein || undefined);
  const [error, setError] = useState('');
  const [pickedId, setPickedId] = useState<string>();
  const history = usePrewarmed(eatingOutDishesData) ?? [];
  const options = suggestDishes(history, { term: place, budget });

  const pick = (d: EatingOutDish) => {
    setPickedId(d.id);
    setPlace(d.place);
    setDish(d.dish);
    setKcal(String(d.calories));
    setProtein(d.protein);
    setEstimated(true);
    setError('');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = dishLabel({ place, dish });
    if (!name) { setError('Enter a place or what you ordered'); return; }
    const value = Number(kcal);
    if (!Number.isFinite(value) || value < 0 || value > 5000) { setError('Enter calories from 0 to 5000'); return; }
    onDecide(name, Math.round(value), { estimated, protein, place: place.trim(), dish: dish.trim() });
  };

  const over = Number(kcal) - budget;

  return (
    <Sheet
      title={isBudget ? 'Where are you eating?' : `What did you have?`}
      subtitle={`${slotLabel(slotFor(meal))} ${isBudget ? 'budget' : 'planned'} · ${budget} kcal`}
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">Later</button>
          <button type="submit" form={formId} className="btn-primary flex-1">{confirmLabel}</button>
        </div>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-5">
        <label className="block">
          <span className="block text-sm font-semibold text-muted mb-1.5">Place or kind of food</span>
          <input value={place} onChange={e => { setPlace(e.target.value); setError(''); }} placeholder="Thai place on the corner" className="input w-full" />
        </label>

        <section aria-labelledby="ideas-heading" className="space-y-1">
          <h3 id="ideas-heading" className="text-sm font-semibold text-muted">{place.trim() ? 'You had before' : 'Your usual orders'}</h3>
          {options.length > 0 ? (
            <EatingOutDishList dishes={options} budget={budget} selectedId={pickedId} onPick={pick} />
          ) : (
            <p className="text-sm text-muted">
              {history.length > 0 ? 'Nothing logged there yet.' : 'Dishes you log when eating out show up here next time.'}
            </p>
          )}
        </section>

        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <label className="block">
            <span className="block text-sm font-semibold text-muted mb-1.5">What you're having <span className="font-normal">· optional</span></span>
            <input value={dish} onChange={e => { setDish(e.target.value); setError(''); }} placeholder="Pad thai" className="input w-full" />
          </label>
          <label className="block">
            <span className="block text-sm font-semibold text-muted mb-1.5">kcal</span>
            <input
              value={kcal}
              onChange={e => { setKcal(e.target.value); setEstimated(true); setProtein(undefined); setPickedId(undefined); setError(''); }}
              inputMode="numeric"
              className={`input w-full text-center ${error.startsWith('Enter calories') ? 'input-error' : ''}`}
            />
          </label>
        </div>
        {Number.isFinite(over) && over !== 0 && Number(kcal) > 0 && (
          <p className="text-sm text-muted" aria-live="polite">
            {over < 0 ? `${-over} kcal under ${isBudget ? 'your budget' : 'the plan'}` : `${over} kcal over ${isBudget ? 'your budget' : 'the plan'}`}
          </p>
        )}
        {error && <p className="text-sm text-error" role="alert">{error}</p>}
      </form>
    </Sheet>
  );
};
