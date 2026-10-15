import React, { useId, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Recipe } from '../types';
import { Sheet } from './Sheet';
import { EatingOutIdea, suggestEatingOutOrders } from '../services/geminiService';
import { isBudgetMeal, mealCalories, slotFor, slotLabel } from '../utils/planUtils';

interface EatingOutDecideSheetProps {
  /** The budget meal being filled in */
  meal: Recipe;
  /** Daily protein goal in grams, so suggestions can favour protein */
  proteinGoal?: number;
  /** Footer button, e.g. "Update the plan" in the planner or "Log it" on Today */
  confirmLabel?: string;
  /** The real meal; it replaces the budget in the same slot */
  onDecide: (name: string, calories: number, options: { estimated: boolean; protein?: number }) => void;
  onClose: () => void;
}

/** Turn "eating out, place TBD" into what you're actually having, with ideas that fit the budget. */
export const EatingOutDecideSheet: React.FC<EatingOutDecideSheetProps> = ({ meal, proteinGoal, confirmLabel = 'Update the plan', onDecide, onClose }) => {
  const formId = useId();
  const budget = mealCalories(meal);
  const isBudget = isBudgetMeal(meal);
  const [place, setPlace] = useState('');
  const [dish, setDish] = useState(isBudget ? '' : meal.name);
  const [kcal, setKcal] = useState(String(budget));
  const [estimated, setEstimated] = useState(true);
  const [protein, setProtein] = useState<number | undefined>();
  const [ideas, setIdeas] = useState<EatingOutIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const suggest = async () => {
    setLoading(true);
    setMessage('');
    try {
      const found = await suggestEatingOutOrders(place, budget, proteinGoal);
      setIdeas(found);
      if (!found.length) setMessage('No ideas came back. Type what you had instead.');
    } catch (e) {
      console.error(e);
      setMessage("Couldn't get ideas right now. You can still type what you're having.");
    } finally {
      setLoading(false);
    }
  };

  const pick = (idea: EatingOutIdea) => {
    setDish(idea.dish);
    setKcal(String(idea.calories));
    setProtein(idea.protein);
    setEstimated(true);
    setError('');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = [dish.trim(), place.trim() && `at ${place.trim()}`].filter(Boolean).join(' ') || place.trim();
    if (!name) { setError('Enter a place or what you ordered'); return; }
    const value = Number(kcal);
    if (!Number.isFinite(value) || value < 0 || value > 5000) { setError('Enter calories from 0 to 5000'); return; }
    onDecide(name, Math.round(value), { estimated, protein });
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

        <section aria-labelledby="ideas-heading" className="space-y-2">
          <h3 id="ideas-heading" className="text-sm font-semibold text-muted">{isBudget ? 'Ideas that fit' : 'Ideas around'} {budget} kcal</h3>
          <button type="button" onClick={suggest} disabled={loading} className="btn-secondary btn-sm">
            {loading ? <span className="spinner spinner-sm" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
            {loading ? 'Thinking…' : ideas.length ? 'Suggest again' : 'Suggest what to order'}
          </button>
          {message && <p className="text-sm text-muted">{message}</p>}
          {ideas.length > 0 && (
            <ul>
              {ideas.map(idea => (
                <li key={idea.dish}>
                  <button
                    type="button"
                    onClick={() => pick(idea)}
                    aria-pressed={dish === idea.dish}
                    className="w-full flex items-center gap-3 py-2 px-2 -mx-2 rounded-[14px] text-left hover:bg-surface-sunken transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="font-semibold leading-snug">{idea.dish}</span>
                      {idea.tip && <span className="block text-xs text-muted mt-0.5">{idea.tip}</span>}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-display font-extrabold leading-5">≈ {idea.calories}</span>
                      <span className="block text-[11px] font-semibold text-muted leading-3">{idea.protein ? `${idea.protein} g protein` : 'kcal'}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
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
              onChange={e => { setKcal(e.target.value); setEstimated(true); setProtein(undefined); setError(''); }}
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
