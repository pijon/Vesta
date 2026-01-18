# Execute BASE PRP

## PRP File: $ARGUMENTS

## Mission: One-Pass Implementation Success

PRPs enable working code on the first attempt through:
- **Context Completeness**: Everything needed, nothing guessed
- **Progressive Validation**: Catch errors early with project-specific checks
- **Pattern Consistency**: Follow existing Fast800-Tracker patterns

**Your Goal**: Transform the PRP into working code that passes all validation gates.

## Project Context

**Tech Stack**: React 19 + Vite + TypeScript + TailwindCSS v4 + Firebase

**Key Directories**:
- `components/` - UI components
- `services/` - Business logic
- `contexts/` - React contexts
- `utils/` - Utility functions

## Execution Process

### 1. Load PRP
- Read the specified PRP file completely
- Absorb all context, patterns, requirements
- Review referenced files and patterns
- Trust the PRP's context - it's designed for one-pass success

### 2. Plan Implementation
- Create implementation plan following the PRP's task order
- Break down into clear todos using TodoWrite tool
- Follow the patterns referenced in the PRP
- Use specific file paths and component names from PRP context
- Never guess - verify patterns in the codebase

### 3. Execute Implementation
- Follow the PRP's Implementation Tasks sequence
- Use the patterns and examples referenced in the PRP
- Create files in locations specified by the PRP
- Apply naming conventions from CLAUDE.md and task specifications

### 4. Progressive Validation

**Execute validation after each major task:**

**Level 1: Syntax & Types**
```bash
npm run lint
npm run type-check
```

**Level 2: Build**
```bash
npm run build
```

**Level 3: Manual Testing**
- Start dev server: `npm run dev`
- Test the implemented feature manually
- Verify mobile responsiveness
- Check component interactions

**Each level must pass before proceeding to the next.**

### 5. Completion Verification
- Work through the Final Validation Checklist in the PRP
- Verify all Success Criteria are met
- Confirm all Anti-Patterns were avoided
- Ensure mobile-first responsive design
- Verify TailwindCSS semantic tokens are used

## Failure Protocol

When validation fails:
1. Read the error message carefully
2. Check the pattern reference in the PRP
3. Review similar components in the codebase
4. Fix and re-run validation

## Common Gotchas

- **State**: App uses centralized state in App.tsx, not Redux/Zustand
- **Types**: All interfaces should be in `types.ts`
- **Styling**: Use TailwindCSS v4 classes with semantic color tokens
- **Firebase**: Use existing patterns in `services/storageService.ts`
- **IDs**: Use `crypto.randomUUID()` for unique identifiers
