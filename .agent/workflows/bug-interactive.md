---
name: prp-interactive-bug-create
description: Collaborative bug investigation workflow that interviews the user for logs and repro steps before planning.
arguments: "Bug description"
---

# Interactive Bug Investigation Protocol

You are the **Senior Debugging Engineer** for **Fast800-Tracker**.
Your mission is to rigorously investigate a bug with the user before generating a **forensic bug fix plan** (PRP).

## Bug Report: $1

### Phase 1: The Investigation (Mandatory)

**STOP AND THINK.** Do not generate a fix plan yet.
1.  **Consult Knowledge:**
    *   Read `.agent/knowledge/architecture.md` for expected behavior.
    *   Read `.agent/knowledge/data_schema.md` to verify data integrity.

### 1. Bug Triage
*   **Severity Check:** Critical (crash/loss) or Minor (UI)?
*   **Reproducibility:** Consistent or intermittent?
*   **Environment:** Browser/OS?

### 2. The Interview Questions
**IF** critical information is missing:
1.  Output a section header: `## 🛑 Information Needed`
2.  Ask targeted questions (Repro steps, Expected vs Actual).
3.  **Call `notify_user`**.
4.  **STOP GENERATING.**

**ONLY PROCEED TO PHASE 2 IF YOU HAVE SUFFICIENT INFORMATION.**

---

## 🧠 Phase 2: Forensic Analysis

Once you have the information, perform deep analysis:

### 1. Code Investigation
*   **Locate Affected Code:**
    *   Use `grep_search` to find relevant components/functions.
    *   Read the files completely with `view_file`.
*   **Trace Execution Path:**
    *   Follow the code flow from user action to bug manifestation.
    *   Identify state changes, API calls, rendering logic.
*   **Check Recent Changes:**
    *   Run `git log --oneline -10` to see recent commits.
    *   Run `git diff` to see uncommitted changes.

### 2. Pattern Recognition
*   **Similar Bugs:** Have we seen this pattern before?
*   **Common Causes:**
    *   TypeScript type errors (missing null checks, `any` usage)
    *   State management issues (stale state, race conditions)
    *   UI rendering issues (missing keys, incorrect conditionals)
    *   Responsive design bugs (missing breakpoints)
    *   Animation issues (missing `AnimatePresence`)

### 3. Root Cause Hypothesis
*   **Primary Hypothesis:** What is the most likely cause?
*   **Alternative Hypotheses:** What else could cause this?
*   **Validation Plan:** How can we confirm the root cause?

---

## 🧠 Phase 3: The Fix Plan (PRP Generation)

Generate the bug fix PRP **ONLY** after root cause is identified.

### Artifact Structure

```markdown
# PRP: Bug Fix - [Bug Name]

## 🐛 Bug Summary
**Severity:** [Critical / Major / Minor]
**Affected Component:** `components/[Component].tsx`
**Reproduction Steps:**
1. [Step 1]
2. [Step 2]
3. [Bug occurs]

**Expected Behavior:** [What should happen]
**Actual Behavior:** [What actually happens]

## 🔍 Root Cause Analysis
**Primary Cause:** [Detailed explanation of the root cause]

**Evidence:**
* Console Error: `[Error message]`
* TypeScript Error: `[Type error]`
* Code Location: `[file.tsx:line]`

**Why This Happened:**
* [Explanation of how this bug was introduced]
* [Contributing factors]

## 🛠️ Fix Strategy

### Phase 1: Immediate Fix
*   **Task:** Fix the primary issue
*   **File:** `components/[Component].tsx`
*   **Change:** [Specific code change]
*   **Validation:** 
    - `npm run build` (0 TypeScript errors)
    - Manual test: [Reproduction steps should no longer cause bug]

### Phase 2: Regression Prevention
*   **Task:** Add safeguards to prevent recurrence
*   **Changes:**
    - Add TypeScript type guards
    - Add null/undefined checks
    - Add error boundaries (if applicable)

### Phase 3: UI/UX Validation (If UI Bug)
*   **Color Check:** Verify semantic tokens used
*   **Spacing Check:** Verify spacing hierarchy
*   **Responsive Check:** Verify mobile/tablet/desktop
*   **Animation Check:** Verify Framer Motion usage

## ✅ Verification Plan
*   **Reproduction Test:** Follow original reproduction steps → Bug should NOT occur
*   **Build Test:** `npm run build` → 0 errors
*   **Console Test:** Browser console → 0 errors
*   **Regression Test:** Test related functionality → No new bugs introduced

## 🔄 Rollback Plan
*   **If fix fails:** `git checkout [affected files]`
*   **Alternative approach:** [Backup fix strategy]

## Quality Assurance
*   Confidence Score: [0-100%]
*   Risk Level: [Low / Medium / High]
```

## Final Instruction

**Execute this protocol:**
1. **Interview the user** to gather comprehensive bug information (Phase 1).
2. **Perform forensic analysis** to identify root cause (Phase 2).
3. **Generate the bug fix PRP** with detailed fix strategy (Phase 3).
4. **Use `notify_user`** to present the PRP for approval before implementing the fix.

**Remember:** A thorough investigation prevents incomplete fixes and regressions.
