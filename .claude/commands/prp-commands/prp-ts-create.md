# Create TypeScript Component PRP

## Feature: $ARGUMENTS

## Mission

Create a TypeScript-focused PRP for Fast800-Tracker with emphasis on type safety, React 19 patterns, and proper interface definitions.

> This is a specialized variant of `/prp-base-create` with extra focus on TypeScript patterns.

## TypeScript-Specific Research

### 1. Type Analysis
- Review `types.ts` for existing interfaces
- Identify types that need to be created or extended
- Check for reusable generic types
- Map data flow types (props, state, service returns)

### 2. Component Pattern Analysis
- Review similar components for TypeScript patterns
- Note prop interface conventions (`ComponentNameProps`)
- Check event handler typing patterns
- Review hook return type patterns

### 3. Service Layer Patterns
- Check `services/` for async function typing
- Review Firebase operation type patterns
- Note error handling type patterns

## TypeScript PRP Additions

Beyond the base PRP template, include:

### Type Definitions Section
```typescript
// New interfaces to add to types.ts
interface FeatureProps {
  // Required props with types
  requiredProp: string;
  // Optional props
  optionalProp?: number;
  // Event handlers
  onAction: (data: DataType) => void;
}

interface FeatureState {
  // State shape
}
```

### Component Skeleton
```typescript
// components/FeatureName.tsx
import { FC } from 'react';
import { FeatureProps } from '../types';

export const FeatureName: FC<FeatureProps> = ({
  requiredProp,
  optionalProp,
  onAction
}) => {
  // Implementation
};
```

## TypeScript Validation Gates

### Level 1: Type Checking
```bash
npm run type-check
# Should pass with no errors
```

### Level 2: Strict Mode Compliance
- No `any` types (use `unknown` if needed)
- All function parameters typed
- All return types explicit or inferrable
- No type assertions unless documented

### Level 3: Pattern Compliance
- Props interfaces follow `ComponentNameProps` convention
- Event handlers properly typed
- Generics used appropriately
- Discriminated unions for complex state

## Anti-Patterns to Avoid

- **No `any`**: Use specific types or `unknown`
- **No type assertions without comments**: `as` should be justified
- **No implicit any in callbacks**: Type all parameters
- **No optional chaining abuse**: Ensure nullability is intentional

## Output

Save as: `PRPs/{feature-name}.md`

Include explicit TypeScript code examples in the Implementation Tasks section.
