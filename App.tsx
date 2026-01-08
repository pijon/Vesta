import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppView, DayPlan, UserStats, DailyLog, FoodLogItem, WorkoutItem, Recipe, FastingState, FastingConfig } from './types';
import { getDayPlan, getUserStats, saveUserStats, getDailyLog, saveDailyLog, exportAllData, importAllData, getFastingState, saveFastingState, addFastingEntry } from './services/storageService';
import { Dashboard } from './components/Dashboard';
import { Planner } from './components/Planner';
import { RecipeLibrary } from './components/RecipeLibrary';
import { ShoppingList } from './components/ShoppingList';
import { FoodLogger } from './components/FoodLogger';
import { Analytics } from './components/Analytics';
import { APP_NAME, DEFAULT_USER_STATS } from './constants';

export const App: React.FC = () => {
    const [view, setView] = useState<AppView>(AppView.DASHBOARD);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [todayDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [tomorrowDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
    });

    const [todayPlan, setTodayPlan] = useState<DayPlan>({ date: '', meals: [], completedMealIds: [] });
    const [tomorrowPlan, setTomorrowPlan] = useState<DayPlan>({ date: '', meals: [], completedMealIds: [] });

    const [userStats, setUserStatsState] = useState<UserStats>(() => {
        const stats = getUserStats();
        return { ...DEFAULT_USER_STATS, ...stats, weightHistory: stats.weightHistory || [] };
    });

    const [fastingState, setFastingState] = useState<FastingState>(() => getFastingState());

    const [dailyLog, setDailyLog] = useState<DailyLog>({ date: '', items: [] });

    const refreshData = () => {
        setTodayPlan(getDayPlan(todayDate));
        setTomorrowPlan(getDayPlan(tomorrowDate));
        const stats = getUserStats();
        setUserStatsState({ ...DEFAULT_USER_STATS, ...stats, weightHistory: stats.weightHistory || [] });
        setDailyLog(getDailyLog(todayDate));
        setFastingState(getFastingState());
    };

    useEffect(() => {
        refreshData();
    }, [todayDate, tomorrowDate, view]);

    const handleUpdateStats = (newStats: UserStats) => {
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
        saveUserStats(finalStats);
    };

    const handleAddFoodLogItems = (items: FoodLogItem[]) => {
        const updatedLog: DailyLog = {
            ...dailyLog,
            items: [...dailyLog.items, ...items]
        };
        setDailyLog(updatedLog);
        saveDailyLog(updatedLog);
    };

    const handleAddWorkout = (workout: WorkoutItem) => {
        const updatedLog: DailyLog = {
            ...dailyLog,
            workouts: [...(dailyLog.workouts || []), workout]
        };
        setDailyLog(updatedLog);
        saveDailyLog(updatedLog);
    };

    const handleUpdateWorkout = (updatedWorkout: WorkoutItem) => {
        const updatedLog: DailyLog = {
            ...dailyLog,
            workouts: (dailyLog.workouts || []).map(w => w.id === updatedWorkout.id ? updatedWorkout : w)
        };
        setDailyLog(updatedLog);
        saveDailyLog(updatedLog);
    };

    const handleDeleteWorkout = (workoutId: string) => {
        const updatedLog: DailyLog = {
            ...dailyLog,
            workouts: (dailyLog.workouts || []).filter(w => w.id !== workoutId)
        };
        setDailyLog(updatedLog);
        saveDailyLog(updatedLog);
    };

    const handleLogMeal = (meal: Recipe, isAdding: boolean) => {
        const currentLog = getDailyLog(todayDate);
        let newItems = [...currentLog.items];

        if (isAdding) {
            newItems.push({
                id: crypto.randomUUID(),
                name: meal.name,
                calories: meal.calories,
                timestamp: Date.now()
            });
        } else {
            // Find the last item that matches (assuming most recent action)
            for (let i = newItems.length - 1; i >= 0; i--) {
                if (newItems[i].name === meal.name && newItems[i].calories === meal.calories) {
                    newItems.splice(i, 1);
                    break;
                }
            }
        }

        const updatedLog = { ...currentLog, items: newItems };
        saveDailyLog(updatedLog);
        // State will be updated by refreshData called in Dashboard
    };

    const handleUpdateWeight = (weight: number) => {
        handleUpdateStats({ ...userStats, currentWeight: weight });
    };

    const handleStartFast = () => {
        const newState: FastingState = {
            ...fastingState,
            isFasting: true,
            startTime: Date.now(),
            endTime: null
        };
        setFastingState(newState);
        saveFastingState(newState);
    };

    const handleEndFast = () => {
        if (fastingState.startTime) {
            const now = Date.now();
            const durationHours = (now - fastingState.startTime) / (1000 * 60 * 60);

            // Add to history
            addFastingEntry({
                id: crypto.randomUUID(),
                startTime: fastingState.startTime,
                endTime: now,
                durationHours,
                isSuccess: durationHours >= fastingState.config.targetFastHours
            });
        }

        const newState: FastingState = {
            ...fastingState,
            isFasting: false,
            endTime: Date.now()
        };
        setFastingState(newState);
        saveFastingState(newState);
    };

    const handleUpdateFastingConfig = (config: FastingConfig) => {
        const newState: FastingState = {
            ...fastingState,
            config
        };
        setFastingState(newState);
        saveFastingState(newState);
    };

    const NavLink = ({ targetView, label }: { targetView: AppView, label: string }) => (
        <button
            onClick={() => setView(targetView)}
            className={`px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg ${view === targetView
                ? 'bg-primary/10 text-primary'
                : 'text-muted hover:text-main hover:bg-background'
                }`}
        >
            {label}
        </button>
    );

    const SettingsModal = () => {
        const [formStats, setFormStats] = useState(userStats);

        const handleSave = () => {
            handleUpdateStats(formStats);
            setIsSettingsOpen(false);
        };

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setIsSettingsOpen(false)}>
                <div className="bg-surface w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-border" onClick={e => e.stopPropagation()}>
                    <div className="p-6 border-b border-border flex justify-between items-center bg-background/50">
                        <h3 className="font-normal text-2xl text-main font-serif">Settings</h3>
                        <button onClick={() => setIsSettingsOpen(false)} className="p-2 bg-surface border border-border rounded-full text-muted hover:text-main transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                    <div className="p-6 space-y-5">
                        <div>
                            <label className="block text-sm font-bold text-main/80 mb-2">Starting Weight (kg)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={formStats.startWeight}
                                onChange={(e) => setFormStats({ ...formStats, startWeight: parseFloat(e.target.value) || 0 })}
                                className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium text-main"
                            />
                            <p className="text-xs text-muted mt-1">Your weight when you began the diet.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-main/80 mb-2">Current Weight (kg)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={formStats.currentWeight}
                                onChange={(e) => setFormStats({ ...formStats, currentWeight: parseFloat(e.target.value) || 0 })}
                                className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium text-main"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-main/80 mb-2">Goal Weight (kg)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={formStats.goalWeight}
                                onChange={(e) => setFormStats({ ...formStats, goalWeight: parseFloat(e.target.value) || 0 })}
                                className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium text-main"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-main/80 mb-2">Daily Calorie Target</label>
                            <input
                                type="number"
                                value={formStats.dailyCalorieGoal}
                                onChange={(e) => setFormStats({ ...formStats, dailyCalorieGoal: parseInt(e.target.value) || 0 })}
                                className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium text-main"
                            />
                        </div>
                    </div>
                    <div className="p-6 pt-0 space-y-4">
                        <button onClick={handleSave} className="w-full py-3 bg-main text-surface font-bold rounded-xl hover:bg-primary transition-colors shadow-lg shadow-primary/20">
                            Save Settings
                        </button>

                        <div className="border-t border-border pt-4 mt-2">
                            <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Data Management</h4>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        const json = exportAllData();
                                        const blob = new Blob([json], { type: 'application/json' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `fast800_backup_${new Date().toISOString().split('T')[0]}.json`;
                                        a.click();
                                        URL.revokeObjectURL(url);
                                    }}
                                    className="flex-1 py-2.5 bg-surface border border-border text-main text-sm font-bold rounded-xl hover:bg-background transition-colors flex items-center justify-center gap-2"
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
                                            reader.onload = (event) => {
                                                const content = event.target?.result as string;
                                                if (importAllData(content)) {
                                                    alert("Data imported successfully!");
                                                    window.location.reload();
                                                } else {
                                                    alert("Failed to import data. Invalid file format.");
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
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen pb-24 md:pb-10 font-sans">

            {/* Top Navigation / Header */}
            <nav className="sticky top-0 z-40 bg-surface/80 backdrop-blur-md border-b border-border">
                <div className="max-w-5xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView(AppView.DASHBOARD)}>
                        <img src="/resources/800logo.png" alt="Fast800 Logo" className="h-6 w-auto" />
                        <h1 className="text-xl font-medium tracking-tight text-main font-serif leading-none">{APP_NAME}</h1>
                    </div>

                    <div className="hidden md:flex items-center gap-2">
                        <NavLink targetView={AppView.DASHBOARD} label="Dashboard" />
                        <NavLink targetView={AppView.PLANNER} label="Planner" />
                        <NavLink targetView={AppView.RECIPES} label="Recipes" />
                        <NavLink targetView={AppView.SHOPPING} label="Shopping" />
                        <NavLink targetView={AppView.JOURNAL} label="Journal" />
                        <NavLink targetView={AppView.ANALYTICS} label="Analytics" />
                    </div>

                    <div>
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="h-9 w-9 rounded-full bg-background border border-border flex items-center justify-center text-muted text-xs font-bold hover:bg-background/80 transition-colors hover:text-primary hover:border-primary/30"
                            title="Settings"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        </button>
                    </div>
                </div>
            </nav>

            {/* Main Content Area */}
            <main className="max-w-5xl mx-auto p-4 md:p-8">
                <AnimatePresence mode="wait">
                    {view === AppView.DASHBOARD && (
                        <motion.div
                            key="dashboard"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Dashboard
                                todayPlan={todayPlan}
                                tomorrowPlan={tomorrowPlan}
                                stats={userStats}
                                dailyLog={dailyLog}
                                onUpdateStats={handleUpdateStats}
                                refreshData={refreshData}
                                onLogMeal={handleLogMeal}
                                fastingState={fastingState}
                                onStartFast={handleStartFast}
                                onEndFast={handleEndFast}
                                onUpdateFastingConfig={handleUpdateFastingConfig}
                            />
                        </motion.div>
                    )}
                    {view === AppView.PLANNER && (
                        <motion.div
                            key="planner"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Planner />
                        </motion.div>
                    )}
                    {view === AppView.RECIPES && (
                        <motion.div
                            key="recipes"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
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
                        >
                            <ShoppingList />
                        </motion.div>
                    )}
                    {view === AppView.JOURNAL && (
                        <motion.div
                            key="journal"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            <FoodLogger
                                currentLog={dailyLog}
                                onAddItems={handleAddFoodLogItems}
                                onAddWorkout={handleAddWorkout}
                                onUpdateWorkout={handleUpdateWorkout}
                                onDeleteWorkout={handleDeleteWorkout}
                                onUpdateWeight={handleUpdateWeight}
                                userStats={userStats}
                            />
                        </motion.div>
                    )}
                    {view === AppView.ANALYTICS && (
                        <motion.div
                            key="analytics"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Analytics userStats={userStats} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* Mobile Bottom Navigation */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border px-6 py-3 flex justify-between z-50">
                <button onClick={() => setView(AppView.DASHBOARD)} className={`flex flex-col items-center gap-1 ${view === AppView.DASHBOARD ? 'text-primary' : 'text-muted'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
                    <span className="text-[10px] font-medium">Home</span>
                </button>
                <button onClick={() => setView(AppView.PLANNER)} className={`flex flex-col items-center gap-1 ${view === AppView.PLANNER ? 'text-primary' : 'text-muted'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    <span className="text-[10px] font-medium">Plan</span>
                </button>
                <button onClick={() => setView(AppView.RECIPES)} className={`flex flex-col items-center gap-1 ${view === AppView.RECIPES ? 'text-primary' : 'text-muted'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    <span className="text-[10px] font-medium">Recipes</span>
                </button>
                <button onClick={() => setView(AppView.SHOPPING)} className={`flex flex-col items-center gap-1 ${view === AppView.SHOPPING ? 'text-primary' : 'text-muted'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                    <span className="text-[10px] font-medium">Shop</span>
                </button>
                <button onClick={() => setView(AppView.ANALYTICS)} className={`flex flex-col items-center gap-1 ${view === AppView.ANALYTICS ? 'text-primary' : 'text-muted'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                    <span className="text-[10px] font-medium">Stats</span>
                </button>
            </div>

            {isSettingsOpen && <SettingsModal />}
        </div>
    );
};