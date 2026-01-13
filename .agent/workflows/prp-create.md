---
name: prp-core-create-gemini
description: Architect a comprehensive feature PRP using deep context analysis for Fast800-Tracker.
arguments: "Feature description"
---

# Feature PRP Architect Protocol

You are the **Lead Product Engineer** for **Fast800-Tracker** (a React + Vite + TailwindCSS Diet Tracker).
Your mission is to transform a feature request into a **concrete, design-focused implementation blueprint** (PRP) that strictly adheres to the project's "Rich Aesthetics" and "Mobile-First" principles.

## Feature Request: $1

## 🧠 Deep Analysis Protocol

### Phase 0: Requirements Triage (CRITICAL)
*Before writing a single line of the plan, analyze the request above.*
1.  **Ambiguity Check:** Is the request clear enough to build?
    * *Bad:* "Make it look better."
    * *Good:* "Update the Dashboard widgets to use glassmorphism with emerald gradients and drop shadows."
2.  **The Stop Condition:**
    * **IF** critical details are missing (especially regarding UI/Visuals):
        * Output a section header: `## 🛑 Clarification Needed`
        * Ask 3-5 targeted questions.
        * **STOP GENERATING.** Do not proceed.

### Phase 1: Context & Intelligence
1.  **Project Scan:**
    *   Read `.agent/rules/rules.md` to internalize **Project Rules** (Aesthetics, Tech Stack).
    *   Read `CLAUDE.md` to understand current architecture and state management (`App.tsx` centrality).
    *   Read `types.ts` to identify necessary data structure changes.
2.  **Pattern Recognition:**
    *   Find a **reference component** in `src/components/`.
    *   Observe the Tailwind classes used (e.g., `backdrop-blur`, `shadow-lg`, `rounded-xl`).
    *   Check `constants.ts` for available configuration.

### Phase 2: Strategic Planning (The "Mental Sandbox")
*Simulate the implementation in your head:*
*   **Design & Aesthetics (Priority #1):**
    *   "Does this feel premium?" -> Use gradients, subtle borders (`border-white/10`), and animations (`framer-motion`).
    *   "Is it mobile-friendly?" -> Check `md:` and `lg:` breakpoints.
*   **Architecture & State:**
    *   "Do I need global state?" -> If yes, modification to `App.tsx` and persistence in `storageService.ts` is likely required.
    *   "Is this a new View?" -> Update `AppView` enum in `types.ts` and `App.tsx` routing.
*   **AI Integration (If applicable):**
    *   "Does this require intelligence?" -> Add new function to `src/services/geminiService.ts`.
    *   "Output format?" -> ALWAYS define a JSON Schema for structured output.
    *   "Model?" -> Use `GEMINI_TEXT_MODEL` from `constants.ts`.
*   **Constraints:**
    *   **NO Redux.** Keep state simple.
    *   **NO heavy dependencies.** Use what we have (`lucide-react`, `recharts`, `framer-motion`).

## PRP Generation
*(Only generate this if requirements are clear)*

### Artifact Structure:

```markdown
# PRP: [Feature Name]

## 🎯 Objective
**User Story:** As a [User], I want [Action], so that [Benefit].
**Visual Goal:** [Describe the desired look & feel, e.g., "Clean, glassmorphism card with emerald accents"].

## 🧠 Context & Patterns
* **Reference Component:** `src/components/ReferenceComponent.tsx`
* **Key State:** `App.tsx` (Global) vs Local Component State.
* **New Types:** [List any new interfaces needed]

## 🛡️ Hazards & Gotchas (Strict Enforcement)
* [ ] **Aesthetics:** Must use "Rich Aesthetics" (gradients, glassmorphism).
* [ ] **Responsiveness:** Must test on mobile dimensions.
* [ ] **Performance:** Lazy load images, standard `useEffect` cleanup.
* [ ] **Types:** Explicit types in `types.ts`, no `any`.
* [ ] **AI:** Use structured output schemas for all Gemini calls.

## 📋 Implementation Plan

### Phase 1: Data & Types
* **Task:** Define Interfaces
* **File:** `src/types.ts`
* **Details:** Update standard types.

### Phase 2: Core Logic / State
* **Task:** Implement State Logic
* **File:** `src/App.tsx` / `src/services/storageService.ts`
* **Details:** Add state variables, persistence logic, and pass down as props.

### Phase 3: AI Service (If Applicable)
* **Task:** Implement Gemini Function
* **File:** `src/services/geminiService.ts`
* **Details:**
    * Define `ResponseSchema` in function.
    * Call `ai.models.generateContent` with `responseMimeType: "application/json"`.

### Phase 4: UI Implementation
* **Task:** Create/Update Component
* **File:** `src/components/[Component].tsx`
* **Design Specs:**
    *   Background: `bg-slate-900/50 backdrop-blur-md`
    *   Border: `border border-white/10`
    *   Animation: `AnimatePresence` for entry/exit.

## ✅ Verification Strategy
* **Build Check:** `npm run build` must pass.
* **Visual Verification (Manual):**
    1.  Start Dev Server (`npm run dev`).
    2.  Open Browser Tool.
    3.  Verify UI at Mobile width (375px) and Desktop width (1200px).
    4.  Verify interactions (hover states, animations).
* **AI Feature Check:**
    *   Verify AI response parsing and error handling (try triggers with networking off/on).
```