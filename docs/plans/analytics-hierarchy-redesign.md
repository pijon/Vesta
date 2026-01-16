# Analytics Hierarchy Redesign
**Fast800 Tracker - Strict Information Architecture**

**Status**: ✅ APPROVED - Implementation In Progress
**Date**: 2026-01-15
**Goal**: Eliminate duplicate metrics, create focused sections with clear purposes

## ✅ Approved Decisions

1. **Extrapolation**: Projected trend line + days to goal calculation ✅
2. **Compliance display**: "12 days" format (no emoji) ✅
3. **Time periods**: Weekly vs monthly is sufficient ✅
4. **Mobile defaults**: PROGRESS expanded by default ✅
5. **Chart types**: Area (weight), Line (calories), Bar (workouts) ✅

---

## Design Principles

1. **One Metric, One Place**: Each measurement appears in exactly ONE section
2. **Clear Purpose**: Every section answers a specific question
3. **Moderate Detail**: Not minimal, not overwhelming - just what's needed
4. **Extrapolation**: Include projections and trend forecasting where valuable
5. **Same Hierarchy**: Desktop and mobile use identical structure (mobile sections are collapsible)

---

## The 3 Analytics Categories

### 📊 1. PROGRESS - "Am I moving toward my goal?"

**Purpose**: Track weight loss journey from start to goal

**Question Answered**: How much have I lost, how much remains, when will I reach my goal?

**Metrics (ALL weight-related data lives here)**:
- Current weight vs goal weight
- Total weight lost (start → current)
- Weight remaining (current → goal)
- Days to goal (extrapolated based on trend)
- Projected goal date (calculated from current rate)
- Weight history chart (area chart)
- Projected trend line (dashed line extending to goal date)

**Components**:
```
┌─────────────────────────────────────────┐
│  PROGRESS                               │
├─────────────────────────────────────────┤
│                                         │
│  🎯 Goal Progress Hero Card             │
│  ┌───────────────────────────────────┐  │
│  │ Current: 85kg  →  Goal: 75kg     │  │
│  │ Lost: 5kg      Remaining: 10kg   │  │
│  │ ━━━━━━━━━━━━━━░░░░░░░░ 33%      │  │
│  │                                   │  │
│  │ Projected: March 15, 2026        │  │
│  │ Days remaining: 42 days          │  │
│  └───────────────────────────────────┘  │
│                                         │
│  📈 Weight Trend with Projection        │
│  ┌───────────────────────────────────┐  │
│  │ Area chart showing:               │  │
│  │ - Historical weight (solid area)  │  │
│  │ - Current trend line (solid)      │  │
│  │ - Projected trend (dashed)        │  │
│  │ - Goal line (horizontal)          │  │
│  └───────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

**Removed Duplicates**:
- ❌ Weight stats from AnalyticsSummary (consolidated into hero card)
- ❌ Weight progress bar from PeriodicComparison (now only here)
- ❌ Weight change indicators scattered elsewhere

---

### ✅ 2. COMPLIANCE - "Am I following the plan?"

**Purpose**: Track daily adherence to calorie targets

**Question Answered**: Am I staying on target? How consistent am I?

**Metrics (ALL calorie & adherence data lives here)**:
- Daily calorie consumption vs target (line chart)
- Net calories (consumed - burned)
- Daily deficit/surplus (bar chart showing +/- from target)
- Compliance rate % (e.g., "85% of days on target")
- Current streak (consecutive days within target)
- Longest streak achieved
- Summary stats: Average deficit, best day, worst day

**Components**:
```
┌─────────────────────────────────────────┐
│  COMPLIANCE                             │
├─────────────────────────────────────────┤
│                                         │
│  📊 Compliance Overview                 │
│  ┌───────────────────────────────────┐  │
│  │ 85% Compliant  🔥 12-day streak  │  │
│  │ Avg deficit: -150 kcal/day       │  │
│  └───────────────────────────────────┘  │
│                                         │
│  📈 Daily Calorie Tracking              │
│  ┌───────────────────────────────────┐  │
│  │ Line chart (last 30 days):       │  │
│  │ - Calories consumed (solid line)  │  │
│  │ - Net calories (dashed line)      │  │
│  │ - Target line (horizontal)        │  │
│  └───────────────────────────────────┘  │
│                                         │
│  📊 Daily Deficit/Surplus               │
│  ┌───────────────────────────────────┐  │
│  │ Bar chart (last 30 days):        │  │
│  │ - Green bars: Under target       │  │
│  │ - Red bars: Over target          │  │
│  │ - Shows exact kcal +/- each day  │  │
│  │                                   │  │
│  │ Summary:                          │  │
│  │ Best day: -450 kcal              │  │
│  │ Worst day: +200 kcal             │  │
│  │ Average: -150 kcal               │  │
│  └───────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

**Removed Duplicates**:
- ❌ Separate calorie line chart (consolidated here)
- ❌ Compliance rate from AnalyticsSummary (now only here)
- ❌ Streak data scattered elsewhere (now only here)
- ❌ Calorie stats from PeriodicComparison (now only here)

---

### 🔍 3. PATTERNS - "What trends exist in my data?"

**Purpose**: Identify behavioral patterns and time-based insights

**Question Answered**: What patterns emerge when comparing time periods and activities?

**Metrics (ALL time-comparison & activity pattern data lives here)**:
- Weekly snapshot (last 7 days summary)
- Monthly snapshot (last 30 days summary)
- Weekly vs monthly comparison
- Workout frequency over time (bar chart)
- Day-by-day breakdown with insights
- Best/worst days identification

**Components**:
```
┌─────────────────────────────────────────┐
│  PATTERNS                               │
├─────────────────────────────────────────┤
│                                         │
│  📅 Time Period Comparison              │
│  ┌───────────────────────────────────┐  │
│  │  This Week  │  This Month         │  │
│  │  ─────────  │  ──────────        │  │
│  │  Avg: 750   │  Avg: 780          │  │
│  │  Workouts:4 │  Workouts: 15      │  │
│  │  Comply:86% │  Comply: 82%       │  │
│  │  Weight:↓0.5│  Weight: ↓2.1      │  │
│  └───────────────────────────────────┘  │
│                                         │
│  💪 Workout Activity Pattern            │
│  ┌───────────────────────────────────┐  │
│  │ Bar chart (last 30 days):        │  │
│  │ - Calories burned per day        │  │
│  │ - Shows frequency & intensity    │  │
│  └───────────────────────────────────┘  │
│                                         │
│  📋 Weekly Breakdown                    │
│  ┌───────────────────────────────────┐  │
│  │ Day-by-day details (last 7 days):│  │
│  │                                   │  │
│  │ Mon: 800 kcal, 1 workout, ✓      │  │
│  │ Tue: 750 kcal, 0 workouts, ✓     │  │
│  │ Wed: 850 kcal, 1 workout, ✗      │  │
│  │ ...                               │  │
│  │                                   │  │
│  │ Insights:                         │  │
│  │ • Best day: Monday (-50 kcal)    │  │
│  │ • Most active: Mon, Wed (2 WO)   │  │
│  │ • Recommended: Add workouts Tue   │  │
│  └───────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

**Removed Duplicates**:
- ❌ Separate workout bar chart (now only here)
- ❌ Weekly summary stats from multiple places (now only here)
- ❌ PeriodicComparison split into relevant sections (comparison stays here, metrics go to owning sections)

---

## Metric Ownership Map

| Metric | Appears In | Reason |
|--------|-----------|---------|
| **Current Weight** | PROGRESS only | Weight data = Progress |
| **Weight Lost** | PROGRESS only | Weight data = Progress |
| **Weight Chart** | PROGRESS only | Weight data = Progress |
| **Goal Projection** | PROGRESS only | Weight data = Progress |
| **Days to Goal** | PROGRESS only | Weight data = Progress |
| **Calories Consumed** | COMPLIANCE only | Adherence data = Compliance |
| **Net Calories** | COMPLIANCE only | Adherence data = Compliance |
| **Deficit/Surplus** | COMPLIANCE only | Adherence data = Compliance |
| **Compliance Rate %** | COMPLIANCE only | Adherence data = Compliance |
| **Streak Data** | COMPLIANCE only | Adherence data = Compliance |
| **Workout Frequency** | PATTERNS only | Activity pattern = Patterns |
| **Weekly Summary** | PATTERNS only | Time comparison = Patterns |
| **Monthly Summary** | PATTERNS only | Time comparison = Patterns |
| **Day Breakdown** | PATTERNS only | Time comparison = Patterns |
| **Best/Worst Days** | PATTERNS only | Time comparison = Patterns |

---

## Components to Modify/Remove

### Keep & Enhance
1. **GoalProjectionCard** → Move to PROGRESS, enhance with extrapolation
2. **Weight Trend Chart** → Move to PROGRESS, add projected trend line
3. **Calorie Line Chart** → Move to COMPLIANCE
4. **DeficitSurplusChart** → Move to COMPLIANCE
5. **Workout Bar Chart** → Move to PATTERNS
6. **WeeklySummary** → Move to PATTERNS (day breakdown)
7. **PeriodicComparison** → Move to PATTERNS (time comparison cards)

### Remove/Consolidate
1. **AnalyticsSummary** → ❌ DELETE
   - Weight loss card → Data moved to PROGRESS hero card
   - Streak card → Data moved to COMPLIANCE overview
   - Compliance card → Data moved to COMPLIANCE overview
   - Weekly stats → Data moved to PATTERNS

### Create New
1. **ComplianceOverviewCard** → NEW component for COMPLIANCE section
   - Shows compliance %, streak, average deficit
   - Replaces scattered compliance metrics

---

## Extrapolation Features (PROGRESS Section)

### Goal Projection Algorithm
```
1. Calculate average weight loss per week from historical data
2. Calculate weeks remaining = (current - goal) / avg_loss_per_week
3. Project goal date = today + (weeks_remaining * 7 days)
4. Generate projected trend line on chart:
   - Start: Current weight, today's date
   - End: Goal weight, projected date
   - Draw dashed line between points
```

### Chart Enhancement
```tsx
<AreaChart>
  {/* Historical data (solid area) */}
  <Area dataKey="weight" fill="url(#colorWeight)" stroke="#3b82f6" />

  {/* Current trend line (solid) */}
  <Line dataKey="trendLine" stroke="#3b82f6" strokeWidth={2} />

  {/* Projected trend (dashed) */}
  <Line
    dataKey="projectedLine"
    stroke="#3b82f6"
    strokeWidth={2}
    strokeDasharray="5 5"
    opacity={0.6}
  />

  {/* Goal line (horizontal) */}
  <ReferenceLine y={goalWeight} stroke="#10b981" strokeDasharray="3 3" />
</AreaChart>
```

---

## Mobile Behavior (Same Hierarchy)

All 3 sections visible on mobile, but with collapsible headers:

```
Mobile View:
┌─────────────────────┐
│ Analytics           │
├─────────────────────┤
│                     │
│ ▼ PROGRESS         │
│   [Expanded by default]
│   - Hero card       │
│   - Chart           │
│                     │
│ ▶ COMPLIANCE       │
│   [Collapsed]       │
│                     │
│ ▶ PATTERNS         │
│   [Collapsed]       │
│                     │
└─────────────────────┘
```

- PROGRESS: Expanded by default (most important)
- COMPLIANCE: Collapsed by default (tap to expand)
- PATTERNS: Collapsed by default (tap to expand)

---

## Implementation Plan

### Phase 1: Create New Structure
1. Create `ComplianceOverviewCard` component
2. Enhance `GoalProjectionCard` with extrapolation
3. Add projected trend line to weight chart
4. Reorganize TrackAnalytics into 3 sections

### Phase 2: Remove Duplicates
1. Delete `AnalyticsSummary` component
2. Remove duplicate metrics from `PeriodicComparison`
3. Consolidate streak data into COMPLIANCE
4. Remove duplicate weight stats

### Phase 3: Polish & Test
1. Add collapsible section headers for mobile
2. Test all calculations (projections, averages, etc.)
3. Verify no metric appears twice
4. Test responsive behavior

---

## Before/After Comparison

### Before (Current)
- **8 sections** with overlapping data
- Weight shown in **4 places**
- Calories shown in **3 places**
- Compliance shown in **3 places**
- Unclear section purposes
- Mobile missing key sections

### After (Proposed)
- **3 sections** with clear purposes
- Weight shown in **1 place** (PROGRESS)
- Calories shown in **1 place** (COMPLIANCE)
- Compliance shown in **1 place** (COMPLIANCE)
- Each section answers specific question
- Mobile has same hierarchy (collapsible)

---

## Questions for Approval

1. **Extrapolation**: Does the projected trend line + goal date calculation make sense?
2. **Compliance metrics**: Should streak be shown as "12 days" or "12-day streak 🔥"?
3. **Patterns section**: Is the weekly vs monthly comparison sufficient, or do we need more time periods?
4. **Mobile defaults**: Should PROGRESS be expanded by default on mobile?
5. **Chart types**: Keep area chart for weight, line chart for calories, bar chart for workouts?

---

**Status**: ✅ APPROVED - Implementation In Progress
**Next Steps**: Implementing Phase 1 → Phase 2 → Phase 3
