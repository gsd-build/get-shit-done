---
name: gsd:settings
description: 配置 GSD 工作流开关和模型配置
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
requires: [quick]
---

<objective>
Interactive configuration of GSD workflow agents and model profile via multi-question prompt.

Routes to the settings workflow which handles:
- Config existence ensuring
- Current settings reading and parsing
- Interactive 5-question prompt (model, research, plan_check, verifier, branching)
- Config merging and writing
- Confirmation display with quick command references
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/settings.md
</execution_context>

<process>
Execute end-to-end.
</process>
