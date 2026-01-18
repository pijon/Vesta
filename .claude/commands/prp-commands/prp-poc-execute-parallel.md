# Execute POC Variations

Build multiple POC variations from existing POC PRPs.

## POC Pattern: $ARGUMENTS

Usage: `/prp-poc-execute-parallel "PRPs/poc-{feature}-*"`
Example: `/prp-poc-execute-parallel "PRPs/poc-meal-layout-*"`

## Execution Process

### 1. Discover POC PRPs

Find all POC PRPs matching the pattern:
- List matching files
- Note the different variations
- Plan execution order

### 2. Setup Structure

Create POC directories:
```
components/
├── poc-{feature}-{variant1}/
├── poc-{feature}-{variant2}/
└── poc-{feature}-{variant3}/
```

### 3. Execute Each POC

For each POC PRP:

**a) Read PRP**
- Understand the specific approach
- Note unique aspects of this variation

**b) Implement**
- Create components following the PRP
- Use Fast800-Tracker patterns
- Keep POC isolated in its directory

**c) Validate**
```bash
npm run type-check
npm run build
```

### 4. Integration (Optional)

If comparing POCs in the app:

```typescript
// Create a POC showcase route or toggle
// Allow switching between variations for comparison
```

## Validation Checklist

For each POC:
- [ ] Builds without errors
- [ ] Types are correct
- [ ] Follows existing patterns
- [ ] Demonstrates intended approach clearly

## Comparison

After all POCs are built:
- Document observations for each approach
- Note trade-offs discovered during implementation
- Recommend preferred approach with reasoning

## Output

- Implemented POC components in their directories
- Comparison notes in `PRPs/poc-{feature}-comparison.md`
