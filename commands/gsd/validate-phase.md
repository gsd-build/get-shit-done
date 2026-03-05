---
name: gsd:validate-phase
description: "Retroactively audit a completed phase for Nyquist validation gaps and generate missing coverage"
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
Audit Nyquist validation coverage for a completed phase. Three states:
- (A) VALIDATION.md exists — audit and fill gaps
- (B) No VALIDATION.md, SUMMARY.md exists — reconstruct from artifacts
- (C) Phase not executed — exit with guidance

Output: updated VALIDATION.md + generated test files.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/validate-phase.md
</execution_context>

<context>
Phase: $ARGUMENTS — optional, defaults to last completed phase.
</context>

<process>
Execute @~/.claude/get-shit-done/workflows/validate-phase.md.
Preserve all workflow gates.
</process>
