# PRP: Dashboard Widget Alignment & Standardization

## 🎯 Objective
**User Story:** As a user, I want the dashboard widgets to look consistent and aligned, so that the interface feels professional, polished, and easy to scan.
**Visual Goal:** Create a strict "Widget Grid" layout where every card shares the exact same internal anatomy: Header, Main Value, Action/Tag Row, and Footer (Progress Bar).
**Constraint Check:**
- Tags must look identical (typography, padding, rounding).
- Buttons must share the same visual weight and positioning.
- Progress bars must be exactly aligned horizontally across cards.

## 🧠 Context & Patterns
*   **Existing Widgets:**
    1.  **Calories** (in `TrackToday.tsx`)
    2.  **Weight** (in `TrackToday.tsx`)
    3.  `HydrationWidget` (Component)
    4.  `FastingWidget` (Component)
*   **Design Tokens:**
    *   **Value:** `text-4xl lg:text-5xl font-bold font-serif`
    *   **Tag/Button:** `h-8` row height (fixed alignment).
    *   **Progress Bar:** `h-2` bar, `mt-auto`.

## 🛡️ Hazards & Gotchas (Strict Enforcement)
*   [ ] **Mobile Layout:** Grid must collapse gracefully (1 col mobile, 2 col tablet, 4 col desktop).
*   [ ] **Action Consistency:** Hydration has buttons in the body. Fasting has buttons in the footer. *Decision: Move Fasting Action to Body to match Hydration.*
*   [ ] **Decor:** Unified to Top-Right `w-32 h-32` for all widgets (Weight was Bottom-Right).
*   [ ] **Z-Index:** Ensure decorations don't block clicks on buttons.

## 📋 Implementation Plan

### Phase 1: Standardization Standards (Mental Model)
*   **Anatomy of a Widget:**
    ```tsx
    <Card className="h-64 flex flex-col relative overflow-hidden">
      <Blob className="absolute -top-10 -right-10 w-32 h-32" />
      <Header>Label + Icon</Header>
      <Body className="flex flex-col h-28">
         <ValueRow>Value + Unit</ValueRow>
         <ActionRow className="mt-auto h-8 flex items-center gap-2">
            {/* Tags OR Buttons go here */}
         </ActionRow>
      </Body>
      <Footer className="mt-auto h-12">
         <ProgressBar />
         <Labels />
      </Footer>
    </Card>
    ```

### Phase 2: Refactor `TrackToday.tsx` (Calories & Weight)
*   **Task:** Update inline widgets.
*   **Changes:**
    *   **Calories:**
        *   Fix Badge styling to match new standard (`px-2.5 py-1 rounded-lg text-xs font-bold uppercase`).
        *   Ensure `ActionRow` height is fixed to align with others.
    *   **Weight:**
        *   Move Decor to Top-Right.
        *   Align Badge to `ActionRow`.
*   **Files:** `components/TrackToday.tsx`

### Phase 3: Refactor `HydrationWidget`
*   **Task:** Align internal layout.
*   **Changes:**
    *   Ensure Buttons (`+250ml`) sit exactly in the `ActionRow` (same vertical offset as Tags).
    *   Match Button styling to "Tag" dimensions but with interactive states.
*   **Files:** `components/HydrationWidget.tsx`

### Phase 4: Refactor `FastingWidget`
*   **Task:** Align internal layout.
*   **Changes:**
    *   **CRITICAL:** Move "Start/End Fast" button from Footer to `ActionRow` to align with Hydration buttons.
    *   Footer should only contain Progress Bar and text labels, matching other widgets.
    *   Update Status Badge to be part of the header or a secondary element, OR keep Status in `ActionRow` and swap Action button there too.
        *   *Refinement:* Fasting often has a status tag AND an action button.
        *   *Plan:* Split `ActionRow`:
            *   Left: Status Tag
            *   Right: Action Button (Tiny)
*   **Files:** `components/FastingWidget.tsx`

## ✅ Verification Strategy
*   **Visual Check:**
    1.  Open Dashboard on Desktop (4-column).
    2.  Place a ruler (or use screenshot tool) to verify:
        *   Tops of all Progress Bars are on the same pixel line.
        *   Baselines of Main Values are aligned.
        *   Tops of Action/Tag rows are aligned.
*   **Interaction:**
    *   Test Hydration Add buttons.
    *   Test Fasting Start/End buttons in new position.
