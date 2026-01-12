import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FastingState, FastingConfig, FastingProtocol } from '../types';

interface FastingWidgetProps {
    fastingState: FastingState;
    onStartFast: () => void;
    onEndFast: () => void;
    onUpdateConfig: (config: FastingConfig) => void;
}

export const FastingWidget: React.FC<FastingWidgetProps> = ({ fastingState, onStartFast, onEndFast, onUpdateConfig }) => {
    const [elapsed, setElapsed] = useState(0);
    const [percent, setPercent] = useState(0);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Update timer every second
    useEffect(() => {
        const updateTimer = () => {
            if (fastingState.isFasting && fastingState.startTime) {
                const now = Date.now();
                const diff = now - fastingState.startTime;
                setElapsed(diff);

                const targetMs = fastingState.config.targetFastHours * 60 * 60 * 1000;
                setPercent(Math.min(100, (diff / targetMs) * 100));
            } else if (!fastingState.isFasting && fastingState.endTime) {
                // Show time since last fast ended (eating window)
                const now = Date.now();
                const diff = now - fastingState.endTime;
                setElapsed(diff);
                setPercent(0);
            } else {
                setElapsed(0);
                setPercent(0);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [fastingState]);

    const formatTime = (ms: number) => {
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor(ms / (1000 * 60 * 60));

        // Show only hours:mins if long duration, or full if short?
        // Let's keep h:mm:ss for precision feel
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const protocols: FastingProtocol[] = ['12:12', '16:8', '14:10', '18:6', '20:4'];

    return (
        <div className="bg-surface shadow-sm border border-border rounded-3xl overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-orange-500/20 pointer-events-none"></div>

            {/* Settings Modal */}
            <AnimatePresence>
                {isSettingsOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute inset-0 bg-surface z-30 p-6 flex flex-col"
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-serif text-lg font-medium text-main">Fasting Protocol</h3>
                            <button
                                onClick={() => setIsSettingsOpen(false)}
                                className="p-1 bg-background rounded-full text-muted hover:text-main transition-colors border border-transparent hover:border-border"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <div className="space-y-3 overflow-y-auto custom-scrollbar pr-1">
                            {protocols.map(p => {
                                const target = parseInt(p.split(':')[0]);
                                const isSelected = fastingState.config.protocol === p;

                                return (
                                    <button
                                        key={p}
                                        onClick={() => {
                                            onUpdateConfig({ protocol: p, targetFastHours: target });
                                            setIsSettingsOpen(false);
                                        }}
                                        className={`w-full p-3 rounded-xl border flex justify-between items-center transition-all text-sm ${isSelected
                                            ? 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-400'
                                            : 'bg-background border-border text-muted hover:bg-surface hover:border-orange-200 dark:hover:border-orange-800'
                                            }`}
                                    >
                                        <span className="font-bold">{p}</span>
                                        <span className="text-xs bg-surface px-2 py-1 rounded-md border border-border shadow-sm text-main">
                                            {target}h fast
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="p-6 relative z-10 flex justify-between items-center gap-6 h-52">
                <div className="flex-1 flex flex-col justify-between h-full">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`p-2 rounded-lg ${fastingState.isFasting ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-serif text-main font-medium leading-none">
                                    {fastingState.isFasting ? 'Fasting' : 'Eating'}
                                </h3>
                                <button
                                    onClick={() => setIsSettingsOpen(true)}
                                    className="text-xs text-muted font-medium hover:text-orange-500 flex items-center gap-1 transition-colors mt-0.5"
                                    title="Change protocol"
                                >
                                    {fastingState.config.protocol} <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                </button>
                            </div>
                        </div>

                        <div className="mt-2">
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-bold text-main tabular-nums">
                                    {formatTime(elapsed).replace(/:/g, ':')}
                                </span>
                                <span className="text-sm text-muted font-medium">hrs</span>
                            </div>
                            <p className="text-xs text-orange-400/80 font-medium mt-1 uppercase tracking-wide">
                                {fastingState.isFasting ? 'Elapsed' : 'Since fast'}
                            </p>
                        </div>
                    </div>

                    <div>
                        {fastingState.isFasting ? (
                            <button
                                onClick={onEndFast}
                                className="px-4 py-2 bg-surface rounded-xl border border-orange-100 dark:border-orange-800/30 shadow-sm text-orange-600 dark:text-orange-400 text-sm font-bold hover:bg-orange-50 dark:hover:bg-orange-900/20 active:scale-95 transition-all w-full md:w-auto"
                            >
                                End Fast
                            </button>
                        ) : (
                            <button
                                onClick={onStartFast}
                                className="px-4 py-2 bg-orange-500 rounded-xl shadow-lg border border-orange-400 shadow-orange-500/20 text-white text-sm font-bold hover:bg-orange-600 active:scale-95 transition-all w-full md:w-auto"
                            >
                                Start Fast
                            </button>
                        )}
                    </div>
                </div>

                {/* Visual Tracker (Right Side) */}
                <div className="w-40 h-40 relative flex items-center justify-center flex-shrink-0">
                    {fastingState.isFasting ? (
                        <React.Fragment>
                            <svg className="w-full h-full transform -rotate-90">
                                <circle
                                    cx="50%"
                                    cy="50%"
                                    r="56"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    className="text-muted/20"
                                />
                                <circle
                                    cx="50%"
                                    cy="50%"
                                    r="56"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    strokeDasharray="351" // 2 * pi * 56 = 351.8
                                    strokeDashoffset={351 - (351 * percent) / 100}
                                    strokeLinecap="round"
                                    className="text-orange-500 transition-all duration-1000 ease-out"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-lg font-bold text-main">{Math.round(percent)}%</span>
                            </div>
                        </React.Fragment>
                    ) : (
                        <div className="w-24 h-24 bg-surface rounded-full flex items-center justify-center border-4 border-emerald-100 dark:border-emerald-900/30 text-emerald-500 shadow-inner">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 12h2a2 2 0 1 0 0-4h-2v4Z" /><path d="m16.7 13.4-.9-1.8c.8-1.1 1.2-2.5 1.2-4a7 7 0 0 0-7-7 7 7 0 0 0-7 7c0 1.5.4 2.9 1.2 4l-.9 1.8a2 2 0 0 0 2.6 2.6l1.8-.9c1.1.8 2.5 1.2 4 1.2s2.9-.4 4-1.2l1.8.9a2 2 0 0 0 2.6-2.6Z" /></svg>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
