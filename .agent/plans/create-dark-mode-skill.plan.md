# Feature: Create Dark Mode Design Skill

## Summary
The user requested a skill to handle dark mode correctly, preventing common errors like poor color choices or missing `dark:` overrides.
I will create a new skill `dark-mode-design` that provides specific guidelines for Vesta's "Evening Firelight" dark mode.

## Proposed Changes

### New Files

#### [NEW] [.agent/skills/dark-mode-design/SKILL.md](file:///Users/jon/Development/github/vista/.agent/skills/dark-mode-design/SKILL.md)
- Define skill metadata (name: `dark-mode-design`).
- Trigger: When user mentions "dark mode", "colors", "styling", "theming".
- **Core Rules**:
    1.  **Semantic Tokens First**: Use `var(--color-bg)` etc. where possible.
    2.  **Explicit Overrides**: Always provide `dark:` variant if using utility classes (e.g. `bg-white dark:bg-white/5`).
    3.  **Opacity Awareness**: Warn about stacking transparency (5% on 5% = lighter than intended). Recommend lower opacity (`2%`) for nested items or exact matches.
    4.  **Palette Reference**: embed the specific Vesta dark mode palette (Warm Charcoal `1A1714` background, Stone text).
    5.  **Inline Safety**: For critical exact matches, allow/recommend inline styles if Tailwind specificity is flaky.

## Verification Plan

### Manual
- Verify file exists.
- (Self-Correction) Future tasks regarding dark mode should trigger this skill and prompt better practices.
