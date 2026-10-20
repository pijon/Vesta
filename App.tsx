import type { PlannedMealIntakeEntry, PlannedMealIntakeResult, PlannedIntakeTicks, ResolvedPlannedMealIntake, CommittedMealIntake } from './types';
import { commitPlannedMealIntake, removePlannedMealIntake, deletePlannedMealIntake, restorePlannedMealIntake, updatePlannedMealIntake } from './services/mealLogService';
import { mealNutrition } from './utils/recipeNutrition';
import { assertUniqueMealKeys } from './utils/mealIntake';
import { MealCaloriesSheet } from './components/MealCaloriesSheet';
import React, { Activity, useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppView, DayPlan, UserStats, DailyLog, FoodLogItem, WorkoutItem, Recipe, FastingState, FastingConfig, CoachReadState, DayLogStatus, UserSetupSnapshot, UserExperience, Avatar } from './types';
import { addDays, isFastDay, isRememberableDish, mealCalories, mealKey, mealProtein, nextMealIndex, slotFor, slotLabel } from './utils/planUtils';
import { getDayPlan, saveUserStats, getDailyLog, saveDailyLog, getFastingState, saveFastingState, addFastingEntry, getCoachRead, saveCoachRead, subscribeFamilyMeals, withFamilyMeals, FamilyMealChange } from './services/storageService';
import { clearWarm, holdWarmUntil } from './utils/prewarm';
import { createInFlight, InFlight } from './utils/inFlight';
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
import { Header } from './components/Header';
import { TrackToday } from './components/TrackToday';
import { PlanToday } from './components/PlanToday';
import { MobileBottomNav } from './components/MobileBottomNav';
import { FamilyNotice } from './components/FamilyNotice';
import { recordFamilyUpdate, subscribeFamilyUpdates } from './services/activityService';
import { joinGroup } from './services/groupService';
import { Sidebar } from './components/Sidebar';
import { FamilyTabs } from './components/FamilyTabs';
import { DEFAULT_USER_STATS, MAX_PLAUSIBLE_FAST_HOURS, DEFAULT_FAST_BREAK_CALORIES } from './constants';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { auth, currentUid } from './services/firebase';
import * as cache from './utils/cacheService';
import { completeUserSetup, getUserSetup, saveUserExperience, saveUserProfileName, saveUserProfileAvatar, UserSetupRequiredError } from './services/userPreferencesService';
import { DevModeProvider, useDevMode } from './contexts/DevModeContext';
import { LoginScreen } from './components/LoginScreen';
import { OnboardingWizard, OnboardingResult } from './components/OnboardingWizard';
import { FoodEntryModal } from './components/FoodEntryModal';
import { WorkoutEntryModal } from './components/WorkoutEntryModal';
import { WeightEntryModal } from './components/WeightEntryModal';
import { ViewSkeleton } from './components/ViewSkeleton';






type ExperienceSettings = NonNullable<React.ComponentProps<typeof SettingsView>['experienceSettings']>;
const normalizeStats = (stats: UserSetupSnapshot['stats']): UserStats => ({ ...DEFAULT_USER_STATS, ...stats, weightHistory: Array.isArray(stats?.weightHistory) ? stats.weightHistory : [] });

interface TrackerAppProps {
    uid: string;
    setup: UserSetupSnapshot;
    /** A setup read from the server, with the `setupVersion()` from when the read started: it's
     *  dropped if the setup changed here since (a switch saved meanwhile would otherwise flip back) */
    onSetupChange: (setup: UserSetupSnapshot, readFrom: number) => void;
    setupVersion: () => number;
    /** The setup from the server, shared with a read already on its way; `version` is its `readFrom` */
    readSetup: () => InFlight<UserSetupSnapshot, number>;
    /** Saved stats, merged into the current setup (never a whole setup from an older render) */
    onStatsChange: (stats: UserStats) => void;
    experienceSettings: ExperienceSettings;
    onTestOnboarding: () => void;
    /** Plan meals saves the avatar without creating a health profile */
    onSavePlanningAvatar: (avatar: Avatar) => Promise<void>;
}

const rejectTrackingChange = async () => { throw new Error('Tracking is not enabled for this experience.'); };

/** The app for both experiences. Plan meals leaves out Today, Analytics and everything that tracks
 *  intake; switching only changes what's shown, so nothing is rebuilt. */
const TrackerApp: React.FC<TrackerAppProps> = ({ uid, setup, onSetupChange, setupVersion, readSetup, onStatsChange, experienceSettings, onTestOnboarding, onSavePlanningAvatar }) => {
    const experience: UserExperience = setup.preferences?.experience === 'planning' ? 'planning' : 'tracking';
    const tracking = experience === 'tracking';
    const alive = useRef(true);
    const ownsSession = useCallback(() => alive.current && currentUid() === uid, [uid]);
    const requireSession = useCallback(() => {
        if (!ownsSession()) throw new Error('Your account changed. Reload and try again.');
    }, [ownsSession]);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, [uid]);
    const navigate = useNavigate();
    const location = useLocation();
    // const [isSettingsOpen, setIsSettingsOpen] = useState(false); // Removed modal state
    const [todayDate, setTodayDate] = useState(() => localDateString());
    const [tomorrowDate, setTomorrowDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return localDateString(d);
    });

    // Background page data waits for the launch refresh (or 10 s, if that hangs): on a phone they
    // share one connection, and Today's numbers come first
    const launchRefreshed = useRef<(() => void) | null>(null);
    if (!launchRefreshed.current) holdWarmUntil(new Promise<void>(resolve => {
        launchRefreshed.current = resolve;
        window.setTimeout(resolve, 10_000);
    }));

    // After start-up: download the other pages' code, pre-render them and load their data in the
    // background, so opening them shows content straight away. It waits for the first paint
    // (Chrome can find idle time before it) and then for idle time (Safari has no idle callback).
    useEffect(() => {
        const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500));
        let cancelled = false;
        requestAnimationFrame(() => setTimeout(() => idle(() => {
            if (cancelled || !ownsSession()) return;
            setPrerenderPages(true);
            prefetchViews();
            import('./services/pageData').then(m => {
                if (!cancelled && ownsSession()) return m.prewarmPages(() => !cancelled && ownsSession());
            });
        })));
        return () => {
            cancelled = true;
            clearWarm();
        };
    }, [ownsSession]);

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

    // Plan meals has no Analytics: its links open Today, the meal-focused one
    const requestedView = getCurrentView();
    const view = !tracking && requestedView === AppView.ANALYTICS ? AppView.TODAY : requestedView;
    useEffect(() => {
        if (view !== requestedView) navigate('/today', { replace: true });
    }, [view, requestedView, navigate]);

    // At launch only the page on screen renders; the hidden pages (and their code) wait until the
    // app is idle, so a cold start doesn't load and draw every page before the first paint
    const [prerenderPages, setPrerenderPages] = useState(false);
    const [visitedViews, setVisitedViews] = useState<ReadonlySet<AppView>>(() => new Set([view]));
    useEffect(() => {
        setVisitedViews(prev => prev.has(view) ? prev : new Set(prev).add(view));
    }, [view]);

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

    // Opens with the last numbers seen on this device while the server is asked (that takes seconds
    // on a cold start), as long as they were this account's
    const [fromCache] = useState(() => {
        const owned = cache.isCacheOwner(uid);
        if (!owned) cache.releaseCacheUnlessOwner(uid);
        return owned;
    });
    const [todayPlan, setTodayPlan] = useState<DayPlan>(() => {
        const date = localDateString();
        return (fromCache && cache.getCachedDayPlan(date)) || { date, meals: [], completedMealIds: [] };
    });
    const [tomorrowPlan, setTomorrowPlan] = useState<DayPlan>(() => {
        const date = addDays(localDateString(), 1);
        return (fromCache && cache.getCachedDayPlan(date)) || { date, meals: [], completedMealIds: [] };
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
    const [editingWorkout, setEditingWorkout] = useState<WorkoutItem | null>(null);
    // Delete for the workout being edited, from whoever opened the sheet (Today adds Undo)
    const [deleteEditingWorkout, setDeleteEditingWorkout] = useState<(() => void) | undefined>();
    const [recentWorkouts, setRecentWorkouts] = useState<WorkoutItem[]>([]);

    const [userStats, setUserStatsState] = useState<UserStats>(() => normalizeStats(setup.stats));
    useEffect(() => { setUserStatsState(normalizeStats(setup.stats)); }, [setup.stats]);

    const theme = useTheme();

    const [fastingState, setFastingState] = useState<FastingState>(() => (fromCache && cache.getCachedFastingState()) || {
        lastAteTime: null,
        config: { protocol: '16:8', targetFastHours: 16 }
    });


    const [coachRead, setCoachRead] = useState<CoachReadState>(() => (fromCache && cache.getCachedCoachRead()) || {});

    const [dailyLog, setDailyLog] = useState<DailyLog>(() => {
        const date = localDateString();
        const merged: DailyLog = (fromCache && cache.getCachedDailyLog(date)) || {
            date,
            items: [],
            workouts: [],
            waterIntake: 0,
        };
        merged.items = merged.items || [];
        merged.workouts = merged.workouts || [];
        merged.waterIntake = typeof merged.waterIntake === 'number' ? merged.waterIntake : 0;
        return merged;
    });
    const dailyLogRef = useRef<DailyLog>(dailyLog);
    const fastingStateRef = useRef(fastingState);
    fastingStateRef.current = fastingState;
    const publishFasting = (next:FastingState) => {fastingStateRef.current=next;setFastingState(next);};
    const healthQueue = useRef<Promise<unknown>>(Promise.resolve());
    const runHealthMutation = <T,>(operation:()=>Promise<T>):Promise<T> => {
        const date=todayDate;
        const next=healthQueue.current.catch(()=>{}).then(async()=>{
            requireSession();
            if(auth.currentUser?.uid!==uid || localDateString()!==date) throw new Error('Your account or date changed. Reload and try again.');
            refreshSeq.current++;logEdits.current++;
            return operation();
        });
        healthQueue.current=next.catch(()=>{});
        return next;
    };

    const setDailyLogState = useCallback((nextLog: DailyLog) => {
        dailyLogRef.current = nextLog;
        setDailyLog(nextLog);
    }, []);

    // True once today's log has come back from the server (the cached copy may be stale)
    const [logFresh, setLogFresh] = useState(false);

    // Counts local edits to today's log, so a refresh that started before one doesn't put back the older log
    const logEdits = useRef(0);
    const writeDailyLog = useCallback(async (updater: (current: DailyLog) => DailyLog) => {
        requireSession();
        logEdits.current++;
        const nextLog = updater(dailyLogRef.current);
        await saveDailyLog(nextLog);
        requireSession();
        setDailyLogState(nextLog);
        return nextLog;
    }, [setDailyLogState, requireSession]);

    const updateDailyLog = (updater:(current:DailyLog)=>DailyLog) => runHealthMutation(()=>writeDailyLog(updater));

    const loadRecentWorkouts = useCallback(async () => {
        if (!ownsSession()) return;
        const { getRecentWorkouts } = await import('./services/storageService');
        if (!ownsSession()) return;
        const recents = await getRecentWorkouts(5);
        if (ownsSession()) setRecentWorkouts(recents);
    }, [ownsSession]);

    useEffect(() => {
        // Recent workouts for suggestions, once tracking
        if (tracking) loadRecentWorkouts();
    }, [loadRecentWorkouts, tracking]);

    // Refreshes overlap (every planner edit starts one, so does focus); only the newest may set state,
    // or a slow earlier one lands last and puts back the plan from before the latest change
    const refreshSeq = useRef(0);

    const refreshData = useCallback(async () => {
        const seq = ++refreshSeq.current;
        const editsAtStart = logEdits.current;
        try {
            // The app may have opened from the cache while Firebase restores the session
            await auth.authStateReady();
            if (auth.currentUser?.uid !== uid || !ownsSession() || seq !== refreshSeq.current) return;
            // Today's data is asked for alongside the setup, not after it (each is a server round trip);
            // health data is only used if the setup still says tracking
            const plans = Promise.all([getDayPlan(todayDate), getDayPlan(tomorrowDate)]);
            const health = experience === 'tracking' ? Promise.all([getDailyLog(todayDate), getFastingState()]) : null;
            // At launch this is the read AccountApp started (one server read, not two)
            const setupRead = readSetup();
            const readFrom = setupRead.version;
            const nextSetup = await setupRead.promise;
            if (!ownsSession() || seq !== refreshSeq.current) return;
            // Health data loads for the tracking experience on screen. A current read that says
            // otherwise switches the screen instead; an older one (a switch saved meanwhile) doesn't count
            const current = readFrom === setupVersion();
            const serverTracking = nextSetup.preferences?.experience === 'tracking' && nextSetup.preferences.trackingSetupComplete;
            if (experience !== 'tracking' || (current && !serverTracking)) {
                onSetupChange(nextSetup, readFrom);
                // Plan meals' Today still needs today's and tomorrow's meals (plans, not health data)
                if (experience !== 'tracking') {
                    const [today, tomorrow] = await plans;
                    if (!ownsSession() || seq !== refreshSeq.current) return;
                    setTodayPlan(today);
                    setTomorrowPlan(tomorrow);
                }
                return;
            }
            if (!health) return;
            // The log is one read; the plans wait on the family and its recipes. Show the numbers first
            const [log, fasting] = await health;
            if (!ownsSession() || seq !== refreshSeq.current) return;
            // Guidance read state is secondary: don't hold up the rest of the refresh for it
            getCoachRead().then(read => { if (ownsSession()) setCoachRead(read); });

            if (readFrom === setupVersion()) setUserStatsState(normalizeStats(nextSetup.stats));
            onSetupChange(nextSetup, readFrom);
            // Edited while loading: the local log is newer (and being saved), keep it
            if (logEdits.current === editsAtStart) {setDailyLogState(log);publishFasting(fasting);}
            setLogFresh(true);

            const [today, tomorrow] = await plans;
            if (!ownsSession() || seq !== refreshSeq.current) return;
            setTodayPlan(today);
            setTomorrowPlan(tomorrow);
            cache.claimCache(uid);

        } catch (error) {
            console.error("Failed to refresh data", error);
        } finally {
            // The newest refresh ending (a superseded one returns early) lets background loads go
            if (seq === refreshSeq.current) launchRefreshed.current?.();
        }
        // A switch to tracking loads today's log and fasting
    }, [todayDate, tomorrowDate, setDailyLogState, uid, ownsSession, onSetupChange, setupVersion, readSetup, experience]);

    // Family meals are live: one another member plans or changes shows up on Today straight away,
    // and a new one is pointed out wherever the user is
    const [familyNotice, setFamilyNotice] = useState<FamilyMealChange[] | null>(null);
    const dismissFamilyNotice = useCallback(() => setFamilyNotice(null), []);
    useEffect(() => subscribeFamilyMeals(todayDate, addDays(todayDate, 6), (dinners, added) => {
        if (!ownsSession()) return;
        const apply = (date: string) => (plan: DayPlan) => (plan.date === date ? withFamilyMeals(plan, dinners[date]) : plan);
        if (dinners[todayDate]) setTodayPlan(apply(todayDate));
        if (dinners[tomorrowDate]) setTomorrowPlan(apply(tomorrowDate));
        if (added.length) setFamilyNotice(added);
    }), [todayDate, tomorrowDate, ownsSession]);

    // Family updates from others not seen yet: a dot on the Family tab
    const [familyUnseen, setFamilyUnseen] = useState(0);
    useEffect(() => subscribeFamilyUpdates((_, unseen) => setFamilyUnseen(unseen)), []);

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


    // Health loading only runs inside the resolved tracking branch.
    useEffect(() => {
        const init = async () => {
            try {
                await refreshData();
            } catch (e) {
                console.error("Background refresh failed", e);
            }
        };
        init();
    }, [refreshData]);

    // Saves stats without touching weight history: Settings, streaks and other
    // non-weigh-in updates must not create a weight entry for today.
    const handleSetCoachRead = (id: string, read: boolean) => {
        requireSession();
        const next = { ...coachRead };
        if (read) next[id] = localDateString(); else delete next[id];
        setCoachRead(next);
        saveCoachRead(next).catch(e => console.error('Failed to save guidance read state', e));
    };

    const handleSaveStats = async (newStats: UserStats) => {
        requireSession();
        refreshSeq.current++;
        await saveUserStats(newStats, uid);
        requireSession();
        setUserStatsState(newStats);
        onStatsChange(newStats);
    };

    // The signed-in user as their family sees them, for the header and the sidebar
    const me = { uid, name: userStats.name, avatar: userStats.avatar };

    // A real weigh-in: records newStats.currentWeight as today's weight history entry.
    const handleLogWeight = async (newStats: UserStats) => {
        requireSession();
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
        refreshSeq.current++;
        await saveUserStats(finalStats, uid);
        requireSession();
        setUserStatsState(finalStats);
        onStatsChange(finalStats);
    };

    // Small amounts (a coffee, tea with milk) are logged but don't end the fast
    const fastBreakCalories = fastingState.config.fastBreakCalories ?? DEFAULT_FAST_BREAK_CALORIES;

    const handleAddFoodLogItems = (items: FoodLogItem[]) => runHealthMutation(async () => {
        const fastingState=fastingStateRef.current;
        const fastBreakCalories=fastingState.config.fastBreakCalories??DEFAULT_FAST_BREAK_CALORIES;
        // Items logged together count as one sitting
        if (items.reduce((sum, item) => sum + (item.calories || 0), 0) <= fastBreakCalories) {
            await writeDailyLog((current) => ({ ...current, items: [...current.items, ...items] }));
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

        await writeDailyLog((current) => ({
            ...current,
            items: [...current.items, ...items],
            maxFastingHours: currentFastingMax
        }));

        // Update TRE tracking - food was just logged (this saves history)
        await updateLastAteTime(now);
    });

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
        requireSession();
        const fastingState=fastingStateRef.current;
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
        requireSession();
        await saveFastingState(newState);
        requireSession();
        publishFasting(newState);
    };

    const handleUpdateFastingConfig = (config: FastingConfig) => runHealthMutation(async () => {
        requireSession();
        const newState: FastingState = {
            ...fastingStateRef.current,
            config
        };
        await saveFastingState(newState);
        requireSession();
        publishFasting(newState);
    });



    /** Shows a saved change to today's plan at once; a refresh already on its way read the plan before it */
    const showTodayPlan = (plan: DayPlan) => {
        refreshSeq.current++;
        setTodayPlan(plan);
    };

    const publishIntake = (result:CommittedMealIntake) => {
        requireSession();refreshSeq.current++;logEdits.current++;
        setDailyLogState(result.log);publishFasting(result.fasting);
        setTodayPlan(plan=>({...plan,completedMealIds:result.completedMealIds}));
    };

    // --- Planned meals eaten: the one path for Today (single and batch), eating out, the Planner
    // and cooking. A meal whose calories aren't fully known (or only budgeted) asks this person for
    // their amount first; nothing is written until every answer is in, and the personal amounts
    // stay in their own diary, never on the shared meal or recipe.
    const todayPlanRef = useRef(todayPlan);
    todayPlanRef.current = todayPlan;
    const intakeKeys = useRef(new Set<string>()); // meals with a request in flight
    const intakeRequest = useRef<{
        id: string;
        date: string;
        entries: PlannedMealIntakeEntry[];
        answers: Map<string, ResolvedPlannedMealIntake>;
        queue: string[]; // keys still waiting for an answer, current first
        total: number;
        skipped: string[];
        finish: (result: PlannedMealIntakeResult) => void;
        onTick?: PlannedIntakeTicks;
        fail: (error: unknown) => void;
    } | null>(null);
    const [intakeAsk, setIntakeAsk] = useState<{ id: string; meal: Recipe; progress?: string; error?: string } | null>(null);

    /** The amount to log without asking: a personal answer given with the request, or a fully known meal */
    const resolveWithoutAsking = (entry: PlannedMealIntakeEntry): ResolvedPlannedMealIntake | null => {
        const key = mealKey(entry.meal);
        if (entry.personal) {
            return {
                ...entry, key, calories: Math.round(entry.personal.calories),
                source: entry.personal.estimated ? 'estimate' : 'manual', caloriesEstimated: entry.personal.estimated,
                name: entry.personal.name, place: entry.personal.place, dish: entry.personal.dish,
            };
        }
        const nutrition = mealNutrition(entry.meal);
        if (!nutrition.complete || nutrition.budget) return null;
        return { ...entry, key, calories: nutrition.knownCalories, source: 'recipe', caloriesEstimated: nutrition.estimated };
    };

    /** Dishes eaten out join the owner's history once logged, so they can be picked next time */
    const rememberEatenOut = (entries: ResolvedPlannedMealIntake[], date: string) => {
        const dishes = entries
            .map(entry => ({
                place: entry.place ?? entry.meal.quick?.place ?? '',
                dish: entry.dish ?? entry.meal.quick?.dish ?? '',
                calories: entry.calories,
                protein: entry.personal?.protein ?? entry.meal.protein,
                remember: !!entry.personal?.place || !!entry.personal?.dish || isRememberableDish(entry.meal),
            }))
            .filter(d => d.remember && (d.place || d.dish));
        if (!dishes.length) return;
        // One at a time: each write reads the history the last one saved. A failure here can't undo the log
        (async () => {
            const { recordEatingOutDish } = await import('./services/storageService');
            for (const { remember: _remember, ...dish } of dishes) await recordEatingOutDish(dish, date);
            const [{ ensureWarm }, { eatingOutDishesData }] = await Promise.all([import('./utils/prewarm'), import('./services/pageData')]);
            await ensureWarm(eatingOutDishesData, true);
        })().catch(e => console.error('Could not remember the dish', e));
    };

    /** Writes the answered meals in one owner transaction, then shows them. Throws (keeping the request) on failure */
    /** Shows ticks at once, before they're saved; `undo` takes back only the ones this added */
    const showTicks = (keys: string[], ticked: boolean) => {
        const done = new Set(todayPlanRef.current.completedMealIds);
        const changed = keys.filter(key => done.has(key) !== ticked);
        if (!changed.length) return () => {};
        const apply = (tick: boolean) => {
            refreshSeq.current++; // a refresh already on its way read the plan before this
            setTodayPlan(plan => ({
                ...plan,
                completedMealIds: tick ? [...new Set([...plan.completedMealIds, ...changed])] : plan.completedMealIds.filter(id => !changed.includes(id)),
            }));
        };
        apply(ticked);
        return () => apply(!ticked);
    };

    /** Writes the answered meals in one owner transaction. Their ticks show at once and are taken back
     *  if the save fails (which throws, keeping the request so it can be retried) */
    const commitIntake = async (request: NonNullable<typeof intakeRequest.current>): Promise<PlannedMealIntakeResult> => {
        const keys = request.entries.map(entry => mealKey(entry.meal)).filter(key => request.answers.has(key));
        const undo = showTicks(keys, true);
        request.onTick?.(keys, true);
        try {
            return await saveIntake(request);
        } catch (error) {
            undo();
            request.onTick?.(keys, false);
            throw error;
        }
    };

    const saveIntake = (request: NonNullable<typeof intakeRequest.current>): Promise<PlannedMealIntakeResult> => runHealthMutation(async () => {
        if (request.date !== todayDate) throw new Error('The day changed. Try again.');
        const resolved = request.entries
            .map(entry => request.answers.get(mealKey(entry.meal)))
            .filter((entry): entry is ResolvedPlannedMealIntake => !!entry);
        // A meal removed from today's plan meanwhile isn't logged against it
        const planned = new Set(todayPlanRef.current.meals.map(mealKey));
        if (resolved.some(entry => !planned.has(entry.key))) throw new Error('Today\'s plan changed. Try again.');
        if (!resolved.length) return { status: 'saved', loggedKeys: [], skippedKeys: request.skipped, items: [] };
        const committed = await commitPlannedMealIntake(uid, request.date, resolved);
        publishIntake(committed);
        rememberEatenOut(resolved, request.date);
        return { status: 'saved', loggedKeys: resolved.map(entry => entry.key), skippedKeys: request.skipped, items: committed.items };
    });

    const endIntakeRequest = (request: NonNullable<typeof intakeRequest.current>) => {
        request.entries.forEach(entry => intakeKeys.current.delete(mealKey(entry.meal)));
        if (intakeRequest.current === request) intakeRequest.current = null;
        setIntakeAsk(current => (current?.id === request.id ? null : current));
    };

    /** Shows the next meal to answer, or commits once none are left */
    const advanceIntake = async (request: NonNullable<typeof intakeRequest.current>) => {
        const key = request.queue[0];
        if (key) {
            const entry = request.entries.find(e => mealKey(e.meal) === key)!;
            const progress = request.total > 1 ? `${request.total - request.queue.length + 1} of ${request.total}` : undefined;
            setIntakeAsk({ id: request.id, meal: entry.meal, progress });
            return;
        }
        const result = await commitIntake(request);
        endIntakeRequest(request);
        request.finish(result);
    };

    const handleRequestPlannedIntake = (entries: PlannedMealIntakeEntry[], onTick?: PlannedIntakeTicks): Promise<PlannedMealIntakeResult> => {
        requireSession();
        if (!entries.length) return Promise.resolve({ status: 'saved', loggedKeys: [], skippedKeys: [], items: [] });
        assertUniqueMealKeys(entries.map(entry => entry.meal));
        const keys = entries.map(entry => mealKey(entry.meal));
        // A second tap while the first is still asking or saving does nothing
        if (intakeRequest.current || keys.some(key => intakeKeys.current.has(key))) return Promise.resolve({ status: 'cancelled' });
        keys.forEach(key => intakeKeys.current.add(key));
        return new Promise<PlannedMealIntakeResult>((finish, fail) => {
            const answers = new Map<string, ResolvedPlannedMealIntake>();
            const queue: string[] = [];
            for (const entry of entries) {
                const resolved = resolveWithoutAsking(entry);
                if (resolved) answers.set(resolved.key, resolved);
                else queue.push(mealKey(entry.meal));
            }
            const request = { id: crypto.randomUUID(), date: todayDate, entries, answers, queue, total: queue.length, skipped: [] as string[], finish, fail, onTick };
            intakeRequest.current = request;
            advanceIntake(request).catch(error => {
                // Nothing to ask and the save failed: hand the error to the caller
                endIntakeRequest(request);
                fail(error);
            });
        });
    };

    /** The answer for the meal being asked about. The last one commits; its failure keeps the sheet open to retry */
    const answerIntake = async (calories: number, estimated: boolean) => {
        const request = intakeRequest.current;
        const key = request?.queue[0];
        if (!request || !key) return;
        const entry = request.entries.find(e => mealKey(e.meal) === key)!;
        request.answers.set(key, { ...entry, key, calories, source: estimated ? 'estimate' : 'manual', caloriesEstimated: estimated });
        if (request.queue.length > 1) {
            request.queue = request.queue.slice(1);
            await advanceIntake(request);
            return;
        }
        try {
            request.queue = [];
            await advanceIntake(request);
        } catch (error) {
            request.queue = [key]; // ask again on retry; the answer is kept in the sheet
            throw error;
        }
    };

    const skipIntake = () => {
        const request = intakeRequest.current;
        const key = request?.queue[0];
        if (!request || !key) return;
        request.skipped.push(key);
        request.answers.delete(key);
        request.queue = request.queue.slice(1);
        advanceIntake(request).catch(error => {
            // Saving the other meals failed: stay on this one so it can be answered or skipped again
            request.skipped = request.skipped.filter(k => k !== key);
            request.queue = [key];
            const entry = request.entries.find(e => mealKey(e.meal) === key)!;
            setIntakeAsk({ id: request.id, meal: entry.meal, error: error instanceof Error ? error.message : "Couldn't save. Try again." });
        });
    };

    const cancelIntake = useCallback(() => {
        const request = intakeRequest.current;
        if (!request) return;
        endIntakeRequest(request);
        request.finish({ status: 'cancelled' });
    }, []);

    // A new day, another page or leaving the app drops an unanswered request without writing anything
    useEffect(() => cancelIntake, [todayDate, view, cancelIntake]);

    /** Unticks at once; the tick comes back if removing the entry fails */
    const handleRemovePlannedIntake = async (meal: Recipe) => {
        const undo = showTicks([mealKey(meal)], false);
        try {
            await runHealthMutation(async () => {
                publishIntake(await removePlannedMealIntake(uid, todayDate, meal));
            });
        } catch (error) {
            undo();
            throw error;
        }
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
        onRequestPlannedIntake: handleRequestPlannedIntake,
        onRemovePlannedIntake: handleRemovePlannedIntake,
        onSetDayStatus: (status: DayLogStatus | undefined) => updateDailyLog(current => ({ ...current, status })),
        onAddFoodLogItems: handleAddFoodLogItems,
        onUpdateFoodItem: (item:FoodLogItem) => runHealthMutation(async()=>{
            if(item.planInstanceId) {publishIntake(await updatePlannedMealIntake(uid,todayDate,item));return;}
            await writeDailyLog(current=>({...current,items:current.items.map(i=>i.id===item.id?item:i)}));
            if(item.calories>(fastingStateRef.current.config.fastBreakCalories??DEFAULT_FAST_BREAK_CALORIES) && item.timestamp>(fastingStateRef.current.lastAteTime??0)) {
                const next={...fastingStateRef.current,lastAteTime:item.timestamp};await saveFastingState(next);requireSession();publishFasting(next);
            }
        }),
        onRestoreFoodItem: (item:FoodLogItem) => runHealthMutation(async()=>{
            if(item.planInstanceId) {publishIntake(await restorePlannedMealIntake(uid,todayDate,item));return;}
            await writeDailyLog(current=>({...current,items:current.items.some(i=>i.id===item.id)?current.items:[...current.items,item]}));
        }),
        onDeleteFoodItem: (itemId:string) => runHealthMutation(async()=>{
            if(dailyLogRef.current.items.find(i=>i.id===itemId)?.planInstanceId) {publishIntake(await deletePlannedMealIntake(uid,todayDate,itemId));return;}
            await writeDailyLog(current=>({...current,items:current.items.filter(i=>i.id!==itemId)}));
        }),
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

    /** Today's subtitle: the greeting plus where the day stands. The next meal is the highlighted row on Today's plate */
    const getTodayLine = (greeting: string) => {
        // Plan meals has no ticks or fast days: just whether anything is planned
        if (!tracking) {
            const count = todayPlan.meals.length;
            return [greeting, count ? `${count} meal${count === 1 ? '' : 's'} planned` : 'nothing planned yet'].join(' · ');
        }
        const status = todayPlan.meals.length === 0
            ? 'nothing planned yet'
            : nextMealIndex(todayPlan) === undefined
                ? 'all meals eaten'
                : undefined;
        return [greeting, ...(isFastDay(todayPlan) ? ['fast day'] : []), ...(status ? [status] : [])].join(' · ');
    };

    // The greeting belongs on Today, with where the day stands; other pages just say where you are
    const getHeaderInfo = (): { title: string; subtitle?: string } => {
        switch (view) {
            case AppView.TODAY:
                return {
                    title: new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
                    subtitle: getTodayLine(`${getGreeting()}, ${userStats.name || 'Family'}`),
                };
            case AppView.ANALYTICS:
                return { title: 'Analytics' };
            case AppView.PLANNER:
                return { title: 'Planner' };
            case AppView.RECIPES:
                return { title: 'Recipes' };
            case AppView.FAMILY:
                return { title: 'Family' };
            case AppView.SHOPPING:
                // Tracking keeps the list under Family's tabs; Plan meals has it as its own page
                return { title: tracking ? 'Family' : 'Shopping' };
            case AppView.SETTINGS:
                return { title: 'Settings' };
            default:
                return { title: 'Vesta' };
        }
    };

    const headerInfo = getHeaderInfo();

    // Every page lives in an Activity: hidden pages are pre-rendered in the background (once the app
    // is idle after launch) and keep their state, but their effects pause and they don't re-render,
    // so switching is instant. Effects re-run when a page is shown again, which quietly refreshes its data.
    // The planner's seven day columns get more room on big screens. The family's pages share
    // the usual width, so their tabs and content stay aligned when switching to the shopping list.
    const pageWidth = (target: AppView) =>
        (target === AppView.PLANNER ? 'max-w-[100rem]' : 'max-w-6xl');
    const renderView = (target: AppView, content: React.ReactNode) => (
        (prerenderPages || target === view || visitedViews.has(target)) &&
        <Activity key={target} mode={view === target ? 'visible' : 'hidden'}>
            <div className={`${pageWidth(target)} mx-auto px-4 pb-4 pt-0 md:px-8 md:pb-8 md:pt-0 motion-safe:animate-page-fade`}>
                <React.Suspense fallback={<ViewSkeleton />}>{content}</React.Suspense>
            </div>
        </Activity>
    );



    return (
        <div className="min-h-screen md:flex font-sans">

            {/* Sidebar and header: who's signed in, as their family sees them */}
            <Sidebar currentView={view} onNavigate={handleNavigate} me={me} familyUnseen={familyUnseen} experience={experience} />

            {/* Main Content Wrapper */}
            <div className="w-full nav:pl-[calc(var(--nav-inset-left)+76px)] nav:lg:pl-[calc(var(--nav-inset-left)+228px)] nav:pr-[env(safe-area-inset-right)]">
                {/* Main Content */}
                {/* The tab bar floats above the bottom edge, so the page needs room under it */}
                <main className="pb-[calc(var(--tab-bar-bottom)+86px)] nav:pb-0 pt-8 md:pt-12">
                    <div className={`${pageWidth(view)} mx-auto px-4 md:px-8`}>
                        <Header
                            title={headerInfo.title}
                            subtitle={headerInfo.subtitle}
                            onNavigate={handleNavigate}
                            me={me}
                            isSettings={view === AppView.SETTINGS}
                        />
                        {tracking && (view === AppView.FAMILY || view === AppView.SHOPPING) && (
                            <FamilyTabs currentView={view} onNavigate={handleNavigate} />
                        )}
                    </div>
                    {/* Views switch instantly (no cross-fade). Each has its own Suspense so a
                        loading view never blanks the page; lazy chunks are prefetched at start-up. */}
                    {renderView(AppView.TODAY, tracking
                        ? <TrackToday {...trackProps} />
                        : <PlanToday uid={uid} todayPlan={todayPlan} tomorrowPlan={tomorrowPlan} onPlanChange={showTodayPlan} refreshData={refreshData} onNavigate={handleNavigate} />)}
                    {tracking && renderView(AppView.ANALYTICS, <TrackAnalytics {...trackProps} />)}
                    {renderView(AppView.PLANNER, <Planner stats={userStats} onPlanChanged={refreshData} experience={experience} onRequestPlannedIntake={tracking ? handleRequestPlannedIntake : undefined} />)}
                    {renderView(AppView.RECIPES, <RecipeLibrary experience={experience} />)}
                    {renderView(AppView.SHOPPING, <ShoppingList />)}
                    {renderView(AppView.FAMILY, <FamilyView myAvatar={userStats.avatar} onSaveAvatar={avatar => tracking ? handleSaveStats({ ...userStats, avatar }) : onSavePlanningAvatar(avatar)} />)}
                    {renderView(AppView.SETTINGS, (
                        <SettingsView
                            stats={userStats}
                            onUpdateStats={tracking ? handleSaveStats : rejectTrackingChange}
                            fastingConfig={fastingState.config}
                            onUpdateFastingConfig={tracking ? handleUpdateFastingConfig : rejectTrackingChange}
                            onTestOnboarding={onTestOnboarding}
                            experienceSettings={experienceSettings}
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
                    familyUnseen={familyUnseen}
                    experience={experience}
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

                {/* Calories for planned meals eaten without known nutrition, from any page */}
                {intakeAsk && (
                    <MealCaloriesSheet
                        key={`${intakeAsk.id}:${mealKey(intakeAsk.meal)}`}
                        meal={intakeAsk.meal}
                        requestId={intakeAsk.id}
                        progress={intakeAsk.progress}
                        error={intakeAsk.error}
                        onSave={answerIntake}
                        onSkip={skipIntake}
                        onClose={cancelIntake}
                    />
                )}

                <WeightEntryModal
                    isOpen={isWeightModalOpen}
                    onClose={() => setIsWeightModalOpen(false)}
                    currentWeight={userStats.currentWeight}
                    onSave={handleUpdateWeight}
                />

                {familyNotice && (
                    <FamilyNotice
                        changes={familyNotice}
                        onView={date => navigate('/mealplanner', { state: { date } })}
                        onDismiss={dismissFamilyNotice}
                    />
                )}

            </div>
        </div>
    );
};

type SetupState = { status: 'loading'; uid: string } | { status: 'error'; uid: string; message: string }
    | { status: 'ready'; uid: string; snapshot: UserSetupSnapshot };

/** This boundary owns setup state; unresolved accounts never mount tracker effects. */
const AccountApp: React.FC<{ uid: string }> = ({ uid }) => {
    const { logout } = useAuth();
    const { isFeatureEnabled } = useDevMode();
    const allowChoice = isFeatureEnabled('enableMealPlanningSetup');
    // A returning user opens straight from the last confirmed setup; the server confirms it after
    const [state, setState] = useState<SetupState>(() => {
        const cached = cache.getCachedUserSetup(uid);
        return cached ? { status: 'ready', uid, snapshot: cached } : { status: 'loading', uid };
    });
    const [retry, setRetry] = useState(0);
    const [wizard, setWizard] = useState<{ intent: 'switch' | 'rerun'; experience: UserExperience; id: number } | null>(null);
    const wizardId = useRef(0);
    const epoch = useRef(0);
    const alive = useRef(true);
    const ownsSession = useCallback(() => alive.current && currentUid() === uid, [uid]);
    // The experience the server last confirmed: where a failed switch goes back to
    const confirmedPreferences = useRef<UserSetupSnapshot['preferences']>(null);
    /** A setup from the server (or just saved to it) */
    const applySetup = useCallback((snapshot: UserSetupSnapshot) => {
        if (!ownsSession() || snapshot.uid !== uid) return;
        confirmedPreferences.current = snapshot.preferences;
        cache.saveCachedUserSetup(snapshot);
        setState({ status: 'ready', uid, snapshot });
    }, [uid, ownsSession]);
    /** Shows preferences not saved yet (a switch on its way), keeping the rest of the current setup */
    const showPreferences = useCallback((preferences: NonNullable<UserSetupSnapshot['preferences']>) => {
        if (!ownsSession()) return;
        setState(current => {
            if (current.status !== 'ready') return current;
            const snapshot = { ...current.snapshot, preferences };
            cache.saveCachedUserSetup(snapshot);
            return { ...current, snapshot };
        });
    }, [ownsSession]);
    // A refresh that read the setup before a change here (a switch, a name) would put the old one
    // back, even if it lands after the change has saved: only a read started since then applies.
    // `epoch` counts those changes; a switch also counts when its save ends.
    const switching = useRef(0);
    const latestSwitch = useRef(0);
    const switchSaves = useRef<Promise<unknown>>(Promise.resolve());
    const setupVersion = useCallback(() => epoch.current, []);
    // One server read of the setup for everyone asking while it's on its way (a launch asks here and
    // in TrackerApp's refresh) or just back, unless the setup changed here since it started: its
    // version is the epoch it started in, so the epoch rules above still hold for whoever shares it
    const setupReads = useRef(createInFlight<UserSetupSnapshot, number>(5000));
    const readSetup = useCallback(() => setupReads.current(() => epoch.current, () => getUserSetup(uid)), [uid]);
    const applyRefreshedSetup = useCallback((snapshot: UserSetupSnapshot, readFrom: number) => {
        if (switching.current === 0 && readFrom === epoch.current) applySetup(snapshot);
    }, [applySetup]);
    const applyStats = useCallback((stats: UserStats) => {
        if (!ownsSession()) return;
        setState(current => {
            if (current.status !== 'ready') return current;
            const snapshot = { ...current.snapshot, stats };
            cache.saveCachedUserSetup(snapshot);
            return { ...current, snapshot };
        });
    }, [ownsSession]);

    useEffect(() => {
        alive.current = true;
        const request = ++epoch.current;
        setState(current => current.status === 'error' ? { status: 'loading', uid } : current); // Retry
        // Firebase may still be restoring the session (AuthGuard opens from the cache meanwhile);
        // the setup is read as the confirmed user. A different user remounts this with their uid.
        auth.authStateReady()
            .then(() => {
                if (request !== epoch.current || auth.currentUser?.uid !== uid) return;
                return readSetup().promise.then(snapshot => {
                    if (request === epoch.current) applySetup(snapshot);
                });
            })
            .catch(error => {
                if (request !== epoch.current || !ownsSession()) return;
                // Offline or slow: keep using the cached setup if there is one
                setState(current => current.status === 'ready'
                    ? current
                    : { status: 'error', uid, message: error instanceof Error ? error.message : 'Your setup could not be loaded. Try again.' });
                console.warn('Could not confirm the setup', error);
            });
        return () => { alive.current = false; epoch.current++; clearWarm(); };
    }, [uid, retry, applySetup, ownsSession, readSetup]);

    if (state.status === 'loading') return <main className="min-h-screen bg-background p-6"><p role="status" className="text-muted">Loading your setup…</p></main>;
    if (state.status === 'error') return <main className="min-h-screen bg-background p-6"><div className="card p-6 max-w-md mx-auto space-y-4">
        <h1 className="heading-2">Let’s reconnect</h1><p role="alert" className="text-error">{state.message}</p>
        <div className="flex flex-wrap gap-3"><button className="btn-primary" onClick={() => setRetry(value => value + 1)}>Retry</button>
            <button className="btn-secondary" onClick={() => void logout()}>Sign out</button></div>
    </div></main>;

    const setup = state.snapshot;
    const preferences = setup.preferences;
    const required = !preferences?.profileSetupComplete || (preferences.experience === 'tracking' && !preferences.trackingSetupComplete);
    const openWizard = (intent: 'switch' | 'rerun', experience: UserExperience) => {
        setWizard({ intent, experience, id: ++wizardId.current });
    };
    const ensureSession = () => { if (!ownsSession()) throw new Error('Your account changed. Reload and try again.'); };
    const onComplete = async (data: OnboardingResult) => {
        ensureSession();
        const request = ++epoch.current;
        const next = await completeUserSetup(uid, data, localDateString());
        ensureSession();
        if (request === epoch.current) { applySetup(next); setWizard(null); }
    };
    const experienceSettings: ExperienceSettings | undefined = preferences ? {
        preferences,
        // The switch shows at once and saves behind it; a failed save switches back and says so.
        // An experience that still needs setting up opens its setup instead.
        onChange: async experience => {
            ensureSession();
            if (!preferences.profileSetupComplete || (experience === 'tracking' && !preferences.trackingSetupComplete)) {
                openWizard('switch', experience);
                return { status: 'setup-required' };
            }
            // Another switch can follow before this one has saved: only the latest one's outcome is
            // shown, and the saves run one after another so the server ends on the latest choice
            const change = ++latestSwitch.current;
            const fallback = confirmedPreferences.current ?? preferences;
            epoch.current++; // a setup read already on its way is older than this
            switching.current++;
            showPreferences({ ...preferences, experience });
            const save = switchSaves.current.catch(() => {}).then(() => saveUserExperience(uid, experience));
            switchSaves.current = save;
            try {
                const next = await save;
                ensureSession();
                if (change === latestSwitch.current) applySetup(next);
                else confirmedPreferences.current = next.preferences;
                return { status: 'saved' };
            } catch (error) {
                const latest = change === latestSwitch.current;
                if (latest) showPreferences(confirmedPreferences.current ?? fallback);
                if (error instanceof UserSetupRequiredError) {
                    ensureSession();
                    if (latest) openWizard('switch', experience);
                    return { status: 'setup-required' };
                }
                throw error;
            } finally {
                switching.current--;
                epoch.current++;
            }
        },
        onSaveName: async name => {
            ensureSession();
            const request = ++epoch.current;
            const next = await saveUserProfileName(uid, name);
            ensureSession();
            if (request === epoch.current) applySetup(next);
        },
    } : undefined;
    const rerun = () => openWizard('rerun', preferences?.experience ?? 'tracking');
    // A new account can join a family from setup; anyone else joins from the Family page
    const joinFamily = async (code: string) => {
        ensureSession();
        try {
            const group = await joinGroup(code);
            void recordFamilyUpdate({ type: 'joined' });
            return group.name;
        } catch (error) {
            const message = error instanceof Error ? error.message : '';
            throw new Error(message === 'Invalid invite code' || !message ? "That code didn't work. Check it and try again." : message);
        }
    };
    const activeWizard = wizard ?? (required ? { intent: 'required' as const, experience: preferences?.experience, id: 0 } : null);

    return <>
        {!required && experienceSettings && (
            <TrackerApp uid={uid} setup={setup} onSetupChange={applyRefreshedSetup} setupVersion={setupVersion} readSetup={readSetup} onStatsChange={applyStats} experienceSettings={experienceSettings} onTestOnboarding={rerun}
                onSavePlanningAvatar={async avatar => {
                    ensureSession();
                    const request = ++epoch.current;
                    const next = await saveUserProfileAvatar(uid, avatar);
                    ensureSession();
                    if (request === epoch.current) applySetup(next);
                }} />
        )}
        {activeWizard && <OnboardingWizard key={`${uid}:${activeWizard.intent}:${activeWizard.id}`}
            stats={setup.stats ?? undefined} initialExperience={activeWizard.experience} allowExperienceChoice={allowChoice}
            intent={activeWizard.intent} onComplete={onComplete}
            onJoinFamily={activeWizard.intent === 'required' && !preferences?.profileSetupComplete ? joinFamily : undefined}
            onCancel={activeWizard.intent === 'required' ? undefined : () => setWizard(null)} />}
    </>;
};

const AuthGuard: React.FC = () => {
    // While Firebase restores the session (over the network, which can take seconds) uid is the
    // previous session's. A returning user with a cached setup gets the app straight away; data
    // calls wait for auth inside Firestore. Anyone else keeps the splash until auth is known.
    const { uid, loading } = useAuth();
    const ready = !loading || (!!uid && cache.getCachedUserSetup(uid) !== null);

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

    return <AccountApp key={uid} uid={uid} />;
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
