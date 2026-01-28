import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Utensils, Check, Sparkles, RefreshCw } from 'lucide-react';
import { planSpecificDays, DayConfig } from '../services/geminiService';
import { getRecipes, saveDayPlan } from '../services/storageService';
import { Recipe, DayPlan } from '../types';
import { useAuth } from '../contexts/AuthContext';

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
                        date: d.toISOString().split('T')[0],
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
            // Use the new specific days planner
            const plan = await planSpecificDays(recipes, dayConfigs, season);
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
            for (const day of generatedPlan) {
                const meals = day.mealIds.map(id => {
                    const r = recipes.find(rec => rec.id === id);
                    return r ? { ...r } : null;
                }).filter(Boolean) as Recipe[];

                const fullPlan: DayPlan = {
                    date: day.date,
                    meals: meals,
                    completedMealIds: [],
                    tips: '',
                    type: day.type || 'non-fast'
                };

                await saveDayPlan(fullPlan);
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

    // --- Render Steps ---

    const renderIgnite = () => (
        <div className="text-center p-6 space-y-6">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-24 h-24 bg-hearth/10 rounded-full flex items-center justify-center mx-auto text-hearth"
            >
                <Sparkles size={48} />
            </motion.div>
            <div>
                <h2 className="text-2xl font-serif text-[var(--text-main)] mb-2">The Sunday Reset</h2>
                <p className="text-[var(--text-muted)]">Light the hearth for the week ahead. Configure each day to match your rhythm.</p>
            </div>
            <button
                onClick={handleIgnite}
                className="w-full py-4 bg-hearth text-white rounded-2xl text-lg font-medium hover:bg-hearth-dark transition-colors shadow-lg shadow-hearth/30"
            >
                Start Ritual
            </button>
        </div>
    );

    const renderConfig = () => (
        <div className="flex flex-col h-[80vh]">
            <div className="p-4 border-b border-[var(--border)] bg-[var(--surface)] flex-none z-10">
                <h3 className="text-xl font-serif text-[var(--text-main)] mb-3">
                    {mode === 'sunday_reset' ? 'Setup Upcoming Week' : 'Plan Days Ahead'}
                </h3>

                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {SEASONS.map(s => (
                        <button
                            key={s}
                            onClick={() => setSeason(s)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-all whitespace-nowrap ${season === s
                                ? 'border-hearth bg-hearth/10 text-hearth'
                                : 'border-[var(--border)] bg-transparent text-[var(--text-muted)]'
                                }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[var(--background)]">
                {dayConfigs.map((day, idx) => {
                    const isIgnored = day.ignore;
                    const dateObj = new Date(day.date);
                    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                    return (
                        <div key={day.date} className={`bg-[var(--input-bg)] rounded-2xl shadow-sm border transition-all ${isIgnored
                            ? 'opacity-50 border-[var(--border)]'
                            : 'border-[var(--border)]'
                            }`}>
                            {/* Header Row */}
                            <div className="p-3 flex items-center justify-between border-b border-[var(--border)]">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => updateDayConfig(idx, { ignore: !day.ignore })}
                                        className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors ${isIgnored
                                            ? 'bg-[var(--background)] border-[var(--border)]'
                                            : 'bg-hearth border-hearth'
                                            }`}
                                    >
                                        {!isIgnored && <Check size={14} className="text-white" />}
                                    </button>
                                    <div>
                                        <div className="font-bold text-[var(--text-main)] text-sm">{dayName}</div>
                                        <div className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">{dateStr}</div>
                                    </div>
                                </div>
                                {!isIgnored && (
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => updateDayConfig(idx, { type: day.type === 'fast' ? 'non-fast' : 'fast' })}
                                            className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${day.type === 'fast'
                                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                                : 'bg-sage-100 dark:bg-sage-900/30 text-sage-800 dark:text-sage-200'
                                                }`}
                                        >
                                            {day.type === 'fast' ? 'Fast Day' : 'Nourish'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Controls Row (Only if not ignored) */}
                            {!isIgnored && (
                                <div className="p-3 grid grid-cols-2 gap-4">
                                    {/* Meals Toggle */}
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-bold mb-1.5 block">Meals</label>
                                        <div className="flex bg-[var(--background)] rounded-xl p-1">
                                            {[2, 3, 4].map(num => (
                                                <button
                                                    key={num}
                                                    onClick={() => updateDayConfig(idx, { meals: num })}
                                                    className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all ${day.meals === num
                                                        ? 'bg-[var(--input-bg)] text-[var(--text-main)] shadow-sm'
                                                        : 'text-[var(--text-muted)]'
                                                        }`}
                                                >
                                                    {num}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Leftovers Toggle */}
                                    <div
                                        onClick={() => updateDayConfig(idx, { useLeftovers: !day.useLeftovers })}
                                        className={`cursor-pointer rounded-xl border p-2 flex items-center justify-between transition-all mt-[18px] ${day.useLeftovers
                                            ? 'border-purple-200 dark:border-purple-800/50 bg-purple-50 dark:bg-purple-900/20'
                                            : 'border-[var(--border)] bg-[var(--input-bg)] hover:bg-[var(--background)]'
                                            }`}
                                    >
                                        <div className="text-xs">
                                            <div className={`font-bold ${day.useLeftovers ? 'text-purple-700 dark:text-purple-300' : 'text-[var(--text-muted)]'}`}>Leftovers</div>
                                            <div className="text-[10px] text-[var(--text-muted)]">For lunch</div>
                                        </div>
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${day.useLeftovers ? 'bg-purple-500 border-purple-500' : 'border-[var(--border)]'}`}>
                                            {day.useLeftovers && <Check size={10} className="text-white" />}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="p-4 border-t border-[var(--border)] bg-[var(--surface)] flex-none z-10">
                <button
                    onClick={handlePlan}
                    className="w-full py-3.5 bg-[var(--text-main)] text-[var(--background)] rounded-2xl hover:opacity-90 transition-opacity shadow-lg shadow-charcoal/20 dark:shadow-white/10 font-medium"
                >
                    Generate {dayConfigs.filter(d => !d.ignore).length} Days
                </button>
            </div>
        </div>
    );

    const renderPlanning = () => (
        <div className="p-12 text-center space-y-6">
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                className="w-20 h-20 border-4 border-hearth/20 border-t-hearth rounded-full mx-auto"
            />
            <div>
                <h3 className="text-xl font-serif text-[var(--text-main)] mb-2">Connecting to Fire...</h3>
                <p className="text-[var(--text-muted)]">Planning your nourishment...</p>
            </div>
        </div>
    );

    const renderReview = () => (
        <div className="h-[80vh] flex flex-col">
            <div className="p-4 border-b border-[var(--border)] bg-[var(--surface)]">
                <h3 className="text-xl font-serif text-[var(--text-main)]">Your Plan</h3>
                <p className="text-[var(--text-muted)] text-sm">Review your plan. Tap shuffle to swap a meal.</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--background)]">
                {generatedPlan.map((day, idx) => (
                    <div key={idx} className="bg-[var(--input-bg)] p-4 rounded-2xl shadow-sm border border-[var(--border)]">
                        <div className="flex justify-between items-center mb-4">
                            <span className="font-serif font-bold text-[var(--text-main)]">
                                {new Date(day.date).toLocaleDateString('en-US', { weekday: 'long' })}
                            </span>
                            <span className={`text-[10px] px-2 py-1 rounded-lg font-bold uppercase tracking-wider ${day.type === 'fast'
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                : 'bg-sage-100 dark:bg-sage-900/30 text-sage-800 dark:text-sage-200'
                                }`}>
                                {day.type === 'fast' ? 'Fast Day' : 'Nourish'}
                            </span>
                        </div>
                        <div className="space-y-3">
                            {day.mealIds.map((id, mIdx) => {
                                const r = recipes.find(rec => rec.id === id);
                                return (
                                    <div key={mIdx} className="flex items-center justify-between text-sm group">
                                        <div className="flex items-center flex-1 text-[var(--text-main)]">
                                            <Utensils size={14} className="mr-3 text-hearth flex-shrink-0" />
                                            <span className="truncate pr-4">{r ? r.name : 'Unknown Recipe'}</span>
                                        </div>
                                        <button
                                            onClick={() => handleSwapMeal(idx, mIdx)}
                                            className="p-2 rounded-full hover:bg-[var(--background)] text-[var(--text-muted)] hover:text-hearth transition-colors"
                                            title="Shuffle this meal"
                                        >
                                            <RefreshCw size={14} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
            <div className="p-4 bg-[var(--surface)] border-t border-[var(--border)] space-y-3">
                <button
                    onClick={handleAcceptPlan}
                    disabled={isLoading}
                    className="w-full py-3.5 bg-hearth text-white rounded-2xl font-medium shadow-lg shadow-hearth/30 hover:bg-hearth-dark transition-colors"
                >
                    {isLoading ? 'Saving...' : 'Confirm Plan'}
                </button>
                <button
                    onClick={handlePlan}
                    disabled={isLoading}
                    className="w-full py-3 text-[var(--text-muted)] text-sm hover:text-[var(--text-main)] transition-colors"
                >
                    Regenerate
                </button>
            </div>
        </div>
    );

    const renderComplete = () => (
        <div className="text-center p-8 space-y-6">
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-24 h-24 bg-sage-100 dark:bg-sage-900/30 rounded-full flex items-center justify-center mx-auto text-sage-600 dark:text-sage-400"
            >
                <Check size={48} />
            </motion.div>
            <div>
                <h2 className="text-2xl font-serif text-[var(--text-main)] mb-2">Plan Saved!</h2>
                <p className="text-[var(--text-muted)]">Your meals have been added to the table.</p>
            </div>
            <button
                onClick={handleClose}
                className="w-full py-4 bg-[var(--text-main)] text-[var(--background)] rounded-2xl text-lg font-medium hover:opacity-90 transition-colors shadow-lg"
            >
                Return to Planner
            </button>
        </div>
    );

    if (!isOpen) return null;

    return createPortal(
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            >
                <motion.div
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="bg-[var(--background)] w-full max-w-md rounded-[2.5rem] shadow-2xl border border-[var(--border)] overflow-hidden relative"
                >
                    {step !== 'ignite' && step !== 'complete' && (
                        <button onClick={handleClose} className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-main)] z-50 p-2">
                            <X size={24} />
                        </button>
                    )}

                    {step === 'ignite' && renderIgnite()}
                    {step === 'config' && renderConfig()}
                    {step === 'planning' && renderPlanning()}
                    {step === 'review' && renderReview()}
                    {step === 'complete' && renderComplete()}
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
};

export default BatchPlannerModal;
