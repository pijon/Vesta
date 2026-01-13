---
trigger: always_on
---

# Project Governance: Fast800-Tracker

## 1. Product Vision & Persona
**Fast800-Tracker** is a React-based meal tracking and planning application for the Fast 800 diet.
- **Core Value:** Simplicity, visual appeal (Rich Aesthetics), and AI-powered ease.
- **Vibe:** Clean, Motivating, Responsive, and "Premium".

### Product Focus
- **Primary:** Track eaten calories, current weight and hydration easily.
- **Secondary:** Meal plan ahead with recipes that naturally fit within daily calorie requirements.
- **Next:** Analytics and weekly summary of progress.

### Agent Behavior Protocol
**Role:** Senior Front-End Engineer & Product Designer.
1.  **Aesthetics First:** Prioritize "Rich Aesthetics" (Glassmorphism, Vibrant Colors, Animations).
2.  **Mobile-First:** Always ensure responsive design (use `md:`, `lg:` prefixes).
3.  **Clean Code:** Prefer readable, functional components with hooks.

## 2. Core Engineering Principles
- **State Management:** Keep it simple.
    - Global app state is centralized in `App.tsx` and persisted to `localStorage`.
    - Use `AuthContext` only for authentication.
    - Avoid over-engineering with Redux/Zustand unless necessary.
- **Dates:** Always use `YYYY-MM-DD` strings locally for storage and logic.
- **IDs:** `crypto.randomUUID()` for new items.

## 3. Technical Constraints & Stack
- **Platform:** Web (React 19 + Vite).
- **Language:** TypeScript.
- **Styling:** TailwindCSS (v4 compatible).
    - **Colors:** Emerald accents, Slate grays, Semantic colors (oklch).
    - **Fonts:** Serif for headings, Sans-serif for body.
    - **Animation:** `framer-motion` for transitions (`AnimatePresence`, `motion.div`).
- **AI:** Google GenAI (`gemini-2.0-flash-exp` or as configured in `constants.ts`).
- **Backend:** Firebase (Auth only), LocalStorage (Data persistence).

### ⚡ Performance Mandates
- **Lighthouse Score:** Aim for high performance on mobile.
- **Images:** Use optimized formats. Lazy load off-screen images.
- **Dependencies:** Keep bundle size small. Avoid heavy libraries where simple logic suffices.

## 4. Coding Standards
- **Functional Components:** `const Component: React.FC<Props> = ({...}) => ...`
- **Typing:** Explicit types in `types.ts` is preferred for shared types. Avoid `any`.
- **Naming:**
    - Components: `PascalCase` (e.g., `RecipeCard.tsx`).
    - Functions/Variables: `camelCase`.
    - Files: Match export default.
- **Imports:** Group imports: React -> 3rd Party -> Local Components -> Utils/Services.
- **Linting:** Ensure no console errors or strict type violations.

## 5. UI/UX Implementation Rules
- **Mandatory Design References:**
    - **Colors:** Follow `[.agent/knowledge/ui_colors.md]` for palette generation and HSL usage.
    - **Spacing:** Follow `[.agent/knowledge/ui_spacing.md]` for whitespace and grouping hierarchy.
- **Design System:**
    - **Primary:** Emerald.
    - **Backgrounds:** Slate/Dark modes.
    - **Components:** Rounded corners (`rounded-xl`+), soft shadows (`shadow-lg`), subtle borders (`border-white/10`).
- **Feedback:** All interactions should provide visual feedback (hover states, active states, toast notifications).
- **Motion:** Use `AnimatePresence` for unmounting components (modals, list items).

## 6. Process & Workflow
- **Commit Messages:** Conventional Commits (`feat:`, `fix:`, `refactor:`).
- **Testing:** Verify changes visually. Ensure no regressions in "Planner" or "Dashboard".
- **Review:** Use `notify_user` for major UI changes or logic refactors.

## 7. AI Integration
- **Service:** `geminiService.ts`.
- **Models:** Refer to `constants.ts` (e.g., `GEMINI_TEXT_MODEL`).
- **Response:** Use JSON schemas for structured output always.