---
name: gsd:explore
description: Socratic ideation and idea routing. Guide a conversation, then route outputs to the right GSD artifacts.
argument-hint: "[topic or idea]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---

<objective>
Socratic ideation -- guide a structured discovery conversation, then route outputs to the correct GSD artifacts (notes, todos, seeds, research questions, requirements, or new phases).
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/explore.md
@~/.claude/get-shit-done/references/ui-brand.md
@~/.claude/get-shit-done/references/questioning.md
@~/.claude/get-shit-done/references/domain-probes.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
Execute the explore workflow from @~/.claude/get-shit-done/workflows/explore.md end-to-end.
</process>
