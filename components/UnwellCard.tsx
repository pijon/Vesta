import React from 'react';
import { Check, Thermometer } from 'lucide-react';

interface UnwellCardProps {
  unwell: boolean;
  /** Water so far and the day's goal, in ml */
  water: number;
  waterGoal: number;
  onSet: (unwell: boolean) => void;
}

const litres = (ml: number) => (ml / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 });

/**
 * Today's "Feeling unwell" mark: a quiet button until it's set, then gentle advice for the day. The day
 * stays out of the burn estimate and streaks pause over it (utils/unwell.ts).
 */
export const UnwellCard: React.FC<UnwellCardProps> = ({ unwell, water, waterGoal, onSet }) => {
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
    <section className="card p-5 md:p-6" aria-label="Feeling unwell">
      <div className="flex items-start gap-4">
        <span className="icon-tile size-12 shrink-0 tile-water flex items-center justify-center"><Thermometer size={20} aria-hidden="true" /></span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-muted">Feeling unwell</p>
          <h2 className="heading-3">Take it easy today</h2>
          <ul className="mt-2 space-y-1.5 leading-relaxed">
            <li>
              <span className="font-semibold">Drink plenty.</span> Water, tea and broth all help
              {water < waterGoal ? `: ${litres(water)} of ${litres(waterGoal)} L so far.` : ', and you\'ve reached your goal.'}
            </li>
            <li>
              <span className="font-semibold">Rest comes first.</span> With only a stuffy nose or a sore throat a gentle walk is fine; with a fever, aches or a chesty cough, skip the workout.
            </li>
            <li>
              <span className="font-semibold">Eat what you can.</span> Today stays out of your burn estimate, and so do weigh-ins for three days after. Mark each day you're unwell.
            </li>
            <li>
              <span className="font-semibold">Your streaks are paused</span>, not broken.
            </li>
          </ul>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button onClick={() => onSet(false)} className="btn-ghost btn-sm"><Check size={16} aria-hidden="true" /> I'm feeling fine today</button>
          </div>
        </div>
      </div>
    </section>
  );
};
