# Automatic TRE Tracking Design

**Date**: 2026-01-15  
**Status**: Approved  
**Author**: AI Assistant

## Problem Statement

Users frequently forget to manually toggle fasting/eating states in the TRE (Time Restricted Eating) widget. This leads to inaccurate tracking and frustration. The current implementation requires explicit "Start Fast" and "End Fast" button presses, which doesn't align with natural eating patterns.

## Solution Overview

Replace manual fasting state toggles with **automatic tracking based on food logging**. The system will track "time since last ate" and automatically calculate fasting status based on the user's selected protocol (e.g., 16:8).

### Key Benefits
- ✅ No manual intervention required
- ✅ Accurate tracking tied to actual eating behavior
- ✅ Simpler mental model for users
- ✅ Eliminates forgotten state changes

---

## Design Details

### 1. Data Model Changes

#### Updated `FastingState` Interface

**Before:**
```typescript
export interface FastingState {
  isFasting: boolean;
  startTime: number | null;
  endTime: number | null;
  config: FastingConfig;
}
```

**After:**
```typescript
export interface FastingState {
  lastAteTime: number | null;  // Timestamp of last food log
  config: FastingConfig;
}
```

**Changes:**
- ❌ Remove `isFasting` - calculated dynamically from `lastAteTime`
- ❌ Remove `startTime` - replaced by `lastAteTime`
- ❌ Remove `endTime` - no longer needed
- ✅ Keep `config` - fasting protocol settings (16:8, etc.)

**No changes to `FastingEntry`** - history tracking remains the same.

---

### 2. Automatic Tracking Logic

#### When `lastAteTime` Updates

The system updates `lastAteTime` to `Date.now()` whenever:

1. **User logs food manually** via `FoodEntryModal`
2. **User marks a planned meal as eaten** in the planner
3. **Any calorie entry is added** to the daily log

#### Calculating Fasting Status

```typescript
const timeSinceLastAte = Date.now() - lastAteTime;
const targetMs = config.targetFastHours * 60 * 60 * 1000;
const isFasting = timeSinceLastAte < targetMs;
const hasReachedTarget = timeSinceLastAte >= targetMs;
const progress = Math.min(100, (timeSinceLastAte / targetMs) * 100);
```

---

### 3. Widget UI Design

#### Visual Layout

**Header** (unchanged):
- Title: "TRE Period"
- Protocol selector button (16:8, 14:10, etc.)

**Main Display:**
```
┌─────────────────────────────────┐
│  TRE Period          [16:8 ✎]  │ ← Header
├─────────────────────────────────┤
│                                 │
│      12:34 hrs                  │ ← Large time counter
│      8:15 remaining to 16h      │ ← Dynamic subtitle
│                                 │
│  [FASTING]        [No action]   │ ← Status badge (no buttons!)
│                                 │
│  ████████████░░░░░░░░░░░░░      │ ← Progress bar
│  75% of 16h target              │
│                                 │
└─────────────────────────────────┘
```

#### Dynamic Status Messages

| Condition | Subtitle Text |
|-----------|--------------|
| No food logged yet | "No meals logged today" |
| Fasting < target | "X:XX remaining to reach Yh" |
| Fasting ≥ target | "✓ Target reached X:XX ago" |

#### Status Badge Colors

| State | Badge Text | Color |
|-------|-----------|-------|
| Time < target | "FASTING" | Orange (`var(--warning)`) |
| Time ≥ target | "FASTED" | Green (`var(--calories)`) |
| No data | "NOT TRACKING" | Gray |

#### Progress Bar
- Fills 0% → 100% as time approaches target
- Stays at 100% after target reached
- Shows percentage text below: "X% of Yh target"

---

### 4. Implementation Plan

#### Files to Modify

##### **`types.ts`**
- Update `FastingState` interface
- Remove deprecated fields

##### **`FastingWidget.tsx`**
- Remove props: `onStartFast`, `onEndFast`
- Calculate `isFasting` and `progress` from `lastAteTime`
- Update UI to remove action buttons
- Add dynamic status message logic
- Update progress bar calculation

##### **`App.tsx`**
- Remove functions: `handleStartFast()`, `handleEndFast()`
- Add function: `updateLastAteTime(timestamp: number)`
- Call `updateLastAteTime()` in:
  - `handleAddFood()` - when logging food manually
  - `handleToggleMealComplete()` - when marking planned meals eaten
- Update `FastingWidget` component props

##### **`storageService.ts`**
- Update `getFastingState()` default return value
- Add migration logic for existing users

---

### 5. Migration Strategy

#### Handling Existing Data

```typescript
// In storageService.ts
export const getFastingState = async (): Promise<FastingState> => {
  const d = await getDoc(getDocRef('data', FASTING_DOC));
  
  if (d.exists()) {
    const oldState = d.data() as any;
    
    // Migration: Convert old format to new
    if ('isFasting' in oldState || 'startTime' in oldState) {
      const newState: FastingState = {
        lastAteTime: oldState.endTime || null,
        config: oldState.config || { protocol: '16:8', targetFastHours: 16 }
      };
      
      // Save migrated state
      await saveFastingState(newState);
      return newState;
    }
    
    return oldState as FastingState;
  }
  
  // Default state
  return {
    lastAteTime: null,
    config: { protocol: '16:8', targetFastHours: 16 }
  };
};
```

---

### 6. Fasting History Logic

#### When to Log a `FastingEntry`

**Strategy**: Log a completed fast entry when:
1. User eats (updates `lastAteTime`)
2. Previous `lastAteTime` was ≥ target hours ago

```typescript
const updateLastAteTime = async (timestamp: number) => {
  const currentState = fastingState;
  
  // Check if we completed a fast
  if (currentState.lastAteTime) {
    const fastDuration = timestamp - currentState.lastAteTime;
    const targetMs = currentState.config.targetFastHours * 60 * 60 * 1000;
    
    if (fastDuration >= targetMs) {
      // Log successful fast
      const entry: FastingEntry = {
        id: crypto.randomUUID(),
        startTime: currentState.lastAteTime,
        endTime: timestamp,
        durationHours: fastDuration / (1000 * 60 * 60),
        isSuccess: true
      };
      await addFastingEntry(entry);
    }
  }
  
  // Update to new eating time
  const newState = { ...currentState, lastAteTime: timestamp };
  await saveFastingState(newState);
  setFastingState(newState);
};
```

---

### 7. Edge Cases

| Scenario | Behavior |
|----------|----------|
| First use (no food logged) | Show "0:00 hrs" with "Log your first meal to start tracking" |
| Midnight rollover | Timer continues counting (doesn't reset) |
| Multiple meals in one day | Each food log updates `lastAteTime` to most recent |
| Protocol change mid-fast | Progress recalculates based on new target |
| Page refresh | Timer persists and continues from stored `lastAteTime` |
| Deleted food log | `lastAteTime` remains unchanged (no retroactive updates) |

---

## Testing Plan

### Manual Testing Scenarios

1. **Fresh Start**
   - [ ] Widget shows "No meals logged" state
   - [ ] Timer shows 0:00 hrs

2. **First Meal Logged**
   - [ ] Timer starts counting from 0:00
   - [ ] Status badge shows "FASTING" (orange)
   - [ ] Progress bar at 0%

3. **Second Meal Logged**
   - [ ] `lastAteTime` updates to most recent timestamp
   - [ ] Timer resets to 0:00
   - [ ] Previous fast logged to history (if target was reached)

4. **Reaching Fasting Target**
   - [ ] Status changes to "FASTED" (green)
   - [ ] Subtitle shows "✓ Target reached X:XX ago"
   - [ ] Progress bar at 100%

5. **Protocol Change**
   - [ ] Switch from 16:8 to 12:12
   - [ ] Progress percentage recalculates
   - [ ] Subtitle updates with new target

6. **Page Refresh**
   - [ ] Timer continues from correct time
   - [ ] All state persists correctly

7. **Migration Testing**
   - [ ] Old fasting data converts without errors
   - [ ] Fasting history remains intact

### Visual Verification

- [ ] Progress bar animates smoothly
- [ ] Colors match design system (orange/green)
- [ ] Time format displays correctly (H:MM or HH:MM)
- [ ] Responsive layout on mobile
- [ ] No layout shifts during updates

---

## Success Criteria

✅ **No manual buttons** - fully automatic tracking  
✅ **Timer updates every second** with accurate time since last ate  
✅ **Progress bar** reflects % toward fasting goal  
✅ **Status badge and messages** update dynamically  
✅ **Food logging** triggers `lastAteTime` update automatically  
✅ **Existing data migrates** without loss  
✅ **Fasting history** logs successful fasts automatically  
✅ **Edge cases** handled gracefully  

---

## Future Enhancements (Out of Scope)

- Manual "I just ate" button for non-logged meals
- Notifications when fasting target is reached
- Weekly fasting statistics and streaks
- Integration with daily calorie goals
- Export fasting data to CSV
