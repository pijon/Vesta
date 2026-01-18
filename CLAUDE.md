# CLAUDE.md

## Agent Configuration (.agent Directory)
Fast800-Tracker uses a structured `.agent` directory.

### 📚 Knowledge Base
- **Architecture:** [.agent/knowledge/architecture.md](file:///Users/jon/Development/github/Fast800-Tracker/.agent/knowledge/architecture.md)
- **Data Schema:** [.agent/knowledge/data_schema.md](file:///Users/jon/Development/github/Fast800-Tracker/.agent/knowledge/data_schema.md)
- **UI Colors:** [.agent/knowledge/ui_colors.md](file:///Users/jon/Development/github/Fast800-Tracker/.agent/knowledge/ui_colors.md)
- **UI Spacing:** [.agent/knowledge/ui_spacing.md](file:///Users/jon/Development/github/Fast800-Tracker/.agent/knowledge/ui_spacing.md)

### 🛠️ Skills
- **Development Guide:** [.agent/skills/development-guide/SKILL.md](file:///Users/jon/Development/github/Fast800-Tracker/.agent/skills/development-guide/SKILL.md)
- **Firebase Ops:** [.agent/skills/firebase-ops/SKILL.md](file:///Users/jon/Development/github/Fast800-Tracker/.agent/skills/firebase-ops/SKILL.md)
- **Frontend Design:** [.agent/skills/frontend-design/SKILL.md](file:///Users/jon/Development/github/Fast800-Tracker/.agent/skills/frontend-design/SKILL.md)
- **Brainstorming:** [.agent/skills/brainstorming/SKILL.md](file:///Users/jon/Development/github/Fast800-Tracker/.agent/skills/brainstorming/SKILL.md)

### ⏩ Workflows
- **Feature Development (Vigorous):** [.agent/workflows/feature-vigorous.md](file:///Users/jon/Development/github/Fast800-Tracker/.agent/workflows/feature-vigorous.md)
  - *Use this for all new features. Enforces research, design, and mental simulation.*


## Project Structure
The project uses a flat structure (no `src/` folder):

- **Root:** `App.tsx`, `index.tsx`, `vite.config.ts`, `types.ts`, `constants.ts`
- **Directories:**
  - `components/`: UI Components.
  - `services/`: Business logic (Firebase, LocalStorage).
  - `contexts/`: React Contexts.
  - `utils/`: Utility functions.
  - `.agent/`: AI Agent configuration.

## Quick Reference
1. **Design:** "Rich Aesthetics" - Glassmorphism, Emerald Accents.
2. **Mobile-First:** Always test mobile responsiveness.
3. **Safety:** No `any`, use semantic tokens, use `crypto.randomUUID()`.
