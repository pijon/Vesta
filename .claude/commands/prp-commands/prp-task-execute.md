# Execute TASK PRP

Run through a task list from an existing TASK PRP.

## PRP File: $ARGUMENTS

## Execution Process

### 1. Load Tasks
- Read task list completely
- Understand context and dependencies
- Note validation commands

### 2. Execute Each Task

For each task:

**Perform Action**
- Follow the specified action (CREATE/UPDATE/ADD/REMOVE)
- Use the patterns referenced
- Apply naming conventions

**Validate**
```bash
npm run type-check
```

**Fix Issues**
- If validation fails, fix before proceeding
- Check pattern references if stuck

### 3. Final Validation

After all tasks:
```bash
npm run lint
npm run type-check
npm run build
```

### 4. Complete Checklist
- Verify all tasks done
- Run manual tests if specified
- Confirm no regressions

Work through tasks sequentially, validating each.
