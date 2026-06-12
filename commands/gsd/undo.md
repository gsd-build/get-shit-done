---
name: gsd:undo
description: "安全 git 回退。使用阶段清单和依赖检查回滚阶段或计划提交"
argument-hint: "--last N | --phase NN | --plan NN-MM"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
requires: [phase]
---

<objective>
Safe git revert — roll back GSD phase or plan commits using the phase manifest, with dependency checks and a confirmation gate before execution.

Three modes:
- **--last N**: Show recent GSD commits for interactive selection
- **--phase NN**: Revert all commits for a phase (manifest + git log fallback)
- **--plan NN-MM**: Revert all commits for a specific plan
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/undo.md
@~/.claude/get-shit-done/references/ui-brand.md
@~/.claude/get-shit-done/references/gate-prompts.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
Execute end-to-end.
</process>
