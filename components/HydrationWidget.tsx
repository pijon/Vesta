import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface HydrationWidgetProps {
    intake: number;
    goal: number;
    onAdd: (amount: number) => void;
}

export const HydrationWidget: React.FC<HydrationWidgetProps> = ({ intake, goal, onAdd }) => {
    const percentage = Math.min(100, (intake / goal) * 100);
    const [isAddOpen, setIsAddOpen] = useState(false);

    // Bubbles animation
    const bubbles = [1, 2, 3, 4, 5];

    return (
        <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-800/30 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-900/10 pointer-events-none" />

            <div className="p-6 relative z-10 flex justify-between items-center gap-6">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-blue-100 dark:bg-blue-800/50 rounded-lg text-blue-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"></path><path d="M14.83 14.8v7.38"></path><path d="M16.96 16.96l-7.387.38"></path><path d="M9.58 14.8l7.38 7.38"></path></svg>
                        </div>
                        <h3 className="text-xl font-serif text-slate-800 dark:text-slate-100 font-medium">Hydration</h3>
                    </div>

                    <div className="mt-4">
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{intake}</span>
                            <span className="text-sm text-slate-400 font-medium">/ {goal} ml</span>
                        </div>
                        <p className="text-xs text-blue-400/80 font-medium mt-1 uppercase tracking-wide">Daily Goal</p>
                    </div>

                    <div className="mt-6 flex gap-3">
                        <button
                            onClick={() => onAdd(250)}
                            className="px-4 py-2 bg-white dark:bg-slate-800 rounded-xl border border-blue-100 dark:border-blue-800/30 shadow-sm text-blue-600 dark:text-blue-400 text-sm font-bold hover:bg-blue-50 dark:hover:bg-blue-900/20 active:scale-95 transition-all flex items-center gap-2"
                        >
                            <span className="text-lg">+</span> 250ml
                        </button>
                        <button
                            onClick={() => onAdd(500)}
                            className="px-4 py-2 bg-blue-500 rounded-xl shadow-lg border border-blue-400 shadow-blue-500/20 text-white text-sm font-bold hover:bg-blue-600 active:scale-95 transition-all flex items-center gap-2"
                        >
                            <span className="text-lg">+</span> 500ml
                        </button>
                    </div>
                </div>

                {/* Visual Tracker */}
                <div className="w-24 h-40 bg-white dark:bg-slate-800 rounded-2xl border-2 border-blue-100 dark:border-blue-800/30 relative overflow-hidden shadow-inner">
                    {/* Glass reflections */}
                    <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-l from-white/20 to-transparent pointer-events-none z-20"></div>

                    {/* Liquid */}
                    <motion.div
                        className="absolute bottom-0 left-0 right-0 bg-blue-400 dark:bg-blue-500 z-10"
                        initial={{ height: 0 }}
                        animate={{ height: `${percentage}%` }}
                        transition={{ type: "spring", stiffness: 60, damping: 15 }}
                    >
                        {/* Wave surface */}
                        <div className="absolute -top-3 left-0 w-[200%] h-6 bg-blue-300/30 dark:bg-blue-400/30 rounded-[100%] animate-wave" style={{ transform: 'rotate(-2deg)' }}></div>

                        {/* Bubbles */}
                        {bubbles.map(i => (
                            <motion.div
                                key={i}
                                className="absolute bg-white/30 rounded-full"
                                style={{
                                    width: Math.random() * 6 + 2,
                                    height: Math.random() * 6 + 2,
                                    left: `${Math.random() * 80 + 10}%`,
                                    bottom: -10
                                }}
                                animate={{
                                    y: [0, -150],
                                    opacity: [0, 1, 0],
                                    x: [0, Math.sin(i) * 10]
                                }}
                                transition={{
                                    repeat: Infinity,
                                    duration: Math.random() * 2 + 3,
                                    delay: Math.random() * 5,
                                    ease: "linear"
                                }}
                            />
                        ))}
                    </motion.div>

                    {/* Measurements */}
                    <div className="absolute inset-0 z-20 flex flex-col justify-between py-2 px-1 pointer-events-none">
                        <div className="w-2 h-[1px] bg-slate-300 dark:bg-slate-600 self-end mr-1"></div>
                        <div className="w-3 h-[1px] bg-slate-300 dark:bg-slate-600 self-end mr-1"></div>
                        <div className="w-2 h-[1px] bg-slate-300 dark:bg-slate-600 self-end mr-1"></div>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes wave {
                    0% { transform: translateX(0) rotate(-2deg); }
                    50% { transform: translateX(-25%) rotate(2deg); }
                    100% { transform: translateX(0) rotate(-2deg); }
                }
                .animate-wave {
                    animation: wave 4s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};
