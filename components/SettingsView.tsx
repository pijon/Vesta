import React, { useState, useEffect, useRef } from 'react';
import { ThemePreference } from '../hooks/useTheme';
import { UserStats, FastingConfig, FastingProtocol, WorkoutCalorieCredit } from '../types';
import { proteinTarget } from '../utils/planUtils';
import { BellRing, Check, Code, Copy, CloudUpload, Database, Download, LogOut, PlayCircle, RefreshCw, Sparkles, Store, SunMoon, Target, Upload, UserRound } from 'lucide-react';
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

const PROTOCOLS: { id: Exclude<FastingProtocol, 'custom'>; hours: number; label: string }[] = [
    { id: '12:12', hours: 12, label: 'Gentle' },
    { id: '14:10', hours: 14, label: 'Steady' },
    { id: '16:8', hours: 16, label: 'Popular' },
    { id: '18:6', hours: 18, label: 'Advanced' },
    { id: '20:4', hours: 20, label: 'Intense' },
];

interface SettingsViewProps {
    stats: UserStats;
    onUpdateStats: (stats: UserStats) => void;
    fastingConfig: FastingConfig;
    onUpdateFastingConfig: (config: FastingConfig) => Promise<void>;
    onTestOnboarding: () => void;
    onTriggerSundayReset?: () => void;
    onRefreshData?: () => Promise<void>;
    themePreference: ThemePreference;
    onChangeTheme: (theme: ThemePreference) => void;
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
    onTriggerSundayReset,
    onRefreshData,
    themePreference,
    onChangeTheme,
}) => {

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
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [dataStatus, setDataStatus] = useState<string | null>(null);
    const [debugInfo, setDebugInfo] = useState<Record<string, string>>({});
    const [showDebug, setShowDebug] = useState(false);
    const { isDevMode, featureFlags, toggleFeatureFlag, resetFlags } = useDevMode();
    const { user, logout } = useAuth();
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
    const save = async () => {
        pendingSave.current = false;
        setSaveState('saving');
        onUpdateStats(toStats(form));
        const fasting = toFasting(form, protocol);
        if (fasting.protocol !== fastingConfig.protocol || fasting.fastBreakCalories !== (fastingConfig.fastBreakCalories ?? DEFAULT_FAST_BREAK_CALORIES)) {
            await onUpdateFastingConfig(fasting);
        }
        setSaveState('saved');
        setTimeout(() => setSaveState(s => (s === 'saved' ? 'idle' : s)), 2500);
    };
    const saveRef = useRef(save);
    saveRef.current = save;

    useEffect(() => {
        pendingSave.current = isDirty && !hasErrors;
        if (!pendingSave.current) return;
        const timer = setTimeout(() => saveRef.current(), 800);
        return () => clearTimeout(timer);
    }, [form, protocol]);
    useEffect(() => () => { if (pendingSave.current) saveRef.current(); }, []);

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

    const displayName = form.name.trim() || stats.name || 'You';

    const field = (
        key: keyof ReturnType<typeof toForm>,
        label: string,
        opts: { unit?: string; hint?: string; inputMode?: 'decimal' | 'numeric' | 'text'; placeholder?: string } = {}
    ) => {
        const id = `settings-${key}`;
        const error = errors[key];
        return (
            <div>
                <label htmlFor={id} className="block text-sm font-semibold mb-1.5">{label}</label>
                <div className="relative">
                    <input
                        id={id}
                        type="text"
                        inputMode={opts.inputMode ?? 'numeric'}
                        value={form[key]}
                        onChange={update(key)}
                        placeholder={opts.placeholder}
                        aria-invalid={!!error}
                        aria-describedby={error ? `${id}-error` : opts.hint ? `${id}-hint` : undefined}
                        className={`input w-full ${opts.unit ? 'pr-14' : ''} ${error ? 'input-error' : ''}`}
                    />
                    {opts.unit && (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted pointer-events-none">{opts.unit}</span>
                    )}
                </div>
                {error
                    ? <p id={`${id}-error`} className="text-xs text-error mt-1">{error}</p>
                    : opts.hint && <p id={`${id}-hint`} className="text-xs text-muted mt-1">{opts.hint}</p>}
            </div>
        );
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Account: the page's one bold block, as the family sees you */}
            <section className="hero p-5 md:p-6 flex items-center gap-4" aria-label="Account">
                <MemberAvatar avatar={stats.avatar} uid={user?.uid ?? ''} size={64} className="shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="font-display font-extrabold text-[32px] leading-9 tracking-tight truncate">{displayName}</p>
                    {user?.email && <p className="text-sm font-medium truncate">{user.email}</p>}
                </div>
            </section>

            {/* Goals */}
            <section className="card" aria-labelledby="goals-heading">
                <div className="p-5 md:p-6 space-y-6">
                    <SectionTitle id="goals-heading" icon={Target} tile="tile-calories" title="Your goals">
                        These drive the targets on Today and in the planner.
                    </SectionTitle>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {field('name', 'Name', { inputMode: 'text', placeholder: 'What should we call you?' })}
                        {field('goalWeight', 'Goal weight', { unit: 'kg', inputMode: 'decimal' })}
                    </div>

                    <div className="border-t border-border pt-5 space-y-4">
                        <h3 className="heading-4">Daily targets</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {field('dailyCalorieGoal', 'Fast days', { unit: 'kcal', hint: 'Calories on fast days' })}
                            {field('nonFastDayCalories', 'Other days', { unit: 'kcal', hint: 'Calories on nourish days' })}
                            {field('dailyProteinGoal', 'Protein', { unit: 'g', placeholder: String(proteinTarget({ ...stats, dailyProteinGoal: undefined })), hint: 'Empty uses 1.6 g per kg of goal weight' })}
                            {field('dailyWaterGoal', 'Water', { unit: 'litres', inputMode: 'decimal' })}
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

                    <div className="border-t border-border pt-5 space-y-3">
                        <div>
                            <h3 className="heading-4">Fasting window</h3>
                            <p className="text-sm text-muted">Hours fasting : hours eating</p>
                        </div>
                        <div role="radiogroup" aria-label="Fasting window" className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                            {PROTOCOLS.map(p => {
                                const active = protocol === p.id;
                                return (
                                    <button
                                        key={p.id}
                                        role="radio"
                                        aria-checked={active}
                                        onClick={() => setProtocol(p.id)}
                                        className="chip flex-col gap-0 px-2 py-2.5 min-h-14"
                                    >
                                        <span className="block font-display font-extrabold text-lg leading-6">{p.id}</span>
                                        <span className={`block text-xs font-medium ${active ? '' : 'text-muted'}`}>{p.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        {fastingConfig.protocol === 'custom' && protocol === 'custom' && (
                            <p className="text-xs text-muted">You're on a custom {fastingConfig.targetFastHours}-hour fast.</p>
                        )}
                        <div className="sm:w-1/2 sm:pr-2">
                            {field('fastBreakCalories', 'Allowed while fasting', { unit: 'kcal', hint: 'Food or drink up to this much, like a coffee, is logged without ending your fast. 0 means anything ends it.' })}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 px-5 md:px-6 py-4 border-t border-border text-sm text-muted min-h-14" role="status" aria-live="polite">
                    {hasErrors
                        ? 'Fix the highlighted fields and they\'ll save'
                        : saveState === 'saved' || (!isDirty && saveState !== 'saving')
                            ? <><Check size={16} aria-hidden="true" /> {saveState === 'saved' ? 'Saved' : 'Changes save as you go'}</>
                            : 'Saving…'}
                </div>
            </section>

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
                        <button onClick={() => setConfirming('sync')} className="btn-secondary btn-sm"><CloudUpload size={16} aria-hidden="true" /> Force sync</button>
                        <button onClick={handleTestOnboarding} className="btn-secondary btn-sm"><PlayCircle size={16} aria-hidden="true" /> Preview welcome</button>
                        {onTriggerSundayReset && (
                            <button onClick={onTriggerSundayReset} className="btn-secondary btn-sm"><Sparkles size={16} aria-hidden="true" /> Test Sunday reset</button>
                        )}
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
