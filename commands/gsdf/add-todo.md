---
name: gsdf:add-todo
description: Capture idea or task as todo from current conversation context (passthrough to /gsd:add-todo)
argument-hint: "[optional description]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
---

<passthrough>
This is a lightweight command. Execute exactly as `/gsd:add-todo $ARGUMENTS`.

Read and follow all instructions from: @~/.claude/commands/gsd/add-todo.md
</passthrough>
