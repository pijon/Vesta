import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Droplets, Flame, Scale, Target, CookingPot, X } from 'lucide-react';
import type { UserExperience, UserSetupSubmission, UserStats } from '../types';
import { DEFAULT_USER_STATS } from '../constants';
import { VestaMark } from './VestaMark';
import { ExperienceChoice } from './ExperienceChoice';

export type OnboardingResult = UserSetupSubmission;

interface OnboardingWizardProps {
    /** Existing values to start from (e.g. when re-run from Settings) */
    stats?: Partial<UserStats>;
    initialExperience?: UserExperience;
    allowExperienceChoice: boolean;
    intent: 'required' | 'switch' | 'rerun';
    onComplete: (data: OnboardingResult) => Promise<void>;
    /** Shown as a close button; leave out when the profile is required */
    onCancel?: () => void;
}

/** Accepts "82,4" as well as "82.4". */
const num = (s: string) => {
    const n = parseFloat(s.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : null;
};

const str = (n: number | undefined) => (n && n > 0 ? String(n) : '');

const NumberField: React.FC<{
    label: string;
    hint?: string;
    unit: string;
    value: string;
    onChange: (v: string) => void;
    Icon: typeof Scale;
    tone: string;
    decimal?: boolean;
    inputRef?: React.Ref<HTMLInputElement>;
}> = ({ label, hint, unit, value, onChange, Icon, tone, decimal, inputRef }) => (
    <label className="flex items-center gap-3 rounded-[14px] border border-border bg-surface p-3 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-[var(--focus-ring)]">
        <span className={`size-10 shrink-0 flex items-center justify-center ${tone} rounded-full`}><Icon size={20} aria-hidden="true" /></span>
        <span className="flex-1 min-w-0">
            <span className="block font-semibold leading-snug">{label}</span>
            {hint && <span className="block text-xs text-muted">{hint}</span>}
        </span>
        <span className="flex items-baseline gap-1 shrink-0">
            <input
                ref={inputRef}
                value={value}
                onChange={e => onChange(e.target.value.replace(decimal ? /[^\d.,]/g : /\D/g, ''))}
                inputMode={decimal ? 'decimal' : 'numeric'}
                placeholder="0"
                className="w-20 bg-transparent text-right font-display font-extrabold text-2xl text-main placeholder:text-muted focus:outline-none"
            />
            <span className="text-sm font-semibold text-muted w-8">{unit}</span>
        </span>
    </label>
);

/** Planning setup needs only a name. Tracking adds explicit personal health answers. */
export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ stats, initialExperience, allowExperienceChoice, intent, onComplete, onCancel }) => {
    const [step, setStep] = useState(0);
    const [experience, setExperience] = useState<UserExperience | null>(initialExperience ?? (allowExperienceChoice ? null : 'tracking'));
    const steps = experience === 'tracking' ? ['About you', 'Your weight', 'Daily targets'] : ['About you'];
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const submitting = useRef(false);
    const mounted = useRef(true);
    const errorRef = useRef<HTMLParagraphElement>(null);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
    // Titles at the greeting's size
    const title = 'font-display font-extrabold text-[40px] leading-[1.02] tracking-[-0.04em]';
    const [name, setName] = useState(stats?.name ?? '');
    const [weight, setWeight] = useState(str(stats?.currentWeight));
    const [goal, setGoal] = useState(str(stats?.goalWeight));
    const [nourish, setNourish] = useState(str(stats?.nonFastDayCalories ?? DEFAULT_USER_STATS.nonFastDayCalories));
    const [fast, setFast] = useState(str(stats?.dailyCalorieGoal ?? DEFAULT_USER_STATS.dailyCalorieGoal));
    const [water, setWater] = useState(str(stats?.dailyWaterGoal ?? DEFAULT_USER_STATS.dailyWaterGoal));

    const nameRef = useRef<HTMLInputElement>(null);
    const weightRef = useRef<HTMLInputElement>(null);
    const nourishRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const target = [nameRef, weightRef, nourishRef][step].current;
        // Wait for the step to render before focusing
        const frame = requestAnimationFrame(() => target?.focus());
        return () => cancelAnimationFrame(frame);
    }, [step]);

    const w = num(weight);
    const g = num(goal);
    const valid = [
        !!experience && !!name.trim() && name.trim().length <= 100,
        w !== null && g !== null && w < 500 && g < 500,
        !!num(nourish) && !!num(fast) && !!num(water),
    ];
    const diff = w !== null && g !== null ? Math.round((w - g) * 10) / 10 : null;

    const next = async () => {
        if (submitting.current || !valid[step] || !experience) return;
        if (step < steps.length - 1) { setStep(step + 1); return; }
        submitting.current = true;
        setBusy(true);
        setError(null);
        try {
            await onComplete(experience === 'planning' ? { experience, name: name.trim() } : {
                experience, name: name.trim(),
                currentWeight: Math.round(w! * 10) / 10,
                goalWeight: Math.round(g! * 10) / 10,
                nonFastDayCalories: Math.round(num(nourish)!),
                dailyCalorieGoal: Math.round(num(fast)!),
                dailyWaterGoal: Math.round(num(water)!),
            });
        } catch (failure) {
            if (mounted.current) setError(failure instanceof Error ? failure.message : 'Your setup could not be saved. Try again.');
        } finally {
            submitting.current = false;
            if (mounted.current) setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-background overflow-y-auto motion-safe:animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
            <div className="min-h-dvh max-w-md mx-auto px-4 py-6 md:py-12 flex flex-col">
                {/* Progress */}
                <div className="flex items-center gap-3 mb-8">
                    {step > 0 ? (
                        <button disabled={busy} onClick={() => setStep(step - 1)} className="icon-btn shrink-0" aria-label="Back"><ArrowLeft size={20} /></button>
                    ) : <span className="size-11 shrink-0" aria-hidden="true" />}
                    <div className="flex-1 flex gap-1.5" aria-label={`Step ${step + 1} of ${steps.length}`} role="img">
                        {steps.map((_, i) => (
                            <span key={i} className={`flex-1 rounded-full transition-colors h-2.5 ${i <= step ? 'bg-[var(--hero)]' : 'bg-border'}`} />
                        ))}
                    </div>
                    {onCancel ? (
                        <button disabled={busy} onClick={onCancel} className="icon-btn shrink-0" aria-label="Close"><X size={20} /></button>
                    ) : <span className="size-11 shrink-0" aria-hidden="true" />}
                </div>

                <form className="flex-1 flex flex-col" onSubmit={e => { e.preventDefault(); void next(); }}>
                    <fieldset disabled={busy} key={step} className="flex-1 motion-safe:animate-page-in min-w-0">
                        {step === 0 && (
                            <>
                                <VestaMark className="size-16 mb-5" />
                                <h1 id="onboarding-title" className={title}>{intent === 'switch' ? 'Make Vesta yours' : 'Welcome to Vesta'}</h1>
                                <p className="text-muted mt-2 mb-6">Plan meals and cook together. Choose what works for you.</p>
                                {allowExperienceChoice && <div className="mb-6"><ExperienceChoice value={experience} onChange={setExperience} disabled={busy} /></div>}
                                <label className="block">
                                    <span className="block text-sm font-semibold mb-1.5">What should we call you?</span>
                                    <input
                                        ref={nameRef}
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        autoComplete="given-name"
                                        autoCapitalize="words"
                                        placeholder="Your first name"
                                        maxLength={100}
                                        className="input w-full text-lg"
                                    />
                                </label>
                            </>
                        )}

                        {step === 1 && (
                            <>
                                <h1 id="onboarding-title" className={title}>Hi {name.trim().split(' ')[0]}. Where are you starting?</h1>
                                <p className="text-muted mt-2 mb-8">We'll save your weight as today's weigh-in.</p>
                                <div className="space-y-2">
                                    <NumberField label="Weight today" unit="kg" value={weight} onChange={setWeight} Icon={Scale} tone="tile-weight" decimal inputRef={weightRef} />
                                    <NumberField label="Goal weight" unit="kg" value={goal} onChange={setGoal} Icon={Target} tone="tile-weight" decimal />
                                </div>
                                <p className="text-sm text-muted mt-3 min-h-5" aria-live="polite">
                                    {diff === null ? '' : diff === 0 ? "You're already at your goal. Vesta will help you stay there." : `That's ${Math.abs(diff).toLocaleString()} kg to ${diff > 0 ? 'lose' : 'gain'}.`}
                                </p>
                            </>
                        )}

                        {step === 2 && (
                            <>
                                <h1 id="onboarding-title" className={title}>Your daily targets</h1>
                                <p className="text-muted mt-2 mb-8">Every day is a nourish day unless you mark it as a fast day in the planner.</p>
                                <div className="space-y-2">
                                    <NumberField label="Nourish day" hint="A normal day" unit="kcal" value={nourish} onChange={setNourish} Icon={CookingPot} tone="tile-calories" inputRef={nourishRef} />
                                    <NumberField label="Fast day" hint="A lighter day, if you do them" unit="kcal" value={fast} onChange={setFast} Icon={Flame} tone="tile-fasting" />
                                    <NumberField label="Water" unit="ml" value={water} onChange={setWater} Icon={Droplets} tone="tile-water" />
                                </div>
                                <p className="text-sm text-muted mt-3">You can change all of this later in Settings.</p>
                            </>
                        )}
                    </fieldset>

                    {busy && <p role="status" className="text-sm text-muted mt-4">Saving your setup…</p>}
                    {error && <p ref={errorRef} tabIndex={-1} role="alert" className="text-sm text-error mt-4">{error}</p>}

                    <button type="submit" disabled={busy || !valid[step]} className="btn-primary btn-lg btn-block mt-8">
                        {step < steps.length - 1 ? <>Continue <ArrowRight size={18} aria-hidden="true" /></> : 'Start using Vesta'}
                    </button>
                </form>
            </div>
        </div>
    );
};
