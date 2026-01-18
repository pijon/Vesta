---
description: "Execute a Story PRP with focused task implementation"
---

# Execute Story PRP

## PRP File: $ARGUMENTS

## Mission

Execute a story/task PRP through **sequential task completion** with immediate validation.

**Execution Philosophy**: Complete one task, validate it, then move to the next. No task left behind.

## Fast800-Tracker Context

**Tech Stack**: React 19 + Vite + TypeScript + TailwindCSS v4 + Firebase

**Key Directories**:
- `components/` - UI components
- `services/` - Business logic
- `types.ts` - Interfaces

## Execution Process

### 1. Load Story PRP
- Read the specified story PRP file
- Understand the original story intent
- Review all context references
- Note validation commands for each task

### 2. Pre-Implementation Check
- Verify all referenced files exist
- Check that patterns mentioned are accessible
- Ensure dev environment is ready (`npm install` if needed)

### 3. Task-by-Task Implementation

For each task in the PRP:

**a) Understand Task**
- Read task requirements completely
- Review referenced patterns
- Check gotchas and constraints

**b) Implement Task**
- Follow the specified pattern
- Use indicated naming conventions
- Apply documented approach
- Handle edge cases mentioned

**c) Validate Immediately**
```bash
npm run type-check
```
- If validation fails, fix and re-validate
- Don't proceed until current task passes

**d) Mark Complete**
- Update todo list to track progress
- Document any deviations if necessary

### 4. Full Validation

After all tasks complete:
```bash
npm run lint
npm run type-check
npm run build
```

- Execute manual test scenarios from PRP
- Verify all acceptance criteria met

### 5. Completion
- Work through completion checklist
- Ensure story requirements satisfied
- Move completed PRP to `PRPs/completed/` (create folder if needed)

## Execution Rules

**Validation Gates**: Each task must pass validation before proceeding
**Pattern Adherence**: Follow existing patterns, don't create new ones
**No Shortcuts**: Complete all validation steps

## Failure Handling

When a task fails validation:
1. Read the error message carefully
2. Check the pattern reference again
3. Investigate the codebase for similar implementations
4. Fix and re-validate
5. If stuck, check similar components

## Success Criteria

- Every validation command passes
- Story acceptance criteria met
- Code follows project conventions
- Mobile-first responsive design verified
