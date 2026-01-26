# Vesta Feature Reference

This document provides a comprehensive, exhaustive list of all features currently implemented in the Vesta application, categorized by functional area.

## 1. Core Tracking & Dashboard ("Today" View)
The central hub for daily activity and health management.

### Daily Logging
- **Food Logging**: Log meals and snacks with automatic timestamping.
- **Water Tracking**: Track daily water intake (with visual progress).
- **Workout Logging**: Log exercise sessions with "Calories Burned" and optional notes.
- **Fast Tracking**:
    - **Automatic Timer**: Calculates current fast duration based on the last logged meal.
    - **Fast Breaker Logic**: Automatically determines if a fast was "successful" (met target) or "broken" when food is logged.
    - **History**: Records completed fasts with duration and success status.

### Progress & Goals
- **Daily Rings**: Visual circular progress indicators for:
    - **Calories**: Tracks consumption against a daily limit (Ceiling).
    - **Water**: Tracks intake against a daily target (Floor).
    - **Fasting**: Tracks hours fasted against a protocol target (Target).
- **"Perfect Day" Status**: Achieved when all three daily goals (Calories, Water, Fasting) are met simultaneously.
- **Streaks**:
    - **Global Streak**: Consecutive "Perfect Days".
    - **Category Streaks**: Individual streaks for Calorie adherence, Water targets, and Fasting success.

### Dashboard Widgets (Bento Grid)
- **Calories Widget**: Shows remaining calories, consumed vs goal, and visual progress bar.
- **Hydration Widget**: Quick-add buttons for water (e.g., +250ml), visual fullness indicator.
- **Fasting Widget**: Live timer showing elapsed time since last meal, target progress bar, and "Eating Window" status.
- **Activity Widget**: Summary of workouts and total active calories burned.
- **Weight Widget**: Quick-log current weight, shows variance from goal.

## 2. AI & Smart Features (Gemini Integration)
Powered by Google Gemini to automate manual tasks and provide nutritional intelligence.

### Smart Nutrition
- **Food Image Analysis**: Upload a photo of food to automatically identify items and estimate calories (e.g., "Grilled chicken salad" -> 450 kcal).
- **Natural Language Food Logging**: Log food via text description (e.g., "I had a coffee and a bagel") -> AI extracts items and calories.
- **Ingredient Parser**: Normalizes raw ingredient text (e.g., "2 large eggs, beaten") into structured data (`{name: "eggs", quantity: 2, unit: "item"}`).

### Intelligent Automation
- **Recipe Parsing**: Paste unstructured text (from a blog or book) -> AI extracts Name, Calories, Macros, Ingredients, Instructions, and Tags.
- **Smart Shopping Conversion**: Converts recipe ingredients (e.g., "1.5 tbsp olive oil") into "Store Buyable" formats (e.g., "250ml bottle").
- **Meal Plan Generation**:
    - **Day Planning**: Generates a balanced 1-day meal plan hitting specific calorie targets (e.g., 800kcal) and dietary preferences (e.g., Mediterranean).
    - **Week Planning**: Generates a full 7-day plan with variety rules (no repeated proteins, mix of cuisines).

## 3. Meal Planning & Recipe Library
Tools for organizing meals and managing a digital cookbook.

### Recipe Library
- **Recipe Management**: Create, Read, Update, Delete (CRUD) recipes.
- **Structured Data**: Stores Calories, Protein/Fat/Carbs (Macros), Serving size, Prep time, and Tags.
- **Image Support**: Attach photos to recipes (via URL or Base64).
- **Tagging System**: Categorize by meal type (Breakfast, Main) or diet (Vegetarian, Gluten-Free).
- **Cooking Mode**: "Cook View" with large text for ingredients and instructions.
- **Scaling**: Override "Cooking Servings" to auto-scale ingredients for larger groups/families without changing the base recipe.

### Planner
- **Weekly Calendar**: View and manage meals for the upcoming 14 days.
- **Multi-Day Support**: Plan Breakfast, Lunch, Dinner, and Snacks for each day.
- **Diet Modes**:
    - **Daily Mode**: Consistent calorie target every day.
    - **5:2 Mode**: Supports "Fast Days" (800kcal) and "Non-Fast Days" (Standard maintenance).
- **Drag & Drop**: (Implied/Planned) Interface for moving meals between days.

## 4. Shopping & Pantry
A smart system to manage groceries and prevent food waste.

### Smart Shopping List
- **Automated Aggregation**: detailed aggregation of ingredients from all planned meals (e.g., 3 recipes need 1 onion each -> Shopping List shows "3 onions").
- **Pantry Management**:
    - **"Have it" Check**: Mark ingredients as "In Pantry" to exclude them from the shopping list.
    - **Inventory**: Tracks items currently available at home.
- **Scaling**: Shopping list quantities respect the "Cooking Servings" set for each planned meal.
- **Clipboard Export**: Quick-copy individual items or the full list to share via text/messaging.

## 5. Analytics & Insights
Long-term health tracking and data visualization.

### Weight Management
- **Trend Line**: Visualizes weight history over time.
- **Projection Engine**: Projects future weight loss trajectory based on current rate and goal variance (shows "Estimated Goal Date").

### Habit Tracking
- **Habit Pillars**: Visual snapshot of consistency across the 3 core habits (Food, Water, Fasting) for the last 7 days.
- **Goals History**: Calendar view showing daily success/failure for goals.

### Activity Patterns
- **Workout Analysis**: Bar charts showing daily calorie burn from exercise.
- **Calorie Adherence**: Line charts comparing Consumed vs. Net vs. Goal calories.

## 6. Social & Family
Features designed for the "Digital Hearth" communal experience.

### Family Groups
- **Group Management**: Create a family group or join one via a 6-digit Invite Code.
- **Member Limits**: Enforces a maximum group size (Safety cap).
- **Shared Visibility**:
    - **Recipe Sharing**: View recipes created by other family members.
    - **Copy to Library**: One-click copy of a family member's recipe into your personal library for editing/use.

## 7. Customization & Settings
Personalizing the app experience.

### User Profile
- **Body Metrics**: Manage Name, Current Weight, Goal Weight.
- **Nutrition Targets**: Set custom Daily Calorie Goal (for Fast/Non-Fast days).
- **Hydration Target**: Set custom daily water goal (ml).
- **Workout Goals**: Set daily target for number of workouts.

### Fasting Configuration
- **Protocol Selection**: Choose from presets (12:12, 14:10, 16:8, 18:6, 20:4) or Custom window.
- **Timer Settings**: Adjust target fasting hours.

### App Preferences
- **Theme**: Light Mode / Dark Mode toggles (manual or system sync).
- **Data Management**:
    - **Export**: Download all user data as JSON.
    - **Import**: Restore data from JSON backup.
    - **Force Sync**: Push local storage to cloud/backend.
    - **Debug Mode**: View raw local storage state (Dev only).

## 8. Technical Features
Behind-the-scenes capabilities.

- **Offline-First Architecture**: Uses LocalStorage for immediate responsiveness and offline capability, syncing to Firebase when available.
- **PWA-Ready**: Mobile-responsive design (Desktop, Tablet, Mobile) with bottom navigation on small screens.
- **Dev Mode**: Hidden feature flag system for testing unreleased features safely.
- **Recovery Tools**: Built-in utilities to fix state desyncs or force-clear caches.
