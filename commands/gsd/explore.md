---
name: gsd:explore
description: 探索式构思和想法路由：在提交到计划前思考想法
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
---
<objective>
Open-ended Socratic ideation session. Guides the developer through exploring an idea via
probing questions, optionally spawns research, then routes outputs to the appropriate GSD
artifacts (notes, todos, seeds, research questions, requirements, or new phases).

Accepts an optional topic argument: `/gsd:explore authentication strategy`
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/explore.md
</execution_context>

<process>
Execute end-to-end.
</process>
