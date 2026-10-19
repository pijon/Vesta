import React, { useId } from 'react';
import { CalendarDays, Check, Gauge } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { UserExperience } from '../types';

interface ExperienceChoiceProps {
  value: UserExperience | null;
  onChange: (value: UserExperience) => void;
  disabled?: boolean;
  /** Keep the question for screen readers only, when a heading above already asks it */
  hideLegend?: boolean;
}

const OPTIONS: { value: UserExperience; label: string; description: string; icon: LucideIcon; tile: string }[] = [
  { value: 'planning', label: 'Plan meals', description: 'Plan meals, save recipes and share the shopping.', icon: CalendarDays, tile: 'tile-weight' },
  { value: 'tracking', label: 'Plan meals and track nutrition', description: 'Plan together and keep your own nutrition log.', icon: Gauge, tile: 'tile-calories' },
];

/** The two ways to use Vesta, as cards. Real radios underneath, so keyboards and screen readers get a radio group */
export const ExperienceChoice: React.FC<ExperienceChoiceProps> = ({ value, onChange, disabled = false, hideLegend = false }) => {
  const group = useId();
  return (
    <fieldset disabled={disabled} className="min-w-0 @container">
      <legend className={hideLegend ? 'sr-only' : 'font-semibold mb-3'}>How would you like to use Vesta?</legend>
      {/* Side by side only where the cards have room (wide Settings, not the narrow onboarding) */}
      <div className="grid gap-2 @xl:grid-cols-2">
        {OPTIONS.map(option => {
          const selected = value === option.value;
          const id = `${group}-${option.value}`;
          const Icon = option.icon;
          return (
            <label
              key={option.value}
              htmlFor={id}
              className={`flex items-center gap-3 rounded-3xl p-4 min-h-11 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus-ring)] ${selected ? 'bg-ink text-on-ink' : 'bg-surface-sunken text-main'} ${disabled ? 'cursor-wait' : 'cursor-pointer'}`}
            >
              <input id={id} name={group} type="radio" value={option.value} checked={selected} disabled={disabled}
                onChange={() => onChange(option.value)} className="sr-only" />
              <span className={`icon-tile ${option.tile} size-10 shrink-0 flex items-center justify-center`} aria-hidden="true">
                <Icon size={18} strokeWidth={2.25} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-semibold">{option.label}</span>
                <span className={`block text-sm mt-0.5 ${selected ? 'text-on-ink-muted' : 'text-muted'}`}>{option.description}</span>
              </span>
              <span
                className={`size-6 shrink-0 rounded-full flex items-center justify-center ${selected ? 'bg-on-ink text-ink' : 'border-2 border-muted'}`}
                aria-hidden="true"
              >
                {selected && <Check size={14} strokeWidth={3} />}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
};
