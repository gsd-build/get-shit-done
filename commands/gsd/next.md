---
name: gsd:next
description: Automatically advance to the next logical step in the GSD workflow. Includes hard stops at milestone boundaries, error states, and verification gaps. Guards against runaway automation.
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Skill
  - AskUserQuestion
---
<objective>
Detect the current project state and automatically invoke the next logical GSD workflow step.
No arguments needed — reads STATE.md, ROADMAP.md, and phase directories to determine what comes next.

Includes safety features from /gsd-continue (now merged):
- Hard stops at milestone boundaries, error states, verification gaps, unresolved checkpoints
- Consecutive-call budget guard (warns at 6+ consecutive invocations)
- Skill() delegation instead of SlashCommand for reliable command routing

Designed for rapid multi-project workflows where remembering which phase/step you're on is overhead.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/next.md
</execution_context>

<process>
Execute the next workflow from @~/.claude/get-shit-done/workflows/next.md end-to-end.
</process>
