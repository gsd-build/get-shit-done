---
name: gsd:list-phases
description: Show all phases in the current milestone with status overview
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
---
<objective>
Show a quick overview of all phases in the current milestone with their status, plan counts, and dependencies. Lightweight alternative to /gsd:progress — no routing logic, no recent work analysis, just phases at a glance.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/list-phases.md
</execution_context>

<process>
Execute the list-phases workflow from @~/.claude/get-shit-done/workflows/list-phases.md end-to-end.
Display the phase table and summary. No routing or next-action suggestions.
</process>