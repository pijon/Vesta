import React, { useState, useEffect } from 'react';
import { UserStats, FastingConfig, FastingProtocol } from '../types';
import { Check, Copy, CloudUpload, Download, LogOut, PlayCircle, RefreshCw, Sparkles, Upload } from 'lucide-react';
import { FamilySettings } from './FamilySettings';
import { exportAllData, importAllData, getLocalStorageDebugInfo, migrateFromLocalStorage } from '../services/storageService';
import { useDevMode } from '../contexts/DevModeContext';
import { useAuth } from '../contexts/AuthContext';
import { localDateString } from '../utils/dateUtils';

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
}


export const SettingsView: React.FC<SettingsViewProps> = ({
    stats,
    onUpdateStats,
    fastingConfig,
    onUpdateFastingConfig,
    onTestOnboarding,
    onTriggerSundayReset,
    onRefreshData
}) => {

    // Form fields are kept as strings so a field can be cleared while typing
    const toForm = (st: UserStats) => ({
        name: st.name || '',
        goalWeight: st.goalWeight ? String(st.goalWeight) : '',
        dailyCalorieGoal: String(st.dailyCalorieGoal || ''),
        nonFastDayCalories: String(st.nonFastDayCalories || 2000),
        dailyWaterGoal: String((st.dailyWaterGoal || 2500) / 1000),
        dailyWorkoutCountGoal: String(st.dailyWorkoutCountGoal || 1),
    });
    const [form, setForm] = useState(() => toForm(stats));
    const [protocol, setProtocol] = useState<FastingProtocol>(fastingConfig.protocol);
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [dataStatus, setDataStatus] = useState<string | null>(null);
    const [debugInfo, setDebugInfo] = useState<Record<string, string>>({});
    const [showDebug, setShowDebug] = useState(false);
    const { isDevMode, featureFlags, toggleFeatureFlag, resetFlags } = useDevMode();
    const { user, logout } = useAuth();
    const [hasCopiedId, setHasCopiedId] = useState(false);

    // Sync local state when the saved values change elsewhere
    useEffect(() => { setForm(toForm(stats)); }, [stats]);
    useEffect(() => { setProtocol(fastingConfig.protocol); }, [fastingConfig]);
    useEffect(() => { if (showDebug) setDebugInfo(getLocalStorageDebugInfo()); }, [showDebug]);

    const update = (field: keyof ReturnType<typeof toForm>) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm(f => ({ ...f, [field]: e.target.value }));
        setSaveState('idle');
    };

    // Validation: every target must be a sensible positive number
    const num = (v: string) => Number(v.replace(',', '.'));
    const errors: Partial<Record<keyof ReturnType<typeof toForm>, string>> = {};
    if (form.goalWeight && !(num(form.goalWeight) >= 30 && num(form.goalWeight) <= 300)) errors.goalWeight = 'Enter a weight between 30 and 300 kg';
    if (!(num(form.dailyCalorieGoal) >= 400 && num(form.dailyCalorieGoal) <= 5000)) errors.dailyCalorieGoal = 'Enter 400 to 5000 kcal';
    if (!(num(form.nonFastDayCalories) >= 800 && num(form.nonFastDayCalories) <= 6000)) errors.nonFastDayCalories = 'Enter 800 to 6000 kcal';
    if (!(num(form.dailyWaterGoal) >= 0.5 && num(form.dailyWaterGoal) <= 6)) errors.dailyWaterGoal = 'Enter 0.5 to 6 litres';
    if (!(Number.isInteger(num(form.dailyWorkoutCountGoal)) && num(form.dailyWorkoutCountGoal) >= 1 && num(form.dailyWorkoutCountGoal) <= 5)) errors.dailyWorkoutCountGoal = 'Enter 1 to 5';
    const hasErrors = Object.keys(errors).length > 0;
    const isDirty = JSON.stringify(form) !== JSON.stringify(toForm(stats)) || protocol !== fastingConfig.protocol;

    const handleSave = async () => {
        if (hasErrors || !isDirty) return;
        setSaveState('saving');
        onUpdateStats({
            ...stats,
            name: form.name.trim(),
            goalWeight: form.goalWeight ? num(form.goalWeight) : stats.goalWeight,
            dailyCalorieGoal: Math.round(num(form.dailyCalorieGoal)),
            nonFastDayCalories: Math.round(num(form.nonFastDayCalories)),
            dailyWaterGoal: Math.round(num(form.dailyWaterGoal) * 1000),
            dailyWorkoutCountGoal: num(form.dailyWorkoutCountGoal),
        });
        if (protocol !== fastingConfig.protocol) {
            await onUpdateFastingConfig({ ...fastingConfig, protocol, targetFastHours: PROTOCOLS.find(p => p.id === protocol)?.hours ?? fastingConfig.targetFastHours });
        }
        setSaveState('saved');
        setTimeout(() => setSaveState(s => (s === 'saved' ? 'idle' : s)), 2500);
    };

    const flash = (message: string) => {
        setDataStatus(message);
        setTimeout(() => setDataStatus(m => (m === message ? null : m)), 3000);
    };

    const handleForceSync = async () => {
        if (confirm("Upload the data stored on this device to the cloud?")) {
            const result = await migrateFromLocalStorage(true);
            if (result.success) {
                window.location.reload();
            } else {
                alert(`Sync failed: ${result.error}`);
            }
        }
    };

    const handleLogout = async () => {
        if (confirm("Log out of Vesta on this device?")) {
            await logout();
        }
    };

    const handleTestOnboarding = () => {
        if (confirm("Preview the welcome flow? Finishing it updates your name, weight and goal; your history is kept.")) {
            onTestOnboarding();
        }
    };

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
        if (!file) return;
        if (!confirm("Importing replaces all of your current Vesta data with this backup. Continue?")) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            const result = await importAllData(event.target?.result as string);
            if (result.success) {
                window.location.reload();
            } else {
                alert(`That backup couldn't be imported: ${result.error}`);
            }
        };
        reader.readAsText(file);
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
        <div className="space-y-6 pb-20 max-w-3xl">
            {/* Account */}
            <section className="card p-5 md:p-6 flex items-center gap-4">
                <span className="size-14 shrink-0 rounded-full bg-calories-bg text-calories-text flex items-center justify-center font-display font-extrabold text-2xl" aria-hidden="true">
                    {displayName.charAt(0).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                    <p className="heading-3 truncate">{displayName}</p>
                    {user?.email && <p className="text-sm text-muted truncate">{user.email}</p>}
                </div>
                <button onClick={handleLogout} className="btn-secondary btn-sm shrink-0">
                    <LogOut size={16} aria-hidden="true" /> Log out
                </button>
            </section>

            {/* Goals */}
            <section className="card" aria-labelledby="goals-heading">
                <div className="p-5 md:p-6 space-y-6">
                    <div>
                        <h2 id="goals-heading" className="heading-2">Your goals</h2>
                        <p className="text-sm text-muted mt-0.5">These drive the targets on Today and in the planner.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {field('name', 'Name', { inputMode: 'text', placeholder: 'What should we call you?' })}
                        {field('goalWeight', 'Goal weight', { unit: 'kg', inputMode: 'decimal' })}
                    </div>

                    <div className="border-t border-border pt-5 space-y-4">
                        <h3 className="heading-4">Daily targets</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {field('dailyCalorieGoal', 'Fast days', { unit: 'kcal', hint: 'Calories on fast days' })}
                            {field('nonFastDayCalories', 'Other days', { unit: 'kcal', hint: 'Calories on nourish days' })}
                            {field('dailyWaterGoal', 'Water', { unit: 'litres', inputMode: 'decimal' })}
                            {field('dailyWorkoutCountGoal', 'Workouts', { unit: 'per day' })}
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
                                        onClick={() => { setProtocol(p.id); setSaveState('idle'); }}
                                        className={`rounded-[14px] border px-2 py-2.5 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${active
                                            ? 'bg-fasting-bg text-fasting-text border-transparent'
                                            : 'bg-surface border-border hover:bg-surface-sunken'}`}
                                    >
                                        <span className="block font-display font-extrabold text-lg leading-6">{p.id}</span>
                                        <span className={`block text-xs ${active ? '' : 'text-muted'}`}>{p.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        {fastingConfig.protocol === 'custom' && protocol === 'custom' && (
                            <p className="text-xs text-muted">You're on a custom {fastingConfig.targetFastHours}-hour fast.</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 px-5 md:px-6 py-4 border-t border-border">
                    <p className={`text-sm text-muted mr-auto ${saveState === 'saved' ? 'sr-only' : ''}`} role="status" aria-live="polite">
                        {saveState === 'saved' ? 'Saved' : hasErrors ? 'Fix the highlighted fields to save' : isDirty ? 'Unsaved changes' : ''}
                    </p>
                    <button onClick={handleSave} disabled={!isDirty || hasErrors || saveState === 'saving'} className="btn-primary">
                        {saveState === 'saved' ? <Check size={18} aria-hidden="true" /> : null}
                        {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Save changes'}
                    </button>
                </div>
            </section>

            {/* Family */}
            <section className="card p-5 md:p-6 space-y-4" aria-labelledby="family-heading">
                <div>
                    <h2 id="family-heading" className="heading-2">Family</h2>
                    <p className="text-sm text-muted mt-0.5">Share recipes and see each other's plans.</p>
                </div>
                <FamilySettings />
            </section>

            {/* Data */}
            <section className="card p-5 md:p-6 space-y-4" aria-labelledby="data-heading">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 id="data-heading" className="heading-2">Your data</h2>
                        <p className="text-sm text-muted mt-0.5">Download a backup, restore one, or pull the latest from the cloud.</p>
                    </div>
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
                        <div>
                            <h2 id="dev-heading" className="heading-2 flex items-center gap-2">
                                Developer <span className="badge badge-fasting">Verified</span>
                            </h2>
                            <p className="text-sm text-muted mt-0.5">Feature flags and recovery tools for testing.</p>
                        </div>
                        <button onClick={resetFlags} className="btn-ghost btn-sm shrink-0">Reset flags</button>
                    </div>

                    <label className="flex items-center justify-between gap-4 rounded-[14px] bg-surface-sunken p-4 cursor-pointer">
                        <span>
                            <span className="block font-semibold">Gemini 3.8 Flash</span>
                            <span className="block text-sm text-muted">Off uses Gemini 3.5 Flash-Lite, a lighter model</span>
                        </span>
                        <input
                            type="checkbox"
                            role="switch"
                            className="sr-only peer"
                            checked={featureFlags.useGeminiExperimental ?? true}
                            onChange={() => toggleFeatureFlag('useGeminiExperimental')}
                        />
                        <span aria-hidden="true" className="relative shrink-0 w-12 h-7 rounded-full bg-border-control peer-checked:bg-ink transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus-ring)] after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-surface after:transition-transform peer-checked:after:translate-x-5" />
                    </label>

                    <div className="flex flex-wrap gap-2">
                        <button onClick={handleForceSync} className="btn-secondary btn-sm"><CloudUpload size={16} aria-hidden="true" /> Force sync</button>
                        <button onClick={handleTestOnboarding} className="btn-secondary btn-sm"><PlayCircle size={16} aria-hidden="true" /> Preview welcome</button>
                        {onTriggerSundayReset && (
                            <button onClick={onTriggerSundayReset} className="btn-secondary btn-sm"><Sparkles size={16} aria-hidden="true" /> Test Sunday reset</button>
                        )}
                        <button onClick={() => setShowDebug(!showDebug)} className="btn-ghost btn-sm" aria-expanded={showDebug}>
                            {showDebug ? 'Hide storage info' : 'Show storage info'}
                        </button>
                    </div>

                    {showDebug && (
                        <div className="rounded-[14px] bg-surface-sunken p-4 space-y-1">
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
        </div>
    );
};
