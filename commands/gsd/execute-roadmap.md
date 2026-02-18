---
name: gsd:execute-roadmap
description: Execute entire roadmap autonomously with Opus coordinator spawning fresh sub-coordinators per phase
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
Execute the full ROADMAP.md autonomously. Coordinator stays lean — parses roadmap, confirms with user, then spawns a fresh sub-coordinator per phase. Each phase gets a clean 200k context window.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-roadmap.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/STATE.md
</context>

<process>
Execute the execute-roadmap workflow from @~/.claude/get-shit-done/workflows/execute-roadmap.md end-to-end.
Preserve all workflow gates (user confirmation, dependency checking, checkpoint handling, completion logging).
</process>
