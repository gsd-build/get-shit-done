---
name: custom:deep-debug
description: Systematic 4-phase debugging for complex bugs. Use instead of /gsd:debug for intermittent, cross-module, or root-cause-unclear bugs. Adapted from Superpowers systematic-debugging + root-cause-tracing + verification-before-completion skills.
argument-hint: "<bug-description>"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task, WebSearch
---

# Systematic Deep Debugging

> Adapted from [Superpowers](https://github.com/obra/superpowers) systematic-debugging, root-cause-tracing, and verification-before-completion skills.
> Use this INSTEAD OF `/gsd:debug` for complex bugs.

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

If you haven't completed Phase 1, you CANNOT propose fixes.

## Input Validation

If `$ARGUMENTS` is empty:
- Print: "Usage: /custom:deep-debug <bug-description>. Example: /custom:deep-debug 'login fails intermittently after auth refactor'"
- STOP. Do not proceed.

## When to Use This (Not /gsd:debug)

| Situation | Use This | Use /gsd:debug |
|-----------|----------|---------------|
| Intermittent bug (sometimes works) | YES | NO |
| Cross-module bug (multiple files) | YES | NO |
| Regression (was working before) | YES | NO |
| Root cause unclear | YES | NO |
| 2+ failed fix attempts | YES | NO |
| Simple, obvious, single-file bug | NO | YES |
| Clear error message, obvious fix | NO | YES |

## Bug Report: $ARGUMENTS

## Phase 1: Root Cause Investigation

**BEFORE attempting ANY fix:**

### 1.1 Read Error Messages Carefully
- Don't skip past errors or warnings
- Read stack traces COMPLETELY
- Note line numbers, file paths, error codes
- They often contain the exact solution

### 1.2 Reproduce Consistently
```
Steps to reproduce:
1. [exact step]
2. [exact step]
3. [exact step]

Expected: [what should happen]
Actual: [what happens]
Reproducible: [always / sometimes / conditions]
```

**"Sometimes happens" is NOT acceptable.** Find the exact conditions:
- Which data combination?
- Which sequence of operations?
- Which environment/config?

### 1.3 Check Recent Changes
```bash
# What changed recently?
git log --oneline -20
git diff HEAD~5 --stat

# Any new dependencies?
git diff HEAD~5 -- package.json

# Config changes?
git diff HEAD~5 -- '*.config.*' '.env*' 'tsconfig*'
```

### 1.4 Gather Evidence at Component Boundaries

**For multi-component systems, add diagnostic logging BEFORE proposing fixes:**

```
For EACH component boundary:
  - Log what data enters
  - Log what data exits
  - Verify environment/config propagation
  - Check state at each layer

Run once → gather evidence → identify failing component → investigate THAT component
```

### 1.5 Trace Data Flow (Root Cause Tracing)

When bug is deep in call stack:

1. **Observe symptom:** Where does the error appear?
2. **Find immediate cause:** What code directly causes this?
3. **Ask "What called this?"** Trace one level up
4. **Keep tracing up** until you find the original trigger
5. **Fix at SOURCE, not at symptom**

```
Error appears at: [file:line]
  ← called by: [file:line]
    ← called by: [file:line]
      ← called by: [file:line] ← ROOT CAUSE HERE
```

**NEVER fix just where the error appears.** Trace back to find the original trigger.

## Phase 2: Pattern Analysis

### 2.1 Find Working Examples
- Locate similar WORKING code in the same codebase
- What works that's similar to what's broken?

### 2.2 Compare Against References
- If implementing a pattern, read reference implementation COMPLETELY
- Don't skim - read every line

### 2.3 Identify Differences
- List EVERY difference between working and broken, however small
- Don't assume "that can't matter"

### 2.4 Understand Dependencies
- What other components does this need?
- What settings, config, environment?
- What assumptions does it make?

## Phase 3: Hypothesis and Testing

### 3.1 Form Single Hypothesis
```
HYPOTHESIS: "[specific root cause]"
EVIDENCE: "[what supports this]"
TEST: "[smallest change to verify]"
```

### 3.2 Test Minimally
- SMALLEST possible change to test hypothesis
- ONE variable at a time
- DON'T fix multiple things at once

### 3.3 Evaluate Result
- Worked? → Phase 4
- Didn't work? → Form NEW hypothesis from what you learned
- DON'T add more fixes on top

### 3.4 The 3-Fix Rule

**If 3+ fixes have failed: STOP. Question the architecture.**

Pattern indicating architectural problem:
- Each fix reveals new shared state/coupling/problem in different place
- Fixes require "massive refactoring"
- Each fix creates new symptoms elsewhere

**→ Report findings to user. This is NOT a failed hypothesis - this is a wrong architecture.**

## Phase 4: Fix and Verify

### 4.1 Create Failing Test
```bash
# Write test that reproduces the bug
# This test MUST FAIL before fix
npm test -- --filter="bug-reproduction"
# Expected: FAIL (proves test catches the bug)
```

### 4.2 Implement Single Fix
- Address ROOT CAUSE (not symptom)
- ONE change at a time
- No "while I'm here" improvements

### 4.3 Verify Fix (Evidence Before Claims)

**The Gate Function (from Superpowers verification-before-completion):**

```
BEFORE claiming "fixed":
1. IDENTIFY: What command proves this?
2. RUN: Execute the FULL command (fresh, complete)
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
   - NO → State actual status with evidence
   - YES → State claim WITH evidence
5. ONLY THEN: Claim it's fixed
```

**NO "should work now." NO "looks correct." RUN THE COMMAND.**

```bash
# Regression test passes?
npm test -- --filter="bug-reproduction"
# Expected: PASS

# All other tests still pass?
npm test
# Expected: ALL PASS

# No new warnings/errors?
npm run type-check
# Expected: 0 errors
```

### 4.4 Document Fix

Update STATE.md (or relevant doc):
```markdown
### Bug Fix: [description]
- **Root cause:** [what actually caused it]
- **Fix:** [what was changed]
- **Regression test:** [test file/name]
- **Phase/commit:** [reference]
```

### 4.5 Add Defense-in-Depth

After fixing root cause, add validation at multiple layers:
- Layer 1: Input validation at entry point
- Layer 2: Assertion at the source function
- Layer 3: Guard at the symptom location
- Layer 4: Monitoring/logging for detection

## Red Flags - STOP and Return to Phase 1

- "Quick fix for now, investigate later"
- "Just try changing X and see"
- "Add multiple changes, run tests"
- "I don't fully understand but this might work"
- "Proposing solutions before tracing data flow"
- "One more fix attempt" (when 2+ already tried)
- Each fix reveals new problem in different place

**ALL of these mean: STOP. Return to Phase 1.**

## Exit Criteria

Debug is COMPLETE only when ALL are true:

- [ ] Bug deterministically reproduced
- [ ] Root cause identified AND proven (not just theory)
- [ ] Fix implemented (at source, not symptom)
- [ ] Regression test written and GREEN
- [ ] All other tests still GREEN
- [ ] Type check passes
- [ ] Fix verified by running actual commands (not "should work")
- [ ] STATE.md updated with bug documentation
- [ ] Defense-in-depth layers added where appropriate

## Output Format

```markdown
## Deep Debug Report: $ARGUMENTS

### Root Cause
[What actually caused the bug - proven, not theorized]

### Fix Applied
[What was changed and why]

### Evidence
- Regression test: [test name] → PASS
- Full test suite: [N/N] → ALL PASS
- Type check: 0 errors

### Commits
- [hash]: test(debug): add regression test for [bug]
- [hash]: fix(debug): [root cause fix description]

### Defense-in-Depth
- Layer 1: [validation added]
- Layer 2: [guard added]
```
