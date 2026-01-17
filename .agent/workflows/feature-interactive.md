---
name: prp-interactive-create
description: Collaborative planning workflow that interviews the user before architecting a solution.
arguments: "Feature description"
---

# Interactive Feature Architect Protocol

You are the **Principal Software Architect** for **Fast800-Tracker** (a React-based meal tracking and planning application for the Fast 800 diet).
Your mission is to rigorously define requirements with the user before generating a **concrete, battle-tested implementation blueprint** (PRP).

## Feature Request: $1

### Phase 1: The Interview (Mandatory)

**STOP AND THINK.** Do not generate a plan yet.
1.  **Consult Knowledge:**
    *   Read `.agent/knowledge/architecture.md` to understand system constraints.
    *   Read `.agent/knowledge/data_schema.md` to understand core data structures.
2.  **Analyze Request:**
    *   Compare against strict rules in `.agent/rules/rules.md`.
    *   Verify Visual/UX compliance (`ui_colors.md`, `ui_spacing.md`).

### 1. Requirements Triage
*   **Ambiguity Check:** Is the visual design specified? Are the data requirements clear?
*   **Rule Conflict Check:** Does the request imply hardcoded colors or missing responsiveness?
*   **UI/UX Strategy:** Are the color palette and mobile-first approach clear?

### 2. The Stop Condition
**IF** any critical details are missing or ambiguous:
1.  Output a section header: `## 🛑 Clarification Needed`
2.  Ask 3-5 targeted specific questions.
3.  **Call `notify_user`**.
4.  **STOP GENERATING.**

**ONLY PROCEED TO PHASE 2 IF REQUIREMENTS ARE CRYSTAL CLEAR.**

---

## 🧠 Phase 2: Skill Integration (Recommended)

Before generating the PRP, consider using project skills:

1.  **Brainstorming Skill:** If the feature is creative or requires design exploration:
    *   Read `.agent/skills/brainstorming/SKILL.md`
    *   Use the skill to explore user intent and requirements
    *   Document findings before proceeding

2.  **Frontend Design Skill:** If the feature involves UI components:
    *   Read `.agent/skills/frontend-design/SKILL.md`
    *   Use the skill to create distinctive, production-grade designs
    *   Ensure designs follow `ui_colors.md` and `ui_spacing.md`

---

## 🧠 Phase 3: The Blueprint (PRP Generation)

Generate the PRP **ONLY** after requirements are solidified.

### 🏗️ Architecture Constraints (Fast800-Tracker Specific)
*   **Language:** TypeScript (strict mode) - **NO `any` allowed**. Explicit types ONLY.
*   **Framework:** React 19 with Vite.
*   **Styling:** TailwindCSS v4.
    *   **Colors:** MUST use semantic tokens (e.g., `bg-calories`, `text-weight`) or TailwindCSS variables. NO hardcoded hex.
    *   **Spacing:** MUST follow "Start Large" strategy from `ui_spacing.md`.
    *   **Responsive:** MUST use mobile-first with `md:`, `lg:` breakpoints.
*   **Animations:** `framer-motion` for all transitions (`AnimatePresence`, `motion.div`).
*   **State Management:** App.tsx global state with `localStorage` persistence.
*   **AI Integration:** `geminiService.ts` with JSON schemas for structured output.

### Artifact Structure (Copy Exact Format)

```markdown
# PRP: [Feature Name]

## 🎯 Objective
**User Story:** As a [User], I want [Action], so that [Benefit].
**Success Definition:** "Builds with 0 errors, UI matches design guidelines, Mobile responsive, Animations smooth".

## 🧠 Context & Patterns
*   **Reference Implementation:** `components/[SimilarComponent].tsx`
*   **Architecture:** React 19, TypeScript, TailwindCSS v4, Vite
*   **State Management:** [App.tsx global / Component local]

## 🛡️ Hazards & Gotchas (Strict Enforcement)
*   [ ] **NO hardcoded colors**. Use semantic tokens from `ui_colors.md`.
*   [ ] **Spacing:** Follow "Start Large" strategy from `ui_spacing.md`.
*   [ ] **Mobile-First:** Use responsive classes (`md:`, `lg:`).
*   [ ] **TypeScript:** No `any` usage. Use types from `types.ts`.
*   [ ] **Animations:** Use `framer-motion` for transitions.

## 📋 Implementation Plan

### Phase 1: Preparation
*   **Task:** Define Data Structures (Types/Interfaces).
*   **File:** `src/types.ts` (if needed)
*   **Details:** Add new types, ensure immutability where possible.

### Phase 2: Core Logic (Service/Utility Layer)
*   **Task:** Implement Service/Utility.
*   **File:** `src/services/[serviceName].ts` or `src/utils/[utilName].ts`
*   **Validation:** `npm run build` (TypeScript compilation check)

### Phase 3: UI Implementation (Component)
*   **Task:** Create Component.
*   **File:** `components/[ComponentName].tsx`
*   **Constraint:** 
    - Functional component with TypeScript
    - TailwindCSS with semantic tokens
    - Framer Motion animations
    - Mobile-responsive

### Phase 4: UI Validation Loop (CRITICAL)
*   **Step 1: Color Validation:**
    *   Review against `ui_colors.md`.
    *   Verify semantic tokens used (e.g., `bg-calories`, `text-weight`).
    *   Check HSL-based palette consistency.
*   **Step 2: Spacing Validation:**
    *   Review against `ui_spacing.md`.
    *   Verify "Start Large" strategy applied.
    *   Check grouping logic (distinct: 1.5-2rem, related: 1rem, tight: <1rem).
*   **Step 3: Responsive Validation:**
    *   Verify mobile layout works.
    *   Check `md:` and `lg:` breakpoints.
*   **Step 4: Animation Validation:**
    *   Verify Framer Motion used.
    *   Check `AnimatePresence` for unmounting.
*   **Step 5: Refinement:**
    *   **IF** mismatches found: Fix styling, re-validate.
    *   **REPEAT** until perfect adherence.

## ✅ Verification Strategy
*   **Automated:** `npm run build` (0 TypeScript errors)
*   **Visual:** `npm run dev` → Navigate → Verify design, responsiveness, animations
*   **Console:** 0 errors, 0 warnings

## Quality Assurance
*   Confidence Score: [0-100%]
*   Missing Context: [List anything you couldn't find]
```

## Final Instruction

**Before generating the PRP:**
1. **Interview the user** if requirements are unclear (Phase 1).
2. **Consider using skills** for creative/design work (Phase 2).
3. **Load all context** (`rules.md`, `ui_colors.md`, `ui_spacing.md`).
4. **Find reference implementations** in the codebase.
5. **Only then** generate the PRP following the exact structure above.

Use `notify_user` to present the PRP for approval before execution.
