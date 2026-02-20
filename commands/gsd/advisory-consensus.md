---
name: gsd:advisory-consensus
description: Run advisory perspectives (PM, UX, Security, etc.) before planning
argument-hint: "<phase> [--skills <skill1,skill2,...>]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
---
<objective>
Run one or more advisory skill perspectives against a phase to produce acceptance criteria and flags before planning.

Loads all specified skills into a single agent that produces a unified advisory output. This replaces running multiple discuss-phase rounds for users who want structured advisory input.

**Default skills:** product-manager, ux-designer
**Output:** `{phase_num}-CONTEXT.md` with advisory-derived decisions
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/advisory-consensus.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<context>
Phase number: $ARGUMENTS
@.planning/STATE.md
@.planning/ROADMAP.md
</context>

<process>
Execute the advisory-consensus workflow from @~/.claude/get-shit-done/workflows/advisory-consensus.md end-to-end.
</process>
