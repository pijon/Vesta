import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { MealSlot, QuickMealKind, Recipe } from '../types';
import { QUICK_MEAL_DESCRIPTION } from '../utils/planUtils';
import { QUICK_MEAL_KINDS } from '../utils/mealVisual';
import { estimateMealCalories } from '../services/geminiService';

interface QuickMealFormProps {
  /** Form id, so the sheet footer's submit button can sit outside the form */
  id: string;
  initialName: string;
  slot: MealSlot;
  isSide: boolean;
  onSubmit: (meal: Recipe) => void;
}

/** Size presets per slot: light, regular, hearty */
const PRESETS: Record<MealSlot | 'side', [number, number, number]> = {
  breakfast: [300, 450, 600],
  lunch: [400, 650, 900],
  dinner: [400, 650, 900],
  snack: [150, 250, 400],
  side: [100, 200, 300],
};
const PRESET_LABELS = ['Light', 'Regular', 'Hearty'];
const KINDS: QuickMealKind[] = ['home', 'out', 'ready'];

/** Plan a meal without a recipe. Only the name is required; calories may be a preset, an estimate or left out. */
export const QuickMealForm: React.FC<QuickMealFormProps> = ({ id, initialName, slot, isSide, onSubmit }) => {
  const [name, setName] = useState(initialName);
  const [kind, setKind] = useState<QuickMealKind>(slot === 'snack' ? 'ready' : 'home');
  const [preset, setPreset] = useState<number | null>(null);
  const [exact, setExact] = useState('');
  const [estimatedExact, setEstimatedExact] = useState(false);
  const [shopping, setShopping] = useState('');
  const [error, setError] = useState('');
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState('');

  const presets = PRESETS[isSide ? 'side' : slot];

  const estimate = async () => {
    if (!name.trim()) { setError('Enter a name first'); return; }
    setEstimating(true);
    setEstimateError('');
    try {
      const kcal = await estimateMealCalories(name.trim(), kind, slot);
      if (kcal === null) { setEstimateError("Couldn't estimate that one. Pick a size or enter a number."); return; }
      setExact(String(kcal));
      setEstimatedExact(true);
      setPreset(null);
      setError('');
    } catch (e) {
      console.error(e);
      setEstimateError("Couldn't estimate right now. Try again in a moment.");
    } finally {
      setEstimating(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Enter a name'); return; }
    let calories: number | null = preset;
    if (exact.trim() !== '') {
      const kcal = Number(exact);
      if (!Number.isFinite(kcal) || kcal < 0 || kcal > 5000) { setError('Enter calories from 0 to 5000'); return; }
      calories = Math.round(kcal);
    }
    const estimated = preset !== null || (exact.trim() !== '' && estimatedExact);
    onSubmit({
      id: crypto.randomUUID(),
      name: name.trim(),
      calories: calories ?? 0,
      ingredients: kind === 'home' ? shopping.split('\n').map(line => line.trim()).filter(Boolean) : [],
      instructions: [],
      tags: isSide ? ['side dish'] : [slot],
      servings: 1,
      description: QUICK_MEAL_DESCRIPTION,
      quick: { kind, estimated: estimated || undefined, noCalories: calories === null || undefined },
    });
  };

  return (
    <form id={id} onSubmit={submit} noValidate className="space-y-5">
      <label className="block">
        <span className="block text-sm font-semibold text-muted mb-1.5">Name</span>
        <input
          value={name}
          onChange={e => { setName(e.target.value); setError(''); }}
          placeholder="Taco Friday"
          className={`input w-full ${error === 'Enter a name' ? 'input-error' : ''}`}
        />
      </label>

      <fieldset>
        <legend className="text-sm font-semibold text-muted mb-1.5">What kind of meal</legend>
        <div role="radiogroup" aria-label="What kind of meal" className="segmented flex w-full">
          {KINDS.map(k => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className="segment flex-1 justify-center !px-2"
            >
              {QUICK_MEAL_KINDS[k].label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-muted mb-1.5">Calories <span className="font-normal">· optional</span></legend>
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
        {estimateError && <p className="text-sm text-error mt-1">{estimateError}</p>}
      </fieldset>

      {kind === 'home' && (
        <label className="block">
          <span className="block text-sm font-semibold text-muted mb-1.5">Shopping <span className="font-normal">· add what you'll need to buy, one per line</span></span>
          <textarea
            value={shopping}
            onChange={e => setShopping(e.target.value)}
            rows={3}
            placeholder={'Tortillas\nMinced beef 500 g\nAvocados'}
            className="input w-full resize-none"
          />
        </label>
      )}

      {error && <p className="text-sm text-error" role="alert">{error}</p>}
    </form>
  );
};
