# Initialize Task List from PRP

Create a detailed task checklist from an existing PRP.

## PRP File: $ARGUMENTS

## Process

1. **Ingest PRP**
   - Read the PRP completely
   - Understand the feature/task scope
   - Note all implementation tasks

2. **Analyze Codebase Context**
   - Review affected files
   - Check existing patterns
   - Verify referenced components exist

3. **Create Task Checklist**

Generate a detailed task list in `PRPs/checklist.md`:

### Task Format

Use information-dense keywords:
- **ADD**: Add new code
- **CREATE**: Create new file
- **MODIFY**: Change existing code
- **MIRROR**: Copy pattern from existing code
- **FIND**: Locate specific code
- **EXECUTE**: Run a command
- **KEEP**: Preserve existing behavior
- **PRESERVE**: Don't change specific parts

### Checklist Structure

```yaml
# Task Checklist: [PRP Name]

## Task 1: [Description]
STATUS: [ ]
ACTION: MODIFY components/[Component].tsx
DETAILS:
  - FIND: pattern "existing code marker"
  - ADD: new functionality after marker
  - PRESERVE: existing props interface
VALIDATION: npm run type-check

## Task 2: [Description]
STATUS: [ ]
ACTION: CREATE components/[NewComponent].tsx
DETAILS:
  - MIRROR: pattern from components/[ExistingComponent].tsx
  - MODIFY: component name and core logic
  - KEEP: error handling pattern identical
VALIDATION: npm run type-check

## Task 3: [Description]
...
```

### Status Tracking

Mark completed tasks:
```yaml
STATUS: [DONE]  # When completed
STATUS: [ ]     # When pending
```

## Output

Save as: `PRPs/checklist.md`

## Usage

After creating the checklist:
1. Work through tasks sequentially
2. Mark each as [DONE] when validated
3. Run full validation after all tasks complete
