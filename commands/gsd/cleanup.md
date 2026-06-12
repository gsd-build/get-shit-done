---
name: gsd:cleanup
description: 归档已完成里程碑中累积的阶段目录
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
requires: [phase]
---
<objective>
Archive phase directories from completed milestones into `.planning/milestones/v{X.Y}-phases/`.

Use when `.planning/phases/` has accumulated directories from past milestones.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/cleanup.md
</execution_context>

<process>
Execute end-to-end.
Identify completed milestones, show a dry-run summary, and archive on confirmation.
</process>
