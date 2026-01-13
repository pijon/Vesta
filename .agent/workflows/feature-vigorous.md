---
description: A rigorous feature development workflow that enforces strict adherence to UI/UX rules through mandatory research and validation phases.
---

# Vigorous Feature Development Workflow

This workflow is designed to prevent "lazy" implementations by forcing a strict Research -> Design -> Critique -> Implement cycle. It prioritizes correctness and adherence to `rules.md` over speed.

## Phase 1: Deep Research & Constraint Extraction
**Goal:** deeply understand *what* must be built and *how* it must look before writing a single line of code or plan.

1.  **Read Core Documentation:**
    -   Read `.agent/rules/rules.md` for project governance and tech stack.
    -   Read `.agent/knowledge/ui_colors.md` for strict color usage (HSL, semantic tokens).
    -   Read `.agent/knowledge/ui_spacing.md` for the "Start Large" spacing strategy.
    
2.  **Analyze Context:**
    -   Read related existing components (e.g., if building a widget, read `App.tsx` and other widgets).
    -   Read `types.ts` to understand data structures.

3.  **Produce Constraints Checklist:**
    -   You MUST output a checklist of constraints specific to this request.
    -   *Example:*
        -   [ ] Must use Emerald-500 (#...) for primary actions.
        -   [ ] Must use `backdrop-blur-md` and `bg-slate-900/50`.
        -   [ ] Margins between widgets must be `1.5rem` (mobile) / `2rem` (desktop).

## Phase 2: User Clarification (The "5 Whys")
**Goal:** Eliminate ambiguity.

1.  **Analyze the Request:**
    -   Is the "Visual Goal" specific enough? (e.g., "Make it pop" is bad; "Use glassmorphism with emerald gradients" is good).
    -   Are the data requirements clear?
2.  **Ask Clarifying Questions:**
    -   If ANYTHING is vague, ask the user. Do not guess.
    -   *Stop Condition:* If you have to ask a question, stop here and wait for user input.

## Phase 3: Design & Self-Critique
**Goal:** Validate the approach *before* proposing it to the user.

1.  **Draft Implementation Plan:**
    -   Sketch out the changes in `implementation_plan.md` format (Goals, Changes, Verification).
    -   Do NOT show this to the user yet.

2.  **Perform Self-Critique:**
    -   Compare your draft against the **Constraints Checklist** from Phase 1.
    -   *Critique Questions:*
        -   "Did I use a hardcoded hex color instead of a semantic token?" -> Fix it.
        -   "Did I suggest a 10px margin instead of the standard spacing scale?" -> Fix it.
        -   "Did I forget the mobile responsive classes (`md:`, `lg:`)?" -> Fix it.

3.  **Finalize & Present Plan:**
    -   Once the design passes your critique, write the `implementation_plan.md`.
    -   Use `notify_user` to present the plan for approval.

## Phase 4: Implementation (The "Vigorous" Way)
**Goal:** Code with precision.

1.  **Strict File Editing:**
    -   When editing, use `view_file` effectively to see context.
    -   Apply changes in small, logical chunks.
    -   **Constant Validation:** After every major edit, ask yourself: "Does this violate the 'Rich Aesthetics' rule?"

2.  **Component Creation Rules:**
    -   **Imports:** Clean and ordered.
    -   **Types:** No `any`. Explicit interfaces.
    -   **Styles:** Tailwind classes *must* match the design system tokens.

## Phase 5: Verification & Proof
**Goal:** Prove it works.

1.  **Manual Verification:**
    -   You cannot "run" the UI, but you must conceptually verify.
    -   Double-check: `npm run build` (if applicable/available).
    -   Check for strict adherence to the visual plan.
    
2.  **Documentation:**
    -   Update `walkthrough.md` with what was done.
