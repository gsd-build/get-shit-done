---
name: gsd:ship
description: 创建 PR、运行审查，验证通过后准备合并
argument-hint: "[phase number or milestone, e.g., '4' or 'v1.0']"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Write
  - AskUserQuestion
requires: [review, verify-work]
---
<objective>
Bridge local completion → merged PR. After /gsd:verify-work passes, ship the work: push branch, create PR with auto-generated body, optionally trigger review, and track the merge.

Closes the plan → execute → verify → ship loop.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/ship.md
</execution_context>

Execute the ship workflow from @~/.claude/get-shit-done/workflows/ship.md end-to-end.
