---
trigger: always_on
---

# Project Governance: Fast800-Tracker

## 1. Product Vision & Persona
**Vesta** is a "Digital Hearth" for family nutrition—a warm, safe space to plan meals and tend to health.
-   **Core Philosophy:** "Nourishment over Numbers".
-   **Vibe:** Warm, Organic, Communal, Forgiving.
-   **Visuals:** Stone White backgrounds, Hearth Orange accents, Soft UI cards.

### Product Focus
-   **Primary:** Nourishment tracking (Energy/Fuel, Hydration), Daily Balance.
-   **Secondary:** Family Meal Planning, Recipe Collection.
-   **Language:** Proactive & Positive (e.g., "Energy Fuel" instead of Calories).

### Agent Behavior Protocol
**Role:** Senior Front-End Engineer & Product Designer (Hearth Keeper).
1.  **Aesthetics First:** Prioritize "Digital Hearth" aesthetics (Warm colors, Soft corners, Organic feel).
2.  **Mobile-First:** Always ensure responsive design.
3.  **Positive Reinforcement:** UI should reward consistency, not punish slips.

## 2. Core Engineering Principles
-   **State Management:** Keep it simple.
    -   Global app state is centralized in `App.tsx` and persisted to `localStorage`.
    -   Use `AuthContext` only for authentication.
    -   Avoid over-engineering with Redux/Zustand unless necessary.
-   **Dates:** Always use `YYYY-MM-DD` strings locally for storage and logic.
-   **IDs:** `crypto.randomUUID()` for new items.

## 3. Technical Constraints & Stack
-   **Platform:** Web (React 19 + Vite).
-   **Language:** TypeScript.
-   **Styling:** TailwindCSS (v4 compatible).
    -   **Colors:** Hearth Orange, Sage Green, Charcoal, Stone White.
    -   **Fonts:** Humanist Serif (Headings) + Rounded Sans (Body).
    -   **Animation:** `framer-motion` for smooth, organic transitions.
-   **AI:** Google GenAI (`gemini-2.0-flash-exp` or as configured in `constants.ts`).
-   **Backend:** Firebase (Auth only), LocalStorage (Data persistence).

### ⚡ Performance Mandates
-   **Lighthouse Score:** Aim for high performance on mobile.
-   **Images:** Use optimized formats. Lazy load off-screen images.
-   **Dependencies:** Keep bundle size small.

## 4. Coding Standards
-   **Functional Components:** `const Component: React.FC<Props> = ({...}) => ...`
-   **Typing:** Explicit types in `types.ts` is preferred for shared types. Avoid `any`.
-   **Naming:**
    -   Components: `PascalCase` (e.g., `RecipeCard.tsx`).
    -   Functions/Variables: `camelCase`.
    -   Files: Match export default.
-   **Imports:** Group imports: React -> 3rd Party -> Local Components -> Utils/Services.
-   **Linting:** Ensure no console errors or strict type violations.

## 5. UI/UX Implementation Rules (Digital Hearth)
-   **Mandatory Design References:**
    -   **Colors:** Use `Hearth Orange` (#E07A5F) for actions, `Stone White` (#F4F1DE) for backgrounds.
    -   **Spacing:** Use generous spacing to create a calm atmosphere.
-   **Design System:**
    -   **Primary:** Hearth Orange.
    -   **Backgrounds:** Stone White (Light), Deep Warm Charcoal (Dark).
    -   **Components:** Soft corners (`rounded-2xl`), gentle shadows (Neumorphism/Soft UI), minimal borders.
-   **Feedback:** "Glow" effects and organic motion.
-   **Motion:** Use `AnimatePresence` for unmounting components.

## 6. Process & Workflow
- **Commit Messages:** Conventional Commits (`feat:`, `fix:`, `refactor:`).
- **Testing:** Verify changes visually. Ensure no regressions in "Planner" or "Dashboard".
- **Review:** Use `notify_user` for major UI changes or logic refactors.

## 7. AI Integration
- **Service:** `geminiService.ts`.
- **Models:** Refer to `constants.ts` (e.g., `GEMINI_TEXT_MODEL`).
- **Response:** Use JSON schemas for structured output always.