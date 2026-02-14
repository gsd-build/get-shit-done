---
name: gsd:setup-quality
description: Configure quality enforcement features (TDD, specs, feedback, checkpoints)
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---

<objective>
Configure quality enforcement features interactively or via preset.

Presets:
- `/gsd:setup-quality --minimal` — Basic TDD + feedback tracking
- `/gsd:setup-quality --standard` — TDD + specs + feedback + checkpoints
- `/gsd:setup-quality --full` — Full TDD enforcement + specs + feedback + checkpoints

Or `/gsd:setup-quality` for interactive selection.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/setup-quality.md
</execution_context>

<process>
**Follow the setup-quality workflow** from `@~/.claude/get-shit-done/workflows/setup-quality.md`.
</process>
