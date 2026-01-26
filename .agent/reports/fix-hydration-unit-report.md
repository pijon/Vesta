# Bug Fix Report: Hydration Unit Mismatch

**Source**: User report "My hydration widget says 500.25L!"
**Date**: 2026-01-26
**Status**: FIXED

---

## Issue Description
Usage of inconsistent units caused the hydration widget to display incorrect values.
- **State**: mL (e.g. 500)
- **Buttons (Old)**: Added L (0.25)
- **Result**: Mixed state (500.25).
- **Display**: Expected Liter prop but received raw mixed state.

## Fix Implemented

1.  **Input Normalization**: Updated `BentoGrid.tsx` buttons to send **mL** (250/500) so they align with the state unit.
2.  **Display Normalization**: Updated `TrackToday.tsx` to divide state (mL) by 1000 before passing to widgets (which expect L).
3.  **Visual Polish**: Added `parseFloat(val.toFixed(2))` to `BentoGrid` and `HearthWidget` display to clean up any existing fractional values in user state.

## Files Changed

- `components/BentoGrid.tsx`
- `components/TrackToday.tsx`
- `components/HearthWidget.tsx`

## Verification
- Typescript check: Passed (no new errors).
- Logic check: 
  - Click +250ml -> State +250 -> Display +0.25L. Correct.
  - Existing 500.25 -> Display 0.5L (rounded). Correct.
