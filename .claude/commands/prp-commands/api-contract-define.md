# Define Firebase Data Contract

Define the data structure and operations for a Firebase/Firestore feature.

## Feature: $ARGUMENTS

## Purpose

Use this command when planning:
- New Firestore collections
- Changes to existing data structures
- Firebase Auth integration points
- Real-time data sync requirements

## Data Contract Definition

### 1. Firestore Collection Structure

```typescript
// Collection: [collection_name]
// Document ID: [strategy - e.g., crypto.randomUUID(), date string, etc.]

interface CollectionDocument {
  id: string;           // Document ID
  userId: string;       // Owner (from AuthContext)
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Domain-specific fields
  [field]: [type];
}
```

### 2. TypeScript Interface (for types.ts)

```typescript
interface FeatureName {
  id: string;
  // ... fields matching Firestore structure
}
```

### 3. Service Layer Operations

```typescript
// services/[feature]Service.ts or add to storageService.ts

// Create
async function createFeature(data: FeatureInput): Promise<Feature>

// Read
async function getFeature(id: string): Promise<Feature | null>
async function getUserFeatures(userId: string): Promise<Feature[]>

// Update
async function updateFeature(id: string, data: Partial<Feature>): Promise<void>

// Delete
async function deleteFeature(id: string): Promise<void>
```

### 4. Real-time Sync (if needed)

```typescript
// For real-time updates
function subscribeToFeature(
  id: string,
  callback: (data: Feature) => void
): () => void  // Returns unsubscribe function
```

### 5. Validation Rules

```typescript
// Client-side validation before Firebase write
const validateFeature = (data: FeatureInput): ValidationResult => {
  // Required fields
  // Value constraints
  // Type checks
}
```

### 6. Security Considerations

- All operations require authenticated user
- Users can only access their own data (userId match)
- Sensitive data should not include PII beyond what's necessary

## Integration Points

### App.tsx State
```typescript
// State additions
const [features, setFeatures] = useState<Feature[]>([]);

// Handler functions
const handleAddFeature = async (data: FeatureInput) => { ... }
const handleUpdateFeature = async (id: string, data: Partial<Feature>) => { ... }
```

### Existing Services
- Extend `storageService.ts` for basic CRUD
- Or create new `services/[feature]Service.ts` for complex operations

## Output

Save as: `PRPs/contracts/{feature}-data-contract.md`

## Checklist

- [ ] Firestore collection structure defined
- [ ] TypeScript interface added to types.ts
- [ ] Service operations specified
- [ ] App.tsx integration points identified
- [ ] Validation rules defined
- [ ] Security considerations noted
