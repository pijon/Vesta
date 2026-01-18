# Create BASE PRP

## Feature: $ARGUMENTS

## PRP Creation Mission

Create a comprehensive PRP that enables **one-pass implementation success** for Fast800-Tracker through systematic research and context curation.

**Critical Understanding**: The executing AI agent only receives:
- The PRP content you create
- Its training data knowledge
- Access to codebase files (but needs guidance on which ones)

**Therefore**: Your research and context curation directly determines implementation success. Incomplete context = implementation failure.

## Project Context

**Tech Stack:**
- React 19 + Vite (SPA, not Next.js)
- TypeScript (Strict mode)
- TailwindCSS v4
- Firebase (Auth + Firestore)
- Google Gemini 2.0 for AI features

**Project Structure (flat, no src/ folder):**
- `App.tsx` - Main component with state management
- `components/` - UI components
- `services/` - Business logic (Firebase, Gemini, LocalStorage)
- `contexts/` - React Contexts (AuthContext)
- `utils/` - Utility functions
- `types.ts` - TypeScript interfaces
- `constants.ts` - App constants

**Key Knowledge Files:**
- `.agent/knowledge/architecture.md` - System architecture
- `.agent/knowledge/data_schema.md` - Core data types
- `.agent/knowledge/ui_colors.md` - Design tokens
- `.agent/knowledge/ui_spacing.md` - Spacing system

## Research Process

> During the research process, create clear tasks and spawn agents as needed. Deeper research = better PRP.

1. **Codebase Analysis**
   - Search for similar features/patterns in components/
   - Identify relevant services in services/
   - Note existing conventions from CLAUDE.md
   - Check existing patterns in similar components
   - Review types.ts for data interfaces

2. **External Research** (if needed)
   - Firebase/Firestore documentation for data operations
   - TailwindCSS v4 patterns for styling
   - React 19 patterns for state and effects
   - Gemini API docs for AI features

3. **User Clarification**
   - Ask for clarification if requirements are ambiguous

## PRP Generation Process

### Step 1: Context Completeness Validation

Before writing, apply the **"No Prior Knowledge" test**:
_"If an agent knew nothing about Fast800-Tracker, would they have everything needed to implement this successfully?"_

### Step 2: Research Integration

Transform your research findings into the PRP:

**Goal Section**: Define specific, measurable Feature Goal and concrete Deliverable
**Context Section**: Populate with research findings - specific file patterns, existing components to reference, gotchas
**Implementation Tasks**: Create dependency-ordered tasks using information-dense keywords
**Validation Gates**: Use project-specific validation commands

### Step 3: Information Density Standards

Ensure every reference is **specific and actionable**:
- File references include specific patterns to follow
- Task specifications include exact naming conventions
- Validation commands are executable (`npm run lint`, `npm run type-check`, `npm run build`)

### Step 4: Plan Before Writing

After research completion, create comprehensive PRP writing plan:
- Plan how to structure each section with your research findings
- Identify gaps that need additional research
- Create systematic approach to filling PRP with actionable context

## PRP Template Structure

```markdown
# PRP: [Feature Name]

## Goal
**Feature Goal**: [What this feature accomplishes]
**Deliverable**: [Concrete output - component, service, etc.]
**Success Definition**: [How we know it's done]

## Context

### Relevant Files
```yaml
existing_patterns:
  - file: components/[SimilarComponent].tsx
    pattern: [What to follow]
  - file: services/[relevantService].ts
    pattern: [How it's used]

types:
  - file: types.ts
    interfaces: [Relevant interfaces]

styling:
  - reference: .agent/knowledge/ui_colors.md
  - reference: .agent/knowledge/ui_spacing.md
```

### Gotchas
- [Common pitfalls to avoid]
- [Project-specific constraints]

## Implementation Tasks

### Task 1: [Description]
**Action**: CREATE/UPDATE/ADD
**File**: [path/to/file]
**Details**:
- [Specific implementation steps]
- [Pattern to follow from existing code]

**Validation**: `npm run type-check`

### Task 2: [Description]
...

## Validation Gates

### Level 1: Syntax & Types
- `npm run lint`
- `npm run type-check`

### Level 2: Build
- `npm run build`

### Level 3: Manual Testing
- [Specific test scenarios]

## Final Checklist
- [ ] All tasks completed
- [ ] Types properly defined
- [ ] Follows existing component patterns
- [ ] Mobile-responsive (mobile-first)
- [ ] Uses semantic color tokens
```

## Output

Save as: `PRPs/{feature-name}.md`

## Quality Gates

### Context Completeness
- [ ] Passes "No Prior Knowledge" test
- [ ] All file references are specific and accessible
- [ ] Implementation tasks include exact naming and placement
- [ ] Validation commands are project-specific

### Information Density
- [ ] No generic references - all are specific and actionable
- [ ] File patterns point to specific examples
- [ ] Task specifications use information-dense keywords

## Success Metrics

**Confidence Score**: Rate 1-10 for one-pass implementation success likelihood
**Target**: Minimum 8/10 before PRP approval

**Validation**: The completed PRP should enable an AI agent unfamiliar with Fast800-Tracker to implement the feature successfully using only the PRP content and codebase access.
