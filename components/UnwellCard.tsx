import React, { useState } from 'react';
import { Check, ChevronDown, Thermometer } from 'lucide-react';

interface UnwellCardProps {
  unwell: boolean;
  /** Water so far and the day's goal, in ml */
  water: number;
  waterGoal: number;
  onSet: (unwell: boolean) => void;
}

const litres = (ml: number) => (ml / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 });

/**
 * Today's "Feeling unwell" mark: a quiet button until it's set, then a one-line row that opens to gentle advice. The day
 * stays out of the burn estimate and streaks pause over it (utils/unwell.ts).
 */
export const UnwellCard: React.FC<UnwellCardProps> = ({ unwell, water, waterGoal, onSet }) => {
  const [open, setOpen] = useState(false);
  if (!unwell) {
    return (
      <div className="flex justify-end">
        <button onClick={() => onSet(true)} className="btn-ghost btn-sm">
          <Thermometer size={16} aria-hidden="true" /> Feeling unwell?
        </button>
      </div>
    );
  }
  return (
    <section className="card px-4 py-3" aria-label="Feeling unwell">
      <div className="flex items-center gap-3">
        <span className="icon-tile size-9 shrink-0 tile-water flex items-center justify-center"><Thermometer size={16} aria-hidden="true" /></span>
        <button
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="flex-1 min-w-0 flex items-center gap-1.5 text-left"
        >
          <span className="min-w-0">
            <span className="block font-semibold truncate">Unwell today</span>
            <span className="block text-xs text-muted truncate">Streaks paused</span>
          </span>
          <ChevronDown size={16} aria-hidden="true" className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        <button onClick={() => onSet(false)} className="btn-ghost btn-sm shrink-0"><Check size={16} aria-hidden="true" /> I'm fine</button>
      </div>
      {open && (
        <ul className="mt-3 pl-12 space-y-1.5 text-sm leading-relaxed">
          <li>
            <span className="font-semibold">Drink plenty.</span> Water, tea and broth all help
            {water < waterGoal ? `: ${litres(water)} of ${litres(waterGoal)} L so far.` : ', and you\'ve reached your goal.'}
          </li>
          <li><span className="font-semibold">Rest comes first.</span> With only a stuffy nose or a sore throat a gentle walk is fine; with a fever, aches or a chesty cough, skip the workout.</li>
          <li><span className="font-semibold">Eat what you can.</span> Today stays out of your burn estimate, and so do weigh-ins for three days after. Mark each day you're unwell.</li>
        </ul>
      )}
    </section>
  );
};
