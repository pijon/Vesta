# Vesta: The One-Year Journey
## Feature Deep Dive for Long-Term Sustainability

**Objective:** Transform Vesta from a short-term tracking utility into a long-term "Digital Hearth" companion that sustains users for 1+ years.
**Philosophy:** Nourishment over Numbers. Growth, not maintenance.

---

## 1. Seasonal Rhythms (The Content Engine)

### The Core Concept
Most diet apps exist in a vacuum. A salad in January is treated the same as a salad in July. "Seasonal Rhythms" synchronizes the app with the natural world, keeping the content fresh, relevant, and naturally engaging. It prevents "diet boredom," the silent killer of long-term adherence.

### How It Works
*   **Dynamic UI Themes:**
    *   **Winter:** UI shifts to warmer, deeper tones (Deep Ember, Roasted Root). Animations are slower, cozier.
    *   **Spring:** UI brightens (Fresh Sprout, Dew Drop). Animations become bouncier/lighter.
*   **Smart Recipe Surfacing (User-Owned):**
    *   **The "Pantry Rediscovery" Engine:** Vesta scans *your* existing recipe library.
    *   **Winter:** It prompts: "It's getting cold—time to bring back your Chili recipe?"
    *   **Summer:** It nudges: "You have 3 great salad recipes you haven't made since August."
    *   **Note:** Vesta *organizes* your world; it doesn't just push generic content.
*   **Educational Nudges:** "Persimmons are in season! Great time to add a new recipe using them."

### Vesta Alignment
It reinforces the "Hearth" metaphor. The hearth is the center of the home that responds to the cold outside. It makes the app feel *alive* and connected to the real world, rather than a static spreadsheet.

### Implementation Effort: Medium
*   *Requires:* Tagging user recipes with seasonality attributes (manual or AI-inferred). Simple theme switcher logic.

---

## 2. Intuitive "Calibration" Mode (The Educational Arc)

### The Core Concept
Tracking every gram forever is exhausting and unnatural. The goal of a 1-year journey is "Food Freedom," not dependency. This feature gamifies the process of weaning *off* the strict tracking while maintaining the awareness.

### How It Works
*   **Phase 1: The Learner (Month 1-3):** Standard counting. Vesta teaches you what 600 calories actually looks like.
*   **Phase 2: The Calibrator (Month 4-6):**
    *   **Blind Estimation:** Before you log, Vesta asks: "Guess the protein?"
    *   **Feedback Loop:** You guess "25g". Log reveals "22g". Vesta says: "You're a pro! Spot on."
*   **Phase 3: The Intuit (Month 6+):**
    *   **Simplified Logging:** Option to switch specific meals to "Photo + Satiety" logging.
    *   User snaps a pic and rates: "How full? (1-5)" & "How energized? (1-5)".
    *   Vesta runs periodic "Spot Checks" (e.g., "Let's fully track for 3 days to recalibrate") to ensure drift hasn't happened.

### Vesta Alignment
It treats the user with dignity. It positions Vesta as a "Mentor" that trusts the user, rather than a "Warden" watching their every move.

### Implementation Effort: High
*   *Requires:* New logging modes, "Guessing" interaction flows, and adaptive settings logic.

---

## 3. The "Sunday Reset" (The Friction Remover)

### The Core Concept
Motivation is finite; habit is infinite. The biggest friction point in long-term health is the weekly "What are we eating?" cognitive load. This feature automates the executive function required to stay healthy.

### How It Works
*   **The Ritual:** Every Sunday morning, Vesta sends a gentle "Hearth is lit" notification.
*   **One-Tap Generation:**
    *   "Plan my week" button.
    *   AI logic: "User had Chicken on Tuesday last week and liked it. It's Winter, so add a Squash Soup. They usually go out on Friday, so leave Friday dinner open."
*   **Smart Groceries:**
    *   Generates a list sorted by supermarket aisle (Produce, Dairy, Pantry).
    *   **"Pantry Stash":** Remembers you bought a bottle of olive oil 2 weeks ago and doesn't add it again.
*   **Prep Mode:** A simple checklist view for Sunday afternoon: "Chop veggies for Tuesday tonight to save 20 mins."

### Vesta Alignment
This is the "Keeper of the Hearth" persona in action. It’s a supportive act of service that reduces anxiety and helps the user care for their future self.

### Implementation Effort: High
*   *Requires:* Robust AI planning logic (already partially there), Grocery List state management, and user preference learning.

---

## 4. The Family Table (The Social Hearth)

### The Core Concept
Dieting in isolation breeds resentment. Eating *with* family builds culture. Vesta bridges the gap between "My strict plan" and "Our family dinner."

### How It Works
*   **The "Menu Board" View:** A simplified, shareable read-only link (or lightweight mode).
    *   Shows *just* the dinner menu for the week. No calories, no macros. Just delicious food photos and names.
    *   Family members can "Heart" options or suggest swaps from a curated list.
*   **Scaling Logic:**
    *   "Cook Mode": User toggles "Cooking for: 4".
    *   Vesta automatically scales the recipe ingredients.
    *   Vesta calculates the *User's Portion* separately (e.g., "Serve family 1 cup each; You take 3/4 cup").
*   **Shared Wins:** "The Miller Family accepted the '5 Veggie Challenge' this week!"

### Vesta Alignment
The Hearth is communal. This feature stops Vesta from being a "walled garden" and makes it the center of the household's nutrition conversation.

### Implementation Effort: Medium
*   *Requires:* Scaling logic for recipes (math), "Guest" or "Family" profiles (lightweight data structure).

---

## 5. The "Wellness Mosaic" (The Visual Reward)

### The Core Concept
Streaks (e.g., "75 days in a row!") are fragile. One slip-up (Day 76 missed) causes a psychological crash ("I ruined it!"). The Mosaic replaces linear streaks with an additive, artistic representation of the year.

### How It Works
*   **The Canvas:** A year-long view (12x30 grid) that starts blank.
*   **The Stones:**
    *   Hit protein goal? -> Place a "Ruby" stone.
    *   Drank water? -> A blue "River" flows through that day's tile.
    *   Rest day? -> A green "Moss" tile.
    *   Missed tracking? -> It's just empty "Soil" (ready for future growth), not a red error.
*   **The result:** By Dec 31st, the user has a unique, colorful tapestry that represents *effort*, not perfection. "Look at the river of hydration I built in August."
*   **Yearly Artifact:** Option to export/print their "Year in Health" as a poster.

### Vesta Alignment
This is pure "Rich Aesthetics" and forgiving design. It celebrates accumulation of good choices over the punishment of bad ones. It turns data into art.

### Implementation Effort: Medium
*   *Requires:* A new visualization component (Canvas or SVG grid), logic to map daily stats to visual assets.

---

## 6. PWA Support (The Always-On Hearth)

### The Core Concept
A "Digital Hearth" should be instantly accessible, even without internet, just like a real hearth is always there in the home. PWA (Progressive Web App) support transforms Vesta from a "website" into an "app" on the user's home screen.

### How It Works
*   **Installability:**
    *   Users can "Add to Home Screen" on iOS/Android.
    *   Full-screen experience (no browser chrome/URL bar).
*   **Offline Capability:**
    *   Core features (viewing plan, logging basics) work without signal.
    *   Syncs automatically when connection returns.
*   **Engagement:**
    *   Native-style push notifications for "Sunday Reset" or meal reminders.

### Vesta Alignment
Reduces the friction of "opening a browser." If the goal is a 1-year habit, removing that 3-second friction point is critical. It signifies permanence and reliability.

### Implementation Effort: High
*   *Requires:* `vite-plugin-pwa`, Service Worker configuration, Manifest setup, and offline fallback UI logic.

---

## Recommendation for Next Steps

If we focus on the **1-year horizon**, I recommend prioritizing **Feature #3 (The Sunday Reset)** and **Feature #5 (The Wellness Mosaic)** first.

1.  **The Sunday Reset** solves the immediate *practical* problem of drop-off (friction).
2.  **The Wellness Mosaic** solves the long-term *emotional* problem of perfectionism (motivation).
