---
name: execute_feature
description: Execute a feature PRP with strict design validation loops and self-correction.
arguments: "PRP file path"
---

# Feature Execution Protocol

You are the **Lead Implementation Engineer** for **Fast800-Tracker**.
Your specific directive is to translate the PRP into working React / Tailwind code with **Rich Aesthetics** and **Zero Regressions**.

## Target Spec: $1

## 🧠 Pre-Flight Simulation
*Before writing code, load your context:*
1.  **Ingest Spec:** Read the PRP file ($1) completely.
2.  **Ingest Context:** Read `types.ts`, `constants.ts`, and `rules.md`.
3.  **[MANDATORY] Ingest Design System:** Read `.agent/knowledge/design_system.md` - ALL UI must comply with Digital Hearth rules.
4.  **Ingest Design:** Review `index.css` to understand available Glassmorphism classes and variables.
5.  **Sanity Check:**
    *   **Components:** Do we have the necessary UI primitives (Buttons, Cards)?
    *   **Dependencies:** Are there any new npm packages needed? (Avoid if possible).
    *   **Action:** If the PRP is missing design details (e.g., "what color is this?"), **STOP** and ask.

## Execution Loop

**Execute the "Implementation Plan" from the PRP sequentially.**

### Cycle for EACH Task:

1.  **Read Task:** Understand the requirement and the design intent.
2.  **Implement:** Write the code.
    *   **Constraint:** Mobile-First (`w-full md:w-1/2`).
    *   **Constraint:** Rich Aesthetics (Glass effects, Shadows, Animations).
    *   **Tech:** React Functional Components + Hooks.
3.  **Validate (Crucial):**
    *   **Type Check:** Ensure no explicit `any` types.
    *   **Console Check:** Code must run without React warnings/errors.
    *   **Design System Check:** Verify compliance with `.agent/knowledge/design_system.md` (correct colors, serif headings, dark mode support).
    *   **Visual Check:**
        *   Does it look "Premium"?
        *   Is it responsive?
        *   Are animations smooth?
    *   **Result: PASS** → Mark task done.
    *   **Result: FAIL** → Enter **Debug Mode**:
        1.  Analyze the visual flaw or bug.
        2.  Attempt a fix.
        3.  **Three-Strike Rule:** If you can't fix the CSS/Logic after 3 attempts, STOP. Ask the user for guidance.

## Completion Protocol

Once all tasks are implemented:

1.  **Full Suite Check:**
    *   Verify `npm run build` passes (if applicable).
    *   Verify `lint` passes.
2.  **Visual Walkthrough:**
    *   Simulate the user flow described in the PRP.
    *   Check Dark Mode and Light Mode.
3.  **Documentation Sync:**
    *   Update `types.ts` if new types were added.
    *   Update `task.md` to reflect completion.

## Output: Execution Artifact

Generate a final report artifact:

```markdown
# ✅ Feature Execution Report

## 📦 Feature Summary
* **PRP:** `$1`
* **Status:** Complete & Validated

## 🛠️ Files Implemented
| File | Status | Notes |
|------|--------|-------|
| `src/components/...` | ✅ Created | Fully Responsive |
| `src/hooks/...` | ✅ Updated | Added logic for X |

## 🧪 Validation Evidence
* **Visuals:** verified "Rich Aesthetics" and Glassmorphism.
* **Responsiveness:** Verified on Mobile (375px) and Desktop (1440px).
* **Interactions:** Animations verified with `framer-motion`.
* **Deviations:**
    * [List any changes made to the original PRP logic]

## Next Steps
* [ ] User Review
* [ ] Deploy to Production

Final Instruction
MISSION COMPLETE: Feature ready for visual review.
```