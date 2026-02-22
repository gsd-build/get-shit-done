---
name: custom:tdd-enforce
description: Enforce TDD discipline on GSD plans. Run after /gsd:plan-phase to validate all tasks have TDD blocks. Adapted from Superpowers test-driven-development skill.
argument-hint: "[phase-number]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# TDD Enforcement Protocol

> Adapted from [Superpowers](https://github.com/obra/superpowers) `test-driven-development` skill.
> Integrated with GSD XML task format.

## The Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Write code before the test? **Delete it. Start over.**

- Don't keep it as "reference"
- Don't "adapt" it while writing tests
- Don't look at it
- Delete means delete

## When This Command Runs

After `/gsd:plan-phase $ARGUMENTS` completes, validate all PLAN.md files in the phase.

## Execution Steps

### 0. Validate Input

If `$ARGUMENTS` is empty or not a number:
- Print: "Usage: /custom:tdd-enforce [phase-number]. Example: /custom:tdd-enforce 1"
- STOP. Do not proceed.

If `.planning/phases/` directory does not exist:
- Print: "No phases found. Run /gsd:plan-phase first."
- STOP. Do not proceed.

### 1. Find Plan Files

```bash
# Use zero-padded pattern match (not fragile sed index)
PHASE_NUM=$(printf "%02d" $ARGUMENTS 2>/dev/null)
PHASE_DIR=$(ls -d .planning/phases/${PHASE_NUM}-* 2>/dev/null | head -1)
if [ -z "$PHASE_DIR" ]; then
  echo "Phase $ARGUMENTS not found. Available phases:"
  ls -d .planning/phases/*-* 2>/dev/null
  exit 1
fi
echo "Checking: $PHASE_DIR"
ls "$PHASE_DIR"/*-PLAN.md 2>/dev/null
```

### 2. Validate Each Plan

For every PLAN.md in the phase directory, check each `<task>` block:

**REQUIRED for every `type="auto"` task that creates/modifies code:**

```xml
<task type="auto" tdd="true">
  <n>Task name</n>
  <files>src/feature.ts, src/feature.test.ts</files>
  <behavior>
    - Test 1: describe expected behavior
    - Test 2: describe edge case
    - Test 3: describe error case
  </behavior>
  <implementation>
    Minimal code to pass tests. No YAGNI.
  </implementation>
  <verify>pnpm test -- --filter=feature && pnpm type-check</verify>
  <done>All tests green, type-check passes</done>
</task>
```

**VIOLATIONS to flag:**
- [ ] Task creates code but `tdd="true"` is missing
- [ ] Task has no `<behavior>` block (test specifications)
- [ ] Task has no test file in `<files>` list
- [ ] `<verify>` tag has no test command (only manual verification)
- [ ] `<implementation>` comes before `<behavior>` in the XML

### 3. Fix Violations

For each violation found:

1. Add `tdd="true"` attribute to the task
2. Add `<behavior>` block with test specifications derived from `<action>` or `<n>`
3. Add test file to `<files>` (e.g., `src/feature.test.ts`)
4. Ensure `<verify>` includes test run command
5. Reorder: `<behavior>` MUST come before `<implementation>`

### 4. Inject TDD Into Executor Context

Append this to the plan's context section:

```markdown
## TDD Protocol (MANDATORY)

Every task with tdd="true" MUST follow Red-Green-Refactor:

**RED:** Write failing test from <behavior> → Run → MUST FAIL → Commit: `test(phase-plan): add failing test for [feature]`
**GREEN:** Write minimal code from <implementation> → Run → MUST PASS → Commit: `feat(phase-plan): implement [feature]`
**REFACTOR:** Clean up → Run → MUST STILL PASS → Commit: `refactor(phase-plan): clean up [feature]`

If code was written before test: DELETE IT. Start over.
```

## Exceptions (Only These)

Tasks that do NOT need `tdd="true"`:
- `type="checkpoint:*"` (human interaction)
- Configuration-only tasks (env files, package.json, tsconfig)
- Documentation-only tasks
- Migration/seed scripts (test via integration tests instead)

## Common Rationalizations (REJECT ALL)

| Excuse | Response |
|--------|----------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after" | Tests passing immediately prove nothing. |
| "Test is hard to write" | Hard to test = hard to use. Simplify the interface. |
| "Just this once" | No exceptions. |
| "Need to explore first" | Fine. Throw away exploration. Start with TDD. |
| "Already manually tested" | Ad-hoc is not systematic. No record, can't re-run. |

## Verification Checklist

Before marking TDD enforcement complete:

- [ ] Every code-producing task has `tdd="true"`
- [ ] Every TDD task has `<behavior>` block
- [ ] Every TDD task has test file in `<files>`
- [ ] Every `<verify>` includes test command
- [ ] `<behavior>` precedes `<implementation>` in every task
- [ ] Plan context includes TDD Protocol section

## Output

Report:
```
TDD Enforcement Report - Phase $ARGUMENTS
==========================================
Plans checked: N
Tasks checked: N
TDD tasks: N (should be ~80%+ of code tasks)
Violations found: N
Violations fixed: N
Status: PASS / FAIL (with remaining issues)
```
