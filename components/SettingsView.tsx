import React, { useState, useEffect, useRef } from 'react';
import { ThemePreference } from '../hooks/useTheme';
import { UserStats, FastingConfig, FastingProtocol, WorkoutCalorieCredit, UserPreferences, UserExperience, UserExperienceChangeResult } from '../types';
import { proteinTarget } from '../utils/planUtils';
import { BellRing, Check, CircleAlert, Code, Compass, Copy, CloudUpload, Database, Download, Droplet, Egg, Gauge, LogOut, Pencil, PlayCircle, RefreshCw, Scale, Store, SunMoon, Target, Timer, Upload, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ReminderSettings } from './ReminderSettings';
import { EatingOutHistorySettings } from './EatingOutHistorySettings';
import { exportAllData, importAllData, getLocalStorageDebugInfo, migrateFromLocalStorage } from '../services/storageService';
import { useDevMode } from '../contexts/DevModeContext';
import { useAuth } from '../contexts/AuthContext';
import { localDateString } from '../utils/dateUtils';
import { DEFAULT_FAST_BREAK_CALORIES } from '../constants';
import { SelectionPill } from './SelectionPill';
import { MemberAvatar } from './MemberAvatar';
import { ConfirmSheet } from './ConfirmSheet';
import { Switch } from './Switch';
import { ExperienceChoice } from './ExperienceChoice';
import { currentUid } from '../services/firebase';

const PROTOCOLS: { id: Exclude<FastingProtocol, 'custom'>; hours: number; label: string }[] = [
    { id: '12:12', hours: 12, label: 'Gentle' },
    { id: '14:10', hours: 14, label: 'Steady' },
    { id: '16:8', hours: 16, label: 'Popular' },
    { id: '18:6', hours: 18, label: 'Advanced' },
    { id: '20:4', hours: 20, label: 'Intense' },
];

interface SettingsViewProps {
    stats: UserStats;
    onUpdateStats: (stats: UserStats) => Promise<void>;
    fastingConfig: FastingConfig;
    onUpdateFastingConfig: (config: FastingConfig) => Promise<void>;
    onTestOnboarding: () => void;
    onRefreshData?: () => Promise<void>;
    themePreference: ThemePreference;
    onChangeTheme: (theme: ThemePreference) => void;
    experienceSettings?: {
        preferences: UserPreferences;
        onChange: (experience: UserExperience) => Promise<UserExperienceChangeResult>;
        onSaveName: (name: string) => Promise<void>;
    };
}

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
];


const CREDIT_OPTIONS: { value: WorkoutCalorieCredit; label: string; example: string }[] = [
    { value: 1, label: 'Add all', example: '300 → +300' },
    { value: 0.5, label: 'Add half', example: '300 → +150' },
    { value: 0, label: "Don't add", example: 'Not counted' },
];

/** A settings card's title: a round tinted icon beside the heading and its description */
const SectionTitle: React.FC<{ id: string; icon: LucideIcon; tile: string; title: React.ReactNode; children?: React.ReactNode }> = ({ id, icon: Icon, tile, title, children }) => (
    <div className="flex items-start gap-3 min-w-0">
        <span className={`icon-tile ${tile} size-10 shrink-0 flex items-center justify-center`}><Icon size={18} strokeWidth={2.25} aria-hidden="true" /></span>
        <div className="min-w-0">
            <h2 id={id} className="heading-3 pt-2">{title}</h2>
            {children && <p className="text-sm text-muted mt-1">{children}</p>}
        </div>
    </div>
);

export const SettingsView: React.FC<SettingsViewProps> = ({
    stats,
    onUpdateStats,
    fastingConfig,
    onUpdateFastingConfig,
    onTestOnboarding,
    onRefreshData,
    themePreference,
    onChangeTheme,
    experienceSettings,
}) => {
    const isPlanning = experienceSettings?.preferences.experience === 'planning';

    // Form fields are kept as strings so a field can be cleared while typing
    const toForm = (st: UserStats, fc: FastingConfig) => ({
        name: st.name || '',
        goalWeight: st.goalWeight ? String(st.goalWeight) : '',
        dailyCalorieGoal: String(st.dailyCalorieGoal || ''),
        nonFastDayCalories: String(st.nonFastDayCalories || 2000),
        dailyWaterGoal: String((st.dailyWaterGoal || 2500) / 1000),
        workoutCalorieCredit: String(st.workoutCalorieCredit ?? 1),
        dailyProteinGoal: st.dailyProteinGoal ? String(st.dailyProteinGoal) : '',
        fastBreakCalories: String(fc.fastBreakCalories ?? DEFAULT_FAST_BREAK_CALORIES),
    });
    const [form, setForm] = useState(() => toForm(stats, fastingConfig));
    const [protocol, setProtocol] = useState<FastingProtocol>(fastingConfig.protocol);
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [saveError, setSaveError] = useState<string | null>(null);
    const [nameSaving, setNameSaving] = useState(false);
    const [experienceMessage, setExperienceMessage] = useState<string | null>(null);
    const [experienceError, setExperienceError] = useState<string | null>(null);
    const modeOperation = useRef(false);
    const mounted = useRef(true);
    const [dataStatus, setDataStatus] = useState<string | null>(null);
    const [debugInfo, setDebugInfo] = useState<Record<string, string>>({});
    const [showDebug, setShowDebug] = useState(false);
    const { isDevMode, featureFlags, toggleFeatureFlag, resetFlags } = useDevMode();
    const { user, uid: sessionUid, logout } = useAuth();
    // Settings can render before Firebase has restored the session (the app opens from the cache), so
    // the owner is the expected uid, as App's own checks use; a different account remounts the app
    const ownerUid = useRef(sessionUid).current;
    const ownsSession = () => !!ownerUid && currentUid() === ownerUid;
    const [hasCopiedId, setHasCopiedId] = useState(false);
    // The action waiting on its confirmation sheet (a backup to restore carries its file)
    const [confirming, setConfirming] = useState<'logout' | 'sync' | { restore: File } | null>(null);

    const update = (field: keyof ReturnType<typeof toForm>) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm(f => ({ ...f, [field]: e.target.value }));
    };

    // Validation: every target must be a sensible positive number
    const num = (v: string) => Number(v.replace(',', '.'));
    const errors: Partial<Record<keyof ReturnType<typeof toForm>, string>> = {};
    if (form.goalWeight && !(num(form.goalWeight) >= 30 && num(form.goalWeight) <= 300)) errors.goalWeight = 'Enter a weight between 30 and 300 kg';
    if (!(num(form.dailyCalorieGoal) >= 400 && num(form.dailyCalorieGoal) <= 5000)) errors.dailyCalorieGoal = 'Enter 400 to 5000 kcal';
    if (!(num(form.nonFastDayCalories) >= 800 && num(form.nonFastDayCalories) <= 6000)) errors.nonFastDayCalories = 'Enter 800 to 6000 kcal';
    if (!(num(form.dailyWaterGoal) >= 0.5 && num(form.dailyWaterGoal) <= 6)) errors.dailyWaterGoal = 'Enter 0.5 to 6 litres';
    if (form.dailyProteinGoal && !(num(form.dailyProteinGoal) >= 30 && num(form.dailyProteinGoal) <= 400)) errors.dailyProteinGoal = 'Enter 30 to 400 g, or leave empty';
    if (!(Number.isInteger(num(form.fastBreakCalories)) && num(form.fastBreakCalories) >= 0 && num(form.fastBreakCalories) <= 200)) errors.fastBreakCalories = 'Enter 0 to 200 kcal';
    const hasErrors = Object.keys(errors).length > 0;

    // What the form would save, and the form those saved values read back as ("2,5" litres and
    // "2.5" are the same goal, so typing one doesn't count as a change or get overwritten)
    type Form = ReturnType<typeof toForm>;
    const toStats = (f: Form): UserStats => ({
        ...stats,
        name: f.name.trim(),
        goalWeight: f.goalWeight ? num(f.goalWeight) : stats.goalWeight,
        dailyCalorieGoal: Math.round(num(f.dailyCalorieGoal)),
        nonFastDayCalories: Math.round(num(f.nonFastDayCalories)),
        dailyWaterGoal: Math.round(num(f.dailyWaterGoal) * 1000),
        workoutCalorieCredit: Number(f.workoutCalorieCredit) as WorkoutCalorieCredit,
        dailyProteinGoal: f.dailyProteinGoal ? Math.round(num(f.dailyProteinGoal)) : undefined,
    });
    const toFasting = (f: Form, p: FastingProtocol): FastingConfig => ({
        ...fastingConfig,
        protocol: p,
        targetFastHours: p === fastingConfig.protocol ? fastingConfig.targetFastHours : PROTOCOLS.find(pr => pr.id === p)?.hours ?? fastingConfig.targetFastHours,
        fastBreakCalories: num(f.fastBreakCalories),
    });
    const sameAsSaved = (f: Form, p: FastingProtocol) =>
        !hasErrors && p === fastingConfig.protocol
        && JSON.stringify(toForm(toStats(f), toFasting(f, p))) === JSON.stringify(toForm(stats, fastingConfig));
    const isDirty = !sameAsSaved(form, protocol);

    // Goals save themselves, like Appearance: shortly after the last change, or straight away when
    // the page is left (hidden pages pause, and coming back reloads the saved values)
    const pendingSave = useRef(false);
    const saveInFlight = useRef<Promise<void> | null>(null);
    const save = async () => {
        if (saveInFlight.current) return saveInFlight.current;
        if (isPlanning || hasErrors || !pendingSave.current) return;
        if (!ownsSession()) throw new Error('Your account changed. Reload and try again.');
        if (mounted.current) { setSaveState('saving'); setSaveError(null); }
        const operation = (async () => {
            await onUpdateStats(toStats(form));
            if (!ownsSession()) throw new Error('Your account changed. Reload and try again.');
            const fasting = toFasting(form, protocol);
            if (fasting.protocol !== fastingConfig.protocol || fasting.fastBreakCalories !== (fastingConfig.fastBreakCalories ?? DEFAULT_FAST_BREAK_CALORIES)) {
                await onUpdateFastingConfig(fasting);
            }
            pendingSave.current = false;
        })();
        saveInFlight.current = operation;
        try {
            await operation;
            if (mounted.current && ownsSession()) {
                setSaveState('saved');
                setTimeout(() => { if (mounted.current && ownsSession()) setSaveState(s => s === 'saved' ? 'idle' : s); }, 2500);
            }
        } catch (error) {
            if (mounted.current && ownsSession()) {
                setSaveState('error');
                setSaveError(error instanceof Error ? error.message : 'Your changes could not be saved. Try again.');
            }
            throw error;
        } finally {
            if (saveInFlight.current === operation) saveInFlight.current = null;
        }
    };
    const saveRef = useRef(save);
    saveRef.current = save;

    useEffect(() => {
        pendingSave.current = !isPlanning && isDirty && !hasErrors;
        if (!pendingSave.current) return;
        const timer = setTimeout(() => { if (ownsSession()) void saveRef.current().catch(() => {}); }, 800);
        return () => clearTimeout(timer);
    }, [form, protocol, isPlanning]);
    useEffect(() => {
        mounted.current = true;
        if (!saveInFlight.current) setSaveState('idle');
        return () => {
            mounted.current = false;
            if (pendingSave.current && ownsSession()) void saveRef.current().catch(() => {});
        };
    }, [ownerUid]);

    // The switch shows at once and saves behind it (App applies it before saving), so nothing here is
    // locked meanwhile: another switch can follow, and only the latest one's outcome is shown
    const [experienceSaving, setExperienceSaving] = useState(0);
    const latestChange = useRef(0);
    const changeExperience = async (experience: UserExperience) => {
        if (!experienceSettings) return;
        const change = ++latestChange.current;
        const isLatest = () => change === latestChange.current && mounted.current && ownsSession();
        setExperienceSaving(n => n + 1); setExperienceError(null); setExperienceMessage(null);
        try {
            if (!ownsSession()) throw new Error('Your account changed. Reload and try again.');
            // Goal edits still waiting are saved first, so switching doesn't drop them
            if (saveInFlight.current || (!isPlanning && pendingSave.current && !hasErrors)) await saveRef.current();
            if (!ownsSession()) throw new Error('Your account changed. Reload and try again.');
            const result = await experienceSettings.onChange(experience);
            if (isLatest()) setExperienceMessage(result.status === 'saved' ? 'Saved' : null);
        } catch (error) {
            if (isLatest()) setExperienceError(error instanceof Error ? error.message : 'Your choice could not be saved. Try again.');
        } finally {
            if (mounted.current) setExperienceSaving(n => n - 1);
        }
    };

    const savePlanningName = async () => {
        if (!experienceSettings || modeOperation.current || !ownsSession()) return;
        modeOperation.current = true;
        setNameSaving(true); setExperienceError(null); setExperienceMessage(null);
        try {
            await experienceSettings.onSaveName(form.name);
            if (mounted.current && ownsSession()) setExperienceMessage('Saved');
        } catch (error) {
            if (mounted.current && ownsSession()) setExperienceError(error instanceof Error ? error.message : 'Your name could not be saved. Try again.');
        } finally {
            modeOperation.current = false;
            if (mounted.current) setNameSaving(false);
        }
    };

    // Pick up saved values that changed elsewhere, unless an edit is still on its way
    useEffect(() => {
        if (pendingSave.current || sameAsSaved(form, protocol)) return;
        setForm(toForm(stats, fastingConfig));
        setProtocol(fastingConfig.protocol);
    }, [stats, fastingConfig]);
    useEffect(() => { if (showDebug) setDebugInfo(getLocalStorageDebugInfo()); }, [showDebug]);

    const flash = (message: string) => {
        setDataStatus(message);
        setTimeout(() => setDataStatus(m => (m === message ? null : m)), 3000);
    };

    const forceSync = async () => {
        const result = await migrateFromLocalStorage(true);
        if (result.success) window.location.reload();
        else flash(`Sync failed: ${result.error}`);
    };

    // The preview can be closed without saving; finishing it saves name, weight, goal and targets
    const handleTestOnboarding = () => onTestOnboarding();

    const handleCopyId = () => {
        if (user?.uid) {
            navigator.clipboard.writeText(user.uid);
            setHasCopiedId(true);
            setTimeout(() => setHasCopiedId(false), 2000);
        }
    };

    const handleExportData = async () => {
        const jsonString = await exportAllData();
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vesta-data-${localDateString()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        flash('Backup downloaded');
    };

    const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) setConfirming({ restore: file });
    };

    const restoreBackup = async (file: File) => {
        const result = await importAllData(await file.text());
        if (result.success) window.location.reload();
        else flash(`That backup couldn't be restored: ${result.error}`);
    };

    const handleRefresh = async () => {
        if (!onRefreshData) return;
        flash('Refreshing…');
        await onRefreshData();
        flash('Up to date');
    };

    // A target as an editable figure inside its metric tile: the number is the input itself.
    // While focused the line under it shows the valid range, and an invalid value shows why.
    const figure = (
        key: keyof ReturnType<typeof toForm>,
        label: string,
        unit: string,
        opts: { range: string; note?: string; inputMode?: 'decimal' | 'numeric'; placeholder?: string; icon?: LucideIcon }
    ) => {
        const id = `settings-${key}`;
        const error = errors[key];
        const shown = form[key] || opts.placeholder || '';
        return (
            // The whole figure area focuses the input, so a one-digit figure is still easy to tap
            <div className="group min-w-0 cursor-text" onClick={e => { if (!(e.target instanceof HTMLInputElement)) document.getElementById(id)?.focus(); }}>
                <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-semibold">{opts.icon && <opts.icon size={16} strokeWidth={2.25} aria-hidden="true" />}{label}</label>
                <div className="flex items-baseline gap-0.5 mt-1.5">
                    {/* The hidden twin sizes the input to its text */}
                    <span className="relative min-w-0 -ml-1 font-display font-extrabold text-[26px] leading-[30px] tracking-tight">
                        <span aria-hidden="true" className="invisible block whitespace-pre px-1 overflow-hidden">{shown || ' '}</span>
                        <input
                            id={id}
                            type="text"
                            inputMode={opts.inputMode ?? 'numeric'}
                            value={form[key]}
                            onChange={update(key)}
                            placeholder={opts.placeholder}
                            aria-invalid={!!error}
                            aria-describedby={`${id}-note`}
                            className={`absolute inset-0 w-full bg-transparent px-1 rounded-lg placeholder:text-muted hover:bg-surface focus:bg-surface focus:text-main focus:outline-2 focus:outline-offset-2 focus:outline-[var(--focus-ring)] ${error ? 'outline-2 outline-offset-2 outline-[var(--error)]' : ''}`}
                        />
                    </span>
                    <span className="text-xs font-semibold">{unit}</span>
                </div>
                <p id={`${id}-note`} className="text-xs font-medium mt-1 min-h-4">
                    {error
                        ? <span className="inline-flex items-start gap-1"><CircleAlert size={14} className="shrink-0 mt-px" aria-hidden="true" />{error}</span>
                        : <>
                            {opts.note && <span className="group-focus-within:hidden">{opts.note}</span>}
                            <span className={opts.note ? 'hidden group-focus-within:inline' : 'sr-only group-focus-within:not-sr-only'}>{opts.range}</span>
                        </>}
                </p>
            </div>
        );
    };

    const protocolLabel = fastingConfig.protocol === 'custom'
        ? `${fastingConfig.targetFastHours} h fast`
        : fastingConfig.protocol;
    const selectedProtocol = PROTOCOLS.find(pr => pr.id === protocol);

    return (
        <div className="space-y-6 pb-20">
            {/* Account: the page's one bold block, as the family sees you */}
            <section className="hero p-5 md:p-6 flex items-center gap-4" aria-label="Account">
                <MemberAvatar avatar={stats.avatar} uid={user?.uid ?? ''} size={64} className="shrink-0" />
                <div className="flex-1 min-w-0">
                    {/* The name is edited in place, sized to its text like the goal figures */}
                    <div className="flex items-center gap-2 min-w-0 cursor-text" onClick={e => { if (!(e.target instanceof HTMLInputElement)) document.getElementById('settings-name')?.focus(); }}>
                        <label htmlFor="settings-name" className="sr-only">Name</label>
                        <span className="relative min-w-0 -ml-1.5 font-display font-extrabold text-[32px] leading-9 tracking-tight">
                            <span aria-hidden="true" className="invisible block whitespace-pre px-1.5 truncate">{form.name || 'Your name'}</span>
                            <input
                                id="settings-name"
                                type="text"
                                autoComplete="given-name"
                                value={form.name}
                                maxLength={100}
                                disabled={nameSaving || saveState === 'saving'}
                                onChange={update('name')}
                                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                placeholder="Your name"
                                className="absolute inset-0 w-full bg-transparent px-1.5 rounded-xl placeholder:text-[var(--hero-foreground)] focus:bg-surface focus:text-main focus:placeholder:text-muted focus:outline-2 focus:outline-offset-2 focus:outline-[var(--focus-ring)]"
                            />
                        </span>
                        <Pencil size={18} strokeWidth={2.25} className="shrink-0" aria-hidden="true" />
                    </div>
                    {isPlanning && <button className="btn-secondary btn-sm mt-3" disabled={nameSaving || !form.name.trim() || form.name.trim().length > 100} onClick={() => void savePlanningName()}>Save name</button>}
                    {!isPlanning && <ul className="flex flex-wrap gap-1.5 mt-2" aria-label="Your targets">
                        {stats.goalWeight ? <li className="badge badge-ink">{stats.goalWeight} kg goal</li> : null}
                        <li className="badge badge-ink">{(stats.nonFastDayCalories || 2000).toLocaleString()} kcal</li>
                        <li className="badge badge-ink">{protocolLabel}</li>
                    </ul>}
                </div>
            </section>

            {experienceSettings && <section className="card p-5 md:p-6 space-y-5" aria-label="Experience">
                <SectionTitle id="experience-heading" icon={Compass} tile="tile-water" title="How you use Vesta">
                    Switch anytime. Your tracking history is kept.
                </SectionTitle>
                <ExperienceChoice value={experienceSettings.preferences.experience} onChange={value => void changeExperience(value)} disabled={saveState === 'saving'} hideLegend />
                <p className="text-xs text-muted">Plan meals is a preview: the Planner, Recipes and Family, without calories. Tracking reminders pause meanwhile and pick up again when you switch back, without the ones you missed.</p>
                {(experienceSaving > 0 || nameSaving || experienceMessage || experienceError) && (
                    experienceError
                        ? <p role="alert" className="inline-flex items-start gap-1.5 text-sm font-medium text-error"><CircleAlert size={16} className="shrink-0 mt-0.5" aria-hidden="true" />{experienceError}</p>
                        : <p role="status" className="inline-flex items-center gap-1.5 text-sm text-muted">
                            {experienceSaving === 0 && !nameSaving && <Check size={16} strokeWidth={2.5} aria-hidden="true" />}
                            {experienceSaving > 0 || nameSaving ? 'Saving…' : experienceMessage}
                        </p>
                )}
            </section>}

            {/* Goals */}
            {!isPlanning && <fieldset disabled={nameSaving || saveState === 'saving'} className="min-w-0">
            <section className="card" aria-labelledby="goals-heading">
                <div className="p-5 md:p-6 space-y-6">
                    <SectionTitle id="goals-heading" icon={Target} tile="tile-calories" title="Your goals">
                        Tap a number to change it. Today and the planner follow these.
                    </SectionTitle>

                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                        <div className="tile tile-calories col-span-3">
                            <p className="flex items-center gap-1.5 text-xs font-semibold"><Gauge size={16} strokeWidth={2.25} aria-hidden="true" /> Calories a day</p>
                            <div className="grid grid-cols-2 gap-4 mt-1">
                                {figure('dailyCalorieGoal', 'Fast days', 'kcal', { range: '400 to 5000' })}
                                <div className="border-l-[1.5px] border-current/25 pl-4 min-w-0">
                                    {figure('nonFastDayCalories', 'Other days', 'kcal', { range: '800 to 6000' })}
                                </div>
                            </div>
                        </div>
                        <div className="tile tile-weight">
                            {figure('goalWeight', 'Goal', 'kg', { range: '30 to 300', inputMode: 'decimal', icon: Scale })}
                        </div>
                        <div className="tile tile-water">
                            {figure('dailyWaterGoal', 'Water', 'litres', { range: '0.5 to 6', inputMode: 'decimal', icon: Droplet })}
                        </div>
                        <div className="tile tile-neutral">
                            {figure('dailyProteinGoal', 'Protein', 'g', {
                                range: 'Empty for auto',
                                icon: Egg,
                                note: form.dailyProteinGoal ? undefined : 'Auto',
                                placeholder: String(proteinTarget({ ...stats, goalWeight: form.goalWeight && !errors.goalWeight ? num(form.goalWeight) : stats.goalWeight, dailyProteinGoal: undefined })),
                            })}
                        </div>

                        <div className="tile tile-fasting col-span-3 md:col-span-6">
                            <p id="fasting-heading" className="flex items-center gap-1.5 text-xs font-semibold"><Timer size={16} strokeWidth={2.25} aria-hidden="true" /> Fasting window</p>
                            <div role="radiogroup" aria-labelledby="fasting-heading" className="grid grid-cols-5 gap-1.5 mt-3 md:max-w-md">
                                {PROTOCOLS.map(p => {
                                    const active = protocol === p.id;
                                    return (
                                        <button
                                            key={p.id}
                                            role="radio"
                                            aria-checked={active}
                                            aria-label={`${p.id}, ${p.label.toLowerCase()}`}
                                            onClick={() => setProtocol(p.id)}
                                            className={`chip px-0 font-display font-extrabold ${active ? '' : 'bg-surface text-main'}`}
                                        >
                                            {p.id}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-xs font-medium mt-2">
                                {selectedProtocol
                                    ? `${selectedProtocol.label}: ${selectedProtocol.hours} hours fasting, ${24 - selectedProtocol.hours} eating`
                                    : `You're on a custom ${fastingConfig.targetFastHours}-hour fast`}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-3 text-sm">
                                <input
                                    id="settings-fastBreakCalories"
                                    type="text"
                                    inputMode="numeric"
                                    value={form.fastBreakCalories}
                                    onChange={update('fastBreakCalories')}
                                    aria-invalid={!!errors.fastBreakCalories}
                                    aria-describedby="settings-fastBreakCalories-note"
                                    className={`w-16 min-h-10 rounded-full bg-surface text-main text-center font-semibold focus:outline-2 focus:outline-offset-2 focus:outline-[var(--focus-ring)] ${errors.fastBreakCalories ? 'outline-2 outline-offset-2 outline-[var(--error)]' : ''}`}
                                />
                                <label htmlFor="settings-fastBreakCalories">kcal allowed while fasting</label>
                            </div>
                            <p id="settings-fastBreakCalories-note" className="text-xs font-medium mt-1">
                                {errors.fastBreakCalories
                                    ? <span className="inline-flex items-start gap-1"><CircleAlert size={14} className="shrink-0 mt-px" aria-hidden="true" />{errors.fastBreakCalories}</span>
                                    : 'Food or drink up to this, like a coffee, doesn\'t end your fast. 0 means anything does.'}
                            </p>
                        </div>
                    </div>

                    <div className="border-t border-border pt-5 space-y-3">
                        <div>
                            <h3 className="heading-4" id="credit-heading">Workout calories</h3>
                            <p className="text-sm text-muted">How much of a workout's burn to add to the day's calories. Watches tend to overestimate, so half is safer.</p>
                        </div>
                        <div role="radiogroup" aria-labelledby="credit-heading" className="grid grid-cols-3 gap-2">
                            {CREDIT_OPTIONS.map(o => {
                                const active = form.workoutCalorieCredit === String(o.value);
                                return (
                                    <button
                                        key={o.value}
                                        role="radio"
                                        aria-checked={active}
                                        onClick={() => { setForm(f => ({ ...f, workoutCalorieCredit: String(o.value) })); }}
                                        className="chip flex-col gap-0 px-2 py-2.5 min-h-14"
                                    >
                                        <span className="block font-semibold">{o.label}</span>
                                        <span className={`block text-xs font-medium ${active ? '' : 'text-muted'}`}>{o.example}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                </div>

                <div className="flex items-center gap-2 px-5 md:px-6 py-4 border-t border-border text-sm text-muted min-h-14" role="status" aria-live="polite">
                    {saveError ? <><span role="alert">{saveError}</span><button className="btn-ghost btn-sm" onClick={() => void saveRef.current().catch(() => {})}>Retry</button></> : hasErrors
                        ? 'Fix the highlighted fields and they\'ll save'
                        : saveState === 'saved' || (!isDirty && saveState !== 'saving')
                            ? <><Check size={16} aria-hidden="true" /> {saveState === 'saved' ? 'Saved' : 'Changes save as you go'}</>
                            : 'Saving…'}
                </div>
            </section>
            </fieldset>}

            {/* Appearance: applies at once, outside the goals form */}
            <section className="card p-5 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4" aria-labelledby="appearance-heading">
                <SectionTitle id="appearance-heading" icon={SunMoon} tile="tile-neutral" title="Appearance">
                    System follows your device, light or dark.
                </SectionTitle>
                <div role="radiogroup" aria-labelledby="appearance-heading" className="segmented pill-group self-start md:self-auto">
                    {THEME_OPTIONS.map(o => (
                        <button
                            key={o.value}
                            role="radio"
                            aria-checked={themePreference === o.value}
                            onClick={() => onChangeTheme(o.value)}
                            className="segment"
                        >
                            {themePreference === o.value && <SelectionPill group="theme-pill" />}
                            {o.label}
                        </button>
                    ))}
                </div>
            </section>

            {/* Reminders */}
            {!isPlanning && <>
            <section className="card p-5 md:p-6 space-y-4" aria-labelledby="reminders-heading">
                <SectionTitle id="reminders-heading" icon={BellRing} tile="tile-water" title="Reminders">
                    Gentle nudges to log and weigh in, so your personal target has the data it needs.
                </SectionTitle>
                <ReminderSettings />
            </section>

            {/* Eating out */}
            <section className="card p-5 md:p-6 space-y-4" aria-labelledby="eating-out-heading">
                <SectionTitle id="eating-out-heading" icon={Store} tile="tile-workout" title="Eating out">
                    Dishes you've logged, offered again when you plan or log a meal out.
                </SectionTitle>
                <EatingOutHistorySettings />
            </section>
            </>}

            {/* Data */}
            <section className="card p-5 md:p-6 space-y-4" aria-labelledby="data-heading">
                <div className="flex items-start justify-between gap-3">
                    <SectionTitle id="data-heading" icon={Database} tile="tile-neutral" title="Your data">
                        Download a backup, restore one, or pull the latest from the cloud.
                    </SectionTitle>
                    {dataStatus && <span className="badge badge-weight shrink-0" role="status">{dataStatus}</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={handleExportData} className="btn-secondary btn-sm">
                        <Download size={16} aria-hidden="true" /> Download backup
                    </button>
                    <label className="btn-secondary btn-sm cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--focus-ring)]">
                        <Upload size={16} aria-hidden="true" /> Restore backup
                        <input type="file" accept=".json,application/json" onChange={handleImportFile} className="sr-only" />
                    </label>
                    {onRefreshData && (
                        <button onClick={handleRefresh} className="btn-ghost btn-sm">
                            <RefreshCw size={16} aria-hidden="true" /> Refresh from cloud
                        </button>
                    )}
                </div>
                {user?.uid && (
                    <button onClick={handleCopyId} className="text-xs text-muted hover:text-main inline-flex items-center gap-1.5 rounded focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]">
                        {hasCopiedId ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
                        {hasCopiedId ? 'User ID copied' : <>User ID <span className="font-mono">{user.uid.slice(0, 8)}…</span></>}
                    </button>
                )}
            </section>

            {/* Developer tools: only for accounts with the developer claim */}
            {isDevMode && (
                <section className="card p-5 md:p-6 space-y-5" aria-labelledby="dev-heading">
                    <div className="flex items-start justify-between gap-3">
                        <SectionTitle id="dev-heading" icon={Code} tile="tile-neutral" title="Developer">
                            Feature flags and recovery tools for testing.
                        </SectionTitle>
                        <button onClick={resetFlags} className="btn-ghost btn-sm shrink-0">Reset flags</button>
                    </div>

                    <div className="flex items-center justify-between gap-4 rounded-[20px] bg-surface-sunken p-4">
                        <label htmlFor="flag-useGeminiExperimental" className="cursor-pointer">
                            <span className="block font-semibold">Gemini 3.8 Flash</span>
                            <span className="block text-sm text-muted">Off uses Gemini 3.5 Flash-Lite, a lighter model</span>
                        </label>
                        <Switch id="flag-useGeminiExperimental" checked={featureFlags.useGeminiExperimental ?? true} onChange={() => toggleFeatureFlag('useGeminiExperimental')} />
                    </div>

                    <div className="flex items-center justify-between gap-4 rounded-[20px] bg-surface-sunken p-4">
                        <label htmlFor="flag-quickMeals" className="cursor-pointer">
                            <span className="block font-semibold">Quick meals</span>
                            <span className="block text-sm text-muted">Plan meals without a recipe from the planner search</span>
                        </label>
                        <Switch id="flag-quickMeals" checked={featureFlags.quickMeals ?? true} onChange={() => toggleFeatureFlag('quickMeals')} />
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <label className="flex items-center justify-between gap-4 w-full" htmlFor="flag-mealPlanningSetup">
                            <span><span className="block font-semibold">Experience choice during setup</span><span className="block text-sm text-muted">Show the experience choice when previewing onboarding.</span></span>
                            <Switch id="flag-mealPlanningSetup" checked={featureFlags.enableMealPlanningSetup ?? false} onChange={() => toggleFeatureFlag('enableMealPlanningSetup')} />
                        </label>
                        <button onClick={() => setConfirming('sync')} className="btn-secondary btn-sm"><CloudUpload size={16} aria-hidden="true" /> Force sync</button>
                        <button onClick={handleTestOnboarding} className="btn-secondary btn-sm"><PlayCircle size={16} aria-hidden="true" /> Preview welcome</button>
                        <button onClick={() => setShowDebug(!showDebug)} className="btn-ghost btn-sm" aria-expanded={showDebug}>
                            {showDebug ? 'Hide storage info' : 'Show storage info'}
                        </button>
                    </div>

                    {showDebug && (
                        <div className="rounded-[20px] bg-surface-sunken p-4 space-y-1">
                            <h3 className="font-sans text-xs font-semibold text-muted mb-2">Local storage</h3>
                            {Object.entries(debugInfo).map(([key, value]) => (
                                <div key={key} className="flex justify-between gap-3 text-xs">
                                    <span className="font-mono text-muted">{key.replace('fast800_', '')}</span>
                                    <span className={(value as string).includes('Found') ? 'font-semibold' : 'text-muted'}>{value}</span>
                                </div>
                            ))}
                            {Object.keys(debugInfo).length === 0 && <p className="text-xs text-muted">Nothing stored on this device.</p>}
                        </div>
                    )}

                    <p className="text-xs text-muted">Developer access comes from a Firebase custom claim. Ask an admin to grant it.</p>
                </section>
            )}

            {/* Account actions, last: rarely needed */}
            <section className="card p-5 md:p-6 flex items-center justify-between gap-4" aria-labelledby="account-heading">
                <SectionTitle id="account-heading" icon={UserRound} tile="tile-neutral" title="Account">
                    {user?.email && <>Signed in as <span className="break-all">{user.email}</span></>}
                </SectionTitle>
                <button onClick={() => setConfirming('logout')} className="btn-secondary btn-sm shrink-0">
                    <LogOut size={16} aria-hidden="true" /> Log out
                </button>
            </section>

            {confirming === 'logout' && (
                <ConfirmSheet
                    title="Log out?"
                    message="You'll need your email and password to sign in again on this device."
                    confirmLabel="Log out"
                    onConfirm={logout}
                    onClose={() => setConfirming(null)}
                />
            )}
            {confirming === 'sync' && (
                <ConfirmSheet
                    title="Upload this device's data?"
                    message="Data saved on this device from older versions of Vesta is written to the cloud, over any matching records, and the app reloads."
                    confirmLabel="Upload"
                    tone="danger"
                    onConfirm={forceSync}
                    onClose={() => setConfirming(null)}
                />
            )}
            {confirming && typeof confirming === 'object' && (
                <ConfirmSheet
                    title="Restore this backup?"
                    message={<>Everything in Vesta is replaced with <span className="font-semibold text-main">{confirming.restore.name}</span>, and the app reloads. Download a backup first if you might want today's data back.</>}
                    confirmLabel="Restore"
                    tone="danger"
                    onConfirm={() => restoreBackup(confirming.restore)}
                    onClose={() => setConfirming(null)}
                />
            )}
        </div>
    );
};
