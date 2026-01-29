# Feature: Smooth Webapp Loading Experience

## Summary

Eliminate jerky/stuttering behavior during webapp initialization by creating a unified, graceful loading flow. This involves consolidating multiple loading states into one smooth transition and preventing re-animation of loading screens during navigation.

## User Story

As a **Vesta user**  
I want the **app to load smoothly and professionally**  
So that **the experience feels polished and premium, not stuttery**

## Problem Statement

Currently, the webapp has multiple sequential loading phases that cause visual jank:

1. **HTML initial loader** (index.html) shows "Warming the Hearth..."
2. **React hydrates** and abruptly replaces HTML loader with `LoadingScreen` (causes flash)
3. **AuthGuard** shows another `LoadingScreen` during Firebase auth check
4. **TrackerApp** shows `LoadingScreen` AGAIN during `isInitializing` phase
5. **Lazy-loaded views** trigger `React.Suspense` fallback, re-showing `LoadingScreen`

This creates visible stuttering: loader → flash → loader → flash → content.

## Solution Statement

1. **Smooth HTML → React handoff**: Fade out the HTML loader gracefully before React content appears
2. **Unified loading state**: Combine auth + init loading into a single coordinated phase
3. **Lighter Suspense fallback**: Use a minimal skeleton or fade transition for lazy views instead of full LoadingScreen
4. **Prefetch critical data**: Start fetching data during auth check to reduce perceived wait time

## Metadata

| Field            | Value                         |
| ---------------- | ----------------------------- |
| Type             | ENHANCEMENT                   |
| Complexity       | MEDIUM                        |
| Systems Affected | App.tsx, index.html, LoadingScreen, AuthContext |
| Dependencies     | None                          |
| Estimated Tasks  | 4                             |

---

## UX Design

### Before State
```
╔═════════════════════════════════════════════════════════════════╗
║  LOADING SEQUENCE (Current - Jerky)                             ║
╠═════════════════════════════════════════════════════════════════╣
║                                                                 ║
║   [HTML Loader]  ──FLASH──▶  [React LoadingScreen]              ║
║        ↓                            ↓                           ║
║   [Auth Loading]  ──FLASH──▶  [Init Loading]                    ║
║        ↓                            ↓                           ║
║   [Yet Another LoadingScreen]  ──FLASH──▶  [Content]            ║
║                                                                 ║
║   PAIN_POINT: 3-4 visible state transitions, each causing       ║
║               a jarring flash or re-animation                   ║
║                                                                 ║
╚═════════════════════════════════════════════════════════════════╝
```

### After State
```
╔═════════════════════════════════════════════════════════════════╗
║  LOADING SEQUENCE (Improved - Smooth)                           ║
╠═════════════════════════════════════════════════════════════════╣
║                                                                 ║
║   [HTML Loader]                                                 ║
║        │                                                        ║
║        ▼ (React mounts but doesn't replace loader immediately)  ║
║   [Single LoadingScreen - smooth fade-in from HTML loader]      ║
║        │                                                        ║
║        │ (Auth + Data init happen in parallel, hidden)          ║
║        │                                                        ║
║        ▼ (Smooth fade-out + content fade-in)                    ║
║   [Content] ◄── professional, single transition                 ║
║                                                                 ║
║   VALUE_ADD: One smooth loading experience, premium feel        ║
║                                                                 ║
╚═════════════════════════════════════════════════════════════════╝
```

---

## Mandatory Reading

| Priority | File | Lines | Why Read This |
|----------|------|-------|---------------|
| P0 | `.agent/knowledge/design_system.md` | all | Ensure loading UI follows design system |
| P0 | `App.tsx` | 475-480, 623-635 | Current LoadingScreen usage pattern |
| P0 | `index.html` | 76-158 | HTML initial loader implementation |
| P0 | `components/LoadingScreen.tsx` | all | Current animated loader |
| P1 | `contexts/AuthContext.tsx` | 21-62 | Auth loading state management |

---

## Patterns to Mirror

**EXISTING FRAMER MOTION TRANSITIONS:**
```tsx
// SOURCE: App.tsx:500-505
// Use similar exit/enter for loading → content transition
<motion.div
    key="today"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.2 }}
>
```

---

## Files to Change

| File                              | Action | Justification                                      |
| --------------------------------- | ------ | -------------------------------------------------- |
| `index.html`                      | UPDATE | Add fade-out animation class and JS to remove loader |
| `App.tsx`                         | UPDATE | Consolidate loading states, coordinate handoff     |
| `components/LoadingScreen.tsx`    | UPDATE | Add fadeFromHtml prop for smooth transition        |
| `components/ViewSkeleton.tsx`     | CREATE | Lightweight skeleton for Suspense fallback         |

---

## NOT Building (Scope Limits)

- **NOT** implementing preloading/prefetching strategies - could be Phase 2
- **NOT** restructuring AuthContext - minimal changes only
- **NOT** progressive hydration - out of scope for this change

---

## Step-by-Step Tasks

### Task 1: Smooth HTML → React Handoff

- **ACTION**: UPDATE `index.html` and `App.tsx`
- **IMPLEMENT**:
  1. Add a CSS class `.fade-out` with opacity animation to initial loader in `index.html`
  2. In `App.tsx`, after React mounts and before showing content, add class to fade out HTML loader
  3. Use `document.querySelector('.initial-loader')?.classList.add('fade-out')` pattern
  4. After 300ms fade, remove the HTML loader element entirely
- **VALIDATE**: `npm run dev` → Observe smooth fade between loaders

### Task 2: Consolidate Auth + Init Loading

- **ACTION**: UPDATE `App.tsx`
- **IMPLEMENT**:
  1. Combine `AuthGuard.loading` and `TrackerApp.isInitializing` into a single user-facing loading state
  2. In `AuthGuard`, start data prefetching during auth check (don't wait)
  3. Only show `LoadingScreen` once for the combined wait
  4. Ensure `LoadingScreen` has `key="app-loader"` for AnimatePresence
- **KEY CHANGE**: Modify `AuthGuard` to pass auth state AND trigger early data load
- **VALIDATE**: `npm run dev` → Only one loading screen visible during startup

### Task 3: Create Lightweight Suspense Skeleton

- **ACTION**: CREATE `components/ViewSkeleton.tsx`
- **IMPLEMENT**:
  1. Simple skeleton with fade-in animation (NOT full LoadingScreen)
  2. Match view structure: header placeholder + content area placeholder
  3. Use design system colors (`bg-charcoal/5`, `dark:bg-white/5`)
- **VALIDATE**: Switch between lazy views → See skeleton instead of full loader

### Task 4: Use ViewSkeleton for Suspense Fallback

- **ACTION**: UPDATE `App.tsx`
- **IMPLEMENT**:
  1. Replace `<LoadingScreen />` in `React.Suspense fallback` with `<ViewSkeleton />`
  2. This prevents re-showing full animated loader on view switches
- **VALIDATE**: Navigate between views → Smooth transition without full loader re-animation

---

## Testing Strategy

### Validation Checks

| Check                    | Method              | Success Criteria |
| ------------------------ | ------------------- | ---------------- |
| Type check               | `npx tsc --noEmit`  | No errors |
| Build                    | `npm run build`     | Builds successfully |
| Smooth HTML handoff      | Browser (Manual)    | No flash between HTML loader and React |
| Single loading screen    | Browser (Manual)    | Only one loader visible during cold start |
| Lazy view transition     | Browser (Manual)    | No full loader re-animation when switching views |
| Dark mode loading        | Browser (Manual)    | Loading states look correct in dark mode |

### Manual Verification Steps

1. **Cold start test**:
   - Hard refresh the browser (Ctrl+Shift+R)
   - Observe loading: should be ONE smooth loading experience
   - No flashes or stutter between different loading phases

2. **View navigation test**:
   - Click between Today → Analytics → Planner
   - Should NOT see full LoadingScreen re-appear
   - Light skeleton or instant transition is acceptable

3. **Dark mode test**:
   - Toggle dark mode before loading
   - Refresh - loading should respect dark mode colors

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
npx tsc --noEmit
```

**EXPECT**: Exit 0, no errors

### Level 2: BUILD_CHECK

```bash
npm run build
```

**EXPECT**: Build completes successfully

### Level 3: BROWSER_VALIDATION

Manual steps (see Testing Strategy above)

---

## Acceptance Criteria

- [ ] Single, smooth loading experience on cold start (no multiple flashes)
- [ ] HTML loader fades out gracefully before React content appears
- [ ] Switching between lazy-loaded views does NOT show full LoadingScreen
- [ ] Loading experience works correctly in both light and dark mode
- [ ] Type check and build pass

---

## Risks and Mitigations

| Risk               | Likelihood | Impact | Mitigation                              |
| ------------------ | ---------- | ------ | --------------------------------------- |
| Timing issues between HTML/React | MEDIUM | MEDIUM | Use requestAnimationFrame for precise timing |
| Auth state race condition | LOW | HIGH | Keep existing loading guards, just consolidate visuals |
| Skeleton doesn't match view structure | LOW | LOW | Use generous placeholder sizing |

---

## Notes

- The key insight is that users see multiple loading screens animating in sequence - each one resets the "Warming the Hearth" animation, which feels amateur
- The fix is primarily visual coordination - the underlying auth/init logic stays the same
- Future enhancement could add preloading of likely-needed data during loading phase
