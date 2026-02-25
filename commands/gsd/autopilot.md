---
name: gsd:autopilot
description: Run full pipeline (discuss, plan, execute) for remaining phases automatically
argument-hint: "[phase] [start-end]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - AskUserQuestion
---
<objective>
Run the full GSD pipeline for remaining phases in the current milestone — automatically.

For each incomplete phase: generate context via synthetic multi-agent discuss, then chain through plan → execute → verify → transition. One command, full autopilot.

**Usage:**
- `/gsd:autopilot` — Run from current phase through end of milestone
- `/gsd:autopilot 5` — Run starting from phase 5
- `/gsd:autopilot 3-7` — Run phases 3 through 7
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/autopilot.md
@~/.claude/get-shit-done/workflows/auto-discuss.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<context>
Arguments: $ARGUMENTS (optional phase number or range)

Context files are resolved in-workflow using `gsd-tools init progress` and `roadmap analyze`.
</context>

<process>
Execute the autopilot workflow from @~/.claude/get-shit-done/workflows/autopilot.md end-to-end.
Preserve all workflow gates (phase loop, synthetic discuss, auto-advance chain, stop conditions).
</process>
