---
name: gsd:progress
description: Check project progress, show context, and route to next action (execute or plan)
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - SlashCommand
---
<objective>
Check project progress, summarize recent work and what's ahead, then intelligently route to the next action - either executing an existing plan or creating the next one.

Provides situational awareness before continuing work.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/progress.md
</execution_context>

<process>
Execute the progress workflow from @~/.claude/get-shit-done/workflows/progress.md end-to-end.
Preserve all routing logic (Routes A through F) and edge case handling.
</process>
