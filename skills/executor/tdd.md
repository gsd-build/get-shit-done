# Skill: TDD Execution

This skill is loaded when executing TDD-type plans.

<tdd_execution>

## TDD Plan Structure

TDD plans have `type: tdd` and contain `<feature>` elements instead of `<task>` elements.

```xml
<feature>
  <name>Feature Name</name>
  <files>source.ts, source.test.ts</files>
  <behavior>Expected behavior with test cases</behavior>
  <implementation>How to implement once tests pass</implementation>
</feature>
```

## Red-Green-Refactor Cycle

**RED - Write failing test:**
1. Create test file following project conventions
2. Write test describing expected behavior
3. Run test - it MUST fail
4. Commit: `test({phase}-{plan}): add failing test for [feature]`

**GREEN - Implement to pass:**
1. Write minimal code to make test pass
2. No cleverness, no optimization - just make it work
3. Run test - it MUST pass
4. Commit: `feat({phase}-{plan}): implement [feature]`

**REFACTOR (if needed):**
1. Clean up implementation if obvious improvements exist
2. Run tests - MUST still pass
3. Commit only if changes: `refactor({phase}-{plan}): clean up [feature]`

## Commit Pattern

Each TDD feature produces 2-3 atomic commits:

```
test(16-01): add failing test for user validation
feat(16-01): implement user validation
refactor(16-01): simplify validation logic  # optional
```

## Context Budget

TDD plans target ~40% context (lower than standard ~50%).

Why: RED phase involves writing and debugging tests, GREEN phase involves iteration. The back-and-forth is heavier than linear execution.

## Verification

After each feature:
- All tests pass (including new test)
- No test warnings or skipped tests
- Implementation matches behavior specification

## Summary Updates

In SUMMARY.md, document:
- Tests added (file paths, what they test)
- Implementation approach
- Any deviations from planned behavior

</tdd_execution>
