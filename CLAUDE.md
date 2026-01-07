# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Fast800 Tracker is a React-based meal tracking and planning application for the Fast 800 diet (800 calorie daily limit). It uses Google's Gemini AI to parse recipes, generate meal plans, and analyze food logs.

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

## Architecture

### Application Structure

The app is a single-page React application using a simple view-based state management pattern (no Redux/Context needed for current scope):

- **Entry**: `index.tsx` → `App.tsx`
- **Main Component**: `App.tsx` manages global state and view routing via `AppView` enum
- **Views**: Dashboard, Planner, Recipes, Shopping, Journal (selected via navigation)

### Key State Management Patterns

1. **App.tsx** holds all shared state (todayPlan, tomorrowPlan, userStats, dailyLog)
2. State is persisted via `storageService.ts` to localStorage
3. `refreshData()` in App.tsx re-fetches from localStorage after mutations
4. Components receive data via props and call parent handlers for mutations

### Data Flow for Food Logging & Meal Tracking

This is the most complex interaction:

1. **Dashboard**: User checks off a meal from today's plan
2. `toggleMeal()` updates the plan's `completedMealIds` array
3. `saveDayPlan()` persists to localStorage
4. `onLogMeal(meal, isAdding)` is called to sync with Journal
5. App.tsx's `handleLogMeal()` adds/removes the item from DailyLog
6. `refreshData()` re-syncs all state

**Important**: The Dashboard and Journal (FoodLogger) share calorie data but operate on different data structures:
- Dashboard uses `DayPlan` with `completedMealIds` tracking
- Journal uses `DailyLog` with timestamped `FoodLogItem[]`

### Core Types (types.ts)

- **Recipe**: Meal definition with nutritional info, ingredients, instructions
- **DayPlan**: Date-specific meal list with completion tracking
- **DailyLog**: Free-form food log entries with timestamps
- **UserStats**: Weight tracking (current, start, goal) with history array
- **AppView**: Enum for view navigation

### Services

**storageService.ts**: LocalStorage wrapper with migration logic
- Handles type migrations (e.g., 'lunch'/'dinner' → 'main meal')
- Provides getters/setters for Recipes, Plans, Stats, Shopping State, Daily Logs
- All functions are synchronous (localStorage is sync)

**geminiService.ts**: Google Gemini AI integration
- `parseRecipeText()`: Parse natural language recipe → Recipe object
- `generateMealPlan()`: Create full day plan (~800 cal) with preferences
- `analyzeFoodLog()`: Parse food description → calorie estimates
- `planWeekWithExistingRecipes()`: 7-day plan from user's recipe library
- All functions return Promises (async AI calls)

### Component Organization

Components are in `/components`:
- **Dashboard**: Main view with calorie tracking, weight chart, meal checklist
- **FoodLogger**: Journal view for free-form food logging with AI parsing
- **Planner**: Meal planning interface for scheduling recipes
- **RecipeLibrary**: Browse/add/edit recipes
- **RecipeCard**: Recipe display component
- **RecipeIllustration**: AI-generated recipe visuals
- **ShoppingList**: Grocery list from planned meals
- **MealPlanner**: Legacy component (check if still used)

### Styling

- TailwindCSS via inline className strings
- Design system: Emerald accent colors, slate grays, serif fonts for headings
- Responsive: Mobile-first with md: breakpoints
- Mobile navigation: Bottom bar (hidden on desktop)

## Important Implementation Details

1. **Recipe IDs**: Generated with `crypto.randomUUID()` on creation
2. **Date Format**: Always `YYYY-MM-DD` string (via `.toISOString().split('T')[0]`)
3. **Weight History**: Automatically appended when currentWeight changes (App.tsx:44-57)
4. **Calorie Calculations**: Reduce over meals/items arrays, comparing to `DAILY_CALORIE_LIMIT` constant
5. **Modal Pattern**: Overlays use fixed positioning with backdrop-blur, click outside to close
6. **Image Support**: Recipes can have optional `image` field (URL string)

## Gemini AI Models

- Uses `gemini-3-flash-preview` (defined in constants.ts as `GEMINI_TEXT_MODEL`)
- Alternative thinking model available: `gemini-3-pro-preview`
- All AI calls use structured output with JSON schemas for type safety

## Common Development Patterns

### Adding a New Recipe Type
1. Update the type union in `types.ts` (Recipe.type)
2. Update `recipeSchema` in `geminiService.ts` with new enum value
3. Update any UI filters/displays in RecipeLibrary/Planner components

### Adding New Storage Keys
1. Define constant in `storageService.ts` (e.g., `const NEW_KEY = "fast800_newfeature"`)
2. Add getter/setter functions following existing patterns
3. Consider migration logic if changing existing data structures

### Integrating New AI Features
1. Define Schema object matching Google GenAI format
2. Create async function in `geminiService.ts`
3. Use `ai.models.generateContent()` with `responseMimeType: "application/json"`
4. Parse response.text and add UUIDs where needed

## API Integration Notes

- AI Studio app URL: https://ai.studio/apps/drive/1G-d8O3292sjHnIXXN-WvBikqjql-KoIW
- The app can be deployed via AI Studio for hosted access
- API key required for all Gemini service calls
