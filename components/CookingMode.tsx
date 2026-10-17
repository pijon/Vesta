import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CookingPot, ListChecks, Minus, Plus, Sun, Timer, X } from 'lucide-react';
import { Recipe } from '../types';
import { scaleIngredient } from '../utils/scaleIngredient';
import { ingredientsInStep, timersIn } from '../utils/cookSteps';
import { Portal } from './Portal';

interface CookingModeProps {
    recipe: Recipe;
    onClose: () => void;
    /** Given when the recipe is one of today's meals not yet eaten: offered once the last step is done */
    onEaten?: () => void;
}

/** A timer started from a step; `step` is the step's index */
interface RunningTimer { id: string; step: number; label: string; endsAt: number; seconds: number }
interface FinishedTimer { id: string; step: number; label: string; seconds: number }

const clock = (seconds: number) => {
    const s = Math.max(0, Math.ceil(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

const durationLabel = (seconds: number) =>
    seconds >= 3600 ? `${Math.round((seconds / 3600) * 10) / 10} h` : seconds >= 60 ? `${Math.round(seconds / 60)} min` : `${seconds} s`;

/** Three short beeps and a buzz when a timer ends. */
const chime = () => {
    try {
        navigator.vibrate?.([300, 150, 300]);
        const ctx = new AudioContext();
        [0, 0.35, 0.7].forEach(t => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.25, ctx.currentTime + t);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.25);
            osc.connect(gain).connect(ctx.destination);
            osc.start(ctx.currentTime + t);
            osc.stop(ctx.currentTime + t + 0.3);
        });
        setTimeout(() => ctx.close(), 1500);
    } catch {
        // Sound is a nice-to-have
    }
};

/** Keeps the screen on while cooking, where the browser supports it. Returns whether it's held. */
const useWakeLock = () => {
    const [held, setHeld] = useState(false);
    useEffect(() => {
        if (!('wakeLock' in navigator)) return;
        let lock: WakeLockSentinel | null = null;
        let cancelled = false;
        const request = async () => {
            try {
                lock = await navigator.wakeLock.request('screen');
                if (cancelled) { lock.release(); return; }
                setHeld(true);
                lock.addEventListener('release', () => setHeld(false));
            } catch {
                setHeld(false);
            }
        };
        // The lock is dropped when the tab is hidden; take it again on return
        const onVisible = () => { if (document.visibilityState === 'visible') request(); };
        request();
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', onVisible);
            lock?.release();
        };
    }, []);
    return held;
};

/**
 * Full-screen, step-by-step cooking: one large step at a time with the ingredients it mentions,
 * ingredients scaled to the servings being cooked, one-tap timers for times mentioned in a step,
 * and the screen kept awake.
 */
export const CookingMode: React.FC<CookingModeProps> = ({ recipe, onClose, onEaten }) => {
    const steps = recipe.instructions?.filter(s => s.trim()) ?? [];
    const baseServings = recipe.servings > 0 ? recipe.servings : 1;
    const [step, setStep] = useState(0);
    const [servings, setServings] = useState(baseServings);
    const [checked, setChecked] = useState<Set<number>>(new Set());
    // On phones and tablets the ingredients open over the step; from lg they sit beside it
    const [showIngredients, setShowIngredients] = useState(steps.length === 0);
    const [timers, setTimers] = useState<RunningTimer[]>([]);
    const [done, setDone] = useState<FinishedTimer[]>([]);
    const [now, setNow] = useState(Date.now());
    // Past the last step, asking whether to mark the meal as eaten
    const [finished, setFinished] = useState(false);
    const awake = useWakeLock();

    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const panelOpenRef = useRef(false);
    const touchX = useRef<number | null>(null);

    const last = Math.max(steps.length - 1, 0);
    const go = (to: number) => setStep(Math.min(Math.max(to, 0), last));
    const factor = servings / baseServings;
    const stepTimers = steps[step] ? timersIn(steps[step]) : [];
    const stepIngredients = steps[step] ? ingredientsInStep(steps[step], recipe.ingredients) : [];
    // Below lg the ingredients panel covers the step
    const panelOpen = showIngredients && steps.length > 0;
    panelOpenRef.current = panelOpen;

    // Keys: arrows move between steps; Escape closes the ingredients panel, then cook mode (not the recipe underneath)
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                if (panelOpenRef.current && !window.matchMedia('(min-width: 1024px)').matches) setShowIngredients(false);
                else onCloseRef.current();
            }
            const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
            if (typing) return;
            if (e.key === 'ArrowRight') setStep(s => Math.min(s + 1, last));
            if (e.key === 'ArrowLeft') setStep(s => Math.max(s - 1, 0));
        };
        window.addEventListener('keydown', onKey, true);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey, true);
            document.body.style.overflow = previousOverflow;
        };
    }, [last]);

    // Tick while any timer runs; chime for each one that finishes
    useEffect(() => {
        if (!timers.length) return;
        const id = setInterval(() => {
            const t = Date.now();
            setNow(t);
            const finishedTimers = timers.filter(timer => timer.endsAt <= t);
            if (finishedTimers.length) {
                chime();
                setTimers(prev => prev.filter(timer => timer.endsAt > t));
                setDone(prev => [...prev, ...finishedTimers.map(({ id, step, label, seconds }) => ({ id, step, label, seconds }))]);
            }
        }, 500);
        return () => clearInterval(id);
    }, [timers]);

    const startTimer = (label: string, seconds: number) => {
        const t = Date.now();
        setNow(t);
        // Starting it again clears the "done" note from last time
        setDone(prev => prev.filter(d => !(d.step === step && d.seconds === seconds)));
        setTimers(prev => [...prev, { id: crypto.randomUUID(), step, label, seconds, endsAt: t + seconds * 1000 }]);
    };

    const toggleIngredient = (i: number) => setChecked(prev => {
        const next = new Set(prev);
        if (next.has(i)) next.delete(i); else next.add(i);
        return next;
    });

    const ingredientRow = (i: number) => {
        const isChecked = checked.has(i);
        return (
            <li key={i}>
                <label className="flex items-start gap-3 py-2.5 border-b border-border last:border-b-0 cursor-pointer">
                    <input type="checkbox" checked={isChecked} onChange={() => toggleIngredient(i)} className="sr-only peer" />
                    <span className={`mt-0.5 size-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus-ring)] ${isChecked ? 'bg-ink border-ink text-on-ink' : 'border-border-control'}`} aria-hidden="true">
                        {isChecked && <Check size={14} strokeWidth={3} />}
                    </span>
                    <span className={`leading-snug ${isChecked ? 'text-muted line-through' : ''}`}>{scaleIngredient(recipe.ingredients[i], factor)}</span>
                </label>
            </li>
        );
    };

    const ingredients = (
        <div>
            <div className="flex items-center justify-between gap-3 mb-2">
                <h2 className="heading-3">Ingredients</h2>
                <div className="flex items-center gap-1" role="group" aria-label="Servings">
                    <button onClick={() => setServings(s => Math.max(1, s - 1))} disabled={servings <= 1} className="size-9 hit-target inline-flex items-center justify-center rounded-full bg-surface-sunken hover:bg-border disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]" aria-label="Fewer servings">
                        <Minus size={16} />
                    </button>
                    <span className="min-w-[5.5rem] text-center text-sm font-semibold" aria-live="polite">{servings} {servings === 1 ? 'serving' : 'servings'}</span>
                    <button onClick={() => setServings(s => Math.min(50, s + 1))} className="size-9 hit-target inline-flex items-center justify-center rounded-full bg-surface-sunken hover:bg-border focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]" aria-label="More servings">
                        <Plus size={16} />
                    </button>
                </div>
            </div>
            {recipe.ingredients.length ? (
                <ul>{recipe.ingredients.map((_, i) => ingredientRow(i))}</ul>
            ) : (
                <p className="text-sm text-muted">This recipe has no ingredients listed.</p>
            )}
        </div>
    );

    const markEaten = () => {
        onEaten?.();
        onClose();
    };

    return (
        <Portal>
            <div className="fixed inset-0 z-[200] bg-background flex flex-col animate-fade-in" role="dialog" aria-modal="true" aria-label={`Cooking ${recipe.name}`}>
                {/* Header */}
                <header className="shrink-0 flex items-center gap-2 px-3 md:px-6 py-3">
                    <button onClick={onClose} className="icon-btn shrink-0" aria-label="Stop cooking"><X size={20} /></button>
                    <div className="flex-1 min-w-0 px-1">
                        <p className="font-display font-extrabold leading-tight truncate">{recipe.name}</p>
                        <p className="text-xs text-muted flex items-center gap-1">
                            {finished ? 'All done' : steps.length ? `Step ${step + 1} of ${steps.length}` : 'Ingredients'}
                            {awake && <><span aria-hidden="true">·</span><Sun size={12} aria-hidden="true" /> Screen stays on</>}
                        </p>
                    </div>
                    {steps.length > 0 && !finished && (
                        <button
                            onClick={() => setShowIngredients(s => !s)}
                            aria-pressed={showIngredients}
                            aria-label="Ingredients"
                            className="chip lg:hidden shrink-0 min-h-11 px-4 max-sm:w-11 max-sm:px-0"
                        >
                            <ListChecks size={18} aria-hidden="true" /><span className="max-sm:hidden">Ingredients</span>
                        </button>
                    )}
                </header>

                {/* Running timers; tap one to go back to its step */}
                {(timers.length > 0 || done.length > 0) && (
                    <div className="shrink-0 flex gap-2 overflow-x-auto no-scrollbar px-3 md:px-6 pb-2" aria-live="polite">
                        {done.map(d => (
                            <button key={d.id} onClick={() => setDone(prev => prev.filter(x => x.id !== d.id))} className="shrink-0 badge badge-warning !rounded-full !text-sm !px-3 min-h-9" aria-label={`Step ${d.step + 1} timer (${d.label}) done. Dismiss`}>
                                <Timer size={14} aria-hidden="true" /> Step {d.step + 1} done <X size={14} aria-hidden="true" />
                            </button>
                        ))}
                        {timers.map(t => (
                            <span key={t.id} className="shrink-0 inline-flex items-center min-h-9 rounded-full tile-fasting text-sm font-semibold">
                                <button onClick={() => { go(t.step); setShowIngredients(false); setFinished(false); }} className="inline-flex items-center gap-1.5 min-h-9 pl-3 pr-1 rounded-full focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]" aria-label={`Step ${t.step + 1} timer, ${clock((t.endsAt - now) / 1000)} left. Go to step`}>
                                    <Timer size={14} aria-hidden="true" />
                                    <span className="font-normal">Step {t.step + 1}</span>
                                    <span aria-hidden="true">·</span>
                                    <span className="tabular-nums">{clock((t.endsAt - now) / 1000)}</span>
                                </button>
                                <button onClick={() => setTimers(prev => prev.filter(x => x.id !== t.id))} className="size-7 mr-1 hit-target inline-flex items-center justify-center rounded-full hover:bg-ink/10" aria-label={`Cancel step ${t.step + 1} timer`}>
                                    <X size={14} />
                                </button>
                            </span>
                        ))}
                    </div>
                )}

                {/* Body */}
                <div className="flex-1 min-h-0 flex">
                    <div className="flex-1 min-w-0 flex flex-col">
                        <div className="relative flex-1 min-h-0">
                            <main
                                className="absolute inset-0 overflow-y-auto"
                                onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
                                onTouchEnd={e => {
                                    if (touchX.current === null || finished) return;
                                    const dx = e.changedTouches[0].clientX - touchX.current;
                                    touchX.current = null;
                                    if (Math.abs(dx) > 60) go(step + (dx < 0 ? 1 : -1));
                                }}
                            >
                                <div className="max-w-2xl min-h-full mx-auto flex flex-col px-5 md:px-8 pt-4 pb-6 md:pt-8 md:pb-10">
                                    {finished ? (
                                        <div className="flex-1 flex flex-col items-center justify-center text-center motion-safe:animate-page-in">
                                            <span className="size-16 mb-5 rounded-full tile-calories flex items-center justify-center" aria-hidden="true"><CookingPot size={30} strokeWidth={2.25} /></span>
                                            <h2 className="heading-2">Enjoy your meal</h2>
                                            <p className="mt-2 text-muted">Mark {recipe.name} as eaten on today's plan?</p>
                                        </div>
                                    ) : steps.length > 0 ? (
                                        <>
                                            {/* Step progress, tappable */}
                                            <div className="shrink-0 flex gap-1.5" role="tablist" aria-label="Steps">
                                                {steps.map((_, i) => (
                                                    <button
                                                        key={i}
                                                        role="tab"
                                                        aria-selected={i === step}
                                                        aria-label={`Step ${i + 1}`}
                                                        onClick={() => go(i)}
                                                        className="flex-1 py-2 group focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] rounded"
                                                    >
                                                        <span className={`block rounded-full transition-colors h-2.5 ${i <= step ? 'bg-[var(--hero)]' : 'bg-border group-hover:bg-border-control'}`} />
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Short steps sit in the middle of the space; long ones start at the top */}
                                            <div key={step} className="flex-1 flex flex-col justify-center py-6 md:py-10 motion-safe:animate-page-in">
                                                <p className="size-14 mb-5 rounded-full bg-[var(--hero)] text-[var(--hero-foreground)] flex items-center justify-center font-display font-extrabold text-2xl"><span className="sr-only">Step </span>{step + 1}</p>
                                                <p className={`${steps[step].length > 220 ? 'text-2xl md:text-3xl' : 'text-[28px] md:text-4xl'} font-display font-bold leading-tight tracking-tight text-main`}>{steps[step]}</p>

                                                {stepTimers.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mt-6">
                                                        {stepTimers.map(t => {
                                                            const running = timers.find(r => r.step === step && r.seconds === t.seconds);
                                                            return running ? (
                                                                <span key={t.seconds} className="btn-sm inline-flex items-center gap-2 rounded-full font-semibold bg-ink text-on-ink" role="status">
                                                                    <Timer size={16} aria-hidden="true" /> {durationLabel(t.seconds)} timer · <span className="tabular-nums">{clock((running.endsAt - now) / 1000)}</span>
                                                                </span>
                                                            ) : (
                                                                <button key={t.seconds} onClick={() => startTimer(t.label, t.seconds)} className="btn-secondary btn-sm">
                                                                    <Timer size={16} aria-hidden="true" /> Start {durationLabel(t.seconds)} timer
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {stepIngredients.length > 0 && (
                                                    <section className="card p-4 md:p-5 mt-8" aria-label="For this step">
                                                        <h3 className="text-sm font-semibold text-muted mb-1">For this step</h3>
                                                        <ul>{stepIngredients.map(ingredientRow)}</ul>
                                                    </section>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-muted">This recipe has no steps yet. Here's what goes in it.</p>
                                    )}
                                </div>
                            </main>

                            {/* Below lg the ingredients open over the step */}
                            {(panelOpen || steps.length === 0) && !finished && (
                                <aside className="lg:hidden absolute inset-0 z-10 bg-background overflow-y-auto animate-fade-in" aria-label="Ingredients">
                                    <div className="max-w-2xl mx-auto px-5 md:px-8 py-5">{ingredients}</div>
                                </aside>
                            )}
                        </div>

                        {/* Controls, under the step column */}
                        {steps.length > 0 && (
                            <footer className="shrink-0 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
                                <div className="max-w-2xl mx-auto px-4 md:px-8">
                                    {finished ? (
                                        <div className="flex gap-3">
                                            <button onClick={onClose} className="btn-secondary btn-lg flex-1">Not now</button>
                                            <button onClick={markEaten} className="btn-primary btn-lg flex-[2]">
                                                <Check size={18} aria-hidden="true" /> Mark as eaten
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            {panelOpen && (
                                                <button onClick={() => setShowIngredients(false)} className="btn-primary btn-lg btn-block lg:hidden">
                                                    <ArrowLeft size={18} aria-hidden="true" /> Back to step {step + 1}
                                                </button>
                                            )}
                                            <div className={`gap-3 ${panelOpen ? 'hidden lg:flex' : 'flex'}`}>
                                                {step > 0 && (
                                                    <button onClick={() => go(step - 1)} className="btn-secondary btn-lg flex-1">
                                                        <ArrowLeft size={18} aria-hidden="true" /> Back
                                                    </button>
                                                )}
                                                {step < last ? (
                                                    <button onClick={() => go(step + 1)} className="btn-primary btn-lg flex-[2]">
                                                        Next step <ArrowRight size={18} aria-hidden="true" />
                                                    </button>
                                                ) : (
                                                    <button onClick={() => (onEaten ? setFinished(true) : onClose())} className="btn-primary btn-lg flex-[2]">
                                                        <Check size={18} aria-hidden="true" /> Done
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </footer>
                        )}
                    </div>

                    {/* From lg the ingredients sit beside the step */}
                    <aside className="hidden lg:block w-96 shrink-0 dark:border-l border-border bg-surface overflow-y-auto px-6 py-8" aria-label="Ingredients">
                        {ingredients}
                    </aside>
                </div>
            </div>
        </Portal>
    );
};
