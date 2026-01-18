# Execute SPEC PRP

Implement a specification/transformation using an existing SPEC PRP.

## PRP File: $ARGUMENTS

## Execution Process

### 1. Understand Specification
- Review current state analysis
- Understand desired state goals
- Map task dependencies

### 2. Plan Implementation
- Think through the transformation carefully
- Break down complex tasks into smaller steps
- Use TodoWrite to track progress
- Identify patterns from existing code to follow

### 3. Execute Tasks

Follow task order from the PRP:

**For each task:**
1. Review the task requirements
2. Check referenced patterns
3. Implement the change
4. Run validation immediately

```bash
npm run type-check
```

5. Fix any issues before proceeding

### 4. Verify Transformation

After all tasks:
```bash
npm run lint
npm run type-check
npm run build
```

- Confirm desired state achieved
- Test affected functionality
- Verify App.tsx integration works

## Rollback Protocol

If a task causes major issues:
1. Revert to last working state
2. Review the task specification
3. Check similar implementations
4. Try again with adjusted approach

## Completion

- Work through quality checklist from PRP
- Verify transformation goals met
- Ensure no regressions introduced
