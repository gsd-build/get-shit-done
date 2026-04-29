---
name: gsd:phase
description: CRUD for phases in ROADMAP.md — add, insert, remove, or edit phases
argument-hint: "[--insert | --remove | --edit] <phase-name-or-number>"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
---

<objective>
Manage phases in ROADMAP.md with a single consolidated command.

Mode routing:
- **default** (no flag): Add a new integer phase to the end of the current milestone → add-phase workflow
- **--insert**: Insert urgent work as a decimal phase (e.g., 72.1) between existing phases → insert-phase workflow
- **--remove**: Remove a future phase and renumber subsequent phases → remove-phase workflow
- **--edit**: Edit any field of an existing phase in place → edit-phase workflow
</objective>

<routing>

| Flag | Action | Workflow |
|------|--------|----------|
| (none) | Add new integer phase at end of milestone | add-phase |
| --insert | Insert decimal phase (e.g., 72.1) after specified phase | insert-phase |
| --remove | Remove future phase, renumber subsequent | remove-phase |
| --edit | Edit fields of existing phase in place | edit-phase |

</routing>

<execution_context>
@~/.claude/get-shit-done/workflows/add-phase.md
@~/.claude/get-shit-done/workflows/insert-phase.md
@~/.claude/get-shit-done/workflows/remove-phase.md
@~/.claude/get-shit-done/workflows/edit-phase.md
</execution_context>

<context>
Arguments: $ARGUMENTS

Parse the first token of $ARGUMENTS:
- If it is `--insert`: strip the flag, pass remainder (format: <after-phase-number> <description>) to insert-phase workflow
- If it is `--remove`: strip the flag, pass remainder (phase number) to remove-phase workflow
- If it is `--edit`: strip the flag, pass remainder (phase-number [--force]) to edit-phase workflow
- Otherwise: pass all of $ARGUMENTS (phase description) to add-phase workflow

Roadmap and state are resolved in-workflow via `init phase-op` and targeted reads.
</context>

<process>
1. Parse the leading flag (if any) from $ARGUMENTS.
2. Load and execute the appropriate workflow end-to-end based on the routing table above.
3. Preserve all validation gates from the target workflow.
</process>
