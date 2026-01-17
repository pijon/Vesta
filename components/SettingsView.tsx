import React, { useState, useEffect } from 'react';
import { UserStats, FastingConfig } from '../types';
import { FamilySettings } from './FamilySettings';
import { exportAllData, importAllData, getLocalStorageDebugInfo, migrateFromLocalStorage } from '../services/storageService';

interface SettingsViewProps {
    stats: UserStats;
    onUpdateStats: (stats: UserStats) => void;
    fastingConfig: FastingConfig;
    onUpdateFastingConfig: (config: FastingConfig) => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
    stats,
    onUpdateStats,
    fastingConfig,
    onUpdateFastingConfig
}) => {
    const [formStats, setFormStats] = useState(stats);
    const [debugInfo, setDebugInfo] = useState<Record<string, string>>({});
    const [showDebug, setShowDebug] = useState(false);
    const [localFastingConfig, setLocalFastingConfig] = useState(fastingConfig);

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

    const handleSaveFasting = async () => {
        await onUpdateFastingConfig(localFastingConfig);
        alert("Fasting settings saved!");
    };

    return (
        <div className="space-y-8 pb-20 animate-fade-in">
            {/* Header */}
            <div className="space-y-2">
                <h1 className="heading-1">
                    Settings
                </h1>
                <p className="text-muted text-lg">Manage your profile, preferences, and data.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* WIDGET 1: My Profile (Merged) */}
                <div className="bg-surface rounded-2xl shadow-sm border border-calories-border overflow-hidden h-full flex flex-col">
                    <div className="p-6 border-b border-calories-border bg-calories-bg/50 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-calories-bg" style={{ color: 'var(--calories)' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        </div>
                        <h3 className="font-medium text-lg font-serif" style={{ color: 'var(--calories)' }}>My Profile</h3>
                    </div>

                    <div className="p-6 space-y-6 flex-1">
                        {/* Section 1: Body Metrics */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-muted uppercase tracking-wider">Body Metrics</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-main mb-2">Starting (kg)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={formStats.startWeight}
                                        onChange={(e) => setFormStats({ ...formStats, startWeight: parseFloat(e.target.value) || 0 })}
                                        className="input w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-main mb-2">Goal (kg)</label>
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
                            <h4 className="text-xs font-bold text-muted uppercase tracking-wider">Diet Targets</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-main mb-2">Fasting (kcal)</label>
                                    <input
                                        type="number"
                                        value={formStats.dailyCalorieGoal}
                                        onChange={(e) => setFormStats({ ...formStats, dailyCalorieGoal: parseInt(e.target.value) || 0 })}
                                        className="input w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-main mb-2">Non-Fast (kcal)</label>
                                    <input
                                        type="number"
                                        value={formStats.nonFastDayCalories || 2000}
                                        onChange={(e) => setFormStats({ ...formStats, nonFastDayCalories: parseInt(e.target.value) || 0 })}
                                        className="input w-full"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-main mb-2">Daily Workout Goal (kcal)</label>
                                <input
                                    type="number"
                                    value={formStats.dailyWorkoutCalorieGoal || 400}
                                    onChange={(e) => setFormStats({ ...formStats, dailyWorkoutCalorieGoal: parseInt(e.target.value) || 0 })}
                                    className="input w-full"
                                />
                            </div>
                        </div>

                        <div className="border-t border-border"></div>

                        {/* Section 3: Protocol */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-muted uppercase tracking-wider">Fasting Protocol</h4>
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
                        </div>
                    </div>
                </div>

                {/* WIDGET 2: Family Settings (Emerald/Water Theme - kept consistent) */}
                <div className="bg-surface rounded-2xl shadow-sm border border-water-border overflow-hidden h-full flex flex-col">
                    <div className="p-6 border-b border-water-border bg-water-bg/50 flex items-center gap-2">
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
                <div className="bg-surface rounded-2xl shadow-sm border border-workout-border overflow-hidden h-full flex flex-col">
                    <div className="p-6 border-b border-workout-border bg-workout-bg/50 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-workout-bg" style={{ color: 'var(--workout)' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        </div>
                        <h3 className="font-medium text-lg font-serif" style={{ color: 'var(--workout)' }}>Data & Backup</h3>
                    </div>

                    <div className="p-6 space-y-4 flex-1">
                        <div className="flex gap-3">
                            <button
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
                                <button className="w-full h-full btn-base bg-error-bg/50 border border-error-border text-error hover:bg-error-bg flex items-center justify-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                    Import Data
                                </button>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-border">
                            <button
                                onClick={() => setShowDebug(!showDebug)}
                                className="text-xs text-muted hover:text-main underline mb-2 block w-full text-left"
                            >
                                {showDebug ? "Hide Advanced Recovery Tools" : "Show Advanced Recovery Tools"}
                            </button>

                            {showDebug && (
                                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-border space-y-3 mt-3 animate-fade-in">
                                    <h4 className="text-sm font-bold text-main">Local Data Recovery</h4>
                                    <div className="space-y-1">
                                        {Object.entries(debugInfo).map(([key, value]) => (
                                            <div key={key} className="flex justify-between text-xs">
                                                <span className="text-slate-500 font-mono">{key.replace('fast800_', '')}</span>
                                                <span className={(value as string).includes('Found') ? "text-emerald-600 font-bold" : "text-slate-400"}>{value}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={handleForceSync}
                                        className="w-full py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 text-sm font-bold rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors mt-2"
                                    >
                                        Force Sync from Device
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
