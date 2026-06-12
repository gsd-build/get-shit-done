---
name: gsd:thread
description: 管理跨会话工作的持久上下文线程
argument-hint: "[list [--open | --resolved] | close <slug> | status <slug> | name | description]"
allowed-tools:
  - Read
  - Write
  - Bash
requires: [phase]
---

<objective>
Create, list, close, or resume persistent context threads. Threads are lightweight
cross-session knowledge stores for work that spans multiple sessions but
doesn't belong to any specific phase.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/thread.md
</execution_context>

<process>
Execute end-to-end.
</process>
