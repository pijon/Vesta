# Create TASK PRP

Generate a focused task list for specific changes with validation.

## Task: $ARGUMENTS

## Analysis Process

### 1. Scope Definition
- Identify all affected files
- Map dependencies within Fast800-Tracker
- Check for side effects on App.tsx state
- Note required type changes

### 2. Pattern Research
- Find similar changes in codebase
- Identify conventions from CLAUDE.md
- Check for helper functions in utils/
- Review component patterns in components/

### 3. User Clarification
- Confirm change scope
- Verify acceptance criteria

## PRP Generation

### Context Section

```yaml
context:
  affected_files:
    - path: [file path]
      changes: [what needs to change]

  patterns:
    - file: components/[SimilarComponent].tsx
      pattern: [pattern to follow]

  types:
    - file: types.ts
      interfaces: [relevant interfaces]

  gotchas:
    - issue: [potential problem]
      solution: [how to handle]
```

### Task Structure

```yaml
Task N:
  action: CREATE/UPDATE/ADD/REMOVE
  file: path/to/file
  details:
    - [specific change]
    - MIRROR pattern from: [reference]
  validation: npm run type-check
  rollback: [undo approach if needed]
```

### Task Sequencing

1. **Type Changes**: Update types.ts first
2. **Service Layer**: Update services/ if needed
3. **Component Changes**: Modify components/
4. **Integration**: Connect to App.tsx state
5. **Validation**: Run full validation suite

### Validation Strategy

- Type check after each file change
- Full lint after component changes
- Build validation at the end

## Output

Save as: `PRPs/task_{task-name}.md`

## Quality Checklist

- [ ] All changes identified
- [ ] Dependencies mapped
- [ ] Each task has validation
- [ ] Follows existing patterns
- [ ] Types properly defined
- [ ] Mobile-first considered
