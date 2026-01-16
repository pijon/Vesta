# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Fast800 Tracker is a React-based meal tracking and planning application for the Fast 800 diet (800 calorie daily limit). It uses Google's Gemini AI to parse recipes, generate meal plans, and analyze food logs.

**Design Philosophy**: "Rich Aesthetics" - The app emphasizes beautiful, premium UI with glassmorphism effects, emerald accent colors, and mobile-first responsive design.

**Tech Stack**: React 19 + Vite, TypeScript, TailwindCSS v4, Google Gemini AI (gemini-2.0-flash-exp), Firebase Authentication, Recharts for data visualization

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Setup

- Create `.env.local` in the root directory
- Set `GEMINI_API_KEY=your_api_key_here`
- The Vite config maps this to `process.env.API_KEY` used in geminiService.ts
- Firebase configuration is embedded in the app (see `services/storageService.ts`)

## Agent Configuration (.agent Directory)

Fast800-Tracker uses a structured `.agent` directory to configure Claude Code's behavior and enforce project standards:

### Project Rules (`.agent/rules/rules.md`)
**Purpose**: Core governance document defining technical constraints, UI/UX mandates, and coding standards

**Key Principles**:
- **Product Vision**: "Rich Aesthetics" - Premium mobile-first design with glassmorphism effects
- **Agent Role**: Senior Front-End Engineer & Product Designer focusing on aesthetics and clean code
- **Technical Stack**: React 19 + Vite, TypeScript, TailwindCSS v4, Firebase Auth, Google Gemini AI
- **Engineering Standards**:
  - Simple state management (no Redux/Context for current scope)
  - Date format: Always `YYYY-MM-DD` strings
  - IDs: Use `crypto.randomUUID()`
  - Functional components only, explicit TypeScript typing
  - PascalCase for components, camelCase for functions/variables
- **UI/UX Mandates**:
  - Must reference color and spacing knowledge files
  - Glassmorphism design pattern
  - Emerald accent colors, serif fonts for headings
  - Mobile-first responsive design (md: breakpoints)
- **Performance**: Lighthouse optimization, lazy loading, minimal dependencies
- **AI Integration**: JSON schemas for structured output, prefer gemini-2.0-flash-exp model

### Design System Knowledge Base (`.agent/knowledge/`)

**`ui_spacing.md`** - Spacing Strategy
- **Philosophy**: "Start Large" - Begin with generous spacing (2rem) and reduce to show relationships
- **Hierarchy Levels**:
  - Distinct sections: 1.5-2rem+ spacing
  - Related elements: 1rem spacing
  - Tight groups: <1rem spacing
- **Key Rules**:
  - Inner spacing should be smaller than outer spacing
  - 1rem as standard default
  - Headings need more space above than below

**`ui_colors.md`** - Color Palette System
- **Structure**: Three categories (Brand/Primary, Supporting/Semantic, Neutrals)
- **Method**: HSL-based palette generation with 100-900 shade scales
- **Consistency**: Supporting colors should have saturation/brightness within 5-10 points
- **Ratios**: 60-30-10 rule (60% neutral, 30% brand, 10% accent)
- **Grays**: Use tinted grays (2-5% brand hue) instead of pure grays
- **Philosophy**: Minimal shadows - prefer subtle borders over heavy drop-shadows

### Custom Skills (`.agent/skills/`)

**`brainstorming`** - Pre-Implementation Discovery
- **When to Use**: MANDATORY before any creative work (new features, components, functionality changes)
- **Process**:
  1. Understanding phase: One question at a time, prefer multiple choice
  2. Exploring approaches: Present 2-3 options with trade-offs
  3. Presenting design: 200-300 word sections with validation checkpoints
- **Output**: Design document to `docs/plans/YYYY-MM-DD-<topic>-design.md`

**`frontend-design`** - Production-Grade UI Creation
- **When to Use**: Building web components, pages, dashboards, or any web UI
- **Philosophy**: Bold aesthetic direction, clear conceptual vision, memorable differentiation
- **Focus Areas**:
  - Typography: Distinctive fonts (avoid generic Arial, Inter, Roboto)
  - Color & Theme: Cohesive aesthetics with CSS variables
  - Motion: High-impact animations, scroll-triggering, hover states
  - Spatial Composition: Unexpected layouts, asymmetry, generous negative space
  - Backgrounds: Atmospheric depth (gradients, noise, patterns, textures)
- **Anti-patterns**: Avoid generic AI aesthetics (cookie-cutter designs, purple gradients)

**`createskill`** - Meta-Skill for Creating Skills
- **Purpose**: Guide for creating new agent capabilities or updating existing skills
- **Process**: 6-step workflow (understand, plan, initialize, edit, package, iterate)
- **Structure**: SKILL.md (required) + optional scripts/, references/, assets/
- **Principles**: Concise content, appropriate degrees of freedom, avoid duplication

**`codereview`** - Code Review Automation (Placeholder)
- Status: Empty file for future implementation

### Development Workflows (`.agent/workflows/`)

**`prp-create.md`** - Deep Context Analysis for Feature Planning
- Architect comprehensive PRPs (Product Requirements & Plans) using full project context
- Three phases: Requirements triage, Context intelligence, Strategic planning
- Output: Detailed PRP with objectives, context, hazards, implementation plan, verification

**`prp-interactive-create.md`** - Collaborative Planning with User Interviews
- Interview-driven planning workflow that clarifies requirements before architecting
- Mandatory interview phase to eliminate ambiguity
- Only generates plan after requirements are crystal clear

**`execute_feature.md`** - Strict Implementation with Validation Loops
- Execute feature PRPs with design validation and self-correction
- Pre-flight checks, execution loop with type/console/visual validation
- Debug mode: Three-strike rule (stop and ask after 3 failed attempts)
- Completion: Build verification, visual walkthrough, documentation sync

**`feature-vigorous.md`** - Research-First Development with Self-Critique
- Rigorous feature development preventing "lazy" implementations
- Five phases: Deep Research → User Clarification → Design & Self-Critique → Implementation → Verification
- Strict validation against project constraints before showing user

**Note**: All workflows enforce adherence to "Rich Aesthetics" and mobile-first principles.

## Architecture

### Application Structure

The app is a single-page React application using a simple view-based state management pattern (no Redux/Context needed for current scope):

- **Entry**: `index.tsx` → `App.tsx` (wrapped in AuthProvider)
- **Main Component**: `App.tsx` manages global state and view routing via `AppView` enum
- **Authentication**: Firebase Auth with AuthProvider context (see `contexts/AuthContext.tsx`)
- **Views** (via `AppView` enum):
  - **TODAY** (TrackToday): Real-time daily tracking with hero stats, meal checklist, quick actions
  - **ANALYTICS** (TrackAnalytics): Historical trends, charts, weekly summaries, goal projections
  - **PLANNER**: Meal planning interface for scheduling recipes
  - **RECIPES**: Recipe library for browsing and managing recipes
  - **SHOPPING**: Generated shopping list from planned meals
- **Navigation**:
  - Desktop: Left sidebar with grouped navigation (Tracking, Planning sections)
  - Mobile: Bottom navigation bar with 5 buttons

### Key State Management Patterns

1. **App.tsx** holds all shared state (todayPlan, tomorrowPlan, userStats, dailyLog, fastingState)
2. State is persisted via `storageService.ts` to Firebase Firestore (with localStorage migration support)
3. `refreshData()` in App.tsx re-fetches from Firebase after mutations
4. Components receive data via props and call parent handlers for mutations
5. **Authentication**: AuthProvider wraps app, provides user context, handles Firebase Auth state

### Data Flow for Food Logging & Meal Tracking

This is the most complex interaction:

1. **Today View**: User checks off a meal from today's plan
2. `toggleMeal()` updates the plan's `completedMealIds` array
3. `saveDayPlan()` persists to Firebase
4. `onLogMeal(meal, isAdding)` is called to sync with DailyLog
5. App.tsx's `handleLogMeal()` adds/removes the item from DailyLog
6. `saveDailyLog()` persists to Firebase
7. `refreshData()` re-syncs all state

**Important**: The Today view and DualTrackSection share calorie data but operate on different data structures:
- **DayPlan**: Date-specific meal list with `completedMealIds` array for tracking eaten meals
- **DailyLog**: Free-form log with timestamped `FoodLogItem[]` and `WorkoutItem[]` arrays
- Meal completion in Today view automatically syncs to DailyLog for historical tracking

### Workout Tracking & Net Calorie Calculation

Workouts allow users to burn calories, which increases their daily calorie budget:

- **Base target**: 800 kcal/day (DAILY_CALORIE_LIMIT constant)
- **With workouts**: If user burns 200 kcal, they can eat 1000 kcal (800 + 200) to maintain net 800 kcal
- **Calculation**: `netCalories = caloriesConsumed - caloriesBurned`
- **Dashboard display**: Shows net calories against base target, with adjusted target displayed when workouts exist
- **FoodLogger**: Separate workout log with purple theme to distinguish from food entries
- **Edit/Delete**: Workouts can be edited or deleted via hover actions (edit/delete buttons appear on hover)

### Trend Charts & Historical Data (Analytics View)

The **Analytics view** consolidates all historical data visualization using Recharts library:

**Main Sections**:
1. **Goal Projection** (Hero Card): Days to goal, progress bar, total lost, projected date
2. **Weight Trend** (Area Chart): Weight over time from UserStats.weightHistory
3. **Calorie Analysis** (Line Chart): Calories consumed (solid) and net calories (dashed) over time
4. **Workout Activity** (Bar Chart): Calories burned per workout day
5. **Deficit/Surplus Chart** (Bar Chart): Daily deficit/surplus vs goal with summary stats
6. **Weekly Summary**: 7-day breakdown with insights, best/worst days, compliance metrics
7. **Weekly vs Monthly Comparison**: Period comparison cards with trend indicators
8. **Advanced Analytics** (Collapsible, Desktop Only): Weight vs Fasting hours, Calorie consistency heatmap

**Data Aggregation**:
- All historical data calculated from DailyLog entries via `getAllDailySummaries()`
- No separate summary storage - aggregated on-the-fly from existing logs
- Analytics utilities in `utils/analytics.ts`: `analyzeWeightTrends()`, `analyzeStreaks()`, `getWeeklySummary()`, `getMonthlySummary()`
- Analytics service in `services/analyticsService.ts`: `getAnalyticsData()`, `getGoalProjection()`

**Responsive Design**:
- Desktop: All sections visible, full chart heights
- Mobile: 3 always visible (Goal, Weight, Calories), 4 collapsible, Advanced hidden

### Core Types (types.ts)

**Recipe & Meal Planning**:
- **Recipe**: Meal definition with nutritional info (calories, protein, fat, carbs), ingredients, instructions, tags, servings, optional image
- **Meal**: Type alias for Recipe
- **DayPlan**: Date-specific meal list with `completedMealIds` array, optional tips, totalCalories, and type (fast/non-fast for 5:2 diet)

**Daily Tracking**:
- **DailyLog**: Free-form food log with `items` (FoodLogItem[]), `workouts` (WorkoutItem[]), `waterIntake` (ml)
- **FoodLogItem**: Individual food entry with id, name, calories, timestamp
- **WorkoutItem**: Exercise entry with id, name, caloriesBurned, duration, type, timestamp

**User & Analytics**:
- **UserStats**: Weight tracking (currentWeight, startWeight, goalWeight), dailyCalorieGoal, dailyWaterGoal, weightHistory (WeightEntry[]), dietMode (daily/5:2), nonFastDayCalories
- **WeightEntry**: Date + weight data point for historical tracking
- **DailySummary**: Aggregated daily stats (date, caloriesConsumed, caloriesBurned, netCalories, workoutCount)

**Fasting**:
- **FastingState**: Current fasting status (isFasting, startTime, endTime, config)
- **FastingConfig**: Protocol settings (protocol: '16:8', targetFastHours)
- **FastingEntry**: Historical fast record (id, startTime, endTime, durationHours, isSuccess)

**Navigation & UI**:
- **AppView**: Enum for view navigation (TODAY, ANALYTICS, PLANNER, RECIPES, SHOPPING)
- **GroceryItem**: Shopping list item (name, checked boolean)

### Services

**storageService.ts**: Firebase Firestore + LocalStorage migration service
- **Primary Storage**: Firebase Firestore (users/{uid}/recipes, users/{uid}/plans, users/{uid}/logs, etc.)
- **Migration Support**: `migrateFromLocalStorage()` transfers old localStorage data to Firebase
- **Type Migrations**: Handles schema changes (e.g., 'lunch'/'dinner' → 'main meal')
- **Key Functions**:
  - Recipe management: `getRecipes()`, `saveRecipe()`, `deleteRecipe()`
  - Plan management: `getDayPlan()`, `saveDayPlan()`
  - Stats: `getUserStats()`, `saveUserStats()`
  - Daily logs: `getDailyLog()`, `saveDailyLog()`, `getAllDailySummaries()`
  - Fasting: `getFastingState()`, `saveFastingState()`, `addFastingEntry()`, `getFastingHistory()`
  - Shopping: `getShoppingState()`, `saveShoppingState()`
  - Workouts: `getRecentWorkouts(limit)` for workout suggestions
- **Data Aggregation**: `getAllDailySummaries(daysBack=90)` aggregates all daily logs into summary objects
- All functions are async (Firebase operations)

**geminiService.ts**: Google Gemini AI integration
- **Model**: Uses `gemini-2.0-flash-exp` (defined in constants.ts as `GEMINI_TEXT_MODEL`)
- **Key Functions**:
  - `parseRecipeText()`: Parse natural language recipe → Recipe object with JSON schema
  - `generateMealPlan()`: Create full day plan (~800 cal) with user preferences
  - `analyzeFoodLog()`: Parse food description → calorie estimates for logging
  - `planWeekWithExistingRecipes()`: Generate 7-day meal plan from user's recipe library
- **Features**: Structured JSON output with schemas, type-safe responses, UUID generation for IDs
- All functions return Promises (async AI calls)

**analyticsService.ts**: Analytics data aggregation
- `getAnalyticsData()`: Merges weight history, fasting data, and daily summaries for comprehensive analytics
- `getGoalProjection()`: Calculates projected goal date based on weight loss trends
- Integrates with `utils/analytics.ts` for calculations

### Component Organization

Components are organized in `/components`:

**Main Views**:
- **TrackToday**: Real-time daily tracking with hero stats cards (Calories, Weight, Hydration, Fasting), meal checklist, quick actions
- **TrackAnalytics**: Consolidated analytics view with historical trends, charts, goal projection, weekly summaries
- **Planner**: Meal planning interface for scheduling recipes across dates
- **RecipeLibrary**: Browse, search, add, edit, and manage recipe collection
- **ShoppingList**: Auto-generated grocery list from planned meals with check-off functionality

**Today View Components**:
- **DualTrackSection**: Side-by-side display of meal plan and food log with quick actions
- **CompactStatsWidget**: Mobile 2x2 grid showing Calories, Weight, Hydration, Workouts
- **HydrationWidget**: Water intake tracker with quick-add buttons
- **FastingWidget**: Intermittent fasting timer with protocol configuration (16:8, etc.)
- **WorkoutWidget**: Workout summary card with quick log button

**Analytics Components** (`/components/analytics/`):
- **GoalProjectionCard**: Hero card showing days to goal, progress bar, weight lost
- **DeficitSurplusChart**: Bar chart of daily calorie deficit/surplus vs goal with summary stats
- **PeriodicComparison**: Side-by-side weekly vs monthly comparison cards with trend indicators

**Supporting Components**:
- **WeeklySummary**: Collapsible 7-day dashboard with bar chart, day breakdown, insights
- **AnalyticsSummary**: High-level analytics cards (weight loss, streaks, compliance)
- **RecipeCard**: Individual recipe display with nutritional info, tags, favorite toggle
- **RecipeDetailModal**: Full recipe view with ingredients, instructions, nutritional breakdown
- **RecipeIllustration**: AI-generated recipe visuals (placeholder for future feature)
- **FoodEntryModal**: Free-form food logging with AI parsing via Gemini
- **WorkoutEntryModal**: Workout entry form with recent workout suggestions

**Navigation Components**:
- **DesktopSidebar**: Left sidebar with grouped navigation (Tracking: Today/Analytics, Planning: Planner/Recipes/Shopping)
- **MobileBottomNav**: Bottom navigation bar with 5 buttons (Today, Analytics, Planner, Recipes, Shopping)

**Utility Components**:
- **Portal**: React Portal wrapper for modals/overlays

### Styling & Design System

**Framework**: TailwindCSS v4 via inline className strings

**Color System** (see `.agent/knowledge/ui_colors.md`):
- **Primary/Brand**: Emerald green (#10b981 and shades) - accent color throughout app
- **Neutrals**: Tinted grays with 2-5% emerald hue saturation (not pure grays)
- **Semantic Colors**:
  - Calories: Emerald green (#10b981)
  - Weight: Blue (#3b82f6)
  - Water/Hydration: Cyan (#06b6d4)
  - Workout: Purple (#a855f7)
  - Warning/Non-Fast Day: Orange (#f97316)
- **CSS Variables**: All colors defined as CSS custom properties in index.css
- **Dark Mode**: Full dark theme support with `dark:` classes, automatic tinted grays
- **60-30-10 Rule**: 60% neutral backgrounds, 30% brand/primary, 10% accent colors

**Typography**:
- **Headings**: Serif fonts (font-serif class) for titles, section headers
- **Body**: Sans-serif for readability
- **Hierarchy**: text-3xl for main headings, text-lg for section titles, text-sm for labels
- **Weight**: font-bold for emphasis, font-medium for UI elements, font-semibold for stats

**Spacing System** (see `.agent/knowledge/ui_spacing.md`):
- **"Start Large" Philosophy**: Begin with generous spacing (space-y-8 = 2rem) and reduce to show relationships
- **Section Spacing**: space-y-8 between major sections
- **Card Spacing**: p-6 to p-8 for card padding
- **Element Spacing**: space-y-4 for related elements, gap-4 for flex/grid children
- **Tight Groups**: gap-2 or space-y-2 for closely related items

**Visual Effects**:
- **Glassmorphism**: backdrop-blur-sm/md with semi-transparent backgrounds (bg-surface/80)
- **Shadows**: Minimal use - prefer subtle borders (border border-border)
- **Rounded Corners**: rounded-2xl for cards, rounded-xl for buttons, rounded-full for pills
- **Animations**: Framer Motion for view transitions, hover effects with transition-all

**Responsive Design**:
- **Mobile-First**: Default styles for mobile (<768px)
- **Breakpoints**: md: (≥768px) for tablet/desktop layouts
- **Desktop Sidebar**: Fixed left sidebar (w-60) on md+ screens
- **Mobile Navigation**: Fixed bottom bar on mobile, hidden on desktop
- **Chart Heights**: h-48 on mobile, h-56 on desktop for better visualization

**Component Patterns**:
- **Cards**: bg-surface, rounded-2xl/3xl, border border-border, shadow-sm
- **Modals**: Fixed overlay with backdrop-blur, click-outside-to-close pattern
- **Buttons**: Primary (bg-primary text-primary-foreground), Secondary (bg-surface border border-border)
- **Form Inputs**: bg-background, border border-border, rounded-xl, focus:ring-2 focus:ring-primary/20

## Important Implementation Details

1. **Recipe IDs**: Always generated with `crypto.randomUUID()` on creation (never manual IDs)
2. **Date Format**: Always `YYYY-MM-DD` string format (via `.toISOString().split('T')[0]`)
3. **Timestamps**: Unix timestamps (milliseconds) via `Date.now()` for food logs, workouts, fasting
4. **Weight History**: Automatically appended when currentWeight changes, one entry per day max
5. **Calorie Calculations**:
   - Consumed: Reduce over dailyLog.items
   - Burned: Reduce over dailyLog.workouts
   - Net: caloriesConsumed - caloriesBurned
   - Compare net to dailyCalorieGoal (or nonFastDayCalories for non-fast days)
6. **Firebase Data Structure**:
   - `users/{uid}/data/stats` - UserStats document
   - `users/{uid}/recipes/{recipeId}` - Recipe documents
   - `users/{uid}/plans/{YYYY-MM-DD}` - DayPlan documents
   - `users/{uid}/logs/{YYYY-MM-DD}` - DailyLog documents
   - `users/{uid}/data/fasting_state` - FastingState document
   - `users/{uid}/fasting_history/{entryId}` - FastingEntry documents
7. **Modal Pattern**: Fixed overlay (z-50+) with backdrop-blur, click-outside-to-close, Portal wrapper
8. **Image Support**: Recipes have optional `image` field (base64 data URL or external URL)
9. **Async/Await**: All Firebase operations are async, always use await and handle errors
10. **Type Safety**: Explicit TypeScript typing required, no `any` types in new code

## Gemini AI Integration

**Primary Model**: `gemini-2.0-flash-exp` (defined in constants.ts as `GEMINI_TEXT_MODEL`)
- Fast, cost-effective model optimized for structured JSON output
- Preferred for recipe parsing, meal planning, food log analysis

**Structured Output**:
- All AI calls use JSON schemas for type-safe responses
- Schemas defined with Google GenAI Schema format
- Response parsing with automatic UUID injection where needed

**Use Cases**:
1. **Recipe Parsing** (`parseRecipeText`): Natural language → Recipe object with full nutritional info
2. **Meal Planning** (`generateMealPlan`): Generate balanced day plan around calorie target
3. **Food Log Analysis** (`analyzeFoodLog`): Parse free-form food description → calorie estimates
4. **Weekly Planning** (`planWeekWithExistingRecipes`): 7-day meal plan from user's recipe library

**Best Practices**:
- Always use structured schemas for predictable responses
- Include clear examples in prompts for better accuracy
- Handle API errors gracefully with user-friendly messages
- Cache API key in .env.local (never commit)

## Utility Functions & Helpers

**`utils/analytics.ts`** - Analytics Calculations
- `analyzeWeightTrends(stats)`: Returns WeightAnalysis with average loss per week, trend direction, projections
- `analyzeStreaks(dailySummaries, dailyGoal)`: Returns StreakAnalysis with current streak, longest streak, compliance rate
- `getWeeklySummary(dailySummaries, dailyGoal)`: Returns PeriodSummary for last 7 days with averages and stats
- `getMonthlySummary(dailySummaries, dailyGoal)`: Returns PeriodSummary for last 30 days
- `enhancePeriodSummaryWithWeight(summary, weightHistory)`: Adds weight change data to period summary
- `calculateDeficitSurplus(dailySummaries, dailyGoal)`: Calculates daily deficit/surplus for charting

**Constants** (`constants.ts`):
- `DAILY_CALORIE_LIMIT`: 800 (base fast day target)
- `APP_NAME`: "Fast800"
- `GEMINI_TEXT_MODEL`: "gemini-2.0-flash-exp"
- `DEFAULT_USER_STATS`: Default UserStats object for new users

**Type Guards & Validators**:
- All types defined in `types.ts` with explicit interfaces
- No runtime validation currently - rely on TypeScript compile-time checks
- Firebase security rules enforce schema at database level

## Common Development Patterns

### Adding a New Recipe Type
1. Update the type union in `types.ts` (Recipe.type)
2. Update `recipeSchema` in `geminiService.ts` with new enum value
3. Update any UI filters/displays in RecipeLibrary/Planner components

### Adding New Storage Keys (Firebase)
1. Define Firestore collection/document path structure in `storageService.ts`
2. Add async getter/setter functions following existing patterns:
   ```typescript
   export async function getNewFeature(): Promise<NewFeature> {
     const user = auth.currentUser;
     if (!user) throw new Error('Not authenticated');
     const docRef = doc(db, `users/${user.uid}/data/newfeature`);
     const docSnap = await getDoc(docRef);
     return docSnap.exists() ? docSnap.data() as NewFeature : DEFAULT_VALUE;
   }
   ```
3. Consider migration logic if changing existing data structures
4. Update Firebase security rules to allow access to new paths

### Adding a New View
1. Add new enum value to `AppView` in `types.ts`
2. Create new view component in `/components`
3. Add nav item to `DesktopSidebar.tsx` (navItems array)
4. Add nav button to `MobileBottomNav.tsx` (navItems array)
5. Add route case in `App.tsx` AnimatePresence block
6. Add any required props to trackProps object in App.tsx

### Adding a New Chart/Analytics Section
1. Ensure data is available in `getAllDailySummaries()` or create new aggregation function
2. Create chart component using Recharts (ResponsiveContainer, AreaChart/LineChart/BarChart)
3. Add to TrackAnalytics component with proper section structure
4. Consider mobile responsive behavior (collapsible, hidden, or always visible)
5. Follow existing chart patterns for colors, tooltips, axes

### Integrating New AI Features
1. Define Schema object matching Google GenAI format in `geminiService.ts`:
   ```typescript
   const mySchema = {
     type: SchemaType.OBJECT,
     properties: {
       field: { type: SchemaType.STRING, description: "..." }
     },
     required: ["field"]
   };
   ```
2. Create async function with schema in `generationConfig`
3. Use `ai.models.generateContent()` with `responseMimeType: "application/json"`
4. Parse `response.text` as JSON and add UUIDs with `crypto.randomUUID()` where needed
5. Handle errors gracefully with user-friendly messages

### Adding a New Widget to Today View
1. Create widget component in `/components` (e.g., `NewWidget.tsx`)
2. Follow existing widget patterns (card structure, color theme, icons)
3. Add to TrackToday hero stats grid (desktop: 4-column, mobile: CompactStatsWidget)
4. Ensure responsive design (show/hide on mobile as appropriate)
5. Add quick action to mobile quick actions bar if applicable

## Project Planning & Documentation

**Planning Documents** (`docs/plans/`):
- Feature designs: `YYYY-MM-DD-<topic>-design.md` (from brainstorming skill)
- Implementation plans: `analytics_integration_plan.md`, etc.
- Use workflows in `.agent/workflows/` for structured planning

**Before Major Features**:
1. Use `brainstorming` skill (mandatory for creative work)
2. Create design document in `docs/plans/`
3. Get user approval before implementation
4. Update CLAUDE.md if architecture changes

**Code Organization**:
- Components: `/components` (flat structure, group in subdirs if needed)
- Services: `/services` (data layer, API integrations)
- Utils: `/utils` (pure functions, helpers)
- Types: `types.ts` (centralized type definitions)
- Contexts: `/contexts` (React contexts like AuthContext)

## Deployment & Infrastructure

**Firebase Hosting**:
- Build: `npm run build` generates `/dist` directory
- Deploy: `firebase deploy --only hosting`
- Config: `.firebaserc` and `firebase.json`

**Firebase Firestore**:
- Database structure documented in "Important Implementation Details" section
- Security rules in Firebase console
- Indexes configured automatically

**Environment Variables**:
- Development: `.env.local` (not committed)
- Production: Set in Firebase hosting environment config
- Required: `GEMINI_API_KEY`

## API Integration Notes

- **AI Studio app URL**: https://ai.studio/apps/drive/1G-d8O3292sjHnIXXN-WvBikqjql-KoIW
- The app can be deployed via AI Studio for hosted access
- API key required for all Gemini service calls
- Rate limits: Monitor usage in Google Cloud Console

---

## Quick Reference for Claude Code

When working on this project, always remember:

1. **Design Philosophy**: "Rich Aesthetics" - premium UI, glassmorphism, emerald accents
2. **Mobile-First**: Always design for mobile first, then enhance for desktop
3. **Reference Knowledge**: Always check `.agent/knowledge/ui_colors.md` and `ui_spacing.md` for design decisions
4. **Use Skills**: Use `brainstorming` skill before any creative work (mandatory)
5. **Type Safety**: Explicit TypeScript typing, no `any` types
6. **IDs**: Always use `crypto.randomUUID()`
7. **Dates**: Always `YYYY-MM-DD` format
8. **Firebase**: All storage operations are async, always await
9. **AI Integration**: Use JSON schemas for structured output
10. **Testing**: Verify builds work (`npm run build`) before considering task complete

**For detailed guidance**, refer to:
- `.agent/rules/rules.md` - Core project rules and mandates
- `.agent/workflows/` - Structured development workflows
- This file (CLAUDE.md) - Architecture and implementation details

**Last Updated**: 2026-01-15
