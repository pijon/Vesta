# Feature: Developer Mode & Feature Flags (Secure Backend)

## Feature Description

Implement a **secure Developer Mode** system using **Firebase Custom Claims** to allow developers to access unreleased features while keeping them completely hidden from regular users. The developer status is verified server-side and cannot be spoofed or bypassed via browser devtools.

**Security Model:**
- Developer status is set via Firebase Admin SDK (server-side only)
- Custom claims are embedded in the ID token and verified on every auth
- Frontend cannot modify developer status - only read it
- Feature flags (preferences within dev mode) can be stored locally

## User Story

As a **developer**
I want to **access features that aren't released yet**
So that **I can test and validate new functionality without exposing it to regular users**

## Problem Statement

Currently, the Fast800-Tracker app has no mechanism to:
1. Securely identify developer users vs regular users
2. Hide experimental or in-development features from production users
3. Allow developers to test new features in a production-like environment
4. Gate features based on backend-verified user claims

A frontend-only solution is insufficient because:
- localStorage can be manipulated via devtools
- React state can be modified via React DevTools
- Any client-side checks can be bypassed

## Solution Statement

Create a **secure Developer Mode** system using Firebase Custom Claims:

1. **Admin Script**: `scripts/setDeveloperClaim.cjs` - Sets `isDeveloper: true` custom claim on specific user UIDs
2. **AuthContext Enhancement**: Extract and expose custom claims from the Firebase ID token
3. **DevModeContext**: Read developer status from claims (immutable), store feature flag preferences in localStorage
4. **SettingsView Widget**: Display developer settings panel only when backend-verified as developer
5. **Feature Gating**: Use `isFeatureEnabled()` hook throughout app for conditional rendering

## Feature Metadata

**Feature Type**: New Capability
**Estimated Complexity**: Medium
**Primary Systems Affected**: scripts/, contexts/AuthContext, contexts/DevModeContext, SettingsView, types.ts
**Dependencies**: firebase-admin (already installed)

---

## CONTEXT REFERENCES

### Relevant Codebase Files

- `scripts/copyRecipes.cjs` (lines 1-167) - Why: Firebase Admin SDK pattern to follow for new script
- `scripts/README.md` (lines 1-76) - Why: Documentation pattern for admin scripts
- `contexts/AuthContext.tsx` (lines 1-46) - Why: Must extend to expose custom claims
- `types.ts` (lines 1-182) - Why: Add DevSettings and FeatureFlags interfaces
- `constants.ts` (lines 1-21) - Why: Add default settings constants
- `components/SettingsView.tsx` (lines 1-302) - Why: Add Developer Settings widget
- `App.tsx` (lines 487-493) - Why: Context provider wrapping pattern

### New Files to Create

- `scripts/setDeveloperClaim.cjs` - Admin script to set/remove developer custom claims
- `contexts/DevModeContext.tsx` - React Context for developer mode and feature flags

### Relevant Documentation

- [Firebase Custom Claims](https://firebase.google.com/docs/auth/admin/custom-claims)
  - Specific section: Setting custom claims via Admin SDK
  - Why: Core mechanism for secure developer identification
- [Firebase ID Token](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
  - Specific section: Accessing claims from token
  - Why: How to read claims on the client

### Patterns to Follow

**Firebase Admin Script Pattern (from copyRecipes.cjs:1-40):**
```javascript
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('Error: serviceAccountKey.json not found!');
  process.exit(1);
}

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
```

**AuthContext Pattern (from AuthContext.tsx:19-44):**
```typescript
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
```

**localStorage Pattern (from App.tsx:67-85):**
```typescript
const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('fast800_darkMode');
    return saved ? JSON.parse(saved) : false;
});

useEffect(() => {
    localStorage.setItem('fast800_darkMode', JSON.stringify(isDarkMode));
}, [isDarkMode]);
```

**Naming Conventions:**
- Admin scripts: CommonJS (`.cjs`), lowercase with camelCase
- Interfaces: PascalCase (e.g., `DevSettings`, `FeatureFlags`)
- Context hooks: `use{Name}` (e.g., `useDevMode`)
- localStorage keys: `fast800_{name}` (e.g., `fast800_devFeatureFlags`)
- Custom claims key: `isDeveloper` (boolean)

---

## IMPLEMENTATION PLAN

### Phase 1: Admin Script (Backend)

Create the Firebase Admin script to set custom claims on developer users.

**Tasks:**
- Create `setDeveloperClaim.cjs` script
- Update `scripts/README.md` with usage documentation

### Phase 2: Types & Constants

Define data structures for feature flags and developer settings.

**Tasks:**
- Add `FeatureFlags` and `DevSettings` interfaces to types.ts
- Add default constants to constants.ts

### Phase 3: Auth Enhancement

Extend AuthContext to read and expose custom claims from the ID token.

**Tasks:**
- Add claims reading after auth state change
- Expose `isDeveloper` boolean in context

### Phase 4: DevMode Context

Create context that combines backend claims with local feature flag preferences.

**Tasks:**
- Read developer status from AuthContext (immutable)
- Store feature flag preferences in localStorage
- Provide hooks for feature checking

### Phase 5: UI Integration

Add Developer Settings panel to SettingsView.

**Tasks:**
- Add Developer Mode widget (only visible to verified developers)
- Add feature flag toggle switches

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

---

### Task 1: CREATE setDeveloperClaim.cjs Admin Script

- **IMPLEMENT**: Create new file at `scripts/setDeveloperClaim.cjs`
```javascript
#!/usr/bin/env node

/**
 * Set or remove developer custom claim on a Firebase user
 *
 * Usage:
 *   node scripts/setDeveloperClaim.cjs <userId> [--remove]
 *
 * Examples:
 *   node scripts/setDeveloperClaim.cjs abc123xyz          # Grant developer access
 *   node scripts/setDeveloperClaim.cjs abc123xyz --remove # Revoke developer access
 *   node scripts/setDeveloperClaim.cjs --list             # List all developers
 *
 * Setup:
 *   Requires scripts/serviceAccountKey.json (see README.md)
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Load service account key
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('Error: serviceAccountKey.json not found!');
  console.error('\nPlease download your service account key:');
  console.error('1. Go to Firebase Console -> Project Settings -> Service Accounts');
  console.error('2. Click "Generate new private key"');
  console.error('3. Save the file as scripts/serviceAccountKey.json');
  process.exit(1);
}

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

/**
 * Set developer claim on a user
 */
async function setDeveloperClaim(userId, isDeveloper) {
  try {
    // Verify user exists
    const user = await admin.auth().getUser(userId);
    console.log(`\nUser found: ${user.email || user.uid}`);

    // Get existing claims
    const existingClaims = user.customClaims || {};
    console.log(`Current claims: ${JSON.stringify(existingClaims)}`);

    // Set new claims (merge with existing)
    const newClaims = {
      ...existingClaims,
      isDeveloper: isDeveloper,
    };

    if (!isDeveloper) {
      delete newClaims.isDeveloper;
    }

    await admin.auth().setCustomUserClaims(userId, newClaims);

    if (isDeveloper) {
      console.log(`\nDeveloper access GRANTED for ${user.email || userId}`);
    } else {
      console.log(`\nDeveloper access REVOKED for ${user.email || userId}`);
    }

    console.log(`New claims: ${JSON.stringify(newClaims)}`);
    console.log('\nNote: User must sign out and sign back in for changes to take effect.');

  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.error(`\nError: User "${userId}" not found`);
      console.error('Check the user ID in Firebase Console -> Authentication -> Users');
    } else {
      console.error('\nError:', error.message);
    }
    process.exit(1);
  }
}

/**
 * List all users with developer claim
 */
async function listDevelopers() {
  console.log('\nScanning for users with developer access...\n');

  const developers = [];
  let nextPageToken;

  do {
    const listResult = await admin.auth().listUsers(1000, nextPageToken);

    listResult.users.forEach(user => {
      if (user.customClaims?.isDeveloper === true) {
        developers.push({
          uid: user.uid,
          email: user.email || '(no email)',
          displayName: user.displayName || '(no name)',
        });
      }
    });

    nextPageToken = listResult.pageToken;
  } while (nextPageToken);

  if (developers.length === 0) {
    console.log('No users with developer access found.');
  } else {
    console.log(`Found ${developers.length} developer(s):\n`);
    developers.forEach((dev, i) => {
      console.log(`${i + 1}. ${dev.email}`);
      console.log(`   UID: ${dev.uid}`);
      console.log(`   Name: ${dev.displayName}\n`);
    });
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--list')) {
    await listDevelopers();
    process.exit(0);
  }

  if (args.length < 1 || args[0].startsWith('--')) {
    console.log('Usage: node scripts/setDeveloperClaim.cjs <userId> [options]');
    console.log('');
    console.log('Options:');
    console.log('  --remove    Revoke developer access');
    console.log('  --list      List all users with developer access');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/setDeveloperClaim.cjs abc123xyz          # Grant access');
    console.log('  node scripts/setDeveloperClaim.cjs abc123xyz --remove # Revoke access');
    console.log('  node scripts/setDeveloperClaim.cjs --list             # List developers');
    process.exit(1);
  }

  const userId = args[0];
  const shouldRemove = args.includes('--remove');

  await setDeveloperClaim(userId, !shouldRemove);
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```
- **PATTERN**: Mirror copyRecipes.cjs structure (lines 1-40 for setup, similar CLI pattern)
- **IMPORTS**: firebase-admin, path, fs (CommonJS)
- **GOTCHA**: User must sign out and back in after claim change for it to take effect
- **VALIDATE**: `node scripts/setDeveloperClaim.cjs --help` - should show usage

---

### Task 2: UPDATE scripts/README.md with Developer Claim Documentation

- **IMPLEMENT**: Add new section after "Copy Recipes Script" section (after line 53):
```markdown

## Set Developer Claim Script

Grant or revoke developer access for users. Developers can see experimental features.

### Usage

```bash
node scripts/setDeveloperClaim.cjs <userId> [options]
```

### Options

- `--remove` - Revoke developer access
- `--list` - List all users with developer access

### Examples

**Grant developer access:**
```bash
node scripts/setDeveloperClaim.cjs abc123xyz
```

**Revoke developer access:**
```bash
node scripts/setDeveloperClaim.cjs abc123xyz --remove
```

**List all developers:**
```bash
node scripts/setDeveloperClaim.cjs --list
```

### Important Notes

- User must **sign out and sign back in** after changes for the new claims to take effect
- Custom claims are embedded in the ID token and verified on every request
- Claims cannot be modified from the client - only via this admin script
```
- **PATTERN**: Follow existing documentation format in README.md
- **IMPORTS**: None
- **GOTCHA**: Emphasize sign-out/sign-in requirement
- **VALIDATE**: Manual review of markdown formatting

---

### Task 3: ADD Feature Flag and DevSettings types to types.ts

- **IMPLEMENT**: Add new interfaces at end of file (after Group interface, line 182)
```typescript

// --- Developer Mode ---
export interface FeatureFlags {
  enableExperimentalRecipes: boolean;
  enableAdvancedAnalytics: boolean;
  enableGroupSharing: boolean;
  enableAIFeatures: boolean;
  showDebugInfo: boolean;
}

export interface DevSettings {
  featureFlags: FeatureFlags;
}
```
- **PATTERN**: Follow interface naming from types.ts (PascalCase, descriptive names)
- **IMPORTS**: None needed
- **GOTCHA**: `isDevMode` is NOT stored here - it comes from Firebase custom claims
- **VALIDATE**: `npx tsc --noEmit` - should compile without errors

---

### Task 4: ADD Default dev settings to constants.ts

- **IMPLEMENT**: Add after DEFAULT_USER_STATS (line 21)
```typescript

export const DEFAULT_FEATURE_FLAGS: import('./types').FeatureFlags = {
  enableExperimentalRecipes: false,
  enableAdvancedAnalytics: false,
  enableGroupSharing: false,
  enableAIFeatures: false,
  showDebugInfo: false,
};

export const DEFAULT_DEV_SETTINGS: import('./types').DevSettings = {
  featureFlags: DEFAULT_FEATURE_FLAGS,
};
```
- **PATTERN**: Mirror DEFAULT_USER_STATS pattern (lines 10-21)
- **IMPORTS**: Uses inline import type to avoid circular dependency
- **GOTCHA**: Use inline `import('./types')` pattern since constants.ts is imported by types consumers
- **VALIDATE**: `npx tsc --noEmit`

---

### Task 5: UPDATE AuthContext.tsx to Expose Custom Claims

- **IMPLEMENT**: Modify AuthContext to read and expose custom claims:

1. Update the interface (line 5-9):
```typescript
interface AuthContextType {
    user: User | null;
    loading: boolean;
    isDeveloper: boolean;
    logout: () => Promise<void>;
}
```

2. Update the default context value (line 11-15):
```typescript
const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    isDeveloper: false,
    logout: async () => { },
});
```

3. Add state and effect to read claims (inside AuthProvider, after line 21):
```typescript
const [isDeveloper, setIsDeveloper] = useState(false);

useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        setUser(user);

        if (user) {
            // Get the ID token result which contains custom claims
            try {
                const tokenResult = await user.getIdTokenResult();
                setIsDeveloper(tokenResult.claims.isDeveloper === true);
            } catch (e) {
                console.warn('Failed to get ID token claims:', e);
                setIsDeveloper(false);
            }
        } else {
            setIsDeveloper(false);
        }

        setLoading(false);
    });

    return unsubscribe;
}, []);
```

4. Update the value object (around line 34-38):
```typescript
const value = {
    user,
    loading,
    isDeveloper,
    logout
};
```
- **PATTERN**: Extend existing auth pattern with claims reading
- **IMPORTS**: No new imports needed (User type already imported)
- **GOTCHA**: Must use `getIdTokenResult()` not just check user object; claims are in the token
- **VALIDATE**: `npx tsc --noEmit`

---

### Task 6: CREATE DevModeContext.tsx

- **IMPLEMENT**: Create new file at `contexts/DevModeContext.tsx`
```typescript
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DevSettings, FeatureFlags } from '../types';
import { DEFAULT_DEV_SETTINGS, DEFAULT_FEATURE_FLAGS } from '../constants';
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
```
- **PATTERN**: Similar to AuthContext structure; uses useAuth hook for claims
- **IMPORTS**: React, types, constants, useAuth
- **GOTCHA**: `isDevMode` is read from `useAuth().isDeveloper` - cannot be modified locally
- **VALIDATE**: `npx tsc --noEmit`

---

### Task 7: UPDATE App.tsx to Wrap with DevModeProvider

- **IMPLEMENT**:
  1. Add import at top (after line 14):
  ```typescript
  import { DevModeProvider } from './contexts/DevModeContext';
  ```
  2. Wrap AuthGuard with DevModeProvider inside AuthProvider (lines 487-493):
  ```typescript
  export const App: React.FC = () => {
      return (
          <AuthProvider>
              <DevModeProvider>
                  <AuthGuard />
              </DevModeProvider>
          </AuthProvider>
      );
  };
  ```
- **PATTERN**: Follow AuthProvider wrapping pattern
- **IMPORTS**: DevModeProvider from contexts/DevModeContext
- **GOTCHA**: DevModeProvider MUST be inside AuthProvider because it uses useAuth hook
- **VALIDATE**: `npm run dev` - app should start without errors

---

### Task 8: UPDATE SettingsView.tsx - Add Developer Settings Widget

- **IMPLEMENT**:
  1. Add import at top (after line 4):
  ```typescript
  import { useDevMode } from '../contexts/DevModeContext';
  ```

  2. Add hook call inside component (after line 26):
  ```typescript
  const { isDevMode, featureFlags, toggleFeatureFlag, resetFlags } = useDevMode();
  ```

  3. Add Developer Settings widget after Data & Backup widget (after line 298, before closing `</div>` of grid):
```typescript
                {/* WIDGET 5: Developer Mode (Only visible to verified developers) */}
                {isDevMode && (
                    <div className="bg-surface rounded-2xl shadow-sm border border-amber-200 dark:border-amber-900/50 overflow-hidden h-full flex flex-col lg:col-span-2">
                        <div className="p-6 border-b border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                                        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                                        <path d="M2 2l7.586 7.586"></path>
                                        <circle cx="11" cy="11" r="2"></circle>
                                    </svg>
                                </div>
                                <h3 className="font-medium text-lg font-serif text-amber-700 dark:text-amber-400">Developer Mode</h3>
                                <span className="ml-2 px-2 py-0.5 text-xs font-bold bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 rounded-full">VERIFIED</span>
                            </div>
                            <button
                                onClick={resetFlags}
                                className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 underline"
                            >
                                Reset Flags
                            </button>
                        </div>

                        <div className="p-6 space-y-6 flex-1">
                            <div className="space-y-1">
                                <p className="text-xs text-muted">Your account has developer access. Feature flags below allow testing unreleased features.</p>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-muted uppercase tracking-wider">Feature Flags</h4>

                                <div className="space-y-3">
                                    {/* Experimental Recipes */}
                                    <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900/70 transition-colors">
                                        <div>
                                            <span className="text-sm font-medium text-main">Experimental Recipes</span>
                                            <p className="text-xs text-muted">Enable AI-powered recipe generation features</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={featureFlags.enableExperimentalRecipes}
                                            onChange={() => toggleFeatureFlag('enableExperimentalRecipes')}
                                            className="w-5 h-5 accent-amber-500"
                                        />
                                    </label>

                                    {/* Advanced Analytics */}
                                    <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900/70 transition-colors">
                                        <div>
                                            <span className="text-sm font-medium text-main">Advanced Analytics</span>
                                            <p className="text-xs text-muted">Enable detailed analytics and insights</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={featureFlags.enableAdvancedAnalytics}
                                            onChange={() => toggleFeatureFlag('enableAdvancedAnalytics')}
                                            className="w-5 h-5 accent-amber-500"
                                        />
                                    </label>

                                    {/* Group Sharing */}
                                    <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900/70 transition-colors">
                                        <div>
                                            <span className="text-sm font-medium text-main">Group Sharing</span>
                                            <p className="text-xs text-muted">Enable family/group recipe sharing</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={featureFlags.enableGroupSharing}
                                            onChange={() => toggleFeatureFlag('enableGroupSharing')}
                                            className="w-5 h-5 accent-amber-500"
                                        />
                                    </label>

                                    {/* AI Features */}
                                    <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900/70 transition-colors">
                                        <div>
                                            <span className="text-sm font-medium text-main">AI Features</span>
                                            <p className="text-xs text-muted">Enable AI-powered suggestions and automation</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={featureFlags.enableAIFeatures}
                                            onChange={() => toggleFeatureFlag('enableAIFeatures')}
                                            className="w-5 h-5 accent-amber-500"
                                        />
                                    </label>

                                    {/* Debug Info */}
                                    <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900/70 transition-colors">
                                        <div>
                                            <span className="text-sm font-medium text-main">Show Debug Info</span>
                                            <p className="text-xs text-muted">Display debug information in UI components</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={featureFlags.showDebugInfo}
                                            onChange={() => toggleFeatureFlag('showDebugInfo')}
                                            className="w-5 h-5 accent-amber-500"
                                        />
                                    </label>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-border">
                                <p className="text-xs text-muted">
                                    Developer access is granted via Firebase custom claims. Contact an admin to request access.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
```
- **PATTERN**: Follow existing widget styling (calories/water/workout borders and backgrounds)
- **IMPORTS**: useDevMode hook
- **GOTCHA**: Uses amber color theme; `lg:col-span-2` makes it full width; shows "VERIFIED" badge
- **VALIDATE**: `npm run dev` - widget should only appear for users with developer claim

---

## TESTING STRATEGY

### Unit Tests

This project does not currently have a test suite. Manual testing is the validation method.

### Integration Tests

Not applicable - manual validation.

### Edge Cases

1. **No developer claim**: User without `isDeveloper` claim sees no Developer Mode widget
2. **Token refresh**: Claims are read on auth state change; user must re-login after claim change
3. **localStorage corruption**: Feature flags use try/catch with fallback to defaults
4. **Schema evolution**: New flags are merged with defaults when loading saved settings
5. **Claim tampering**: Cannot be done - claims are signed by Firebase and verified server-side

---

## VALIDATION COMMANDS

Execute every command to ensure zero regressions and 100% feature correctness.

### Level 1: Syntax & Style

```bash
npx tsc --noEmit
```

### Level 2: Build

```bash
npm run build
```

### Level 3: Development Server

```bash
npm run dev
```

### Level 4: Admin Script Test

```bash
# Show help
node scripts/setDeveloperClaim.cjs --help

# List current developers (should work with empty list)
node scripts/setDeveloperClaim.cjs --list
```

### Level 5: Manual Validation

1. **Grant Developer Access:**
   - Find your user ID in Firebase Console -> Authentication
   - Run: `node scripts/setDeveloperClaim.cjs <your-uid>`
   - Sign out and sign back in to the app
   - Navigate to Settings
   - Verify Developer Mode widget appears with "VERIFIED" badge

2. **Toggle Feature Flags:**
   - Click each checkbox toggle
   - Verify state changes persist after page refresh

3. **Reset Flags:**
   - Enable some flags
   - Click "Reset Flags"
   - Verify all flags return to off

4. **Verify Security (Different User):**
   - Sign in as a different user (without developer claim)
   - Navigate to Settings
   - Verify Developer Mode widget does NOT appear
   - Open browser devtools, check localStorage - modifying `fast800_devFeatureFlags` should have no effect on seeing the widget

5. **Revoke Access:**
   - Run: `node scripts/setDeveloperClaim.cjs <your-uid> --remove`
   - Sign out and sign back in
   - Verify Developer Mode widget no longer appears

---

## ACCEPTANCE CRITERIA

- [ ] Admin script can grant developer access via custom claims
- [ ] Admin script can revoke developer access
- [ ] Admin script can list all developers
- [ ] Developer Mode widget only appears for users with verified `isDeveloper` claim
- [ ] Feature flags can be toggled by developers
- [ ] Feature flag preferences persist in localStorage
- [ ] Non-developers cannot see Developer Mode widget even by manipulating localStorage
- [ ] All validation commands pass with zero errors
- [ ] Code follows project conventions and patterns

---

## COMPLETION CHECKLIST

- [ ] All tasks completed in order
- [ ] Each task validation passed immediately
- [ ] All validation commands executed successfully
- [ ] TypeScript compilation passes without errors
- [ ] Build succeeds without errors
- [ ] Admin script tested with real Firebase user
- [ ] Manual testing confirms security model works
- [ ] Acceptance criteria all met

---

## NOTES

### Security Model

1. **Backend Authority**: Developer status is set ONLY via Firebase Admin SDK. The client cannot modify custom claims.

2. **ID Token Verification**: Custom claims are embedded in the ID token, which is cryptographically signed by Firebase. Any tampering invalidates the token.

3. **Defense in Depth**:
   - Frontend checks `isDeveloper` claim (UI visibility)
   - Feature flags are preferences WITHIN dev mode, not the gate itself
   - Even if localStorage is manipulated, `isDevMode` comes from the verified claim

4. **Claim Propagation**: After setting/removing a claim, the user must sign out and back in. This is a Firebase requirement - claims are cached in the ID token.

### Design Decisions

1. **Custom Claims vs Firestore**: Custom claims are more secure because:
   - They're in the ID token (no extra read)
   - They're signed by Firebase
   - They can be used in Firebase Security Rules
   - They propagate to all Firebase services automatically

2. **Feature Flags in localStorage**: Once developer status is verified via claims, storing flag preferences locally is acceptable because:
   - They only affect what the developer sees
   - They have no security implications (dev mode is already granted)
   - Faster than Firestore reads

3. **Amber Theme**: The Developer Mode widget uses amber/yellow colors to clearly distinguish it from user-facing settings and convey "caution/development" semantics.

### Future Considerations

- **Security Rules**: Add Firestore security rules that check `request.auth.token.isDeveloper`
- **Remote Feature Flags**: Could store flags in Firestore for cross-device sync
- **Role Hierarchy**: Could add more roles (admin, tester, beta) with different capabilities
- **Audit Log**: Could log when developer claim is granted/revoked

<!-- EOF -->
