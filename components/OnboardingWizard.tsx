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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--background)]/80 backdrop-blur-md p-4 animate-fade-in">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-lg bg-[var(--surface)] border border-border/50 shadow-2xl rounded-[2.5rem] overflow-hidden p-8 md:p-12 relative"
            >
                {/* Decorative Background */}
                <div className="absolute top-0 right-0 p-12 opacity-[0.03] text-[var(--text-main)] pointer-events-none transform translate-x-1/4 -translate-y-1/4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>
                </div>

                <div className="text-center space-y-8 relative z-10">
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        <div className="w-20 h-20 mx-auto mb-6 bg-primary/10 rounded-full flex items-center justify-center text-4xl shadow-sm animate-pulse-slow">
                            🔥
                        </div>
                        <h1 className="text-3xl md:text-4xl font-serif font-bold text-[var(--text-main)] mb-3">Welcome to Vesta</h1>
                        <p className="text-xl text-[var(--text-secondary)] font-medium">Let's tend to your health.</p>
                    </motion.div>

                    <div className="space-y-6">
                        <motion.div
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="space-y-2 text-left"
                        >
                            <label className="block text-sm font-bold text-[var(--text-main)] uppercase tracking-wide ml-1">What should we call you?</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Your Name"
                                className="w-full p-4 text-lg bg-[var(--input-bg)] border border-border rounded-2xl focus:ring-2 focus:ring-primary/50 outline-none text-[var(--text-main)] placeholder-[var(--text-muted)] transition-all shadow-sm"
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
                                <label className="block text-sm font-bold text-[var(--text-main)] uppercase tracking-wide ml-1">Current Weight</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={weight}
                                        onChange={(e) => setWeight(e.target.value)}
                                        placeholder="0.0"
                                        className="w-full p-4 text-lg bg-[var(--input-bg)] border border-border rounded-2xl focus:ring-2 focus:ring-primary/50 outline-none text-[var(--text-main)] placeholder-[var(--text-muted)] transition-all shadow-sm"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] font-bold text-sm">kg</span>
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.6 }}
                                className="space-y-2 text-left"
                            >
                                <label className="block text-sm font-bold text-[var(--text-main)] uppercase tracking-wide ml-1">Goal Weight</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={goal}
                                        onChange={(e) => setGoal(e.target.value)}
                                        placeholder="0.0"
                                        className="w-full p-4 text-lg bg-[var(--input-bg)] border border-border rounded-2xl focus:ring-2 focus:ring-primary/50 outline-none text-[var(--text-main)] placeholder-[var(--text-muted)] transition-all shadow-sm"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] font-bold text-sm">kg</span>
                                </div>
                            </motion.div>
                        </div>
                    </div>

                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.8 }}
                        className="pt-4"
                    >
                        <button
                            onClick={handleSubmit}
                            disabled={!canProceed()}
                            className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2 ${canProceed()
                                ? 'bg-primary text-white hover:brightness-110 hover:shadow-primary/30'
                                : 'bg-[var(--card-bg)] text-[var(--text-muted)] cursor-not-allowed'
                                }`}
                        >
                            <span>Start My Vesta Journey</span>
                            {canProceed() && (
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
                            )}
                        </button>
                    </motion.div>
                </div>
            </motion.div>
        </div>
    );
};
