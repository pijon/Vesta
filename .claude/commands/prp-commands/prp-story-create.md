---
description: "Convert user story/task into executable PRP with Fast800-Tracker codebase analysis"
---

# Create Story PRP from User Story/Task

## Story/Task: $ARGUMENTS

## Mission

Transform a user story or task into a **tactical implementation PRP** through systematic codebase analysis and task decomposition.

We do not write any code in this step. The goal is to create a detailed, context-engineered implementation plan for the executing agent.

**Key Principle**: Gather full context about the story/task before proceeding with analysis.

## Fast800-Tracker Context

**Tech Stack**: React 19 + Vite + TypeScript + TailwindCSS v4 + Firebase + Gemini

**Project Structure**:
- `App.tsx` - Main state management
- `components/` - UI components (widgets, views, modals)
- `services/` - Business logic (storageService, geminiService)
- `contexts/` - React contexts (AuthContext)
- `types.ts` - All TypeScript interfaces
- `constants.ts` - App constants

**Key Knowledge Files**:
- `.agent/knowledge/architecture.md`
- `.agent/knowledge/data_schema.md`
- `.agent/knowledge/ui_colors.md`
- `.agent/knowledge/ui_spacing.md`

## Analysis Process

### Phase 1: Story Decomposition

Analyze the story to determine:
- **Story/Task Type**: Feature / Bug / Enhancement / Refactor
- **Complexity**: Low / Medium / High
- **Affected Areas**: Which components/services need changes

### Phase 2: Codebase Intelligence Gathering

**1. Project Structure Analysis**
- Map where changes need to go (components/, services/, etc.)
- Identify integration points with App.tsx state
- Check relevant configuration

**2. Pattern Recognition**
- Search for similar implementations in codebase
- Check CLAUDE.md for conventions
- Review existing component patterns
- Note anti-patterns to avoid

**3. Type Analysis**
- Review `types.ts` for relevant interfaces
- Identify types to create or extend
- Check service return types

**4. Testing Patterns**
- Identify validation commands
- Note manual testing scenarios

**5. Integration Points**
- Files that need updates
- New files to create and where
- State connections to App.tsx

### Phase 3: Deep Analysis

Think hard about everything learned during research phases. Consider:
- Data flow through the application
- State management implications
- UI/UX patterns from existing components
- Mobile-first considerations

### Phase 4: PRP Task Generation

Transform analysis into concrete tasks.

**Task Rules**:
1. Each task is atomic and independently testable
2. Tasks are ordered by dependency
3. Use information-dense action verbs: CREATE, UPDATE, ADD, REMOVE, REFACTOR, MIRROR
4. Include specific implementation details from codebase analysis
5. Every task has an executable validation command

**Task Action Types**:
- **CREATE**: New files/components
- **UPDATE**: Modify existing files
- **ADD**: Insert new functionality into existing code
- **REMOVE**: Delete deprecated code
- **REFACTOR**: Restructure without changing behavior
- **MIRROR**: Copy existing pattern from elsewhere in codebase

### Phase 5: Validation Design

For each task, design validation that:
- Can run immediately after task completion
- Provides clear pass/fail feedback
- Uses project-specific commands (`npm run lint`, `npm run type-check`, `npm run build`)

## PRP Template

```markdown
# Story PRP: [Story Title]

## Story
**Type**: Feature / Bug / Enhancement
**Complexity**: Low / Medium / High

## Context

### Affected Files
- [List files to modify/create]

### Relevant Patterns
- [Reference similar components]

### Types
- [Interfaces to create/extend]

### Gotchas
- [Project-specific pitfalls]

## Implementation Tasks

### Task 1: [Description]
**Action**: CREATE/UPDATE/ADD
**File**: [path]
**Details**:
- [Specific steps]
- MIRROR pattern from: [existing file]

**Validation**: `npm run type-check`

### Task 2: [Description]
...

## Validation Gates
- `npm run lint`
- `npm run type-check`
- `npm run build`
- [Manual testing scenarios]

## Completion Checklist
- [ ] All tasks completed
- [ ] Types properly defined
- [ ] Follows existing patterns
- [ ] Mobile-responsive
```

## Output

Save as: `PRPs/story_{kebab-case-summary}.md`

## Success Metrics

**Implementation Ready**: Another agent could execute these tasks without additional context
**Validation Complete**: Every task has at least one working validation command
**Pattern Consistent**: Tasks follow existing codebase conventions
