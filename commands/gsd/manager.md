---
name: gsd:manager
description: Interactive command center for managing multiple phases from one terminal
argument-hint: "[--analyze-deps]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
  - Skill
  - Agent
requires: [phase]
---
<objective>
Single-terminal command center for managing a milestone. Shows a dashboard of all phases with visual status indicators, recommends optimal next actions, and dispatches work — discuss runs inline, plan/execute run as background agents.

Designed for power users who want to parallelize work across phases from one terminal: discuss a phase while another plans or executes in the background.

**Creates/Updates:**
- No files created directly — dispatches to existing GSD commands via Skill() and background Task agents.
- Reads `.planning/STATE.md`, `.planning/ROADMAP.md`, phase directories for status.

**After:** User exits when done managing, or all phases complete and milestone lifecycle is suggested.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/manager.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<context>
No arguments required. Requires an active milestone with ROADMAP.md and STATE.md.

Project context, phase list, dependencies, and recommendations are resolved inside the workflow using `gsd-sdk query init.manager`. No upfront context loading needed.
</context>

<process>
If `--analyze-deps` is in $ARGUMENTS:
Read and execute `~/.claude/get-shit-done/workflows/analyze-dependencies.md` end-to-end.

Execute end-to-end.
Maintain the dashboard refresh loop until the user exits or all phases complete.
</process>
