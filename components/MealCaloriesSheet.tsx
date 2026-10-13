import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Recipe } from '../types';
import { Sheet } from './Sheet';
import { PRESET_LABELS, QUICK_MEAL_PRESETS } from './QuickMealForm';
import { estimateMealCalories } from '../services/geminiService';
import { slotFor } from '../utils/planUtils';

interface MealCaloriesSheetProps {
  meal: Recipe;
  /** e.g. "1 of 2", when several meals are being asked about in a row */
  progress?: string;
  onSave: (calories: number, estimated: boolean) => void;
  onSkip: () => void;
  onClose: () => void;
}

/** Asks for the calories of a quick meal planned without them, before it's logged as eaten. */
export const MealCaloriesSheet: React.FC<MealCaloriesSheetProps> = ({ meal, progress, onSave, onSkip, onClose }) => {
  const slot = slotFor(meal);
  const presets = QUICK_MEAL_PRESETS[slot];
  const [preset, setPreset] = useState<number | null>(null);
  const [exact, setExact] = useState('');
  const [estimatedExact, setEstimatedExact] = useState(false);
  const [error, setError] = useState('');
  const [estimating, setEstimating] = useState(false);

  const estimate = async () => {
    setEstimating(true);
    setError('');
    try {
      const kcal = await estimateMealCalories(meal.name, meal.quick?.kind || 'home', slot);
      if (kcal === null) { setError("Couldn't estimate that one. Pick a size or enter a number."); return; }
      setExact(String(kcal));
      setEstimatedExact(true);
      setPreset(null);
    } catch (e) {
      console.error(e);
      setError("Couldn't estimate right now. Pick a size or enter a number.");
    } finally {
      setEstimating(false);
    }
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (exact.trim() !== '') {
      const kcal = Number(exact);
      if (!Number.isFinite(kcal) || kcal < 0 || kcal > 5000) { setError('Enter calories from 0 to 5000'); return; }
      onSave(Math.round(kcal), estimatedExact);
      return;
    }
    if (preset === null) { setError('Pick a size or enter a number'); return; }
    onSave(preset, true);
  };

  return (
    <Sheet
      title={`How much was ${meal.name}?`}
      subtitle={`It was planned without calories${progress ? ` · ${progress}` : ''}`}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={onSkip} className="btn-secondary">Skip this meal</button>
          <button type="submit" form="meal-calories-form" className="btn-primary flex-1">Log it</button>
        </div>
      }
    >
      <form id="meal-calories-form" onSubmit={save} noValidate>
        <div className="grid grid-cols-4 gap-2">
          {presets.map((kcal, i) => (
            <button
              key={kcal}
              type="button"
              onClick={() => { setPreset(p => (p === kcal ? null : kcal)); setExact(''); setEstimatedExact(false); setError(''); }}
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
              value={exact}
              onChange={e => { setExact(e.target.value); setEstimatedExact(false); setPreset(null); setError(''); }}
              inputMode="numeric"
              placeholder="kcal"
              className={`input w-full min-h-14 text-center !px-2 ${error.startsWith('Enter calories') ? 'input-error' : ''}`}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 mt-1.5">
          <button type="button" onClick={estimate} disabled={estimating} className="btn-ghost btn-sm !px-2 -ml-2">
            {estimating ? <span className="spinner spinner-sm" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
            {estimating ? 'Estimating…' : 'Estimate from the name'}
          </button>
          {estimatedExact && exact && <span className="text-xs text-muted">Estimated, shown as ≈ {exact} kcal</span>}
        </div>
        {error && <p className="text-sm text-error mt-2" role="alert">{error}</p>}
      </form>
    </Sheet>
  );
};
