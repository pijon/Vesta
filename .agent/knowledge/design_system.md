# Vesta Design System - "Digital Hearth"

> **Version:** 2.0 (January 2026)
> **Philosophy:** "Nourishment over Numbers" - A warm, organic, and forgiving design language.

This guide is the single source of truth for implementing UI in Vesta. All new components and refactors MUST adhere to these rules.

---

## 1. Color Palette

### 1.1 Brand Colors
| Name | Hex | CSS Variable | Usage |
|------|-----|--------------|-------|
| **Hearth Orange** | `#E07A5F` | `--color-hearth` | Primary actions, active states, energy/calories |
| **Sage Green** | `#81B29A` | `--color-sage` | Health, balance, success, weight tracking |
| **Charcoal** | `#3D405B` | `--color-charcoal` | Primary text (light mode), important UI elements |
| **Stone White** | `#F4F1DE` | `--color-stone` | Page background (light mode), primary text (dark mode) |
| **Eternal Flame** | `#F2CC8F` | `--color-flame` | Streaks, highlights, fasting indicators |
| **Ocean Blue** | `#7BAEBC` | `--color-ocean` | Hydration, water tracking |

### 1.2 Light Mode Tokens
```css
--background: #F4F1DE;          /* Stone White */
--surface: rgba(255,255,255,0.6); /* Semi-transparent white */
--card-bg: rgba(255,255,255,0.4); /* Glass effect */
--text-main: #3D405B;           /* Charcoal */
--text-muted: rgba(61,64,91,0.6); /* Charcoal @ 60% */
```

### 1.3 Dark Mode Tokens ("Evening Firelight")
```css
--background: #1A1714;          /* Deep charcoal brown */
--surface: rgba(255,255,255,0.05);
--card-bg: rgba(255,255,255,0.08);
--text-main: #F4F1DE;           /* Stone (inverted) */
--text-muted: rgba(244,241,222,0.6);
```

### 1.4 Semantic Mapping (New Standard)
Use these classes instead of legacy tokens:

| Legacy Token | **Light Mode Replacement** | **Dark Mode Variant** |
|--------------|----------------------------|----------------------|
| `text-main` | `text-charcoal` | `dark:text-stone-200` |
| `text-muted` | `text-charcoal/60` | `dark:text-stone-400` |
| `bg-surface` | `bg-white` | `dark:bg-white/5` |
| `bg-background` | `bg-stone-50` | `dark:bg-[#1A1714]` |

---

## 2. Typography

### 2.1 Font Families
- **Headings:** `font-serif` → Merriweather (Humanist Serif - Nostalgic, Editorial)
- **Body:** `font-sans` → Nunito (Rounded Sans - Friendly, Approachable)

### 2.2 Heading Styles
```html
<h1 class="text-2xl md:text-3xl lg:text-4xl font-serif font-normal text-charcoal dark:text-stone-200 tracking-tight">
<h2 class="text-xl md:text-2xl lg:text-3xl font-serif font-normal">
<h3 class="text-lg md:text-xl font-serif font-normal">
```

### 2.3 Body Text
- Regular: `text-charcoal dark:text-stone-300`
- Muted: `text-charcoal/60 dark:text-stone-400`
- Small/Labels: `text-xs font-bold uppercase tracking-widest text-charcoal/60 dark:text-stone-400`

---

## 3. Components

### 3.1 Cards
**Standard Card:**
```html
<div class="bg-white dark:bg-white/5 border border-charcoal/5 dark:border-white/5 rounded-3xl shadow-sm p-6">
```

**Glass Card (for overlays/search bars):**
```html
<div class="glass-card rounded-2xl p-6">
<!-- glass-card uses var(--card-bg) with backdrop-blur -->
```

### 3.2 Buttons
**Primary (Hearth Orange):**
```html
<button class="btn-primary">Action</button>
<!-- Already uses --primary (Hearth) with organic border-radius -->
```

**Secondary:**
```html
<button class="btn-secondary">Cancel</button>
```

**Ghost:**
```html
<button class="btn-ghost">Learn More</button>
```

### 3.3 Inputs
```html
<input class="bg-charcoal/5 dark:bg-white/5 border border-transparent focus:border-hearth/50 rounded-xl text-charcoal dark:text-stone-200 placeholder:text-charcoal/40 dark:placeholder:text-stone-600 focus:ring-2 focus:ring-hearth/20" />
```

### 3.4 Badges
Use the pre-defined badge classes:
- `badge-terracotta` - Calories, primary metrics
- `badge-sage` - Health, protein
- `badge-water` - Hydration
- `badge-warning` - Fat, warnings
- `badge-plum` - Workouts

### 3.5 Modals
```html
<!-- Backdrop -->
<div class="fixed inset-0 bg-stone-900/60 backdrop-blur-sm">
  <!-- Modal Container -->
  <div class="bg-stone-50 dark:bg-[#1A1714] rounded-[2.5rem] border border-white/50 dark:border-white/5">
    <!-- Content uses bg-white dark:bg-white/5 for inner cards -->
  </div>
</div>
```

---

## 4. Dark Mode Guidelines

### 4.1 Background Hierarchy
| Level | Light Mode | Dark Mode |
|-------|------------|-----------|
| Page | `bg-stone-50` / `#F4F1DE` | `bg-[#1A1714]` |
| Card Surface | `bg-white` | `bg-white/5` |
| Inner Card | `bg-charcoal/5` | `bg-white/5` |
| Elevated | `bg-white` + `shadow-sm` | `bg-white/10` |

### 4.2 Text Contrast
| Usage | Light Mode | Dark Mode |
|-------|------------|-----------|
| Primary Text | `text-charcoal` | `text-stone-200` |
| Secondary Text | `text-charcoal/60` | `text-stone-400` |
| Disabled/Hint | `text-charcoal/40` | `text-stone-500` |

### 4.3 Border Colors
- Light: `border-charcoal/5` or `border-charcoal/10`
- Dark: `border-white/5` or `border-white/10`

---

## 5. Motion & Interaction

### 5.1 Hover Effects
- **Cards:** `hover:scale-[1.01]` or `hover:-translate-y-1` with `hover:shadow-xl`
- **Buttons:** Subtle lift, glow effect (`shadow-hearth/20`)
- **Interactive Elements:** Use `transition-all duration-300`

### 5.2 Animations
- `animate-fade-in` - Entry animations
- `animate-scale-in` - Modal/Card pop-in
- `animate-slide-up` - Content reveals

---

## 6. Do's and Don'ts

### ✅ DO
- Use semantic color tokens (`text-charcoal`, `bg-hearth`)
- Always provide dark mode variants (`dark:text-stone-200`)
- Use Serif fonts for headings
- Keep corners soft (`rounded-2xl` to `rounded-3xl`)
- Use warm shadows with `hsla(25, 40%, 25%, 0.08)`

### ❌ DON'T
- Use pure black (`#000`) or pure white (`#FFF`) for large areas
- Use clinical colors (bright blue, stark gray)
- Use sharp corners (`rounded-sm`, `rounded-md`)
- Use aggressive red for "over limit" states (use soft warnings)
- Mix legacy tokens (`text-muted`) with new tokens

---

## 7. Migration Checklist

When refactoring a component:
- [ ] Replace `text-muted` → `text-charcoal/60 dark:text-stone-400`
- [ ] Replace `text-main` → `text-charcoal dark:text-stone-200`
- [ ] Replace `bg-surface` → `bg-white dark:bg-white/5`
- [ ] Replace `bg-background` → Use specific color or `bg-stone-50 dark:bg-[#1A1714]`
- [ ] Ensure all headings use `font-serif`
- [ ] Verify contrast in both light and dark mode
