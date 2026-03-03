---
type: prompt
name: gsd:switch-milestone
description: Switch active milestone for concurrent work
argument-hint: <milestone-name>
allowed-tools:
  - Read
  - Bash
---

<objective>
Switch the active milestone to work on a different one concurrently.

Reads available milestones, warns about in-progress work on the current milestone, and updates the ACTIVE_MILESTONE pointer.
</objective>

<execution_context>
**Load these files NOW (before proceeding):**

- @~/.claude/get-shit-done/workflows/switch-milestone.md (main workflow)
</execution_context>

<context>
**User input:**
- Target milestone: {{milestone-name}}
</context>

<process>
Follow switch-milestone.md workflow end-to-end.
</process>
