import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
import { DevModeProvider } from './contexts/DevModeContext';
import { LoginScreen } from './components/LoginScreen';
import { OnboardingWizard } from './components/OnboardingWizard';


import { FamilySettings } from './components/FamilySettings';
import { SettingsView } from './components/SettingsView';


const TrackerApp: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    // const [isSettingsOpen, setIsSettingsOpen] = useState(false); // Removed modal state
    const [todayDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [tomorrowDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
    });

    // Derive current view from URL
    const getCurrentView = (): AppView => {
        const path = location.pathname;
        if (path === '/' || path === '/today') return AppView.TODAY;
        if (path === '/analytics') return AppView.ANALYTICS;
        if (path === '/mealplanner') return AppView.PLANNER;
        if (path === '/recipes') return AppView.RECIPES;
        if (path === '/shopping') return AppView.SHOPPING;
        if (path === '/settings') return AppView.SETTINGS;
        return AppView.TODAY;
    };

    const view = getCurrentView();

    // Navigation handler that updates URL
    const handleNavigate = (newView: AppView) => {
        const routes: Record<AppView, string> = {
            [AppView.TODAY]: '/today',
            [AppView.ANALYTICS]: '/analytics',
            [AppView.PLANNER]: '/mealplanner',
            [AppView.RECIPES]: '/recipes',
            [AppView.SHOPPING]: '/shopping',
            [AppView.SETTINGS]: '/settings'
        };
        navigate(routes[newView] || '/today');
    };

    const [todayPlan, setTodayPlan] = useState<DayPlan>({ date: '', meals: [], completedMealIds: [] });
    const [tomorrowPlan, setTomorrowPlan] = useState<DayPlan>({ date: '', meals: [], completedMealIds: [] });

    const [userStats, setUserStatsState] = useState<UserStats>(DEFAULT_USER_STATS);
    const [showOnboarding, setShowOnboarding] = useState(false);

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

        // Check for onboarding: if weight history is empty, show wizard
        // (Assuming DEFAULT_USER_STATS has empty history, and existing users have history)
        const history = stats.weightHistory || [];
        setUserStatsState({ ...DEFAULT_USER_STATS, ...stats, weightHistory: history });
        setDailyLog(log);
        setFastingState(fasting);

        if (history.length === 0) {
            setShowOnboarding(true);
        }
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

    const handleOnboardingComplete = async (data: { name: string; currentWeight: number; goalWeight: number }) => {
        // Safe update: Update name, goal, and merge current weight into history
        const updatedStats = {
            ...userStats,
            name: data.name,
            currentWeight: data.currentWeight,
            goalWeight: data.goalWeight,
            // Deprecated startWeight: only set if starting fresh
            startWeight: userStats.weightHistory.length === 0 ? data.currentWeight : userStats.startWeight
        };

        // Use the existing safe update handler to manage history array logic
        await handleUpdateStats(updatedStats);
        setShowOnboarding(false);
    };



    // SettingsModal moved to separate component SettingsView.tsx

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
        onNavigate: handleNavigate
    };

    return (
        <div className="min-h-screen md:flex font-sans">
            {showOnboarding && <OnboardingWizard onComplete={handleOnboardingComplete} />}

            {/* Desktop Sidebar */}

            <DesktopSidebar
                currentView={view}
                onNavigate={handleNavigate}
                onOpenSettings={() => handleNavigate(AppView.SETTINGS)}
                isDarkMode={isDarkMode}
                onToggleDarkMode={toggleDarkMode}
            />


            {/* Main Content Wrapper */}
            <div className="w-full md:ml-60">
                {/* Top Bar - Mobile only */}
                <nav className="md:hidden sticky top-0 z-40 bg-surface-glass border-b border-border backdrop-blur-md">
                    <div className="px-4 h-16 flex items-center justify-between">
                        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => handleNavigate(AppView.TODAY)}>
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
                                onClick={() => handleNavigate(AppView.SETTINGS)}
                                className={`h-10 w-10 rounded-full flex items-center justify-center transition-all shadow-sm border ${view === AppView.SETTINGS
                                    ? 'bg-primary text-white border-primary'
                                    : 'bg-surface border-border text-muted hover:text-primary hover:bg-primary/5 hover:border-primary/20'
                                    }`}
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
                        {view === AppView.SETTINGS && (
                            <motion.div
                                key="settings"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="max-w-6xl mx-auto p-4 md:p-8"
                            >
                                <SettingsView
                                    stats={userStats}
                                    onUpdateStats={handleUpdateStats}
                                    fastingConfig={fastingState.config}
                                    onUpdateFastingConfig={handleUpdateFastingConfig}
                                    onTestOnboarding={() => setShowOnboarding(true)}
                                />

                            </motion.div>
                        )}
                    </AnimatePresence>
                </main>

                {/* Mobile Bottom Navigation */}
                <MobileBottomNav currentView={view} onNavigate={handleNavigate} />
                {/* Settings Modal Removed */}
            </div>
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
            <DevModeProvider>
                <AuthGuard />
            </DevModeProvider>
        </AuthProvider>
    );
};