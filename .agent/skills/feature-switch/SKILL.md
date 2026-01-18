---
name: feature-switch
description: Developer Mode and Feature Flags system for gating unreleased features behind secure Firebase custom claims.
---

# Feature Switch (Developer Mode)

## Overview

The Feature Switch system allows developers to access unreleased features while keeping them hidden from regular users. It uses **Firebase Custom Claims** for secure, backend-verified developer authentication.

## Security Model

- **Backend Authority**: Developer status is set via Firebase Admin SDK only
- **Tamper-Proof**: Custom claims are cryptographically signed in the ID token
- **Defense in Depth**: Even if localStorage is modified, `isDevMode` comes from the verified claim

## Quick Start

### 1. Using Feature Flags in Components

```typescript
import { useDevMode } from '../contexts/DevModeContext';

const MyComponent: React.FC = () => {
  const { isDevMode, isFeatureEnabled } = useDevMode();

  return (
    <div>
      {/* Gate feature behind a specific flag */}
      {isFeatureEnabled('enableExperimentalRecipes') && (
        <ExperimentalFeature />
      )}

      {/* Show to any verified developer */}
      {isDevMode && (
        <DeveloperOnlyContent />
      )}
    </div>
  );
};
```

### 2. Available Feature Flags

| Flag | Description |
|------|-------------|
| `enableExperimentalRecipes` | AI-powered recipe generation features |
| `enableAdvancedAnalytics` | Detailed analytics and insights |
| `enableGroupSharing` | Family/group recipe sharing |
| `enableAIFeatures` | AI-powered suggestions and automation |
| `showDebugInfo` | Display debug information in UI |

### 3. Granting Developer Access

```bash
# Grant developer access to a user
node scripts/setDeveloperClaim.cjs <userId>

# Revoke developer access
node scripts/setDeveloperClaim.cjs <userId> --remove

# List all developers
node scripts/setDeveloperClaim.cjs --list
```

**Important**: User must sign out and sign back in after claim changes.

## API Reference

### `useDevMode()` Hook

```typescript
const {
  isDevMode,           // boolean - true if user has isDeveloper claim
  featureFlags,        // FeatureFlags object with all flag states
  toggleFeatureFlag,   // (flag: keyof FeatureFlags) => void
  isFeatureEnabled,    // (flag: keyof FeatureFlags) => boolean
  resetFlags,          // () => void - reset all flags to false
} = useDevMode();
```

### `isFeatureEnabled(flag)`

Returns `true` only if:
1. User is a verified developer (has `isDeveloper` custom claim)
2. The specific flag is toggled ON in Settings

```typescript
// Correct usage
if (isFeatureEnabled('enableAIFeatures')) {
  // This code runs only for developers with the flag enabled
}

// Wrong - don't check featureFlags directly
if (featureFlags.enableAIFeatures) {
  // This ignores developer status!
}
```

## Adding a New Feature Flag

### Step 1: Add to Types

In `types.ts`, add your flag to the `FeatureFlags` interface:

```typescript
export interface FeatureFlags {
  enableExperimentalRecipes: boolean;
  enableAdvancedAnalytics: boolean;
  enableGroupSharing: boolean;
  enableAIFeatures: boolean;
  showDebugInfo: boolean;
  enableMyNewFeature: boolean;  // Add here
}
```

### Step 2: Add Default Value

In `constants.ts`, add the default (always `false`):

```typescript
export const DEFAULT_FEATURE_FLAGS: import('./types').FeatureFlags = {
  enableExperimentalRecipes: false,
  enableAdvancedAnalytics: false,
  enableGroupSharing: false,
  enableAIFeatures: false,
  showDebugInfo: false,
  enableMyNewFeature: false,  // Add here
};
```

### Step 3: Add UI Toggle (Optional)

In `components/SettingsView.tsx`, add a toggle in the Developer Mode widget:

```typescript
<label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900/70 transition-colors">
    <div>
        <span className="text-sm font-medium text-main">My New Feature</span>
        <p className="text-xs text-muted">Description of what this enables</p>
    </div>
    <input
        type="checkbox"
        checked={featureFlags.enableMyNewFeature}
        onChange={() => toggleFeatureFlag('enableMyNewFeature')}
        className="w-5 h-5 accent-amber-500"
    />
</label>
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Firebase Auth                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Custom Claims: { isDeveloper: true }            │   │
│  │  (Set via Admin SDK, embedded in ID token)       │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   AuthContext.tsx                        │
│  - Reads claims via user.getIdTokenResult()             │
│  - Exposes isDeveloper boolean                          │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  DevModeContext.tsx                      │
│  - isDevMode = isDeveloper (from AuthContext)           │
│  - featureFlags stored in localStorage                  │
│  - isFeatureEnabled = isDevMode && flag                 │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    Components                            │
│  {isFeatureEnabled('flag') && <Feature />}              │
└─────────────────────────────────────────────────────────┘
```

## Files Reference

| File | Purpose |
|------|---------|
| `scripts/setDeveloperClaim.cjs` | Admin script to manage developer claims |
| `contexts/AuthContext.tsx` | Reads `isDeveloper` from Firebase ID token |
| `contexts/DevModeContext.tsx` | Provides `useDevMode()` hook |
| `types.ts` | `FeatureFlags` and `DevSettings` interfaces |
| `constants.ts` | `DEFAULT_FEATURE_FLAGS` values |
| `components/SettingsView.tsx` | Developer Mode UI widget |

## Troubleshooting

### Developer Mode widget not appearing

1. Verify the user has the claim: `node scripts/setDeveloperClaim.cjs --list`
2. Ensure user signed out and back in after claim was set
3. Check browser console for token errors

### Feature flag changes not persisting

Feature flags are stored in `localStorage` under key `fast800_devFeatureFlags`. Clear this key to reset.

### Need to test as non-developer

1. Use incognito/private browsing
2. Or revoke your claim: `node scripts/setDeveloperClaim.cjs <your-uid> --remove`
