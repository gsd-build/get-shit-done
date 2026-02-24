---
name: custom:tdd-enforce
description: Enforce TDD discipline on GSD plans. Run after /gsd:plan-phase to validate all tasks have TDD blocks. Adapted from Superpowers test-driven-development skill.
argument-hint: "[phase-number]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# TDD Enforcement Protocol

> Adapted from [Superpowers](https://github.com/obra/superpowers) `test-driven-development` skill.
> Integrated with GSD XML task format and `~/.claude/get-shit-done/references/tdd.md`.

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
PHASE_NUM=$(printf "%02d" "$ARGUMENTS" 2>/dev/null)
PHASE_DIR=$(ls -d .planning/phases/"${PHASE_NUM}"-* 2>/dev/null | head -1)
if [ -z "$PHASE_DIR" ]; then
  echo "Phase $ARGUMENTS not found. Available phases:"
  ls -d .planning/phases/*-* 2>/dev/null
  echo "STOP: Phase not found. Do not continue."
  exit 1
fi
echo "Checking: $PHASE_DIR"
ls "$PHASE_DIR"/*-PLAN.md 2>/dev/null
```

**Important:** `exit 1` inside a bash code block only exits that block — it does NOT stop Claude from proceeding to Step 2. If the bash output contains "STOP: Phase not found", you MUST stop execution entirely. Do not continue to Step 2.

### 2. Validate Each Plan

For every PLAN.md in the phase directory, check two things:

**A) Plan-level TDD mechanism:**

GSD handles TDD via plan-level frontmatter. Plans containing code-producing tasks should use:
- `type: tdd` in YAML frontmatter (for dedicated TDD plans), OR
- `type: execute` with individual tasks that have `<behavior>` blocks and test files in `<files>`

**B) Task-level requirements for code-producing tasks:**

Every `type="auto"` task that creates or modifies code MUST have:

```xml
<task type="auto">
  <name>Task name</name>
  <files>src/feature.ts, src/feature.test.ts</files>
  <behavior>
    - Test 1: describe expected behavior
    - Test 2: describe edge case
    - Test 3: describe error case
  </behavior>
  <action>
    Minimal code to pass tests. No YAGNI.
  </action>
  <verify>
    <automated>pnpm test -- --filter=feature && pnpm type-check</automated>
  </verify>
  <done>All tests green, type-check passes</done>
</task>
```

Note: Real GSD plans use structured `<verify>` blocks with `<automated>` and optionally `<manual>` children. When checking violations, look inside the `<automated>` tag for test commands — not the bare `<verify>` tag.

**VIOLATIONS to flag:**
- [ ] Task creates code but has no `<behavior>` block (test specifications)
- [ ] Task has no test file in `<files>` list
- [ ] `<verify><automated>` has no test command (only `<manual>` verification)
- [ ] Task has `<action>` but no `<behavior>` block preceding it
- [ ] Plan has code-producing tasks but does not reference `tdd.md` in `<execution_context>`

### 3. Fix Violations

For each violation found:

1. Add `<behavior>` block with test specifications derived from `<action>` or `<name>`
2. Add test file to `<files>` (e.g., `src/feature.test.ts`)
3. Ensure `<verify><automated>` includes test run command
4. If `<action>` exists without a preceding `<behavior>`, add the `<behavior>` block

### 4. Ensure TDD Reference in Plan Context

GSD plans have two context blocks: `<execution_context>` for GSD workflow/reference files, and `<context>` for project-specific files. The TDD reference is a GSD system file, so it belongs in `<execution_context>`.

Do NOT append freeform markdown into either block. Use `@file` references only.

Ensure the plan's `<execution_context>` block includes the TDD reference. Use the absolute path (tilde `~` does not expand in `@file` references):

```xml
<execution_context>
@/home/ayaz/.claude/get-shit-done/workflows/execute-plan.md
@/home/ayaz/.claude/get-shit-done/references/tdd.md
</execution_context>
```

If `@.../references/tdd.md` is missing from `<execution_context>`, add it. This gives the executor full TDD protocol guidance without corrupting the XML structure.

**Note:** These commands do not call `gsd-tools.cjs init` and use relative paths from the working directory. Ensure you invoke them from the project root (where `.planning/` lives).

## Exceptions (Only These)

Tasks that do NOT need `<behavior>` blocks or test files:
- `type="checkpoint:*"` (human interaction)
- Configuration-only tasks (env files, package.json, tsconfig)
- Documentation-only tasks
- Migration/seed scripts (test via project's integration test suite — e.g., `tests/integration/` or equivalent; if no integration tests exist, note this as a gap)

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

- [ ] Every code-producing task has `<behavior>` block
- [ ] Every task with `<behavior>` has test file in `<files>`
- [ ] Every `<verify><automated>` includes test command
- [ ] Every task with `<action>` also has `<behavior>`
- [ ] Plan `<execution_context>` includes `@.../references/tdd.md` (absolute path)
- [ ] Plan frontmatter is `type: tdd` (dedicated TDD plan) or `type: execute` (standard plan with per-task TDD)

## Output

Report:
```
TDD Enforcement Report - Phase $ARGUMENTS
==========================================
Plans checked: N
Tasks checked: N
TDD tasks (with <behavior>): N (should be ~80%+ of code tasks)
Violations found: N
Violations fixed: N
tdd.md reference: present / ADDED
Status: PASS / FAIL (with remaining issues)
```
