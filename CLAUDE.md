# CLAUDE.md

## Agent Configuration (.agent Directory)
Fast800-Tracker uses a structured `.agent` directory.

### 📚 Knowledge Base
- **Design System:** [.agent/knowledge/design_system.md](file:///Users/jon/Development/github/vista/.agent/knowledge/design_system.md) ⭐
- **Architecture:** [.agent/knowledge/architecture.md](file:///Users/jon/Development/github/vista/.agent/knowledge/architecture.md)
- **Data Schema:** [.agent/knowledge/data_schema.md](file:///Users/jon/Development/github/vista/.agent/knowledge/data_schema.md)
- **UI Colors:** [.agent/knowledge/ui_colors.md](file:///Users/jon/Development/github/vista/.agent/knowledge/ui_colors.md)
- **UI Spacing:** [.agent/knowledge/ui_spacing.md](file:///Users/jon/Development/github/vista/.agent/knowledge/ui_spacing.md)

### 🛠️ Skills
- **Development Guide:** [.agent/skills/development-guide/SKILL.md](file:///Users/jon/Development/github/Fast800-Tracker/.agent/skills/development-guide/SKILL.md)
- **Feature Switch:** [.agent/skills/feature-switch/SKILL.md](file:///Users/jon/Development/github/Fast800-Tracker/.agent/skills/feature-switch/SKILL.md)
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
## Code Exploration with dora

This codebase uses dora for fast code intelligence and architectural analysis.

### IMPORTANT: Use dora for code exploration

**ALWAYS use dora commands for code exploration instead of Grep/Glob/Find.**

### All Commands

**Overview:**

- `dora status` - Check index health, file/symbol counts, last indexed time
- `dora map` - Show packages, file count, symbol count

**Files & Symbols:**

- `dora ls [directory] [--limit N] [--sort field]` - List files in directory with metadata (symbols, deps, rdeps). Default limit: 100
- `dora file <path>` - Show file's symbols, dependencies, and dependents
- `dora symbol <query> [--kind type] [--limit N]` - Find symbols by name across codebase. Default limit: 20
- `dora refs <symbol> [--kind type] [--limit N]` - Find all references to a symbol
- `dora exports <path>` - List exported symbols from a file
- `dora imports <path>` - Show what a file imports

**Dependencies:**

- `dora deps <path> [--depth N]` - Show file dependencies (what this imports). Default depth: 1
- `dora rdeps <path> [--depth N]` - Show reverse dependencies (what imports this). Default depth: 1
- `dora adventure <from> <to>` - Find shortest dependency path between two files

**Code Health:**

- `dora leaves [--max-dependents N]` - Find files with few/no dependents. Default: 0
- `dora lost [--limit N]` - Find unused exported symbols. Default limit: 50
- `dora treasure [--limit N]` - Find most referenced files and files with most dependencies. Default: 10

**Architecture Analysis:**

- `dora cycles [--limit N]` - Detect circular dependencies. Empty = good. Default: 50
- `dora coupling [--threshold N]` - Find bidirectionally dependent file pairs. Default threshold: 5
- `dora complexity [--sort metric]` - Show file complexity metrics (sort by: complexity, symbols, stability). Default: complexity

**Change Impact:**

- `dora changes <ref>` - Show files changed since git ref and their impact
- `dora graph <path> [--depth N] [--direction type]` - Generate dependency graph. Direction: deps, rdeps, both. Default: both, depth 1

**Documentation:**

- `dora docs [--type TYPE]` - List all documentation files. Use --type to filter by md or txt
- `dora docs search <query> [--limit N]` - Search through documentation content. Default limit: 20
- `dora docs show <path> [--content]` - Show document metadata and references. Use --content to include full text

**Note:** To find where a symbol/file is documented, use `dora symbol` or `dora file` which show a `documented_in` field.

**Database:**

- `dora schema` - Show database schema (tables, columns, indexes)
- `dora cookbook show [recipe]` - Query patterns with real examples (quickstart, methods, references, exports)
- `dora query "<sql>"` - Execute read-only SQL query against the database

### When to Use Other Tools

- **Read**: For reading file source code
- **Grep**: Only for non-code files or when dora fails
- **Edit/Write**: For making changes
- **Bash**: For running commands/tests

### Quick Workflow

```bash
dora status                      # Check index health
dora treasure                    # Find core files
dora file <path>                 # Understand a file
dora deps/rdeps <path>           # Navigate dependencies
dora symbol <query>              # Find symbols (shows documented_in)
dora refs <symbol>               # Find references
dora docs                        # List all documentation
dora docs search <query>         # Search documentation content
```

For detailed usage and examples, refer to `./dora/docs/SKILL.md`.
