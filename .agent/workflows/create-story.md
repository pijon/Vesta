---
description: Interactive workflow to generate a highly detailed, constraint-aware User Story Prompt for vigorous feature development.
---

# Vigorous User Story Prompt Creator

This workflow is the "Pre-Game" phase. Its only goal is to take a vague user idea and refine it into a **Vigorous User Story Prompt** that is ready for the `@feature-vigorous` or `@feature-interactive` workflows.

## Phase 1: Context & Constraint Loading
1.  **Read Core Rules:**
    -   Read `.agent/rules/rules.md` to ensure alignment with "Rich Aesthetics" and "Mobile-First".
    -   Read `.agent/knowledge/ui_colors.md` and `.agent/knowledge/ui_spacing.md` to understand the visual language.

2.  **Analyze Existing State:**
    -   Briefly scan `src/types.ts` and `src/App.tsx` (or relevant files) to understand the current technical context.

## Phase 2: The Interrogation (The "5 Whys")
**Goal:** Extract the "Hidden Requirements" from the user.

1.  **Ask the User for the Feature Idea:**
    -   "What feature or change would you like to build? Please be as descriptive as possible."
    -   *Wait for User Input.*

2.  **Iterative Refinement (Loop):**
    -   Analyze the user's input against the **Project Governance** in `rules.md`.
    -   **Check for Vague Visuals:** Does it say "make it pretty"? -> Ask: "Shall we use the standard glassmorphism/emerald aesthetic? What semantic colors should play a role?"
    -   **Check for Data Ambiguity:** Does it imply new data? -> Ask: "Where does this generic data live? `App.tsx` state? Firestore? Does it need a new Interface in `types.ts`?"
    -   **Check for Mobile/Desktop:** -> Ask: "How should this behave on mobile vs desktop?"
    -   **Stop Condition:** When you have clear answers for **Visuals**, **Data**, **interactions**, and **Success Criteria**.

## Phase 3: Construct the Vigorous Prompt
**Goal:** Generate the Golden Prompt.

1.  **Synthesize Findings:**
    -   Combine user answers with project constraints (e.g., "Use semantic tokens," "No Redux").

2.  **Generate Output Artifact:**
    -   Output the following markdown block for the user to copy/use.

    ```markdown
    # Vigorous Feature Request: [Feature Title]

    ## 📖 User Story
    **As a** [Persona],
    **I want** [Functionality],
    **So that** [Benefit].

    ## 🎨 Visual Specifications (Rich Aesthetics)
    *   **Style:** [e.g., Glassmorphism, Rounded-XL, Soft Shadows]
    *   **Colors:** [Specific Semantic Tokens, e.g., `bg-primary`, `text-slate-900`]
    *   **Animation:** [e.g., Framer Motion entry/exit, hover scales]
    *   **Spacing Strategy:** [e.g., "Start Large" - 1.5rem gaps]

    ## 🛠️ Technical Implementation
    *   **New Components:** [List likely new components]
    *   **Modified Files:** [List files to touch, e.g., `App.tsx`, `types.ts`]
    *   **Data Structure:**
        ```typescript
        // Proposed Interface Change
        interface NewData { ... }
        ```
    *   **State Management:** [e.g., "Add to `userData` in `App.tsx`, persist to localStorage"]

    ## ✅ Acceptance Criteria (The "Definition of Done")
    *   [ ] Implemented using **TailwindCSS v4** with semantic variables.
    *   [ ] Fully responsive (tested at 375px and 1200px +).
    *   [ ] No console errors or TypeScript `any` types.
    *   [ ] [Specific Feature Requirement 1]
    *   [ ] [Specific Feature Requirement 2]
    ```

## Phase 4: Final Verification
1.  **Ask User:** "Does this prompt accurately capture your intent? Is it 'Vigorous' enough?"
2.  **Refine:** If user has edits, update the prompt.
3.  **Completion:** Once approved, tell the user they can now run `@feature-vigorous` (or `@feature-interactive`) using this prompt as the input.
