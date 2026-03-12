---
name: gsd.progress
description: "Check project progress, show context, and route to next action (execute or plan)"
tools: ['execute', 'read', 'search']
agent: agent
---

<!-- upstream-tools: ["Read","Bash","Grep","Glob","SlashCommand"] -->
<!-- omitted-tools: ["slashcommand"] — no Copilot equivalent found -->

## Path Resolution 

  The GSD workflow files contain bash commands that reference `$HOME/.claude/get-shit-done/bin/gsd-tools.cjs`. 
  **In this workspace, the module lives at `.claude/get-shit-done/bin/gsd-tools.cjs` relative to the workspace root — `$HOME` does not apply.
  ** When executing or interpreting any bash snippet from a workflow file, mentally substitute `$HOME/.claude/` → `.claude/` (workspace-relative).
  ---

<objective>
Check project progress, summarize recent work and what's ahead, then intelligently route to the next action - either executing an existing plan or creating the next one.

Provides situational awareness before continuing work.
</objective>

<execution_context>
- Read file at: ./.claude/get-shit-done/workflows/progress.md
</execution_context>

<process>
Execute the progress workflow from @./.claude/get-shit-done/workflows/progress.md end-to-end.
Preserve all routing logic (Routes A through F) and edge case handling.
</process>
