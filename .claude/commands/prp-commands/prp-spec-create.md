# Create SPEC PRP (Transformation)

Generate a comprehensive specification-driven PRP for larger transformations.

## Specification: $ARGUMENTS

## Use Case

Use SPEC PRPs for:
- Major refactors affecting multiple components
- Architecture changes
- Migration tasks (e.g., upgrading patterns)
- Transformations with clear before/after states

## Analysis Process

### 1. Current State Assessment
- Map existing implementation in components/services
- Identify pain points or technical debt
- Document integration points with App.tsx
- Note current type definitions

### 2. Desired State Research
- Best practices for target state
- Implementation examples from codebase
- Migration strategies
- Risk assessment

### 3. User Clarification
- Confirm transformation goals
- Priority of objectives
- Acceptable trade-offs

## PRP Generation

### State Documentation

```yaml
current_state:
  files: [list affected files]
  behavior: [how it works now]
  issues: [specific problems]
  types: [current interfaces]

desired_state:
  files: [expected structure]
  behavior: [target functionality]
  benefits: [improvements gained]
  types: [new/modified interfaces]
```

### Hierarchical Objectives

1. **High-Level**: Overall transformation goal
2. **Mid-Level**: Major milestones
3. **Low-Level**: Specific tasks with validation

### Task Specification

**Information-dense keywords:**
- **MIRROR**: Copy pattern from existing code to new location
- **ADD**: Add new code to codebase
- **MODIFY**: Change existing code
- **DELETE**: Remove existing code
- **RENAME**: Rename file/component/function
- **MOVE**: Move code to different location
- **REPLACE**: Replace existing implementation

### Example Task:

```yaml
task_name: Update meal tracking state
  action: MODIFY
  file: App.tsx
  changes:
    - Add new state variable for [feature]
    - Create handler function following existing patterns
    - Wire up to child components
  validation: npm run type-check
  rollback: Revert App.tsx changes
```

### Implementation Strategy

- Identify dependencies between tasks
- Order by: types → services → components → integration
- Include rollback approach for risky changes
- Progressive enhancement where possible

## Output

Save as: `PRPs/spec_{spec-name}.md`

## Quality Checklist

- [ ] Current state fully documented
- [ ] Desired state clearly defined
- [ ] All objectives measurable
- [ ] Tasks ordered by dependency
- [ ] Each task has validation
- [ ] Risks identified with mitigations
- [ ] Rollback strategy for critical changes
- [ ] Integration points with App.tsx noted
