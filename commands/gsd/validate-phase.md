---
name: gsd:validate-phase
description: Retroactively audit and fill Nyquist validation gaps for a completed phase
argument-hint: "[phase number]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---
<objective>
Audit Nyquist validation coverage for a completed phase.

Three input states:
- (A) VALIDATION.md exists — audit existing coverage and fill gaps
- (B) No VALIDATION.md but SUMMARY.md exists — reconstruct validation from artifacts
- (C) Phase not executed — exit with guidance

Output: updated VALIDATION.md + generated test files.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/validate-phase.md
</execution_context>

<context>
Phase: $ARGUMENTS (optional)
- If provided: Validate specific phase (e.g., "4")
- If not provided: Defaults to most recently completed phase via STATE.md

Context files are resolved inside the workflow (`gsd-tools init phase-op`).
</context>

<process>
Execute the validate-phase workflow from @~/.claude/get-shit-done/workflows/validate-phase.md end-to-end.
Preserve all workflow gates (state detection, gap analysis approval, auditor spawning, debug loop cap, VALIDATION.md generation, result routing).
</process>
