---
name: gsd:edit-phase
description: Edit any field of an existing roadmap phase in place, preserving number and position
argument-hint: <phase-number> [--force]
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>
Modify any field of an existing phase in ROADMAP.md in place.

Supports:
- Editing individual fields (title, description/goal, requirements, success criteria, depends_on)
- Full regeneration of all fields from a clarified intent
- Guarded edits: refuses in_progress/completed phases unless --force is passed
- Depends-on validation: blocks invalid references with a clear error
- Diff + confirmation before writing
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/edit-phase.md
</execution_context>

<context>
Arguments: $ARGUMENTS (format: <phase-number> [--force])

Roadmap and state are resolved in-workflow via `init phase-op` and targeted reads.
</context>

<process>
Execute the edit-phase workflow from @~/.claude/get-shit-done/workflows/edit-phase.md end-to-end.
Preserve all validation gates (phase existence, status guard, depends_on validation, diff + confirmation).
</process>
