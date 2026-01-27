# Feature: Ember Glow for Calories Card

## Summary

Replace the standard progress bar in `CaloriesRemainingCard` with an "Ember Glow" visualization. As the user consumes calories, a warm, subtle gradient will rise from the bottom of the card, mimicking a fire building up or a vessel filling with warmth. This reinforces the "Digital Hearth" aesthetic.

## User Story

As a User
I want my calorie tracking to feel organic and warm
So that I don't feel like I'm just hitting clinical targets, but "fueling" my fire

## Problem Statement

The current progress bar is functional but "clinical". It creates a hard line and feels like a standard dashboard widget, clashing with the "Hearth / Warmth" vibe of the rest of the application.

## Solution Statement

We will:
1.  Remove the explicit progress bar component from `CaloriesRemainingCard`.
2.  Add a `div` positioned absolutely at the bottom of the card.
3.  Apply a linear gradient background (`from-hearth/30 via-hearth/10 to-transparent`).
4.  Animate the `height` of this div based on the percentage of calories consumed.
5.  Ensure the text remains legible on top (`z-10`).

## Metadata

| Field            | Value                                             |
| ---------------- | ------------------------------------------------- |
| Type             | UI POLISH                                         |
| Complexity       | LOW                                               |
| Systems Affected | `components/BentoGrid.tsx`                        |
| Dependencies     | None                                              |
| Estimated Tasks  | 1                                                 |

---

## UX Design

### Before State
-   White/Glass card.
-   Text stats.
-   Horizontal bar at the bottom (green/red).

### After State
-   White/Glass card.
-   Text stats (unchanged).
-   **No horizontal bar**.
-   **Background**: A warm orange glow rises from the bottom of the card, filling it up like liquid/fire as you eat.

### Interaction Changes
-   Visual only. No functional change.

---

## Mandatory Reading

| Priority | File | Lines | Why Read This |
|----------|------|-------|---------------|
| P1 | `components/BentoGrid.tsx` | 73-121 | Existing implementation to modify |

---

## Patterns to Mirror

**EMBER_GRADIENT:**
```css
/* Approximate Tailwind */
bg-gradient-to-t from-hearth/20 via-hearth/5 to-transparent
```

---

## Files to Change

| File | Action | Justification |
|------|--------|---------------|
| `components/BentoGrid.tsx` | UPDATE | Remove progress bar, add background gradient logic |

---

## Step-by-Step Tasks

### Task 1: UPDATE `components/BentoGrid.tsx`

-   **ACTION**: Implement Ember Glow
-   **IMPLEMENT**:
    -   Calculate `percentConsumed`: `Math.min(100, (1 - (caloriesRemaining / caloriesGoal)) * 100)`. (Handle overage logic if needed, maybe cap at 100 or shimmer).
    -   Remove the `<div className="w-full h-1.5 ...">` progress bar block.
    -   Add strictly positioned background div: `absolute bottom-0 left-0 right-0 z-0 transition-all duration-1000 ease-out`.
    -   Style it:
        -   If Over (`isOver`): `from-red-500/20 via-red-500/5 to-transparent`
        -   Normal: `from-hearth/30 via-hearth/5 to-transparent`
    -   Set `height` style to `${Math.max(0, (consumed / caloriesGoal) * 100)}%`. Note: `consumed = caloriesGoal - caloriesRemaining`.
-   **VALIDATE**: `npm run dev` - visually verify the glow rises.

---

## Testing Strategy

### Validation Checks

| Check | Method | Success Criteria |
|-------|--------|------------------|
| **Visual Gradient** | Manual | Gradient is visible at bottom, fades out upwards |
| **Dynamic Height** | Manual | Gradient height matches consumption (e.g. 50% consumed = half card filled) |
| **Over Limit** | Manual | Gradient turns reddish/warning tone if consumed > goal |
| **Text Contrast** | Manual | Text remains readable over the gradient |

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Text Readability | LOW | LOW | Keep gradient subtle (max opacity 30%) so black text is still clear |
