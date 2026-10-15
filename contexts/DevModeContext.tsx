import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { FeatureFlags } from '../types';
import { DEFAULT_FEATURE_FLAGS } from '../constants';
import { useAuth } from './AuthContext';

const STORAGE_KEY = 'fast800_devFeatureFlags';

interface DevModeContextType {
  isDevMode: boolean; // From Firebase custom claims (read-only)
  featureFlags: FeatureFlags;
  toggleFeatureFlag: (flag: keyof FeatureFlags) => void;
  isFeatureEnabled: (flag: keyof FeatureFlags) => boolean;
  resetFlags: () => void;
}

const DevModeContext = createContext<DevModeContextType>({
  isDevMode: false,
  featureFlags: DEFAULT_FEATURE_FLAGS,
  toggleFeatureFlag: () => {},
  isFeatureEnabled: () => false,
  resetFlags: () => {},
});

export const useDevMode = () => useContext(DevModeContext);

export const DevModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Developer status comes from Firebase custom claims (secure, immutable)
  const { isDeveloper } = useAuth();

  // Feature flag preferences stored locally (only meaningful if isDeveloper)
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with defaults to handle new flags added after initial save
        return { ...DEFAULT_FEATURE_FLAGS, ...parsed };
      }
    } catch (e) {
      console.warn('Failed to parse feature flags from localStorage:', e);
    }
    return DEFAULT_FEATURE_FLAGS;
  });

  // Persist feature flags to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(featureFlags));
  }, [featureFlags]);

  const toggleFeatureFlag = useCallback((flag: keyof FeatureFlags) => {
    setFeatureFlags(prev => ({
      ...prev,
      [flag]: !prev[flag],
    }));
  }, []);

  const resetFlags = useCallback(() => {
    setFeatureFlags(DEFAULT_FEATURE_FLAGS);
  }, []);

  // A feature is enabled only if: user is a developer AND the flag is on
  const isFeatureEnabled = useCallback((flag: keyof FeatureFlags): boolean => {
    return isDeveloper && featureFlags[flag];
  }, [isDeveloper, featureFlags]);

  const value: DevModeContextType = {
    isDevMode: isDeveloper,
    featureFlags,
    toggleFeatureFlag,
    isFeatureEnabled,
    resetFlags,
  };

  return (
    <DevModeContext.Provider value={value}>
      {children}
    </DevModeContext.Provider>
  );
};

/**
 * Usage Example:
 *
 * ```typescript
 * import { useDevMode } from '../contexts/DevModeContext';
 *
 * const MyComponent: React.FC = () => {
 *   const { isDevMode, isFeatureEnabled } = useDevMode();
 *
 *   return (
 *     <div>
 *       <h1>My Component</h1>
 *
 *       {isFeatureEnabled('enableExperimentalRecipes') && (
 *         <ExperimentalRecipeGenerator />
 *       )}
 *
 *       {isDevMode && isFeatureEnabled('showDebugInfo') && (
 *         <pre>{JSON.stringify(debugData, null, 2)}</pre>
 *       )}
 *     </div>
 *   );
 * };
 * ```
 */
