import React, { useState } from 'react';
import {
    migrateBase64ImagesToStorage,
    migrateAllLogsToSummaries,
    migrateDayPlansToNormalized,
    cleanupLegacyData,
    archiveYesterdaysLog
} from '../services/storageService';

interface MigrationStep {
    id: string;
    name: string;
    description: string;
    status: 'pending' | 'running' | 'success' | 'error';
    result?: string;
    error?: string;
}

export const MigrationRunner: React.FC = () => {
    const [steps, setSteps] = useState<MigrationStep[]>([
        {
            id: 'images',
            name: 'Migrate Images to Storage',
            description: 'Upload Base64 images to Firebase Storage CDN',
            status: 'pending'
        },
        {
            id: 'logs',
            name: 'Archive Historical Logs',
            description: 'Compress old daily logs to summaries (95% reduction)',
            status: 'pending'
        },
        {
            id: 'plans',
            name: 'Normalize Day Plans',
            description: 'Convert meal plans to reference-based storage (60-80% reduction)',
            status: 'pending'
        },
        {
            id: 'cleanup',
            name: 'Clean Legacy Data',
            description: 'Delete deprecated plan and shared_recipes documents',
            status: 'pending'
        }
    ]);

    const [isRunning, setIsRunning] = useState(false);

    const updateStep = (id: string, updates: Partial<MigrationStep>) => {
        setSteps(prev => prev.map(step =>
            step.id === id ? { ...step, ...updates } : step
        ));
    };

    const runMigrations = async () => {
        setIsRunning(true);

        // Step 1: Migrate images
        updateStep('images', { status: 'running' });
        try {
            const imageResult = await migrateBase64ImagesToStorage();
            if (imageResult.success) {
                updateStep('images', {
                    status: 'success',
                    result: `Migrated ${imageResult.migratedCount} images${imageResult.errors.length > 0 ? ` (${imageResult.errors.length} errors)` : ''}`
                });
            } else {
                updateStep('images', { status: 'error', error: imageResult.errors.join(', ') });
            }
        } catch (e: any) {
            updateStep('images', { status: 'error', error: e.message });
        }

        // Step 2: Archive logs
        updateStep('logs', { status: 'running' });
        try {
            const logResult = await migrateAllLogsToSummaries();
            if (logResult.success) {
                updateStep('logs', {
                    status: 'success',
                    result: `Archived ${logResult.migratedCount} historical logs`
                });
            } else {
                updateStep('logs', { status: 'error', error: logResult.error });
            }
        } catch (e: any) {
            updateStep('logs', { status: 'error', error: e.message });
        }

        // Step 3: Normalize plans
        updateStep('plans', { status: 'running' });
        try {
            const planResult = await migrateDayPlansToNormalized();
            if (planResult.success) {
                updateStep('plans', {
                    status: 'success',
                    result: `Normalized ${planResult.migratedCount} day plans`
                });
            } else {
                updateStep('plans', { status: 'error', error: planResult.error });
            }
        } catch (e: any) {
            updateStep('plans', { status: 'error', error: e.message });
        }

        // Step 4: Cleanup legacy
        updateStep('cleanup', { status: 'running' });
        try {
            const cleanupResult = await cleanupLegacyData();
            if (cleanupResult.success) {
                updateStep('cleanup', {
                    status: 'success',
                    result: `Deleted ${cleanupResult.deletedCount} legacy items`
                });
            } else {
                updateStep('cleanup', { status: 'error', error: cleanupResult.error });
            }
        } catch (e: any) {
            updateStep('cleanup', { status: 'error', error: e.message });
        }

        setIsRunning(false);
    };

    const allComplete = steps.every(s => s.status === 'success');
    const hasErrors = steps.some(s => s.status === 'error');

    return (
        <div className="max-w-2xl mx-auto p-6">
            <div className="bg-stone-50 dark:bg-stone-900 rounded-2xl p-6 border border-stone-200 dark:border-stone-800">
                <h2 className="text-2xl font-bold text-charcoal dark:text-stone-100 mb-2">
                    Database Normalization
                </h2>
                <p className="text-sm text-stone-600 dark:text-stone-400 mb-6">
                    Reduce storage bloat by 60-80% with these one-time migrations
                </p>

                <div className="space-y-3 mb-6">
                    {steps.map((step, index) => (
                        <div
                            key={step.id}
                            className="bg-white dark:bg-stone-800 rounded-xl p-4 border border-stone-200 dark:border-stone-700"
                        >
                            <div className="flex items-start gap-3">
                                {/* Status Icon */}
                                <div className="flex-shrink-0 mt-0.5">
                                    {step.status === 'pending' && (
                                        <div className="w-6 h-6 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center text-xs font-medium text-stone-500">
                                            {index + 1}
                                        </div>
                                    )}
                                    {step.status === 'running' && (
                                        <div className="w-6 h-6 rounded-full bg-hearth-orange/20 flex items-center justify-center">
                                            <div className="w-3 h-3 rounded-full bg-hearth-orange animate-pulse" />
                                        </div>
                                    )}
                                    {step.status === 'success' && (
                                        <div className="w-6 h-6 rounded-full bg-sage-green/20 flex items-center justify-center">
                                            <svg className="w-4 h-4 text-sage-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                    )}
                                    {step.status === 'error' && (
                                        <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                                            <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-charcoal dark:text-stone-100">
                                        {step.name}
                                    </h3>
                                    <p className="text-sm text-stone-600 dark:text-stone-400 mt-0.5">
                                        {step.description}
                                    </p>
                                    {step.result && (
                                        <p className="text-sm text-sage-green dark:text-sage-green/80 mt-2 font-medium">
                                            ✓ {step.result}
                                        </p>
                                    )}
                                    {step.error && (
                                        <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                                            Error: {step.error}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={runMigrations}
                        disabled={isRunning || allComplete}
                        className={`
              flex-1 px-6 py-3 rounded-xl font-semibold text-white
              transition-all duration-200
              ${isRunning || allComplete
                                ? 'bg-stone-300 dark:bg-stone-700 cursor-not-allowed'
                                : 'bg-hearth-orange hover:bg-hearth-orange/90 active:scale-[0.98]'
                            }
            `}
                    >
                        {isRunning ? 'Running Migrations...' : allComplete ? 'Migrations Complete' : 'Run All Migrations'}
                    </button>

                    {allComplete && (
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-3 rounded-xl font-semibold bg-sage-green text-white hover:bg-sage-green/90 transition-all duration-200"
                        >
                            Reload App
                        </button>
                    )}
                </div>

                {allComplete && (
                    <div className="mt-4 p-4 bg-sage-green/10 dark:bg-sage-green/20 rounded-xl border border-sage-green/20">
                        <p className="text-sm text-sage-green dark:text-sage-green/90 font-medium">
                            ✓ All migrations completed successfully! Your database storage has been optimized by 60-80%.
                        </p>
                    </div>
                )}

                {hasErrors && !isRunning && (
                    <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                        <p className="text-sm text-red-600 dark:text-red-400">
                            Some migrations failed. Check the errors above and try again, or contact support.
                        </p>
                    </div>
                )}
            </div>

            <div className="mt-6 p-4 bg-stone-100 dark:bg-stone-800 rounded-xl">
                <h3 className="font-semibold text-charcoal dark:text-stone-100 mb-2">What This Does:</h3>
                <ul className="text-sm text-stone-600 dark:text-stone-400 space-y-1">
                    <li>• Uploads recipe images to Firebase Storage CDN (faster loading)</li>
                    <li>• Compresses historical food logs to summaries (95% smaller)</li>
                    <li>• Normalizes meal plans to use references (60-80% smaller)</li>
                    <li>• Removes deprecated legacy data structures</li>
                </ul>
            </div>
        </div>
    );
};
