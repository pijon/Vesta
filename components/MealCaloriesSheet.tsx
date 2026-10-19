import React, { useState, useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { Recipe } from '../types';
import { Sheet } from './Sheet';
import { PRESET_LABELS, QUICK_MEAL_PRESETS } from './QuickMealForm';
import { estimateMealCalories } from '../services/geminiService';
import { mealNutrition, nutritionLabel } from '../utils/recipeNutrition';
import { slotFor, mealKey } from '../utils/planUtils';

interface MealCaloriesSheetProps {
  meal: Recipe;
  /** e.g. "1 of 2", when several meals are being asked about in a row */
  progress?: string;
  onSave: (calories: number, estimated: boolean) => void | Promise<void>;
  busy?: boolean;
  error?: string;
  requestId?: string;
  onSkip: () => void;
  onClose: () => void;
}

/** Asks for this person's calories for a whole planned meal (with its sides) whose nutrition isn't known, before it's logged as eaten. */
export const MealCaloriesSheet: React.FC<MealCaloriesSheetProps> = ({ meal, progress, onSave, onSkip, onClose, busy = false, error: externalError, requestId }) => {
  const slot = slotFor(meal);
  const presets = QUICK_MEAL_PRESETS[slot];
  const [preset, setPreset] = useState<number | null>(null);
  const [exact, setExact] = useState('');
  const [estimatedExact, setEstimatedExact] = useState(false);
  const [error, setError] = useState('');
  const [estimating, setEstimating] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const revision = useRef(0);
  const alive = useRef(true);
  const identity = `${requestId ?? ''}/${mealKey(meal)}`;
  const identityRef = useRef(identity);
  identityRef.current = identity;
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; revision.current++; };
  }, []);
  // A new meal (or request) starts with a clean answer; a pending estimate for the old one is dropped
  useEffect(() => {
    revision.current++;
    setExact(''); setPreset(null); setError(''); setEstimatedExact(false); setEstimating(false);
  }, [identity]);
  const pending = busy || saving;
  const nutrition = mealNutrition(meal);

  const estimate = async () => {
    const token = ++revision.current;
    const captured = identityRef.current;
    // An estimate only fills the answer if nothing changed while it was on its way
    const current = () => alive.current && captured === identityRef.current && token === revision.current;
    setEstimating(true);
    setError('');
    try {
      const kcal = await estimateMealCalories([meal.name,...(meal.sides||[]).map(s=>s.name)].join(' with '), meal.quick?.kind || 'home', slot);
      if (!current()) return;
      if (typeof kcal !== 'number' || !Number.isFinite(kcal) || kcal < 0 || kcal > 5000) { setError("Couldn't estimate that one. Pick a size or enter a number."); return; }
      setExact(String(kcal));
      setEstimatedExact(true);
      setPreset(null);
    } catch (e) {
      if (!current()) return;
      console.error(e);
      setError("Couldn't estimate right now. Pick a size or enter a number.");
    } finally {
      if (current()) setEstimating(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || savingRef.current) return;
    let calories = preset;
    let estimated = true;
    if (exact.trim() !== '') {
      const kcal = Number(exact);
      if (!Number.isFinite(kcal) || kcal < 0 || kcal > 5000) {
        setError('Enter calories from 0 to 5000');
        inputRef.current?.focus();
        return;
      }
      calories = Math.round(kcal);
      estimated = estimatedExact;
    }
    if (calories === null) {
      setError('Pick a size or enter a number');
      inputRef.current?.focus();
      return;
    }
    revision.current++;
    setEstimating(false);
    savingRef.current = true;
    setSaving(true);
    try {
      await onSave(calories, estimated);
    } catch (e) {
      // The answer stays so the save can be retried
      if (alive.current) {
        setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
        inputRef.current?.focus();
      }
    } finally {
      savingRef.current = false;
      if (alive.current) setSaving(false);
    }
  };

  return (
    <Sheet
      title={`How much was ${meal.name}?`}
      subtitle={`For your diary, including all sides${progress ? ` · ${progress}` : ''}`}
      dismissible={!pending}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={onSkip} disabled={pending} className="btn-secondary">Skip this meal</button>
          <button type="submit" form="meal-calories-form" disabled={pending} className="btn-primary flex-1">{pending ? 'Saving…' : 'Log it'}</button>
        </div>
      }
    >
      <p className="text-sm text-muted mb-4">Enter the whole meal amount for your personal diary. Shared recipes and plans keep their nutrition. {nutrition.budget ? 'A planned budget is not actual intake.' : nutritionLabel(nutrition)}</p>
      <form id="meal-calories-form" onSubmit={save} noValidate>
        <div className="grid grid-cols-4 gap-2">
          {presets.map((kcal, i) => (
            <button
              key={kcal}
              type="button"
              disabled={pending}
              onClick={() => { revision.current++; setEstimating(false); setPreset(p => (p === kcal ? null : kcal)); setExact(''); setEstimatedExact(false); setError(''); }}
              aria-pressed={preset === kcal}
              aria-label={`${PRESET_LABELS[i]}, about ${kcal} kcal`}
              className="chip chip-tile flex-col !gap-0 min-h-14"
            >
              <span className="font-display font-extrabold text-[15px] leading-5">≈ {kcal}</span>
              <span className="text-xs font-semibold leading-4">{PRESET_LABELS[i]}</span>
            </button>
          ))}
          <label>
            <span className="sr-only">Exact calories</span>
            <input
              ref={inputRef}
              disabled={pending}
              value={exact}
              onChange={e => { revision.current++; setEstimating(false); setExact(e.target.value); setEstimatedExact(false); setPreset(null); setError(''); }}
              inputMode="numeric"
              placeholder="kcal"
              className={`input w-full min-h-14 text-center !px-2 ${error.startsWith('Enter calories') ? 'input-error' : ''}`}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 mt-1.5">
          <button type="button" onClick={estimate} disabled={estimating || pending} className="btn-ghost btn-sm !px-2 -ml-2">
            {estimating ? <span className="spinner spinner-sm" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
            {estimating ? 'Estimating…' : 'Estimate from the name'}
          </button>
          {estimatedExact && exact && <span className="text-xs text-muted">Estimated, shown as ≈ {exact} kcal</span>}
        </div>
        {(error || externalError) && <p className="text-sm text-error mt-2" role="alert">{error || externalError}</p>}
      </form>
    </Sheet>
  );
};
