---
name: gsd:import
description: Ingest external plans or PRDs. Detects conflicts against project decisions before writing anything.
argument-hint: "--from <filepath> | --prd <filepath>"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
  - Task
---

<objective>
Import external plans or PRDs into the GSD planning system with conflict detection and agent delegation.

Two modes:
- **--from**: Import an external plan file, detect conflicts, write as GSD PLAN.md, validate via gsd-plan-checker.
- **--prd**: Extract a PRD into PROJECT.md + REQUIREMENTS.md, delegate ROADMAP.md generation to gsd-planner.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/import.md
@~/.claude/get-shit-done/references/ui-brand.md
@~/.claude/get-shit-done/references/gate-prompts.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
Execute the import workflow end-to-end.
</process>
