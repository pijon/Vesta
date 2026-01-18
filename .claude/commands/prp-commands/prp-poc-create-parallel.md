# Create POC Variations

Create multiple proof-of-concept approaches for exploring a feature idea.

## Request: $ARGUMENTS

Usage: `/prp-poc-create-parallel [number_of_variations] "[problem_statement]"`
Example: `/prp-poc-create-parallel 3 "explore different layouts for the meal planning view"`

## Purpose

Use this for:
- Exploring different UI/UX approaches
- Comparing implementation strategies
- Validating design decisions before committing
- Rapid prototyping of feature ideas

## POC Creation Process

### 1. Problem Analysis

Parse the problem statement:
- Core user need
- Key interactions required
- Constraints from existing Fast800-Tracker patterns

### 2. Design Variation Matrix

For N variations requested, create different approaches:

**Example Variations:**
```yaml
POC 1 - Minimal:
  ui_approach: Clean, simple, content-focused
  focus: Core functionality only

POC 2 - Feature-Rich:
  ui_approach: Full-featured with all options visible
  focus: Power user workflows

POC 3 - Mobile-Optimized:
  ui_approach: Touch-first, gesture-based
  focus: Mobile user experience
```

### 3. POC Specification

For each variation, define:

```yaml
poc_name: poc-{feature}-{variant}
approach: [description of this approach]
components:
  - [components to create]
unique_aspects: [what makes this approach different]
trade_offs: [pros and cons of this approach]
```

### 4. Project Structure

```
components/
├── poc-{feature}-minimal/
│   └── [POC 1 components]
├── poc-{feature}-rich/
│   └── [POC 2 components]
└── poc-{feature}-mobile/
    └── [POC 3 components]
```

## PRP Output

Generate a PRP for each variation:

```markdown
# POC PRP: [Feature] - [Variant]

## Goal
Explore [specific approach] for [feature]

## Approach
[Description of this variation's strategy]

## Components
- [List of components to create]

## Implementation Tasks
[Standard task format]

## Validation
- Component renders without errors
- Matches intended approach
- Uses existing Fast800-Tracker patterns
```

## Output

Save as: `PRPs/poc-{feature}-{variant}.md` for each variation

## Success Criteria

- [ ] Each POC explores a meaningfully different approach
- [ ] All POCs follow Fast800-Tracker patterns
- [ ] Each POC can be evaluated independently
- [ ] Clear trade-offs documented for decision making
