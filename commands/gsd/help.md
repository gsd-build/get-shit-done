---
name: gsd:help
description: 显示可用的 GSD 命令和使用指南
argument-hint: "[--brief | --full | <topic> | --brief <topic>]"
allowed-tools:
  - Read
---
<objective>
Display GSD help at the tier the user asked for: brief (one-line refresher), default (one-page tour), full (complete reference), a single topic section, or a compact scoped lookup of one topic (`--brief <topic>`: signature + one-line summary).

Output ONLY the reference content of the chosen tier. Do NOT add:
- Project-specific analysis
- Git status or file context
- Next-step suggestions
- Any commentary beyond the reference
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/help.md
</execution_context>

<context>
Arguments: $ARGUMENTS
</context>

<process>
Follow ~/.claude/get-shit-done/workflows/help.md with $ARGUMENTS.
</process>
