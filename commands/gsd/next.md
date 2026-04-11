---
name: gsd:next
description: Automatically advance to the next logical step in the GSD workflow
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - SlashCommand
---
<objective>
Detect the current project state and automatically invoke the next logical GSD workflow step.
No arguments needed — reads STATE.md, ROADMAP.md, and phase directories to determine what comes next.

Designed for rapid multi-project workflows where remembering which phase/step you're on is overhead.

Supports `--force` flag to bypass safety gates (checkpoint, error state, verification failures, and prior-phase completeness scan).

Before routing to the next step, scans all prior phases for incomplete work: plans that ran without producing summaries, verification failures without overrides, and phases where discussion happened but planning never ran. When incomplete work is found, shows a structured report and offers three options: defer the gaps to the backlog and continue, stop and resolve manually, or force advance without recording. When prior phases are clean, routes silently with no interruption.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/next.md
</execution_context>

<process>
Execute the next workflow from @~/.claude/get-shit-done/workflows/next.md end-to-end.
</process>
