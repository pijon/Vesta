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
        <div className="bg-surface p-6 rounded-3xl shadow-sm border border-border flex flex-col h-64 relative overflow-hidden group hover:shadow-md transition-all duration-500">
            {/* Decorative gradient orb */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-orange-400/5 to-orange-600/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>

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

            {/* Header: Label + Icon */}
            <div className="flex justify-between items-center mb-4 relative z-10">
                <div className='flex flex-col'>
                    <p className="text-muted text-xs font-bold uppercase tracking-widest leading-none">TRE Period</p>
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="text-[10px] text-muted font-medium hover:text-orange-500 flex items-center gap-1 transition-colors mt-1"
                        title="Change protocol"
                    >
                        {fastingState.config.protocol} <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                    </button>
                </div>

                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-none dark:shadow-lg transition-colors ${fastingState.isFasting ? 'bg-gradient-to-br from-orange-500 to-orange-700 dark:shadow-orange-500/30' : 'bg-gradient-to-br from-emerald-500 to-emerald-700 dark:shadow-emerald-500/30'}`}>
                    {fastingState.isFasting ? (
                        <svg width="18" height="18" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" clipRule="evenodd" d="M44 24C44 35.0457 35.0457 44 24 44C12.9543 44 4 35.0457 4 24C4 12.9543 12.9543 4 24 4C35.0457 4 44 12.9543 44 24ZM16.2218 31.7782C15.8313 31.3877 15.8313 30.7546 16.2218 30.364L22.5858 24.0001L16.2218 17.6361C15.8313 17.2455 15.8313 16.6124 16.2218 16.2218C16.6123 15.8313 17.2455 15.8313 17.636 16.2218L24 22.5858L30.364 16.2219C30.7545 15.8314 31.3877 15.8314 31.7782 16.2219C32.1687 16.6124 32.1687 17.2456 31.7782 17.6361L25.4142 24.0001L31.7782 30.364C32.1687 30.7545 32.1687 31.3877 31.7782 31.7782C31.3876 32.1687 30.7545 32.1687 30.364 31.7782L24 25.4143L17.6361 31.7782C17.2455 32.1688 16.6124 32.1688 16.2218 31.7782Z" fill="currentColor" />
                        </svg>
                    ) : (
                        <svg width="18" height="18" viewBox="0 0 17 17" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                            <g transform="translate(1.000000, 0.000000)">
                                <path d="M7.984,0.053 C3.599,0.053 0.045,3.614 0.045,8.006 C0.045,12.398 3.6,15.959 7.984,15.959 C12.368,15.959 15.923,12.398 15.923,8.006 C15.923,3.614 12.369,0.053 7.984,0.053 L7.984,0.053 Z M7.49,2.045 C8.328,2.045 9.009,2.699 9.009,3.505 C9.009,4.311 8.328,4.965 7.49,4.965 C6.65,4.965 5.971,4.311 5.971,3.505 C5.971,2.699 6.65,2.045 7.49,2.045 L7.49,2.045 Z M8.035,14.908 C4.984,14.908 2.342,10.918 8.101,7.984 C13.357,5.308 10.904,0.744 8.035,1.008 C12.41,1.008 14.974,4.119 14.974,7.958 C14.975,11.797 11.867,14.908 8.035,14.908 L8.035,14.908 Z" />
                                <ellipse cx="8.493" cy="11.445" rx="1.493" ry="1.445" />
                            </g>
                        </svg>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="h-28 flex flex-col relative z-10">
                {/* Hero Number */}
                <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl lg:text-5xl font-bold bg-gradient-to-br from-neutral-800 to-neutral-600 dark:from-neutral-100 dark:to-neutral-400 bg-clip-text text-transparent font-serif tracking-tight leading-none">
                        {formatTime(elapsed).split(':')[0]}<span className='text-3xl'>:{formatTime(elapsed).split(':')[1]}</span>
                    </span>
                    <span className="text-muted font-semibold text-lg">hrs</span>
                </div>

                {/* Action Row - Fixed h-8 alignment */}
                <div className="flex items-center justify-between gap-2 mt-auto h-8">
                    {/* Left: Status Badge */}
                    {/* Left: Status Badge */}
                    <div className={`px-2.5 py-1 rounded-lg shadow-sm text-[10px] font-bold uppercase flex items-center gap-1.5 border border-transparent ${fastingState.isFasting
                        ? 'bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100 dark:border-orange-600'
                        : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-600'
                        }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${fastingState.isFasting ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                        {fastingState.isFasting ? 'Fasting' : 'Eating Window'}
                    </div>

                    {/* Right: Action Button */}
                    {fastingState.isFasting ? (
                        <button
                            onClick={(e) => { e.stopPropagation(); onEndFast(); }}
                            className="bg-white border border-border text-neutral-900 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-100 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors shadow-sm"
                        >
                            End Fast
                        </button>
                    ) : (
                        <button
                            onClick={(e) => { e.stopPropagation(); onStartFast(); }}
                            className="bg-orange-500 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase hover:bg-orange-600 transition-colors shadow-sm shadow-orange-500/20"
                        >
                            Start Fast
                        </button>
                    )}
                </div>
            </div>

            {/* Progress Bar & Actions */}
            <div className="relative z-10 h-10 mt-auto">
                <div className="w-full bg-slate-100 dark:bg-white/10 h-2 rounded-full overflow-hidden shadow-inner mt-4">
                    <motion.div
                        className={`h-full rounded-full shadow-lg ${fastingState.isFasting
                            ? 'bg-gradient-to-r from-orange-400 to-orange-600 shadow-none dark:shadow-lg dark:shadow-orange-500/50'
                            : 'bg-gradient-to-r from-emerald-400 to-emerald-600 shadow-none dark:shadow-lg dark:shadow-emerald-500/50'
                            }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                    />
                </div>

                <div className="flex justify-between items-center mt-1.5">
                    <span className="text-xs text-muted font-semibold">
                        {fastingState.isFasting ? `${Math.round(percent)}% of target` : 'Tracking inactive'}
                    </span>
                </div>
            </div>
        </div>
    );
};

