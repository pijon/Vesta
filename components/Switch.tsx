import React from 'react';

interface SwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    /** Accessible name; leave out when a <label htmlFor={id}> names the switch */
    label?: string;
    id?: string;
    disabled?: boolean;
}

/** On/off switch: an ink track when on, with a 44px tap area. */
export const Switch: React.FC<SwitchProps> = ({ checked, onChange, label, id, disabled }) => (
    <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`hit-target relative shrink-0 w-12 h-7 rounded-full transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${checked ? 'bg-ink' : 'bg-border-control'}`}
    >
        <span aria-hidden="true" className={`absolute top-1 left-1 size-5 rounded-full bg-surface transition-transform motion-reduce:transition-none ${checked ? 'translate-x-5' : ''}`} />
    </button>
);
