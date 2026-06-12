---
name: gsd:ultraplan-phase
description: "[BETA] 将规划阶段卸载到 Claude Code 的 ultraplan 云；在浏览器中审查并导入回来"
argument-hint: "[phase-number]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
requires: [import, phase, plan-phase]
---

<objective>
Offload GSD's plan phase to Claude Code's ultraplan cloud infrastructure.

Ultraplan drafts the plan in a remote cloud session while your terminal stays free.
Review and comment on the plan in your browser, then import it back via /gsd:import --from.

⚠ BETA: ultraplan is in research preview. Use /gsd:plan-phase for stable local planning.
Requirements: Claude Code v2.1.91+, claude.ai account, GitHub repository.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/ultraplan-phase.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
Execute the ultraplan-phase workflow end-to-end.
</process>
