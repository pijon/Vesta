import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppView, DayPlan, UserStats, DailyLog, FoodLogItem, WorkoutItem, Recipe, FastingState, FastingConfig } from './types';
import { getDayPlan, getUserStats, saveUserStats, getDailyLog, saveDailyLog, exportAllData, importAllData, getFastingState, saveFastingState, addFastingEntry, migrateFromLocalStorage, getLocalStorageDebugInfo } from './services/storageService';
import { TrackToday } from './components/TrackToday';
import { TrackAnalytics } from './components/TrackAnalytics';
import { Planner } from './components/Planner';
import { RecipeLibrary } from './components/RecipeLibrary';
import { ShoppingList } from './components/ShoppingList';
import { DesktopSidebar } from './components/DesktopSidebar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { APP_NAME, DEFAULT_USER_STATS } from './constants';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginScreen } from './components/LoginScreen';

const TrackerApp: React.FC = () => {
    const [view, setView] = useState<AppView>(AppView.TODAY);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [todayDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [tomorrowDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
    });

    const [todayPlan, setTodayPlan] = useState<DayPlan>({ date: '', meals: [], completedMealIds: [] });
    const [tomorrowPlan, setTomorrowPlan] = useState<DayPlan>({ date: '', meals: [], completedMealIds: [] });

    const [userStats, setUserStatsState] = useState<UserStats>(DEFAULT_USER_STATS);
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const saved = localStorage.getItem('fast800_darkMode');
        return saved ? JSON.parse(saved) : false;
    });

    const [fastingState, setFastingState] = useState<FastingState>({
        lastAteTime: null,
        config: { protocol: '16:8', targetFastHours: 16 }
    });

    // Dark mode effect
    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('fast800_darkMode', JSON.stringify(isDarkMode));
    }, [isDarkMode]);

    const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

    const [dailyLog, setDailyLog] = useState<DailyLog>({ date: '', items: [] });

    const refreshData = async () => {
        const [today, tomorrow, stats, log, fasting] = await Promise.all([
            getDayPlan(todayDate),
            getDayPlan(tomorrowDate),
            getUserStats(),
            getDailyLog(todayDate),
            getFastingState()
        ]);

        setTodayPlan(today);
        setTomorrowPlan(tomorrow);
        setUserStatsState({ ...DEFAULT_USER_STATS, ...stats, weightHistory: stats.weightHistory || [] });
        setDailyLog(log);
        setFastingState(fasting);
    };

    useEffect(() => {
        const init = async () => {
            await migrateFromLocalStorage();
            await refreshData();
        };
        init();
    }, [todayDate, tomorrowDate]);

    const handleUpdateStats = async (newStats: UserStats) => {
        const today = new Date().toISOString().split('T')[0];
        let history = [...(newStats.weightHistory || [])];
        const existingIndex = history.findIndex(h => h.date === today);

        if (existingIndex >= 0) {
            history[existingIndex] = { date: today, weight: newStats.currentWeight };
        } else {
            history.push({ date: today, weight: newStats.currentWeight });
        }
        history.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const finalStats = { ...newStats, weightHistory: history };
        setUserStatsState(finalStats);
        await saveUserStats(finalStats);
    };

    const handleAddFoodLogItems = async (items: FoodLogItem[]) => {
        const updatedLog: DailyLog = {
            ...dailyLog,
            items: [...dailyLog.items, ...items]
        };
        setDailyLog(updatedLog);
        await saveDailyLog(updatedLog);

        // Update TRE tracking - food was just logged
        await updateLastAteTime(Date.now());
    };

    const handleAddWorkout = async (workout: WorkoutItem) => {
        const updatedLog: DailyLog = {
            ...dailyLog,
            workouts: [...(dailyLog.workouts || []), workout]
        };
        setDailyLog(updatedLog);
        await saveDailyLog(updatedLog);
    };

    const handleUpdateWorkout = async (updatedWorkout: WorkoutItem) => {
        const updatedLog: DailyLog = {
            ...dailyLog,
            workouts: (dailyLog.workouts || []).map(w => w.id === updatedWorkout.id ? updatedWorkout : w)
        };
        setDailyLog(updatedLog);
        await saveDailyLog(updatedLog);
    };

    const handleDeleteWorkout = async (workoutId: string) => {
        const updatedLog: DailyLog = {
            ...dailyLog,
            workouts: (dailyLog.workouts || []).filter(w => w.id !== workoutId)
        };
        setDailyLog(updatedLog);
        await saveDailyLog(updatedLog);
    };

    const handleLogMeal = async (meal: Recipe, isAdding: boolean) => {
        // Use current state instead of fetching fresh to avoid extra DB read
        let newItems = [...(dailyLog.items || [])];

        if (isAdding) {
            newItems.push({
                id: crypto.randomUUID(),
                name: meal.name,
                calories: meal.calories,
                timestamp: Date.now()
            });
            // Update TRE tracking when adding a meal
            await updateLastAteTime(Date.now());
        } else {
            for (let i = newItems.length - 1; i >= 0; i--) {
                if (newItems[i].name === meal.name && newItems[i].calories === meal.calories) {
                    newItems.splice(i, 1);
                    break;
                }
            }
        }

        const updatedLog = { ...dailyLog, items: newItems };
        setDailyLog(updatedLog);
        await saveDailyLog(updatedLog);
    };

    const handleUpdateWeight = (weight: number) => {
        handleUpdateStats({ ...userStats, currentWeight: weight });
    };

    const updateLastAteTime = async (timestamp: number) => {
        // Check if we completed a successful fast before eating
        if (fastingState.lastAteTime) {
            const fastDuration = timestamp - fastingState.lastAteTime;
            const targetMs = fastingState.config.targetFastHours * 60 * 60 * 1000;

            if (fastDuration >= targetMs) {
                // Log successful fast to history
                await addFastingEntry({
                    id: crypto.randomUUID(),
                    startTime: fastingState.lastAteTime,
                    endTime: timestamp,
                    durationHours: fastDuration / (1000 * 60 * 60),
                    isSuccess: true
                });
            }
        }

        // Update to new eating time
        const newState: FastingState = {
            ...fastingState,
            lastAteTime: timestamp
        };
        setFastingState(newState);
        await saveFastingState(newState);
    };

    const handleUpdateFastingConfig = async (config: FastingConfig) => {
        const newState: FastingState = {
            ...fastingState,
            config
        };
        setFastingState(newState);
        await saveFastingState(newState);
    };

    const SettingsModal = () => {
        const [formStats, setFormStats] = useState(userStats);
        const [debugInfo, setDebugInfo] = useState<Record<string, string>>({});
        const [showDebug, setShowDebug] = useState(false);

        useEffect(() => {
            if (showDebug) {
                setDebugInfo(getLocalStorageDebugInfo());
            }
        }, [showDebug]);

        const handleForceSync = async () => {
            if (confirm("This will attempt to upload data found on this device to the cloud. Continue?")) {
                const result = await migrateFromLocalStorage(true);
                if (result.success) {
                    alert("Sync process finished successfully! Reloading...");
                    window.location.reload();
                } else {
                    alert(`Sync failed: ${result.error}\n\nCheck console for details.`);
                }
            }
        };

        const handleSave = () => {
            handleUpdateStats(formStats);
            setIsSettingsOpen(false);
        };

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setIsSettingsOpen(false)}>
                <div className="bg-surface w-full max-w-md rounded-2xl shadow-2xl overflow-hidden premium-shadow border border-border" onClick={e => e.stopPropagation()}>
                    <div className="p-6 border-b border-border flex justify-between items-center bg-background/50">
                        <h3 className="font-medium text-2xl text-main font-serif tracking-tight">Settings</h3>
                        <button onClick={() => setIsSettingsOpen(false)} className="p-2 bg-transparent hover:bg-muted/10 rounded-full text-muted hover:text-main transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                    <div className="p-6 space-y-5">
                        <div>
                            <label className="block text-sm font-bold text-main mb-2">Starting Weight (kg)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={formStats.startWeight}
                                onChange={(e) => setFormStats({ ...formStats, startWeight: parseFloat(e.target.value) || 0 })}
                                className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-medium text-main transition-all"
                            />
                            <p className="text-xs text-muted mt-1">Your weight when you began the diet.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-main mb-2">Current Weight (kg)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={formStats.currentWeight}
                                onChange={(e) => setFormStats({ ...formStats, currentWeight: parseFloat(e.target.value) || 0 })}
                                className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-medium text-main transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-main mb-2">Goal Weight (kg)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={formStats.goalWeight}
                                onChange={(e) => setFormStats({ ...formStats, goalWeight: parseFloat(e.target.value) || 0 })}
                                className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-medium text-main transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-main mb-2">Fasting Day Target</label>
                                <input
                                    type="number"
                                    value={formStats.dailyCalorieGoal}
                                    onChange={(e) => setFormStats({ ...formStats, dailyCalorieGoal: parseInt(e.target.value) || 0 })}
                                    className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-medium text-main transition-all"
                                />
                                <p className="text-xs text-muted mt-1">Target for fasting days</p>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-main mb-2">Non-Fast Day Target</label>
                                <input
                                    type="number"
                                    value={formStats.nonFastDayCalories || 2000}
                                    onChange={(e) => setFormStats({ ...formStats, nonFastDayCalories: parseInt(e.target.value) || 0 })}
                                    className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-medium text-main transition-all"
                                />
                                <p className="text-xs text-muted mt-1">Target for normal days</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 pt-0 space-y-4">
                        <button onClick={handleSave} className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg active:scale-95">
                            Save Settings
                        </button>

                        <div className="border-t border-border pt-4 mt-2">
                            <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Data Management</h4>
                            <div className="flex gap-3">
                                <button
                                    onClick={async () => {
                                        const json = await exportAllData();
                                        const blob = new Blob([json], { type: 'application/json' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `fast800_backup_${new Date().toISOString().split('T')[0]}.json`;
                                        a.click();
                                        URL.revokeObjectURL(url);
                                    }}
                                    className="flex-1 py-2.5 bg-surface border border-border text-main text-sm font-bold rounded-xl hover:bg-background transition-colors flex items-center justify-center gap-2 shadow-sm"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                    Export
                                </button>
                                <div className="flex-1 relative">
                                    <input
                                        type="file"
                                        accept=".json"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;

                                            if (!confirm("This will overwrite your current data. Are you sure?")) {
                                                e.target.value = '';
                                                return;
                                            }

                                            const reader = new FileReader();
                                            reader.onload = async (event) => {
                                                const content = event.target?.result as string;
                                                const result = await importAllData(content);
                                                if (result.success) {
                                                    alert("Data imported successfully!");
                                                    window.location.reload();
                                                } else {
                                                    alert(`Failed to import data: ${result.error}`);
                                                }
                                            };
                                            reader.readAsText(file);
                                        }}
                                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                    />
                                    <button className="w-full h-full py-2.5 bg-red-50 text-red-600 border border-red-100 text-sm font-bold rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                        Import
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Data Recovery Section */}
                        <div className="border-t border-border pt-4 mt-2">
                            <button
                                onClick={() => setShowDebug(!showDebug)}
                                className="text-xs text-muted hover:text-main underline mb-2"
                            >
                                {showDebug ? "Hide Recovery Tools" : "Show Recovery Tools"}
                            </button>

                            {showDebug && (
                                <div className="bg-slate-50 p-4 rounded-xl border border-border space-y-3">
                                    <h4 className="text-sm font-bold text-main">Local Data Recovery</h4>
                                    <div className="space-y-1">
                                        {Object.entries(debugInfo).map(([key, value]) => (
                                            <div key={key} className="flex justify-between text-xs">
                                                <span className="text-slate-500 font-mono">{key.replace('fast800_', '')}</span>
                                                <span className={(value as string).includes('Found') ? "text-emerald-600 font-bold" : "text-slate-400"}>{value}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={handleForceSync}
                                        className="w-full py-2 bg-emerald-100 text-emerald-700 border border-emerald-200 text-sm font-bold rounded-lg hover:bg-emerald-200 transition-colors"
                                    >
                                        Force Sync from Device
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Props for Track components (Dashboard, Trends, Weekly)
    const trackProps = {
        todayPlan,
        tomorrowPlan,
        stats: userStats,
        dailyLog,
        fastingState,
        onUpdateStats: handleUpdateStats,
        onLogMeal: handleLogMeal,
        onAddFoodLogItems: handleAddFoodLogItems,
        onUpdateFoodItem: async (item: FoodLogItem) => {
            const updatedLog = {
                ...dailyLog,
                items: dailyLog.items.map(i => i.id === item.id ? item : i)
            };
            setDailyLog(updatedLog);
            await saveDailyLog(updatedLog);
        },
        onDeleteFoodItem: async (itemId: string) => {
            const updatedLog = {
                ...dailyLog,
                items: dailyLog.items.filter(i => i.id !== itemId)
            };
            setDailyLog(updatedLog);
            await saveDailyLog(updatedLog);
        },
        onAddWorkout: handleAddWorkout,
        onUpdateWorkout: handleUpdateWorkout,
        onDeleteWorkout: handleDeleteWorkout,
        onUpdateFastingConfig: handleUpdateFastingConfig,
        refreshData,
        onNavigate: setView
    };

    return (
        <div className="min-h-screen md:flex font-sans">
            {/* Desktop Sidebar */}
            <DesktopSidebar
                currentView={view}
                onNavigate={setView}
                onOpenSettings={() => setIsSettingsOpen(true)}
                isDarkMode={isDarkMode}
                onToggleDarkMode={toggleDarkMode}
            />

            {/* Main Content Wrapper */}
            <div className="w-full md:ml-60">
                {/* Top Bar - Mobile only */}
                <nav className="md:hidden sticky top-0 z-40 bg-surface-glass border-b border-border backdrop-blur-md">
                    <div className="px-4 h-16 flex items-center justify-between">
                        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView(AppView.TODAY)}>
                            <img src="/resources/800logo.png" alt="Fast800 Logo" className="h-7 w-auto transition-transform group-hover:scale-105" />
                            <h1 className="text-xl font-medium tracking-tight text-main leading-none">
                                Fast<span className="font-bold text-primary">800</span>
                            </h1>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Dark Mode Toggle */}
                            <button
                                onClick={toggleDarkMode}
                                className="h-10 w-10 rounded-full bg-surface border border-border flex items-center justify-center text-muted hover:text-primary hover:bg-primary/5 hover:border-primary/20 transition-all shadow-sm"
                                title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
                            >
                                {isDarkMode ? (
                                    // Sun icon for light mode
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="5"></circle>
                                        <line x1="12" y1="1" x2="12" y2="3"></line>
                                        <line x1="12" y1="21" x2="12" y2="23"></line>
                                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                                        <line x1="1" y1="12" x2="3" y2="12"></line>
                                        <line x1="21" y1="12" x2="23" y2="12"></line>
                                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                                    </svg>
                                ) : (
                                    // Moon icon for dark mode
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                                    </svg>
                                )}
                            </button>

                            {/* Settings */}
                            <button
                                onClick={() => setIsSettingsOpen(true)}
                                className="h-10 w-10 rounded-full bg-surface border border-border flex items-center justify-center text-muted hover:text-primary hover:bg-primary/5 hover:border-primary/20 transition-all shadow-sm"
                                title="Settings"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="3"></circle>
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                </nav>

                {/* Main Content */}
                <main className="pb-24 md:pb-10">
                    <AnimatePresence mode="wait">
                        {view === AppView.TODAY && (
                            <motion.div
                                key="today"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="max-w-6xl mx-auto p-4 md:p-8"
                            >
                                <TrackToday {...trackProps} />
                            </motion.div>
                        )}
                        {view === AppView.ANALYTICS && (
                            <motion.div
                                key="analytics"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="max-w-6xl mx-auto p-4 md:p-8"
                            >
                                <TrackAnalytics {...trackProps} />
                            </motion.div>
                        )}
                        {view === AppView.PLANNER && (
                            <motion.div
                                key="planner"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="max-w-6xl mx-auto p-4 md:p-8"
                            >
                                <Planner stats={userStats} />
                            </motion.div>
                        )}
                        {view === AppView.RECIPES && (
                            <motion.div
                                key="recipes"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="max-w-6xl mx-auto p-4 md:p-8"
                            >
                                <RecipeLibrary />
                            </motion.div>
                        )}
                        {view === AppView.SHOPPING && (
                            <motion.div
                                key="shopping"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="max-w-6xl mx-auto p-4 md:p-8"
                            >
                                <ShoppingList />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </main>

                {/* Mobile Bottom Navigation */}
                <MobileBottomNav currentView={view} onNavigate={setView} />
            </div>

            {/* Settings Modal */}
            {isSettingsOpen && <SettingsModal />}
        </div>
    );
};

const AuthGuard: React.FC = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <img src="/resources/800logo.png" alt="Fast800 Logo" className="h-12 w-auto opacity-50" />
                </div>
            </div>
        );
    }

    if (!user) {
        return <LoginScreen />;
    }

    return <TrackerApp />;
};

export const App: React.FC = () => {
    return (
        <AuthProvider>
            <AuthGuard />
        </AuthProvider>
    );
};