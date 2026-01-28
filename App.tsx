import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AppView, DayPlan, UserStats, DailyLog, FoodLogItem, WorkoutItem, Recipe, FastingState, FastingConfig } from './types';
import { getDayPlan, getUserStats, saveUserStats, getDailyLog, saveDailyLog, exportAllData, importAllData, getFastingState, saveFastingState, addFastingEntry, migrateFromLocalStorage, getLocalStorageDebugInfo } from './services/storageService';
import { Header } from './components/Header';
import { TrackToday } from './components/TrackToday';
import { TrackAnalytics } from './components/TrackAnalytics';
import { Planner } from './components/Planner';
import { RecipeLibrary } from './components/RecipeLibrary';
import { ShoppingList } from './components/ShoppingList';
import { MobileBottomNav } from './components/MobileBottomNav';
import { APP_NAME, DEFAULT_USER_STATS } from './constants';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DevModeProvider } from './contexts/DevModeContext';
import { LoginScreen } from './components/LoginScreen';
import { OnboardingWizard } from './components/OnboardingWizard';
import { FoodEntryModal } from './components/FoodEntryModal';
import { WorkoutEntryModal } from './components/WorkoutEntryModal';
import { WeightEntryModal } from './components/WeightEntryModal';
import { LoadingScreen } from './components/LoadingScreen';


import { FamilySettings } from './components/FamilySettings';
import { SettingsView } from './components/SettingsView';


const TrackerApp: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    // const [isSettingsOpen, setIsSettingsOpen] = useState(false); // Removed modal state
    const [todayDate, setTodayDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [tomorrowDate, setTomorrowDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
    });

    // Check for date change on focus/visibility change
    useEffect(() => {
        const checkDate = () => {
            const now = new Date().toISOString().split('T')[0];
            if (now !== todayDate) {
                console.log("Date changed, updating...", now);
                setTodayDate(now);
                const tom = new Date();
                tom.setDate(tom.getDate() + 1);
                setTomorrowDate(tom.toISOString().split('T')[0]);
            }
        };

        // Check when window gets focus or becomes visible
        window.addEventListener('focus', checkDate);
        document.addEventListener('visibilitychange', checkDate);

        return () => {
            window.removeEventListener('focus', checkDate);
            document.removeEventListener('visibilitychange', checkDate);
        };
    }, [todayDate]);

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

    // Global Modal State
    const [isFoodModalOpen, setIsFoodModalOpen] = useState(false);
    const [isWorkoutModalOpen, setIsWorkoutModalOpen] = useState(false);
    const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
    const [editingWorkout, setEditingWorkout] = useState<WorkoutItem | null>(null);
    const [recentWorkouts, setRecentWorkouts] = useState<WorkoutItem[]>([]);

    const [userStats, setUserStatsState] = useState<UserStats>(DEFAULT_USER_STATS);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);

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

    useEffect(() => {
        // Load recent workouts for suggestion
        const loadRecents = async () => {
            const { getRecentWorkouts } = await import('./services/storageService');
            const recents = await getRecentWorkouts(5);
            setRecentWorkouts(recents);
        };
        loadRecents();
    }, [dailyLog.workouts]);

    const refreshData = async () => {
        try {
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
        } catch (error) {
            console.error("Failed to refresh data", error);
        }
    };


    useEffect(() => {
        const init = async () => {
            try {
                await migrateFromLocalStorage();
                await refreshData();
            } catch (error) {
                console.error("Initialization error", error);
            } finally {
                setIsInitializing(false);
            }
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
        const now = Date.now();
        let currentFastingMax = dailyLog.maxFastingHours || 0;

        // Check active fast duration before breaking it
        if (fastingState.lastAteTime) {
            const diffHours = (now - fastingState.lastAteTime) / (1000 * 60 * 60);
            if (diffHours > currentFastingMax) {
                currentFastingMax = diffHours;
            }
        }

        const updatedLog: DailyLog = {
            ...dailyLog,
            items: [...dailyLog.items, ...items],
            maxFastingHours: currentFastingMax
        };
        setDailyLog(updatedLog);
        await saveDailyLog(updatedLog);

        // Update TRE tracking - food was just logged (this saves history)
        await updateLastAteTime(now);
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
        let currentFastingMax = dailyLog.maxFastingHours || 0;

        if (isAdding) {
            const now = Date.now();
            newItems.push({
                id: crypto.randomUUID(),
                name: meal.name,
                calories: meal.calories,
                timestamp: now
            });

            // Check active fast duration before breaking it
            if (fastingState.lastAteTime) {
                const diffHours = (now - fastingState.lastAteTime) / (1000 * 60 * 60);
                if (diffHours > currentFastingMax) {
                    currentFastingMax = diffHours;
                }
            }

            // Update TRE tracking when adding a meal
            await updateLastAteTime(now);
        } else {
            for (let i = newItems.length - 1; i >= 0; i--) {
                if (newItems[i].name === meal.name && newItems[i].calories === meal.calories) {
                    newItems.splice(i, 1);
                    // When removing, we don't recalculate maxFastingHours or revert persistence
                    // as the fast WAS broken/achieved at that time.
                    break;
                }
            }
        }

        const updatedLog = { ...dailyLog, items: newItems, maxFastingHours: currentFastingMax };
        setDailyLog(updatedLog);
        await saveDailyLog(updatedLog);
    };

    const handleUpdateWeight = (weight: number) => {
        handleUpdateStats({ ...userStats, currentWeight: weight });
    };

    const handleAddWater = async (amount: number) => {
        const newIntake = (dailyLog.waterIntake || 0) + amount;
        const updatedLog = { ...dailyLog, waterIntake: newIntake };
        setDailyLog(updatedLog);
        await saveDailyLog(updatedLog);
        // refreshData is called by saveDailyLog effect usually, but here we update local state immediately
    };

    const handleWorkoutSave = (workout: WorkoutItem) => {
        if (editingWorkout) {
            handleUpdateWorkout(workout);
        } else {
            handleAddWorkout(workout);
        }
        setEditingWorkout(null);
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

            // Update lastAteTime to the latest food item time
            if (updatedLog.items.length > 0) {
                const latestItem = updatedLog.items.reduce((prev, current) =>
                    (prev.timestamp > current.timestamp) ? prev : current
                );

                const newState: FastingState = {
                    ...fastingState,
                    lastAteTime: latestItem.timestamp
                };
                setFastingState(newState);
                await saveFastingState(newState);
            }
        },
        onDeleteFoodItem: async (itemId: string) => {
            const updatedLog = {
                ...dailyLog,
                items: dailyLog.items.filter(i => i.id !== itemId)
            };
            setDailyLog(updatedLog);
            await saveDailyLog(updatedLog);

            // Update lastAteTime to the latest food item time (if any remain)
            // If no items remain today, we technically don't know the *previous* lastAteTime (yesterday),
            // so we leave it as is, or we could fetch yesterday's log. 
            // For now, updating to latest of today if exists is a partial fix.
            if (updatedLog.items.length > 0) {
                const latestItem = updatedLog.items.reduce((prev, current) =>
                    (prev.timestamp > current.timestamp) ? prev : current
                );

                const newState: FastingState = {
                    ...fastingState,
                    lastAteTime: latestItem.timestamp
                };
                setFastingState(newState);
                await saveFastingState(newState);
            }
        },
        onAddWorkout: handleAddWorkout,
        onUpdateWorkout: handleUpdateWorkout,
        onDeleteWorkout: handleDeleteWorkout,
        onUpdateFastingConfig: handleUpdateFastingConfig,
        refreshData,
        onNavigate: handleNavigate,
        // Modal Handlers
        onOpenFoodModal: () => setIsFoodModalOpen(true),
        onOpenWorkoutModal: (workout?: WorkoutItem) => {
            if (workout) setEditingWorkout(workout);
            else setEditingWorkout(null);
            setIsWorkoutModalOpen(true);
        },
        onOpenWeightModal: () => setIsWeightModalOpen(true),
        onAddWater: handleAddWater, // Direct action
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    const getHeaderInfo = () => {
        const greeting = `${getGreeting()}, ${userStats.name || 'Family'}`;

        switch (view) {
            case AppView.TODAY:
                return { title: greeting, subtitle: 'Today\'s Log' };
            case AppView.ANALYTICS:
                return { title: greeting, subtitle: 'Analytics & Trends' };
            case AppView.PLANNER:
                return { title: greeting, subtitle: 'Meal Planner' };
            case AppView.RECIPES:
                return { title: greeting, subtitle: 'Recipe Library' };
            case AppView.SHOPPING:
                return { title: greeting, subtitle: 'Shopping List' };
            case AppView.SETTINGS:
                return { title: greeting, subtitle: 'Settings & Preferences' };
            default:
                return { title: greeting, subtitle: 'Digital Hearth' };
        }
    };

    const headerInfo = getHeaderInfo();

    if (isInitializing) {
        return <LoadingScreen />;
    }

    return (
        <div className="min-h-screen md:flex font-sans">
            {showOnboarding && <OnboardingWizard onComplete={handleOnboardingComplete} />}


            {/* Main Content Wrapper */}
            <div className="w-full">
                {/* Main Content */}
                <main className="pb-32 pt-8 md:pt-12">
                    <div className="max-w-6xl mx-auto px-4 md:px-8">
                        <Header
                            title={headerInfo.title}
                            subtitle={headerInfo.subtitle}
                            isDarkMode={isDarkMode}
                            onToggleDarkMode={toggleDarkMode}
                            onNavigate={handleNavigate}
                        />
                    </div>
                    <AnimatePresence mode="wait">
                        {view === AppView.TODAY && (
                            <motion.div
                                key="today"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="max-w-6xl mx-auto px-4 pb-4 pt-0 md:px-8 md:pb-8 md:pt-0"
                            >
                                <TrackToday {...trackProps} isDarkMode={isDarkMode} onToggleDarkMode={toggleDarkMode} />
                            </motion.div>
                        )}
                        {view === AppView.ANALYTICS && (
                            <motion.div
                                key="analytics"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="max-w-6xl mx-auto px-4 pb-4 pt-0 md:px-8 md:pb-8 md:pt-0"
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
                                className="max-w-6xl mx-auto px-4 pb-4 pt-0 md:px-8 md:pb-8 md:pt-0"
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
                                className="max-w-6xl mx-auto px-4 pb-4 pt-0 md:px-8 md:pb-8 md:pt-0"
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
                                className="max-w-6xl mx-auto px-4 pb-4 pt-0 md:px-8 md:pb-8 md:pt-0"
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
                                className="max-w-6xl mx-auto px-4 pb-4 pt-0 md:px-8 md:pb-8 md:pt-0"
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
                <MobileBottomNav
                    currentView={view}
                    onNavigate={handleNavigate}
                />

                {/* Global Modals */}
                <FoodEntryModal
                    isOpen={isFoodModalOpen}
                    onClose={() => setIsFoodModalOpen(false)}
                    onAddItems={handleAddFoodLogItems}
                />

                <WorkoutEntryModal
                    isOpen={isWorkoutModalOpen}
                    onClose={() => {
                        setIsWorkoutModalOpen(false);
                        setEditingWorkout(null);
                    }}
                    onSave={handleWorkoutSave}
                    editingWorkout={editingWorkout}
                    recentWorkouts={recentWorkouts}
                />

                <WeightEntryModal
                    isOpen={isWeightModalOpen}
                    onClose={() => setIsWeightModalOpen(false)}
                    currentWeight={userStats.currentWeight}
                    onSave={handleUpdateWeight}
                />
            </div>
        </div>
    );
};

const AuthGuard: React.FC = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return <LoadingScreen />;
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