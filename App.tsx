import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppView, DayPlan, UserStats, DailyLog, FoodLogItem, WorkoutItem, Recipe, FastingState, FastingConfig } from './types';
import { getDayPlan, getUserStats, saveUserStats, getDailyLog, saveDailyLog, exportAllData, importAllData, getFastingState, saveFastingState, addFastingEntry, migrateFromLocalStorage, getLocalStorageDebugInfo } from './services/storageService';
import * as cache from './utils/cacheService';
// Lazy load non-critical components for performance
const TrackAnalytics = React.lazy(() => import('./components/TrackAnalytics').then(module => ({ default: module.TrackAnalytics })));
const Planner = React.lazy(() => import('./components/Planner').then(module => ({ default: module.Planner })));
const RecipeLibrary = React.lazy(() => import('./components/RecipeLibrary').then(module => ({ default: module.RecipeLibrary })));
const ShoppingList = React.lazy(() => import('./components/ShoppingList').then(module => ({ default: module.ShoppingList })));
const FamilySettings = React.lazy(() => import('./components/FamilySettings').then(module => ({ default: module.FamilySettings })));
const SettingsView = React.lazy(() => import('./components/SettingsView').then(module => ({ default: module.SettingsView })));
const MigrationRunner = React.lazy(() => import('./components/MigrationRunner').then(module => ({ default: module.MigrationRunner })));

// Download the lazy views in the background after start-up so the first visit to
// each page renders immediately instead of flashing the Suspense skeleton.
const prefetchViews = () => {
    void import('./components/TrackAnalytics');
    void import('./components/Planner');
    void import('./components/RecipeLibrary');
    void import('./components/ShoppingList');
    void import('./components/SettingsView');
};
import BatchPlannerModal from './components/BatchPlannerModal';
import { Header } from './components/Header';
import { TrackToday } from './components/TrackToday';
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
import { ViewSkeleton } from './components/ViewSkeleton';





const DARK_MODE_KEY = 'vesta_darkMode';

const TrackerApp: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    // const [isSettingsOpen, setIsSettingsOpen] = useState(false); // Removed modal state
    const [todayDate, setTodayDate] = useState(() => localDateString());
    const [tomorrowDate, setTomorrowDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return localDateString(d);
    });

    useEffect(() => {
        const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500));
        idle(prefetchViews);
    }, []);

    // Check for date change on focus/visibility change
    useEffect(() => {
        console.log("Vesta PWA 1.0.2 - Enhanced Update Check");
        const checkDate = () => {
            const now = localDateString();
            if (now !== todayDate) {
                console.log("Date changed, updating...", now);
                setTodayDate(now);
                const tom = new Date();
                tom.setDate(tom.getDate() + 1);
                setTomorrowDate(localDateString(tom));
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

    const [todayPlan, setTodayPlan] = useState<DayPlan>(() => {
        const date = localDateString();
        return cache.getCachedDayPlan(date) || { date, meals: [], completedMealIds: [] };
    });
    const [tomorrowPlan, setTomorrowPlan] = useState<DayPlan>(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        const date = localDateString(d);
        return cache.getCachedDayPlan(date) || { date, meals: [], completedMealIds: [] };
    });

    // Global Modal State
    const [isFoodModalOpen, setIsFoodModalOpen] = useState(false);
    const [isWorkoutModalOpen, setIsWorkoutModalOpen] = useState(false);
    const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
    const [isSundayResetOpen, setIsSundayResetOpen] = useState(false);
    const [editingWorkout, setEditingWorkout] = useState<WorkoutItem | null>(null);
    const [recentWorkouts, setRecentWorkouts] = useState<WorkoutItem[]>([]);

    const [userStats, setUserStatsState] = useState<UserStats>(() => cache.getCachedUserStats() || DEFAULT_USER_STATS);
    const [showOnboarding, setShowOnboarding] = useState(false);
    // Removed isInitializing to allow instant rendering from cache

    const [isDarkMode, setIsDarkMode] = useState(() => {
        const saved = localStorage.getItem(DARK_MODE_KEY) ?? localStorage.getItem('fast800_darkMode');
        if (saved !== null) {
            return JSON.parse(saved);
        }
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    const [fastingState, setFastingState] = useState<FastingState>(() => cache.getCachedFastingState() || {
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
        localStorage.setItem(DARK_MODE_KEY, JSON.stringify(isDarkMode));
    }, [isDarkMode]);

    const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

    const [dailyLog, setDailyLog] = useState<DailyLog>(() => {
        const date = localDateString();
        const cached = cache.getCachedDailyLog(date);
        const merged: DailyLog = {
            date,
            items: [],
            workouts: [],
            waterIntake: 0,
            ...(cached || {}),
        };
        merged.workouts = merged.workouts || [];
        merged.waterIntake = typeof merged.waterIntake === 'number' ? merged.waterIntake : 0;
        return merged;
    });
    const dailyLogRef = useRef<DailyLog>(dailyLog);

    const setDailyLogState = useCallback((nextLog: DailyLog) => {
        dailyLogRef.current = nextLog;
        setDailyLog(nextLog);
    }, []);

    const updateDailyLog = useCallback(async (updater: (current: DailyLog) => DailyLog) => {
        const nextLog = updater(dailyLogRef.current);
        setDailyLogState(nextLog);
        await saveDailyLog(nextLog);
        return nextLog;
    }, [setDailyLogState]);

    const loadRecentWorkouts = useCallback(async () => {
        const { getRecentWorkouts } = await import('./services/storageService');
        const recents = await getRecentWorkouts(5);
        setRecentWorkouts(recents);
    }, []);

    useEffect(() => {
        // Load recent workouts for suggestion once on mount
        loadRecentWorkouts();
    }, [loadRecentWorkouts]);

    const refreshData = useCallback(async () => {
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
            setDailyLogState(log);
            setFastingState(fasting);

            if (history.length === 0) {
                setShowOnboarding(true);
            }
        } catch (error) {
            console.error("Failed to refresh data", error);
        }
    }, [todayDate, tomorrowDate, setDailyLogState]);

    // Revalidate on focus (SWR)
    useEffect(() => {
        const onFocus = () => {
            if (document.visibilityState === 'visible') {
                // console.log("App focused, revalidating data...");
                refreshData();
            }
        };

        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onFocus);

        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onFocus);
        };
    }, [refreshData]); // Re-attach if refreshData changes (it changes when date changes)


    // Background SWR Refresh
    useEffect(() => {
        const init = async () => {
            // Only run migration and refresh, no blocking UI
            try {
                await migrateFromLocalStorage();
                await refreshData();
            } catch (e) {
                console.error("Background refresh failed", e);
            }
        };
        init();
    }, [todayDate, tomorrowDate]);

    // Saves stats without touching weight history: Settings, streaks and other
    // non-weigh-in updates must not create a weight entry for today.
    const handleSaveStats = async (newStats: UserStats) => {
        setUserStatsState(newStats);
        await saveUserStats(newStats);
    };

    // A real weigh-in: records newStats.currentWeight as today's weight history entry.
    const handleLogWeight = async (newStats: UserStats) => {
        const today = localDateString();
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
        let currentFastingMax = dailyLogRef.current.maxFastingHours || 0;

        // Check active fast duration before breaking it
        if (fastingState.lastAteTime) {
            const diffHours = (now - fastingState.lastAteTime) / (1000 * 60 * 60);
            if (diffHours > currentFastingMax) {
                currentFastingMax = diffHours;
            }
        }

        await updateDailyLog((current) => ({
            ...current,
            items: [...current.items, ...items],
            maxFastingHours: currentFastingMax
        }));

        // Update TRE tracking - food was just logged (this saves history)
        await updateLastAteTime(now);
    };

    const handleAddWorkout = async (workout: WorkoutItem) => {
        await updateDailyLog((current) => ({
            ...current,
            workouts: [...(current.workouts || []), workout]
        }));
        loadRecentWorkouts();
    };

    const handleUpdateWorkout = async (updatedWorkout: WorkoutItem) => {
        await updateDailyLog((current) => ({
            ...current,
            workouts: (current.workouts || []).map(w => w.id === updatedWorkout.id ? updatedWorkout : w)
        }));
        loadRecentWorkouts();
    };

    const handleDeleteWorkout = async (workoutId: string) => {
        await updateDailyLog((current) => ({
            ...current,
            workouts: (current.workouts || []).filter(w => w.id !== workoutId)
        }));
        loadRecentWorkouts();
    };

    const handleLogMeal = async (meal: Recipe, isAdding: boolean) => {
        // Use current state instead of fetching fresh to avoid extra DB read
        const currentLog = dailyLogRef.current;
        let newItems = [...(currentLog.items || [])];
        let currentFastingMax = currentLog.maxFastingHours || 0;

        if (isAdding) {
            const now = Date.now();
            newItems.push({
                id: crypto.randomUUID(),
                name: meal.name,
                calories: meal.calories,
                timestamp: now,
                // Persist metadata
                tags: meal.tags,
                isLeftover: meal.isLeftover,
                isPacked: meal.isPacked,
                type: meal.tags?.[0] // Helpful shortcut
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

        await updateDailyLog((current) => ({ ...current, items: newItems, maxFastingHours: currentFastingMax }));
    };

    const handleUpdateWeight = (weight: number) => {
        handleLogWeight({ ...userStats, currentWeight: weight });
    };

    const handleAddWater = async (amount: number) => {
        await updateDailyLog((current) => ({
            ...current,
            waterIntake: (current.waterIntake || 0) + amount
        }));
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

        // The welcome flow asks for current weight, so record it as a weigh-in
        await handleLogWeight(updatedStats);
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
        onUpdateStats: handleSaveStats,
        onLogMeal: handleLogMeal,
        onAddFoodLogItems: handleAddFoodLogItems,
        onUpdateFoodItem: async (item: FoodLogItem) => {
            const updatedLog = await updateDailyLog((current) => ({
                ...current,
                items: current.items.map(i => i.id === item.id ? item : i)
            }));

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
            const updatedLog = await updateDailyLog((current) => ({
                ...current,
                items: current.items.filter(i => i.id !== itemId)
            }));

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
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    };

    const getHeaderInfo = () => {
        const greeting = `${getGreeting()}, ${userStats.name || 'Family'}`;

        switch (view) {
            case AppView.TODAY:
                return { title: 'Today', subtitle: greeting };
            case AppView.ANALYTICS:
                return { title: 'Analytics', subtitle: greeting };
            case AppView.PLANNER:
                return { title: 'Planner', subtitle: greeting };
            case AppView.RECIPES:
                return { title: 'Recipes', subtitle: greeting };
            case AppView.SHOPPING:
                return { title: 'Shopping', subtitle: greeting };
            case AppView.SETTINGS:
                return { title: 'Settings', subtitle: greeting };
            default:
                return { title: 'Vesta', subtitle: greeting };
        }
    };

    const headerInfo = getHeaderInfo();



    return (
        <div className="min-h-screen md:flex font-sans">
            {showOnboarding && <OnboardingWizard onComplete={handleOnboardingComplete} />}


            {/* Main Content Wrapper */}
            <div className="w-full">
                {/* Main Content */}
                <main className="pb-28 pt-8 md:pt-12">
                    <div className="max-w-6xl mx-auto px-4 md:px-8">
                        <Header
                            title={headerInfo.title}
                            subtitle={headerInfo.subtitle}
                            isDarkMode={isDarkMode}
                            onToggleDarkMode={toggleDarkMode}
                            onNavigate={handleNavigate}
                            showSundayReset={new Date().getDay() === 0}
                            onOpenSundayReset={() => setIsSundayResetOpen(true)}
                        />
                    </div>
                    {/* Views switch instantly (no cross-fade): each has its own Suspense so a
                        loading view never blanks the page. Lazy chunks are prefetched below. */}
                            {view === AppView.TODAY && (
                                <div key="today" className="max-w-6xl mx-auto px-4 pb-4 pt-0 md:px-8 md:pb-8 md:pt-0">
                                    <React.Suspense fallback={<ViewSkeleton />}>
                                        <TrackToday {...trackProps} isDarkMode={isDarkMode} onToggleDarkMode={toggleDarkMode} />
                                    </React.Suspense>
                                </div>
                            )}
                            {view === AppView.ANALYTICS && (
                                <div key="analytics" className="max-w-6xl mx-auto px-4 pb-4 pt-0 md:px-8 md:pb-8 md:pt-0">
                                    <React.Suspense fallback={<ViewSkeleton />}>
                                        <TrackAnalytics {...trackProps} />
                                    </React.Suspense>
                                </div>
                            )}
                            {view === AppView.PLANNER && (
                                <div key="planner" className="max-w-6xl mx-auto px-4 pb-4 pt-0 md:px-8 md:pb-8 md:pt-0">
                                    <React.Suspense fallback={<ViewSkeleton />}>
                                        <Planner stats={userStats} onPlanChanged={refreshData} />
                                    </React.Suspense>
                                </div>
                            )}
                            {view === AppView.RECIPES && (
                                <div key="recipes" className="max-w-6xl mx-auto px-4 pb-4 pt-0 md:px-8 md:pb-8 md:pt-0">
                                    <React.Suspense fallback={<ViewSkeleton />}>
                                        <RecipeLibrary />
                                    </React.Suspense>
                                </div>
                            )}
                            {view === AppView.SHOPPING && (
                                <div key="shopping" className="max-w-6xl mx-auto px-4 pb-4 pt-0 md:px-8 md:pb-8 md:pt-0">
                                    <React.Suspense fallback={<ViewSkeleton />}>
                                        <ShoppingList />
                                    </React.Suspense>
                                </div>
                            )}
                            {view === AppView.SETTINGS && (
                                <div key="settings" className="max-w-6xl mx-auto px-4 pb-4 pt-0 md:px-8 md:pb-8 md:pt-0">
                                    <React.Suspense fallback={<ViewSkeleton />}>
                                        <SettingsView
                                            stats={userStats}
                                            onUpdateStats={handleSaveStats}
                                            fastingConfig={fastingState.config}
                                            onUpdateFastingConfig={handleUpdateFastingConfig}
                                            onTestOnboarding={() => setShowOnboarding(true)}
                                            onTriggerSundayReset={() => setIsSundayResetOpen(true)}
                                            onRefreshData={refreshData}
                                        />
                                    </React.Suspense>
                                </div>
                            )}

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

                <BatchPlannerModal
                    isOpen={isSundayResetOpen}
                    onClose={() => setIsSundayResetOpen(false)}
                    mode="sunday_reset"
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

import { ReloadPrompt } from './components/ReloadPrompt';
import { localDateString } from './utils/dateUtils';

export const App: React.FC = () => {
    // Smooth handoff: Fade out the HTML initial loader when React mounts
    useEffect(() => {
        const initialLoader = document.getElementById('initial-loader');
        if (initialLoader) {
            // Add fade-out class for smooth transition
            initialLoader.classList.add('fade-out');
            // Remove from DOM after animation completes
            const timer = setTimeout(() => {
                initialLoader.remove();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, []);

    // Removed Hard Version Check to allow Service Worker to handle updates gracefully


    return (
        <AuthProvider>
            <DevModeProvider>
                <AuthGuard />
                <ReloadPrompt />
            </DevModeProvider>
        </AuthProvider>
    );
};
