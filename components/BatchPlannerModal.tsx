import React, { useState, useEffect } from 'react';
import { Utensils, Check, Flame, Sparkles, RefreshCw } from 'lucide-react';
import { planSpecificDays, DayConfig } from '../services/geminiService';
import { getDayPlan, getRecipes, getUserStats, saveDayPlan } from '../services/storageService';
import { getMyGroupId } from '../services/groupService';
import { dayTarget, planMeal, slotFor } from '../utils/planUtils';
import { Recipe } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { localDateString, parseLocalDate } from '../utils/dateUtils';
import { mealVisualFor } from '../utils/mealVisual';
import { Sheet } from './Sheet';

interface BatchPlannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode?: 'sunday_reset' | 'manual';
}

type Step = 'ignite' | 'config' | 'planning' | 'review' | 'complete';

const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];

const BatchPlannerModal: React.FC<BatchPlannerModalProps> = ({ isOpen, onClose, mode = 'sunday_reset' }) => {
    const { user } = useAuth();
    const [step, setStep] = useState<Step>('ignite');
    const [season, setSeason] = useState<string>('Winter');

    // Day Configuration State (New)
    const [dayConfigs, setDayConfigs] = useState<DayConfig[]>([]);

    const [generatedPlan, setGeneratedPlan] = useState<{ date: string, mealIds: string[], type?: 'fast' | 'non-fast' }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [recipes, setRecipes] = useState<Recipe[]>([]);

    // Determine current season automatically on mount
    useEffect(() => {
        const month = new Date().getMonth();
        if (month >= 2 && month <= 4) setSeason('Spring');
        else if (month >= 5 && month <= 7) setSeason('Summer');
        else if (month >= 8 && month <= 10) setSeason('Autumn');
        else setSeason('Winter');
    }, []);

    // Initialize days when entering config (or on mount/open)
    useEffect(() => {
        if (isOpen) {
            // If manual mode, skip "ignite" step
            if (mode === 'manual' && step === 'ignite') {
                setStep('config');
            }

            // Generate next 5 days if starting fresh or just opened in manual
            if (step === 'ignite' || (mode === 'manual' && dayConfigs.length === 0)) {
                const days: DayConfig[] = [];
                const today = new Date();
                for (let i = 0; i < 5; i++) {
                    const d = new Date(today);
                    d.setDate(today.getDate() + 1 + i); // Start from tomorrow
                    days.push({
                        date: localDateString(d),
                        type: 'non-fast',
                        meals: 3,
                        useLeftovers: false,
                        ignore: false
                    });
                }
                setDayConfigs(days);
            }
        }
    }, [isOpen, step, mode]);

    useEffect(() => {
        const loadRecipes = async () => {
            if (user?.uid) {
                const r = await getRecipes();
                setRecipes(r);
            }
        };
        loadRecipes();
    }, [user]);

    const handleIgnite = () => {
        setStep('config');
    };

    const handlePlan = async () => {
        setStep('planning');
        setIsLoading(true);
        try {
            const stats = await getUserStats();
            const targets = { fast: dayTarget({ type: 'fast' }, stats), nourish: dayTarget(undefined, stats) };
            const plan = await planSpecificDays(recipes, dayConfigs, targets, season);
            setGeneratedPlan(plan);
            setStep('review');
        } catch (error) {
            console.error(error);
            setStep('config');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAcceptPlan = async () => {
        setIsLoading(true);
        try {
            // Fill only the open slots: meals already planned (and family dinners) stay
            const inFamily = !!(await getMyGroupId());
            for (const day of generatedPlan) {
                const existing = await getDayPlan(day.date);
                const taken = new Set(existing.meals.map(slotFor));
                const added: Recipe[] = [];
                day.mealIds.forEach(id => {
                    const recipe = recipes.find(rec => rec.id === id);
                    if (!recipe) return;
                    const slot = slotFor(recipe);
                    if (slot === 'snack' || taken.has(slot)) return;
                    taken.add(slot);
                    added.push(planMeal(recipe, slot, { familyDinner: inFamily && slot === 'dinner' }));
                });

                await saveDayPlan({
                    ...existing,
                    meals: [...existing.meals, ...added],
                    type: day.type || existing.type,
                });
            }
            setStep('complete');
        } catch (e) {
            console.error("Saving failed", e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSwapMeal = (dayIndex: number, mealIndex: number) => {
        if (recipes.length === 0) return;

        const currentDay = generatedPlan[dayIndex];
        const usedIds = new Set(currentDay.mealIds);

        const candidates = recipes.filter(r => !usedIds.has(r.id));

        if (candidates.length > 0) {
            const randomRecipe = candidates[Math.floor(Math.random() * candidates.length)];

            const newPlan = [...generatedPlan];
            newPlan[dayIndex] = {
                ...newPlan[dayIndex],
                mealIds: [...newPlan[dayIndex].mealIds]
            };
            newPlan[dayIndex].mealIds[mealIndex] = randomRecipe.id;

            setGeneratedPlan(newPlan);
        }
    };

    const updateDayConfig = (index: number, updates: Partial<DayConfig>) => {
        const newConfigs = [...dayConfigs];
        newConfigs[index] = { ...newConfigs[index], ...updates };
        setDayConfigs(newConfigs);
    };

    const handleClose = () => {
        setStep('ignite'); // Reset step for next time, though useEffect might override if manual
        onClose();
    };

    // --- Render ---

    const dayLabel = (date: string, opts: Intl.DateTimeFormatOptions) => parseLocalDate(date).toLocaleDateString(undefined, opts);
    const activeDays = dayConfigs.filter(d => !d.ignore).length;

    if (!isOpen) return null;

    if (step === 'ignite') {
        return (
            <Sheet
                title="Your Sunday reset"
                subtitle="Plan the week ahead in a few taps, with recipes from your own cookbook."
                onClose={handleClose}
                footer={<button onClick={handleIgnite} className="btn-primary btn-block">Start your week</button>}
            >
                <div className="flex justify-center py-6" aria-hidden="true">
                    <span className="size-24 rounded-full bg-primary-light text-primary flex items-center justify-center">
                        <Sparkles size={44} />
                    </span>
                </div>
            </Sheet>
        );
    }

    if (step === 'config') {
        return (
            <Sheet
                title={mode === 'sunday_reset' ? 'Set up the coming week' : 'Plan the next days'}
                subtitle="Choose which days to fill and how. Meals you've already planned stay."
                onClose={handleClose}
                footer={
                    <button onClick={handlePlan} disabled={activeDays === 0} className="btn-primary btn-block">
                        <Sparkles size={18} aria-hidden="true" /> Plan {activeDays} {activeDays === 1 ? 'day' : 'days'}
                    </button>
                }
            >
                <div className="space-y-4">
                    <fieldset>
                        <legend className="block text-sm font-semibold mb-1.5">Season</legend>
                        <div className="flex flex-wrap gap-1.5">
                            {SEASONS.map(s => (
                                <button key={s} type="button" onClick={() => setSeason(s)} aria-pressed={season === s} className="chip">{s}</button>
                            ))}
                        </div>
                    </fieldset>

                    <ul className="space-y-2">
                        {dayConfigs.map((day, idx) => {
                            const name = dayLabel(day.date, { weekday: 'long' });
                            return (
                                <li key={day.date} className="rounded-[18px] border border-border p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <label className="flex items-center gap-3 min-w-0 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={!day.ignore}
                                                onChange={() => updateDayConfig(idx, { ignore: !day.ignore })}
                                                className="size-5 shrink-0 accent-[var(--ink)]"
                                            />
                                            <span className="min-w-0">
                                                <span className={`block font-semibold ${day.ignore ? 'text-muted' : ''}`}>{name}</span>
                                                <span className="block text-xs text-muted">{dayLabel(day.date, { day: 'numeric', month: 'short' })}</span>
                                            </span>
                                        </label>
                                        {!day.ignore && (
                                            <button
                                                type="button"
                                                onClick={() => updateDayConfig(idx, { type: day.type === 'fast' ? 'non-fast' : 'fast' })}
                                                aria-pressed={day.type === 'fast'}
                                                aria-label={`Fast day on ${name}`}
                                                className={`chip shrink-0 ${day.type === 'fast' ? '!bg-fasting-bg !text-fasting-text' : ''}`}
                                            >
                                                <Flame size={14} aria-hidden="true" /> {day.type === 'fast' ? 'Fast day' : 'Nourish day'}
                                            </button>
                                        )}
                                    </div>

                                    {!day.ignore && (
                                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-muted" id={`meals-${day.date}`}>Meals</span>
                                                <div className="segmented" role="radiogroup" aria-labelledby={`meals-${day.date}`}>
                                                    {[2, 3, 4].map(num => (
                                                        <button
                                                            key={num}
                                                            type="button"
                                                            role="radio"
                                                            aria-checked={day.meals === num}
                                                            onClick={() => updateDayConfig(idx, { meals: num })}
                                                            className="segment !px-3.5"
                                                        >
                                                            {num}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    role="switch"
                                                    checked={day.useLeftovers}
                                                    onChange={() => updateDayConfig(idx, { useLeftovers: !day.useLeftovers })}
                                                    className="size-5 accent-[var(--ink)]"
                                                />
                                                Leftovers for lunch
                                            </label>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </Sheet>
        );
    }

    if (step === 'planning') {
        return (
            <Sheet title="Planning your week" onClose={handleClose}>
                <div className="py-10 flex flex-col items-center text-center gap-4" role="status">
                    <span className="spinner spinner-lg text-primary" aria-hidden="true" />
                    <p className="text-muted">Picking recipes that fit your days…</p>
                </div>
            </Sheet>
        );
    }

    if (step === 'review') {
        return (
            <Sheet
                title="Your plan"
                subtitle="Swap anything you don't fancy, then save it."
                size="lg"
                onClose={handleClose}
                footer={
                    <div className="flex gap-2">
                        <button onClick={handlePlan} disabled={isLoading} className="btn-secondary"><RefreshCw size={16} aria-hidden="true" /> Plan again</button>
                        <button onClick={handleAcceptPlan} disabled={isLoading} className="btn-primary flex-1">
                            {isLoading ? 'Saving…' : 'Save plan'}
                        </button>
                    </div>
                }
            >
                <div className="space-y-5">
                    {generatedPlan.map((day, idx) => (
                        <section key={day.date} aria-label={dayLabel(day.date, { weekday: 'long' })}>
                            <div className="flex items-center justify-between gap-3 mb-1">
                                <h3 className="heading-3">{dayLabel(day.date, { weekday: 'long' })}</h3>
                                <span className={`badge ${day.type === 'fast' ? 'badge-fasting' : 'badge-neutral'}`}>{day.type === 'fast' ? 'Fast day' : 'Nourish day'}</span>
                            </div>
                            <ul>
                                {day.mealIds.map((id, mIdx) => {
                                    const r = recipes.find(rec => rec.id === id);
                                    const visual = r ? mealVisualFor(r) : null;
                                    return (
                                        <li key={mIdx} className="flex items-center gap-3 py-2 border-t border-border first:border-t-0">
                                            {r?.image ? (
                                                <img src={r.image} alt="" className="icon-tile size-10 shrink-0 object-cover" />
                                            ) : (
                                                <span className={`icon-tile size-10 shrink-0 flex items-center justify-center ${visual?.tint ?? 'tile-neutral'}`} aria-hidden="true">
                                                    {visual ? <visual.Icon size={18} strokeWidth={1.75} /> : <Utensils size={18} />}
                                                </span>
                                            )}
                                            <span className="flex-1 min-w-0 font-semibold truncate">{r ? r.name : 'Recipe not found'}</span>
                                            <button
                                                onClick={() => handleSwapMeal(idx, mIdx)}
                                                className="icon-btn shrink-0"
                                                aria-label={`Swap ${r ? r.name : 'this meal'}`}
                                            >
                                                <RefreshCw size={16} />
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    ))}
                </div>
            </Sheet>
        );
    }

    return (
        <Sheet
            title="Your week is planned"
            subtitle="Your meals have been added to the table."
            onClose={handleClose}
            footer={<button onClick={handleClose} className="btn-primary btn-block">Back to the planner</button>}
        >
            <div className="flex justify-center py-6" aria-hidden="true">
                <span className="size-24 rounded-full tile-weight flex items-center justify-center">
                    <Check size={44} />
                </span>
            </div>
        </Sheet>
    );
};

export default BatchPlannerModal;
