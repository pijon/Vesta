import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface OnboardingWizardProps {
    onComplete: (data: { name: string; currentWeight: number; goalWeight: number }) => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
    const [step, setStep] = useState(0);
    const [name, setName] = useState('');
    const [weight, setWeight] = useState('');
    const [goal, setGoal] = useState('');

    const canProceed = () => {
        if (!name.trim()) return false;
        if (!weight || parseFloat(weight) <= 0) return false;
        if (!goal || parseFloat(goal) <= 0) return false;
        return true;
    };

    const handleSubmit = () => {
        if (canProceed()) {
            onComplete({
                name: name.trim(),
                currentWeight: parseFloat(weight),
                goalWeight: parseFloat(goal)
            });
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--stone-900)]/80 backdrop-blur-md p-4 animate-fade-in">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-lg bg-white dark:bg-white/5-glass border border-white/20 shadow-2xl rounded-3xl overflow-hidden p-8 md:p-12"
            >
                <div className="text-center space-y-6">
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        <img src="/resources/logo_light.png" alt="Vesta Logo" className="h-16 w-auto mx-auto mb-6" />
                        <h1 className="text-3xl md:text-4xl font-serif font-medium text-charcoal dark:text-stone-200 mb-3">Welcome to Vesta</h1>
                        <p className="text-xl text-charcoal/60 dark:text-stone-400">Let's personalize your journey.</p>
                    </motion.div>

                    <div className="space-y-6 pt-6">
                        <motion.div
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="space-y-2 text-left"
                        >
                            <label className="block text-sm font-bold text-charcoal dark:text-stone-200 uppercase tracking-wide ml-1">What should we call you?</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Your Name"
                                className="w-full p-4 text-lg bg-stone-50 dark:bg-[#1A1714]/50 border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none text-charcoal dark:text-stone-200 placeholder:text-charcoal/60 dark:text-stone-400/50 transition-all focus:bg-stone-50 dark:bg-[#1A1714]"
                                autoFocus
                            />
                        </motion.div>

                        <div className="grid grid-cols-2 gap-4">
                            <motion.div
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.5 }}
                                className="space-y-2 text-left"
                            >
                                <label className="block text-sm font-bold text-charcoal dark:text-stone-200 uppercase tracking-wide ml-1">Current Weight</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={weight}
                                        onChange={(e) => setWeight(e.target.value)}
                                        placeholder="0.0"
                                        className="w-full p-4 text-lg bg-stone-50 dark:bg-[#1A1714]/50 border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none text-charcoal dark:text-stone-200 placeholder:text-charcoal/60 dark:text-stone-400/50 transition-all focus:bg-stone-50 dark:bg-[#1A1714]"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-charcoal/60 dark:text-stone-400 font-bold">kg</span>
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.6 }}
                                className="space-y-2 text-left"
                            >
                                <label className="block text-sm font-bold text-charcoal dark:text-stone-200 uppercase tracking-wide ml-1">Goal Weight</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={goal}
                                        onChange={(e) => setGoal(e.target.value)}
                                        placeholder="0.0"
                                        className="w-full p-4 text-lg bg-stone-50 dark:bg-[#1A1714]/50 border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none text-charcoal dark:text-stone-200 placeholder:text-charcoal/60 dark:text-stone-400/50 transition-all focus:bg-stone-50 dark:bg-[#1A1714]"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-charcoal/60 dark:text-stone-400 font-bold">kg</span>
                                </div>
                            </motion.div>
                        </div>
                    </div>

                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.8 }}
                        className="pt-8"
                    >
                        <button
                            onClick={handleSubmit}
                            disabled={!canProceed()}
                            className={`w-full py-4 rounded-2xl font-bold text-lg shadow-xl shadow-primary/20 transition-all transform active:scale-95 ${canProceed()
                                ? 'bg-gradient-to-r from-[var(--terracotta-500)] to-[var(--terracotta-600)] text-white hover:brightness-110'
                                : 'bg-white dark:bg-white/5-muted text-charcoal/60 dark:text-stone-400 cursor-not-allowed'
                                }`}
                        >
                            Start My Vesta Journey
                        </button>
                        <p className="mt-4 text-xs text-charcoal/60 dark:text-stone-400">By continuing, I commit to tracking my progress honestly.</p>
                    </motion.div>
                </div>
            </motion.div>
        </div>
    );
};
