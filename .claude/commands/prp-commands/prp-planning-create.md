# Create PLANNING PRP (PRD)

Transform rough ideas into comprehensive Product Requirements Documents for Fast800-Tracker features.

## Idea: $ARGUMENTS

## Use Case

Use PLANNING PRPs for:
- New major features before implementation
- Complex features needing design exploration
- Features requiring user research or market analysis
- Epic-level planning

## Discovery Process

### 1. Concept Expansion
- Break down the core idea
- Define success criteria
- Map to Fast800-Tracker's purpose (health/diet tracking)

### 2. Research (if needed)
- Similar features in competing health apps
- Best practices for health/fitness UX
- Technical feasibility within current stack

### 3. User Research & Clarification
Ask user for:
- Target user persona (casual dieter, strict tracker, etc.)
- Key pain points being solved
- Success metrics
- Constraints/requirements

## PRD Generation

### Visual Documentation Plan

```yaml
diagrams_needed:
  user_flows:
    - Happy path journey
    - Error scenarios

  data_model:
    - New interfaces for types.ts
    - State changes in App.tsx

  component_hierarchy:
    - New components needed
    - Existing components affected
```

### User Story Development

```markdown
## Epic: [High-level feature]

### Story 1: [User need]
**As a** Fast800 user
**I want** [capability]
**So that** [benefit - relates to diet/health goal]

**Acceptance Criteria:**
- [ ] Specific behavior
- [ ] Edge case handling
- [ ] Mobile-first design

**Technical Notes:**
- Component: components/[NewComponent].tsx
- State: App.tsx changes needed
- Types: types.ts additions
```

### Implementation Strategy

1. **Phase 1**: Core types and interfaces
2. **Phase 2**: Service layer (Firebase/Gemini integration)
3. **Phase 3**: UI components
4. **Phase 4**: Integration with App.tsx

### Technical Considerations

**Fast800-Tracker Specifics:**
- State lives in App.tsx (no Redux)
- Firebase for persistence (storageService.ts)
- Gemini for AI features (geminiService.ts)
- TailwindCSS v4 for styling
- Mobile-first responsive design

## Output Structure

```markdown
# PRD: [Feature Name]

## 1. Executive Summary
## 2. Problem & Solution
## 3. User Stories
## 4. Data Model (types.ts additions)
## 5. Component Architecture
## 6. State Management (App.tsx changes)
## 7. Firebase Integration
## 8. Implementation Phases
## 9. Success Metrics
## 10. Open Questions
```

Save as: `PRPs/{feature-name}-prd.md`

## Quality Checklist

- [ ] Problem clearly articulated
- [ ] Solution addresses problem
- [ ] User flows documented
- [ ] Data model defined (types.ts)
- [ ] Component hierarchy clear
- [ ] App.tsx integration planned
- [ ] Firebase operations identified
- [ ] Mobile-first considered
- [ ] Ready for implementation PRP
