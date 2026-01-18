# Execute TypeScript PRP

## PRP File: $ARGUMENTS

## Mission: Type-Safe Implementation

Execute a TypeScript-focused PRP with emphasis on type safety and React 19 patterns.

> This is a specialized variant of `/prp-base-execute` with extra TypeScript validation.

## Execution Process

### 1. Load & Analyze PRP
- Read the PRP completely
- Pay special attention to type definitions section
- Review interface patterns specified
- Note TypeScript-specific gotchas

### 2. Type-First Implementation

**Order of operations**:
1. Define/extend interfaces in `types.ts` first
2. Implement service layer functions with proper return types
3. Create components with typed props
4. Wire up event handlers with proper typing

### 3. Progressive Type Validation

**After each file change:**
```bash
npm run type-check
```

**After completing a component:**
```bash
npm run lint
npm run type-check
```

### 4. TypeScript Quality Checks

Before marking task complete, verify:
- [ ] No `any` types used
- [ ] All props interfaces defined
- [ ] Event handlers properly typed
- [ ] Return types explicit or properly inferred
- [ ] No TypeScript errors or warnings

### 5. Build Validation
```bash
npm run build
```

## Common TypeScript Issues

### "Property does not exist"
- Check if interface is properly defined
- Verify import of types
- Check for typos in property names

### "Type 'X' is not assignable to type 'Y'"
- Review the expected type
- Check if you need a type guard
- Verify data transformations

### "Object is possibly undefined"
- Add null checks
- Use optional chaining appropriately
- Consider if the type should be non-nullable

## Failure Protocol

When type errors occur:
1. Read the full error message
2. Check the types.ts definitions
3. Review similar typed components
4. Fix at the source (types.ts) not with assertions
