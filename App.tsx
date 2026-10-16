import React, { Activity, useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppView, DayPlan, UserStats, DailyLog, FoodLogItem, WorkoutItem, Recipe, FastingState, FastingConfig, CoachReadState, DayLogStatus } from './types';
import { isFastDay, mealCalories, mealKey, mealProtein, nextMealIndex, slotFor, slotLabel } from './utils/planUtils';
import { getDayPlan, getUserStats, saveUserStats, getDailyLog, saveDailyLog, getFastingState, saveFastingState, addFastingEntry, getCoachRead, saveCoachRead, migrateFromLocalStorage } from './services/storageService';
import * as cache from './utils/cacheService';
import { useTheme } from './hooks/useTheme';
// Lazy load non-critical components for performance
const TrackAnalytics = React.lazy(() => import('./components/TrackAnalytics').then(module => ({ default: module.TrackAnalytics })));
const Planner = React.lazy(() => import('./components/Planner').then(module => ({ default: module.Planner })));
const RecipeLibrary = React.lazy(() => import('./components/RecipeLibrary').then(module => ({ default: module.RecipeLibrary })));
const ShoppingList = React.lazy(() => import('./components/ShoppingList').then(module => ({ default: module.ShoppingList })));
const FamilyView = React.lazy(() => import('./components/FamilyView').then(module => ({ default: module.FamilyView })));
const SettingsView = React.lazy(() => import('./components/SettingsView').then(module => ({ default: module.SettingsView })));

// Download the lazy views in the background after start-up so the first visit to
// each page renders immediately instead of flashing the Suspense skeleton.
const prefetchViews = () => {
    void import('./components/TrackAnalytics');
    void import('./components/Planner');
    void import('./components/RecipeLibrary');
    void import('./components/ShoppingList');
    void import('./components/FamilyView');
    void import('./components/SettingsView');
};
import BatchPlannerModal from './components/BatchPlannerModal';
import { Header } from './components/Header';
import { TrackToday } from './components/TrackToday';
import { MobileBottomNav } from './components/MobileBottomNav';
import { Sidebar } from './components/Sidebar';
import { PlannerTabs } from './components/PlannerTabs';
import { DEFAULT_USER_STATS, MAX_PLAUSIBLE_FAST_HOURS, DEFAULT_FAST_BREAK_CALORIES } from './constants';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { currentUid } from './services/firebase';
import { DevModeProvider } from './contexts/DevModeContext';
import { LoginScreen } from './components/LoginScreen';
import { OnboardingWizard, OnboardingResult } from './components/OnboardingWizard';
import { FoodEntryModal } from './components/FoodEntryModal';
import { WorkoutEntryModal } from './components/WorkoutEntryModal';
import { WeightEntryModal } from './components/WeightEntryModal';
import { ViewSkeleton } from './components/ViewSkeleton';






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

    // After start-up: download the other pages' code and load their data in the background,
    // so opening them shows content straight away
    useEffect(() => {
        const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500));
        idle(() => {
            prefetchViews();
            import('./services/pageData').then(m => m.prewarmPages());
        });
        return () => { import('./utils/prewarm').then(m => m.clearWarm()); };
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
        if (path === '/family') return AppView.FAMILY;
        if (path === '/settings') return AppView.SETTINGS;
        return AppView.TODAY;
    };

    const view = getCurrentView();

    // Each page gets back the scroll position it was left at
    const scrollPositions = useRef(new Map<AppView, number>());
    const previousView = useRef(view);
    useLayoutEffect(() => {
        if (previousView.current === view) return;
        scrollPositions.current.set(previousView.current, window.scrollY);
        previousView.current = view;
        window.scrollTo(0, scrollPositions.current.get(view) ?? 0);
    }, [view]);

    // Navigation handler that updates URL
    const handleNavigate = (newView: AppView) => {
        const routes: Record<AppView, string> = {
            [AppView.TODAY]: '/today',
            [AppView.ANALYTICS]: '/analytics',
            [AppView.PLANNER]: '/mealplanner',
            [AppView.RECIPES]: '/recipes',
            [AppView.SHOPPING]: '/shopping',
            [AppView.FAMILY]: '/family',
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
    // A weigh-in reminder opens /today?weigh=1: go straight to the weight sheet
    useEffect(() => {
        if (new URLSearchParams(location.search).get('weigh') !== '1') return;
        setIsWeightModalOpen(true);
        navigate(location.pathname, { replace: true });
    }, [location.search, location.pathname, navigate]);
    const [isSundayResetOpen, setIsSundayResetOpen] = useState(false);
    const [editingWorkout, setEditingWorkout] = useState<WorkoutItem | null>(null);
    // Delete for the workout being edited, from whoever opened the sheet (Today adds Undo)
    const [deleteEditingWorkout, setDeleteEditingWorkout] = useState<(() => void) | undefined>();
    const [recentWorkouts, setRecentWorkouts] = useState<WorkoutItem[]>([]);

    const [userStats, setUserStatsState] = useState<UserStats>(() => cache.getCachedUserStats() || DEFAULT_USER_STATS);
    const [showOnboarding, setShowOnboarding] = useState(false);
    // Removed isInitializing to allow instant rendering from cache

    const theme = useTheme();

    const [fastingState, setFastingState] = useState<FastingState>(() => cache.getCachedFastingState() || {
        lastAteTime: null,
        config: { protocol: '16:8', targetFastHours: 16 }
    });


    const [coachRead, setCoachRead] = useState<CoachReadState>(() => cache.getCachedCoachRead() || {});

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

    // True once today's log has come back from the server (the cached copy may be stale)
    const [logFresh, setLogFresh] = useState(false);

    // Counts local edits to today's log, so a refresh that started before one doesn't put back the older log
    const logEdits = useRef(0);
    const updateDailyLog = useCallback(async (updater: (current: DailyLog) => DailyLog) => {
        logEdits.current++;
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

    // Refreshes overlap (every planner edit starts one, so does focus); only the newest may set state,
    // or a slow earlier one lands last and puts back the plan from before the latest change
    const refreshSeq = useRef(0);
    const refreshData = useCallback(async () => {
        const seq = ++refreshSeq.current;
        const editsAtStart = logEdits.current;
        try {
            const [today, tomorrow, stats, log, fasting] = await Promise.all([
                getDayPlan(todayDate),
                getDayPlan(tomorrowDate),
                getUserStats(),
                getDailyLog(todayDate),
                getFastingState()
            ]);
            if (seq !== refreshSeq.current) return;
            // Guidance read state is secondary: don't hold up the rest of the refresh for it
            getCoachRead().then(setCoachRead);

            setTodayPlan(today);
            setTomorrowPlan(tomorrow);

            // Check for onboarding: if weight history is empty, show wizard
            // (Assuming DEFAULT_USER_STATS has empty history, and existing users have history)
            const history = stats.weightHistory || [];
            setUserStatsState({ ...DEFAULT_USER_STATS, ...stats, weightHistory: history });
            // Edited while loading: the local log is newer (and being saved), keep it
            if (logEdits.current === editsAtStart) setDailyLogState(log);
            setLogFresh(true);
            setFastingState(fasting);

            if (history.length === 0) {
                setShowOnboarding(true);
            }
        } catch (error) {
            console.error("Failed to refresh data", error);
        }
    }, [todayDate, tomorrowDate, setDailyLogState]);

    // Coming back to Today reloads it: plans also change from Recipes ("Add to plan") and other family members
    const lastView = useRef(view);
    useEffect(() => {
        if (view === AppView.TODAY && lastView.current !== AppView.TODAY) refreshData();
        lastView.current = view;
    }, [view, refreshData]);

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
    const handleSetCoachRead = (id: string, read: boolean) => {
        const next = { ...coachRead };
        if (read) next[id] = localDateString(); else delete next[id];
        setCoachRead(next);
        saveCoachRead(next).catch(e => console.error('Failed to save guidance read state', e));
    };

    const handleSaveStats = async (newStats: UserStats) => {
        setUserStatsState(newStats);
        await saveUserStats(newStats);
    };

    // The signed-in user as their family sees them, for the header and the sidebar
    const me = { uid: currentUid() ?? '', name: userStats.name, avatar: userStats.avatar };

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

    // Small amounts (a coffee, tea with milk) are logged but don't end the fast
    const fastBreakCalories = fastingState.config.fastBreakCalories ?? DEFAULT_FAST_BREAK_CALORIES;

    const handleAddFoodLogItems = async (items: FoodLogItem[]) => {
        // Items logged together count as one sitting
        if (items.reduce((sum, item) => sum + (item.calories || 0), 0) <= fastBreakCalories) {
            await updateDailyLog((current) => ({ ...current, items: [...current.items, ...items] }));
            return;
        }
        const now = Date.now();
        let currentFastingMax = dailyLogRef.current.maxFastingHours || 0;

        // Check active fast duration before breaking it
        if (fastingState.lastAteTime) {
            const diffHours = (now - fastingState.lastAteTime) / (1000 * 60 * 60);
            if (diffHours > currentFastingMax && diffHours <= MAX_PLAUSIBLE_FAST_HOURS) {
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

    // Food logged without protein (before protein tracking, or a recipe without it) gets an AI
    // estimate from its name and calories. Each item is tried once per session.
    const proteinTried = useRef(new Set<string>());
    useEffect(() => {
        if (!logFresh) return;
        const missing = (dailyLog.items || []).filter(item => typeof item.protein !== 'number' && !proteinTried.current.has(item.id));
        if (!missing.length) return;
        const timer = window.setTimeout(async () => {
            missing.forEach(item => proteinTried.current.add(item.id));
            try {
                const { estimateProtein } = await import('./services/geminiService');
                const grams = await estimateProtein(missing.map(({ name, calories }) => ({ name, calories })));
                const byId = new Map(missing.map((item, i) => [item.id, grams[i]]));
                if (![...byId.values()].some(g => g !== null)) return;
                await updateDailyLog(current => ({
                    ...current,
                    items: current.items.map(item => {
                        const g = byId.get(item.id);
                        // Only fill gaps: never overwrite an amount set meanwhile
                        return typeof g === 'number' && typeof item.protein !== 'number' ? { ...item, protein: g } : item;
                    }),
                }));
            } catch (e) {
                console.warn('Protein estimate failed', e);
            }
        }, 1500);
        return () => window.clearTimeout(timer);
    }, [dailyLog.items, logFresh, updateDailyLog]);

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

    /**
     * Logs planned meals as eaten, each at its own time. The fast ends at the earliest of them and
     * the last meal becomes the last time eaten, so logging the day in the evening keeps fasts right.
     */
    const handleLogMeals = async (entries: { meal: Recipe; at: number }[]) => {
        if (!entries.length) return;
        const sorted = [...entries].sort((a, b) => a.at - b.at);
        // Only meals over the limit end the fast
        const breaking = sorted.filter(({ meal }) => mealCalories(meal) > fastBreakCalories);
        const first = breaking[0]?.at;
        const last = breaking[breaking.length - 1]?.at;
        let currentFastingMax = dailyLogRef.current.maxFastingHours || 0;

        // Check active fast duration before breaking it
        if (fastingState.lastAteTime && first !== undefined && first > fastingState.lastAteTime) {
            const diffHours = (first - fastingState.lastAteTime) / (1000 * 60 * 60);
            if (diffHours > currentFastingMax && diffHours <= MAX_PLAUSIBLE_FAST_HOURS) {
                currentFastingMax = diffHours;
            }
        }

        const items: FoodLogItem[] = sorted.map(({ meal, at }) => ({
            id: crypto.randomUUID(),
            name: meal.name,
            calories: mealCalories(meal),
            ...(mealProtein(meal) !== undefined ? { protein: mealProtein(meal) } : {}),
            timestamp: at,
            // Persist metadata
            tags: meal.tags,
            isLeftover: meal.isLeftover,
            isPacked: meal.isPacked,
            type: slotLabel(slotFor(meal)),
            planInstanceId: mealKey(meal),
        }));
        await updateDailyLog((current) => ({ ...current, items: [...(current.items || []), ...items], maxFastingHours: currentFastingMax }));

        // Update TRE tracking: meals logged after the fact may be older than the last time eaten
        if (first !== undefined && last !== undefined) {
            await updateLastAteTime(first, Math.max(last, fastingState.lastAteTime || 0));
        }
    };

    const handleLogMeal = async (meal: Recipe, isAdding: boolean) => {
        if (isAdding) {
            await handleLogMeals([{ meal, at: Date.now() }]);
            return;
        }
        // Use current state instead of fetching fresh to avoid extra DB read
        const newItems = [...(dailyLogRef.current.items || [])];
        const key = mealKey(meal);
        // Entries logged before planInstanceId existed are matched by name and calories
        const linked = newItems.some(item => item.planInstanceId === key);
        for (let i = newItems.length - 1; i >= 0; i--) {
            if (linked ? newItems[i].planInstanceId === key : (newItems[i].name === meal.name && newItems[i].calories === mealCalories(meal))) {
                newItems.splice(i, 1);
                // When removing, we don't recalculate maxFastingHours or revert persistence
                // as the fast WAS broken/achieved at that time.
                break;
            }
        }

        await updateDailyLog((current) => ({ ...current, items: newItems }));
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

    /** `timestamp` ends the current fast; `lastAte` (default the same) is the new last time eaten. */
    const updateLastAteTime = async (timestamp: number, lastAte = timestamp) => {
        // Check if we completed a successful fast before eating
        if (fastingState.lastAteTime) {
            const fastDuration = timestamp - fastingState.lastAteTime;
            const targetMs = fastingState.config.targetFastHours * 60 * 60 * 1000;

            if (fastDuration >= targetMs && fastDuration <= MAX_PLAUSIBLE_FAST_HOURS * 60 * 60 * 1000) {
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
            lastAteTime: lastAte
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

    const handleOnboardingComplete = async (data: OnboardingResult) => {
        // Safe update: name, weights and targets; current weight is merged into history
        const updatedStats = {
            ...userStats,
            ...data,
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
        coachRead,
        onSetCoachRead: handleSetCoachRead,
        onLogMeal: handleLogMeal,
        onLogMeals: handleLogMeals,
        onSetDayStatus: (status: DayLogStatus | undefined) => updateDailyLog(current => ({ ...current, status })),
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
        /** Undo of a delete: puts the entry back as it was, without counting it as eating now */
        onRestoreFoodItem: async (item: FoodLogItem) => {
            await updateDailyLog((current) => ({ ...current, items: [...current.items, item] }));
            if (item.timestamp > (fastingState.lastAteTime || 0)) {
                const newState: FastingState = { ...fastingState, lastAteTime: item.timestamp };
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
        onOpenWorkoutModal: (workout?: WorkoutItem, onDelete?: () => void) => {
            if (workout) setEditingWorkout(workout);
            else setEditingWorkout(null);
            setDeleteEditingWorkout(() => onDelete);
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

    /** Today's subtitle: the greeting plus where the day stands, so it changes as you go */
    const getTodayLine = (greeting: string) => {
        const next = nextMealIndex(todayPlan);
        const status = todayPlan.meals.length === 0
            ? 'nothing planned yet'
            : next === undefined
                ? 'all meals eaten'
                : `${slotLabel(slotFor(todayPlan.meals[next])).toLowerCase()} next: ${todayPlan.meals[next].name}`;
        return [greeting, ...(isFastDay(todayPlan) ? ['fast day'] : []), status].join(' · ');
    };

    const getHeaderInfo = (): { title: string; subtitle: string } => {
        const greeting = `${getGreeting()}, ${userStats.name || 'Family'}`;

        switch (view) {
            case AppView.TODAY:
                return {
                    title: new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
                    subtitle: getTodayLine(greeting),
                };
            case AppView.ANALYTICS:
                return { title: 'Analytics', subtitle: greeting };
            case AppView.PLANNER:
                return { title: 'Planner', subtitle: greeting };
            case AppView.RECIPES:
                return { title: 'Recipes', subtitle: greeting };
            case AppView.SHOPPING:
                return { title: 'Planner', subtitle: greeting };
            case AppView.FAMILY:
                return { title: 'Family', subtitle: greeting };
            case AppView.SETTINGS:
                return { title: 'Settings', subtitle: greeting };
            default:
                return { title: 'Vesta', subtitle: greeting };
        }
    };

    const headerInfo = getHeaderInfo();

    // Every page lives in an Activity: hidden pages are pre-rendered in the background and keep
    // their state, but their effects pause and they don't re-render, so switching is instant.
    // Effects re-run when a page is shown again, which quietly refreshes its data.
    const renderView = (target: AppView, content: React.ReactNode) => (
        <Activity key={target} mode={view === target ? 'visible' : 'hidden'}>
            <div className="max-w-6xl mx-auto px-4 pb-4 pt-0 md:px-8 md:pb-8 md:pt-0 motion-safe:animate-page-in">
                <React.Suspense fallback={<ViewSkeleton />}>{content}</React.Suspense>
            </div>
        </Activity>
    );



    return (
        <div className="min-h-screen md:flex font-sans">
            {showOnboarding && (
                <OnboardingWizard
                    stats={userStats}
                    onComplete={handleOnboardingComplete}
                    // Only optional once there's a first weigh-in
                    onCancel={userStats.weightHistory.length > 0 ? () => setShowOnboarding(false) : undefined}
                />
            )}


            {/* Sidebar and header: who's signed in, as their family sees them */}
            <Sidebar currentView={view} onNavigate={handleNavigate} me={me} />

            {/* Main Content Wrapper */}
            <div className="w-full md:pl-20 lg:pl-60">
                {/* Main Content */}
                {/* The tab bar floats above the bottom edge, so the page needs room under it */}
                <main className="pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-0 pt-8 md:pt-12">
                    <div className="max-w-6xl mx-auto px-4 md:px-8">
                        <Header
                            title={headerInfo.title}
                            subtitle={headerInfo.subtitle}
                            onNavigate={handleNavigate}
                            me={me}
                            showSundayReset={new Date().getDay() === 0}
                            onOpenSundayReset={() => setIsSundayResetOpen(true)}
                        />
                        {(view === AppView.PLANNER || view === AppView.SHOPPING) && (
                            <PlannerTabs currentView={view} onNavigate={handleNavigate} />
                        )}
                    </div>
                    {/* Views switch instantly (no cross-fade). Each has its own Suspense so a
                        loading view never blanks the page; lazy chunks are prefetched at start-up. */}
                    {renderView(AppView.TODAY, <TrackToday {...trackProps} />)}
                    {renderView(AppView.ANALYTICS, <TrackAnalytics {...trackProps} />)}
                    {renderView(AppView.PLANNER, <Planner stats={userStats} onPlanChanged={refreshData} />)}
                    {renderView(AppView.RECIPES, <RecipeLibrary />)}
                    {renderView(AppView.SHOPPING, <ShoppingList />)}
                    {renderView(AppView.FAMILY, <FamilyView myAvatar={userStats.avatar} onSaveAvatar={avatar => handleSaveStats({ ...userStats, avatar })} />)}
                    {renderView(AppView.SETTINGS, (
                        <SettingsView
                            stats={userStats}
                            onUpdateStats={handleSaveStats}
                            fastingConfig={fastingState.config}
                            onUpdateFastingConfig={handleUpdateFastingConfig}
                            onTestOnboarding={() => setShowOnboarding(true)}
                            onTriggerSundayReset={() => setIsSundayResetOpen(true)}
                            onRefreshData={refreshData}
                            themePreference={theme.preference}
                            onChangeTheme={theme.setPreference}
                        />
                    ))}

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
                    onDelete={editingWorkout ? deleteEditingWorkout : undefined}
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
    const { uid, loading } = useAuth();
    // Firebase restores the session over the network, which can take seconds on a slow
    // connection. A returning user gets the app straight away, drawn from the local cache
    // (data calls wait for auth inside Firestore); anyone else sees the splash until then.
    const ready = !loading || !!uid;

    useEffect(() => {
        if (!ready) return;
        const initialLoader = document.getElementById('initial-loader');
        if (!initialLoader) return;
        initialLoader.classList.add('fade-out');
        const timer = setTimeout(() => initialLoader.remove(), 300);
        return () => clearTimeout(timer);
    }, [ready]);

    if (!ready) {
        return null;
    }

    if (!uid) {
        return <LoginScreen />;
    }

    return <TrackerApp />;
};

import { ReloadPrompt } from './components/ReloadPrompt';
import { localDateString } from './utils/dateUtils';

export const App: React.FC = () => {
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
