---
description: A rigorous feature development workflow that enforces strict adherence to UI/UX rules through mandatory research and validation phases.
---

# Feature Development Workflow

This workflow is designed to prevent "lazy" implementations by forcing a strict Research -> Design -> Critique -> Implement cycle. It prioritizes correctness and adherence to `rules.md` over speed.

## Phase 1: Deep Research & Constraint Extraction
**Goal:** deeply understand *what* must be built and *how* it must look before writing a single line of code or plan.

1.  **Read Core Documentation:**
    -   Read `.agent/rules/rules.md` for project governance and tech stack.
    -   **[MANDATORY]** Read `.agent/knowledge/design_system.md` for the complete "Digital Hearth" design language (colors, typography, components, dark mode).
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

## Phase 3: Strategic Planning (The "Mental Sandbox")
**Goal:** Simulate the implementation in your head and architect the solution.

1.  **Mental Simulation:**
    *   **Design & Aesthetics:** "Does this feel premium? Am I using `backdrop-blur-md` and semantic tokens?"
    *   **Architecture:** "Do I need to touch `App.tsx` or just a local component?"
    *   **Constraints:** "No Redux, No hardcoded hex colors, Mobile-first."

2.  **Draft Implementation Artifact (PRP):**
    *   You MUST produce a plan following this structure (do not deviate):
    
    ```markdown
    # PRP: [Feature Name]
    
    ## 🎯 Objective
    **User Story:** As a [User], I want...
    **Visual Goal:** [Describe the premium look & feel]
    
    ## 🛡️ Hazards & Gotchas (Strict Enforcement)
    * [ ] **Design System:** MUST adhere to `.agent/knowledge/design_system.md` (Digital Hearth palette, serif headings, dark mode support).
    * [ ] **Aesthetics:** Must use "Rich Aesthetics" (semantic tokens, subtle shadows).
    * [ ] **Colors:** Use semantic tokens from `ui_colors.md` (NO hex codes).
    * [ ] **Spacing:** Follow "Start Large" strategy from `ui_spacing.md`.
    * [ ] **Responsiveness:** Must test on mobile dimensions with `md:`, `lg:` breakpoints.
    
    ## 📋 Implementation Plan
    ### Phase 1: Data & Types
    * **File:** `src/types.ts`
    * **Details:** ...
    
    ### Phase 2: UI Implementation
    * **File:** `components/MyComponent.tsx`
    * **Design Specs:** (List specific Tailwind classes)
    
    ### Phase 3: Verification
    * **Visual:** Verify at 375px (Mobile) and 1200px (Desktop).
    ```

3.  **Self-Critique & Approval:**
    *   Review your PRP against the **Constraints Checklist** from Phase 1.
    *   **STOP:** Use `notify_user` to present this PRP. Do not proceed to implementation until approved.

## Phase 4: Implementation (The "Vigorous" Way)
**Goal:** Code with precision.

1.  **Strict File Editing:**
    -   When editing, use `view_file` effectively to see context.
    -   Apply changes in small, logical chunks.
    -   **Constant Validation:** During every edit, ask: "Does this violate the 'Rich Aesthetics' rule?"

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