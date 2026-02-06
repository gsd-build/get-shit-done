---
name: gsdf:check-todos
description: List pending todos and select one to work on (passthrough to /gsd:check-todos)
argument-hint: "[area filter]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - AskUserQuestion
---

<passthrough>
This is a lightweight command. Execute exactly as `/gsd:check-todos $ARGUMENTS`.

Read and follow all instructions from: @~/.claude/commands/gsd/check-todos.md
</passthrough>
