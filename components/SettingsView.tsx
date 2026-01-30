import React, { useState, useEffect } from 'react';
import { UserStats, FastingConfig } from '../types';
import { FamilySettings } from './FamilySettings';
import { exportAllData, importAllData, getLocalStorageDebugInfo, migrateFromLocalStorage } from '../services/storageService';
import { useDevMode } from '../contexts/DevModeContext';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../services/firebase';

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

    const [formStats, setFormStats] = useState(stats);
    const [debugInfo, setDebugInfo] = useState<Record<string, string>>({});
    const [showDebug, setShowDebug] = useState(false);
    const [localFastingConfig, setLocalFastingConfig] = useState(fastingConfig);
    const { isDevMode, featureFlags, toggleFeatureFlag, resetFlags } = useDevMode();
    const { logout } = useAuth();
    const [hasCopied, setHasCopied] = useState(false);

    // Sync local state with props when they change
    useEffect(() => {
        setFormStats(stats);
    }, [stats]);

    useEffect(() => {
        setLocalFastingConfig(fastingConfig);
    }, [fastingConfig]);

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

    const handleSaveProfile = () => {
        onUpdateStats(formStats);
        // Visual feedback could be added here (toast)
        alert("Profile settings saved!");
    };

    const handleLogout = async () => {
        if (confirm("Are you sure you want to log out?")) {
            await logout();
        }
    };

    const handleSaveFasting = async () => {
        await onUpdateFastingConfig(localFastingConfig);
        alert("Fasting settings saved!");
    };

    const handleTestOnboarding = () => {
        if (confirm("Preview Onboarding Flow?\n\nThis will trigger the Welcome Wizard. Completing it will simply update your profile (Name, Current Weight, Goal) without deleting history.")) {
            onTestOnboarding();
        }
    };

    const handleCopyId = () => {
        if (auth.currentUser?.uid) {
            navigator.clipboard.writeText(auth.currentUser.uid);
            setHasCopied(true);
            setTimeout(() => setHasCopied(false), 2000);
        }
    };

    const handleExportData = async () => {
        const jsonString = await exportAllData();
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vesta-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-8 pb-20 animate-fade-in">
            {/* Header removed - global header used */}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* WIDGET 1: My Profile (Merged) */}
                <div className="bg-[var(--card-bg)] rounded-2xl shadow-sm border border-border/50 overflow-hidden h-full flex flex-col">
                    <div className="p-6 border-b border-border/30 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-calories-bg" style={{ color: 'var(--calories)' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                            </div>
                            <h3 className="font-medium text-lg font-serif" style={{ color: 'var(--calories)' }}>My Profile</h3>
                        </div>

                        {/* User ID Tag */}
                        {auth.currentUser?.uid && (
                            <button
                                onClick={handleCopyId}
                                className="group flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-charcoal/5 dark:bg-white/5 border border-border/50 hover:bg-charcoal/10 dark:hover:bg-white/10 hover:border-calories-border/50 transition-all cursor-pointer"
                                title="Click to copy User ID"
                            >
                                <span className="text-[10px] uppercase font-bold text-charcoal/60 dark:text-stone-400 group-hover:text-charcoal dark:text-stone-200 transition-colors tracking-wider">
                                    {hasCopied ? "COPIED" : "ID"}
                                </span>
                                <span className="text-xs font-mono text-charcoal/60 dark:text-stone-400/80 group-hover:text-charcoal dark:text-stone-200 transition-colors">
                                    {hasCopied ? "✓" : auth.currentUser.uid.substring(0, 6) + "..."}
                                </span>
                            </button>
                        )}
                    </div>

                    <div className="p-6 space-y-6 flex-1">
                        {/* Section 1: Body Metrics */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-charcoal/60 dark:text-stone-400 uppercase tracking-wider">Body Metrics</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-charcoal dark:text-stone-200 mb-2">Your Name</label>
                                    <input
                                        type="text"
                                        value={formStats.name || ''}
                                        onChange={(e) => setFormStats({ ...formStats, name: e.target.value })}
                                        className="input w-full"
                                        placeholder="Enter your name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-charcoal dark:text-stone-200 mb-2">Goal (kg)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={formStats.goalWeight}
                                        onChange={(e) => setFormStats({ ...formStats, goalWeight: parseFloat(e.target.value) || 0 })}
                                        className="input w-full"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-border"></div>

                        {/* Section 2: Diet Targets */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-charcoal/60 dark:text-stone-400 uppercase tracking-wider">Nutrition Goals</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-charcoal dark:text-stone-200 mb-2">Fasting (kcal)</label>
                                    <input
                                        type="number"
                                        value={formStats.dailyCalorieGoal}
                                        onChange={(e) => setFormStats({ ...formStats, dailyCalorieGoal: parseInt(e.target.value) || 0 })}
                                        className="input w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-charcoal dark:text-stone-200 mb-2">Non-Fast (kcal)</label>
                                    <input
                                        type="number"
                                        value={formStats.nonFastDayCalories || 2000}
                                        onChange={(e) => setFormStats({ ...formStats, nonFastDayCalories: parseInt(e.target.value) || 0 })}
                                        className="input w-full"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-charcoal dark:text-stone-200 mb-2">Daily Workout Target (sessions)</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={formStats.dailyWorkoutCountGoal || 1}
                                    onChange={(e) => setFormStats({ ...formStats, dailyWorkoutCountGoal: parseInt(e.target.value) || 1 })}
                                    className="input w-full"
                                />
                            </div>
                        </div>

                        <div className="border-t border-border"></div>

                        {/* Section 3: Protocol */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-charcoal/60 dark:text-stone-400 uppercase tracking-wider">Fasting Protocol</h4>
                            <select
                                value={localFastingConfig.protocol}
                                onChange={(e) => {
                                    const protocol = e.target.value as any;
                                    let hours = 16;
                                    if (protocol === '12:12') hours = 12;
                                    if (protocol === '14:10') hours = 14;
                                    if (protocol === '18:6') hours = 18;
                                    if (protocol === '20:4') hours = 20;
                                    setLocalFastingConfig({ ...localFastingConfig, protocol, targetFastHours: hours });
                                }}
                                className="input w-full"
                            >
                                <option value="12:12">12:12 (Beginner)</option>
                                <option value="14:10">14:10 (Intermediate)</option>
                                <option value="16:8">16:8 (Popular)</option>
                                <option value="18:6">18:6 (Advanced)</option>
                                <option value="20:4">20:4 (Warrior)</option>
                            </select>
                        </div>

                        <div className="pt-2">
                            <button
                                onClick={() => { handleSaveProfile(); handleSaveFasting(); }}
                                className="btn-primary w-full"
                            >
                                Save Profile
                            </button>

                            <button
                                onClick={handleLogout}
                                className="w-full mt-3 py-2 border border-error-border/50 text-error hover:bg-error-bg/10 rounded-lg transition-colors font-medium text-sm flex items-center justify-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                    <polyline points="16 17 21 12 16 7"></polyline>
                                    <line x1="21" y1="12" x2="9" y2="12"></line>
                                </svg>
                                Log Out
                            </button>
                        </div>
                    </div>
                </div>

                {/* WIDGET 2: Family Settings (Emerald/Water Theme - kept consistent) */}
                <div className="bg-[var(--card-bg)] rounded-2xl shadow-sm border border-border/50 overflow-hidden h-full flex flex-col">
                    <div className="p-6 border-b border-border/30 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-water-bg" style={{ color: 'var(--water)' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        </div>
                        <h3 className="font-medium text-lg font-serif" style={{ color: 'var(--water)' }}>Family Group</h3>
                    </div>
                    <div className="p-6 flex-1">
                        <FamilySettings />
                    </div>
                </div>

                {/* WIDGET 4: Data Management (Purple/Workout Theme) */}
                <div className="bg-[var(--card-bg)] rounded-2xl shadow-sm border border-border/50 overflow-hidden h-full flex flex-col">
                    <div className="p-6 border-b border-border/30 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-workout-bg" style={{ color: 'var(--workout)' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        </div>
                        <h3 className="font-medium text-lg font-serif" style={{ color: 'var(--workout)' }}>Data & Backup</h3>
                    </div>

                    <div className="p-6 space-y-4 flex-1">
                        <div className="flex gap-3">
                            <button
                                onClick={handleExportData}
                                className="flex-1 btn-secondary flex items-center justify-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                Export Data
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
                                <button className="w-full h-full btn-base bg-transparent border border-error-border text-error hover:bg-error-bg/10 flex items-center justify-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                    Import Data
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="pt-3 border-t border-border/50">
                        <button
                            onClick={async () => {
                                if (onRefreshData) {
                                    await onRefreshData();
                                    alert("Data refreshed from cloud.");
                                }
                            }}
                            className="w-full py-2 px-3 bg-stone-100 dark:bg-white/5 text-charcoal dark:text-stone-200 border border-border text-sm font-bold rounded-lg hover:bg-stone-200 dark:hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>
                            Refresh Data
                        </button>
                    </div>

                </div>

            </div>


            {/* WIDGET 5: Developer Mode (Only visible to verified developers) */}
            {
                isDevMode && (
                    <div className="bg-[var(--card-bg)] rounded-2xl shadow-sm border border-border/50 overflow-hidden h-full flex flex-col lg:col-span-2">
                        <div className="p-6 border-b border-border/30 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-warning-bg" style={{ color: 'var(--warning)' }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                                        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                                        <path d="M2 2l7.586 7.586"></path>
                                        <circle cx="11" cy="11" r="2"></circle>
                                    </svg>
                                </div>
                                <h3 className="font-medium text-lg font-serif" style={{ color: 'var(--warning)' }}>Developer Mode</h3>
                                <span className="ml-2 badge-amber">VERIFIED</span>
                            </div>
                            <button
                                onClick={resetFlags}
                                className="text-xs hover:text-charcoal dark:text-stone-200 underline"
                                style={{ color: 'var(--warning)' }}
                            >
                                Reset Flags
                            </button>
                        </div>

                        <div className="p-6 space-y-6 flex-1">
                            <div className="space-y-1">
                                <p className="text-xs text-charcoal/60 dark:text-stone-400">Your account has developer access. Feature flags below allow testing unreleased features.</p>
                            </div>

                            <div className="space-y-4">
                                <div className="pt-4">
                                    <p className="text-xs text-charcoal/60 dark:text-stone-400 italic">No active feature flags available.</p>
                                </div>

                                {/* Recovery Tools (New Location) */}
                                <div className="space-y-4 pt-4 border-t border-border">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-bold text-charcoal/60 dark:text-stone-400 uppercase tracking-wider">Recovery Tools</h4>
                                        <button
                                            onClick={() => setShowDebug(!showDebug)}
                                            className="text-xs text-charcoal/60 dark:text-stone-400 hover:text-charcoal dark:text-stone-200 underline"
                                        >
                                            {showDebug ? "Hide Debug Info" : "Show Debug Info"}
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <button
                                            onClick={handleForceSync}
                                            className="w-full py-2 px-3 bg-calories-bg/50 text-[var(--calories)] border border-calories-border/50 text-sm font-bold rounded-lg hover:bg-calories-bg hover:border-calories-border transition-all flex items-center justify-center gap-2"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M16 21h5v-5"></path></svg>
                                            Force Sync
                                        </button>
                                        <button
                                            onClick={handleTestOnboarding}
                                            className="w-full py-2 px-3 bg-water-bg/50 text-[var(--water)] border border-water-border/50 text-sm font-bold rounded-lg hover:bg-water-bg hover:border-water-border transition-all flex items-center justify-center gap-2"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
                                            Preview Intro
                                        </button>
                                    </div>

                                    <button
                                        onClick={onTriggerSundayReset}
                                        className="w-full py-2 px-3 bg-orange-50 text-orange-700 border border-orange-200 text-sm font-bold rounded-lg hover:bg-orange-100 transition-all flex items-center justify-center gap-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20"></path></svg>
                                        Test Sunday Reset
                                    </button>

                                    {showDebug && (
                                        <div className="bg-stone-50 dark:bg-[#1A1714] p-4 rounded-xl border border-border space-y-2 animate-fade-in">
                                            <h4 className="text-xs font-bold text-charcoal dark:text-stone-200 mb-2">Local Storage Debug</h4>
                                            <div className="space-y-1">
                                                {Object.entries(debugInfo).map(([key, value]) => (
                                                    <div key={key} className="flex justify-between text-xs">
                                                        <span className="text-charcoal/60 dark:text-stone-400 font-mono">{key.replace('fast800_', '')}</span>
                                                        <span className={(value as string).includes('Found') ? "text-primary font-bold" : "text-charcoal/60 dark:text-stone-400"}>{value}</span>
                                                    </div>
                                                ))}
                                                {Object.keys(debugInfo).length === 0 && (
                                                    <p className="text-xs text-charcoal/60 dark:text-stone-400 italic">No debug info available (or loading...)</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>


                                <div className="pt-4 border-t border-border">
                                    <p className="text-xs text-charcoal/60 dark:text-stone-400">
                                        Developer access is granted via Firebase custom claims. Contact an admin to request access.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};
