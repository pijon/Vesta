import React, { useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Sheet } from './Sheet';
import { useDevMode } from '../contexts/DevModeContext';

interface WeightEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentWeight: number;
    onSave: (weight: number) => void;
}

/** Accepts "82,4" as well as "82.4" (Swedish keyboards). */
const parseWeight = (s: string) => {
    const n = parseFloat(s.replace(',', '.'));
    return Number.isFinite(n) && n > 0 && n < 500 ? n : null;
};

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const WeightEntrySheet: React.FC<Omit<WeightEntryModalProps, 'isOpen'>> = ({ onClose, currentWeight, onSave }) => {
    const [value, setValue] = useState(currentWeight > 0 ? currentWeight.toFixed(1) : '');
    const inputRef = useRef<HTMLInputElement>(null);
    const market = useDevMode().isFeatureEnabled('marketTheme');
    const weight = parseWeight(value);
    const diff = weight !== null && currentWeight > 0 ? Math.round((weight - currentWeight) * 10) / 10 : null;

    const step = (delta: number) => {
        const base = weight ?? (currentWeight || 70);
        setValue((Math.round((base + delta) * 10) / 10).toFixed(1));
    };

    const save = () => {
        if (weight === null) return;
        onSave(Math.round(weight * 10) / 10);
        onClose();
    };

    const stepButton = (delta: number, label: string, Icon: typeof Plus) => (
        <button
            type="button"
            onClick={() => step(delta)}
            aria-label={label}
            className="icon-btn !size-12 shrink-0 bg-surface-sunken border-transparent"
        >
            <Icon size={20} />
        </button>
    );

    return (
        <Sheet
            title="Log weight"
            subtitle={currentWeight > 0 ? `Last logged ${fmt(currentWeight)} kg` : undefined}
            onClose={onClose}
            initialFocus={inputRef}
            footer={<button onClick={save} disabled={weight === null} className="btn-primary btn-block">Save weight</button>}
        >
            <form onSubmit={e => { e.preventDefault(); save(); }} className="pt-2">
                <div className="flex items-center justify-center gap-3">
                    {stepButton(-0.1, 'Decrease by 0.1 kg', Minus)}
                    <label className={`relative flex items-baseline justify-center tile-weight min-w-0 ${market ? 'rounded-[28px] px-5 py-5 w-56' : 'rounded-[14px] px-4 py-3 w-48'}`}>
                        <span className="sr-only">Weight in kilograms</span>
                        <input
                            ref={inputRef}
                            value={value}
                            onChange={e => setValue(e.target.value.replace(/[^\d.,]/g, ''))}
                            onFocus={e => e.target.select()}
                            inputMode="decimal"
                            placeholder="75.0"
                            className={`w-full min-w-0 bg-transparent text-center font-display font-extrabold leading-tight text-main placeholder:text-muted focus:outline-none ${market ? 'text-[64px] tracking-[-0.04em]' : 'text-5xl tracking-tight'}`}
                        />
                        <span className="text-lg font-bold text-weight-text">kg</span>
                    </label>
                    {stepButton(0.1, 'Increase by 0.1 kg', Plus)}
                </div>
                <p className="text-sm text-muted text-center mt-3 min-h-5" aria-live="polite">
                    {diff === null ? '' : diff === 0 ? 'Same as last time' : `${fmt(Math.abs(diff))} kg ${diff < 0 ? 'less' : 'more'} than last time`}
                </p>
                <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
            </form>
        </Sheet>
    );
};

/** Log today's weight: one big number with fine steppers, compared with the last weigh-in. */
export const WeightEntryModal: React.FC<WeightEntryModalProps> = ({ isOpen, ...props }) =>
    isOpen ? <WeightEntrySheet {...props} /> : null;
