---
name: gsd:capture
description: Capture ideas, tasks, notes, and seeds to their destination
argument-hint: "[--note | --backlog | --seed | --list] [text]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
Capture ideas, tasks, notes, and seeds to their appropriate destination in the GSD system.

Mode routing:
- **default** (no flag): Capture as a structured todo for later work → add-todo workflow
- **--note**: Zero-friction idea capture (append/list/promote) → note workflow
- **--backlog**: Add an idea to the backlog parking lot (999.x numbering) → add-backlog workflow
- **--seed**: Capture a forward-looking idea with trigger conditions → plant-seed workflow
- **--list**: List pending todos and select one to work on → check-todos workflow
</objective>

<routing>

| Flag | Destination | Workflow |
|------|-------------|----------|
| (none) | Structured todo in .planning/todos/ | add-todo |
| --note | Timestamped note file, list, or promote | note |
| --backlog | ROADMAP.md backlog section (999.x) | add-backlog |
| --seed | .planning/seeds/SEED-NNN-slug.md | plant-seed |
| --list | Interactive todo browser + action router | check-todos |

</routing>

<execution_context>
@~/.claude/get-shit-done/workflows/add-todo.md
@~/.claude/get-shit-done/workflows/note.md
@~/.claude/get-shit-done/workflows/add-backlog.md
@~/.claude/get-shit-done/workflows/plant-seed.md
@~/.claude/get-shit-done/workflows/check-todos.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<context>
Arguments: $ARGUMENTS

Parse the first token of $ARGUMENTS:
- If it is `--note`: strip the flag, pass remainder to note workflow
- If it is `--backlog`: strip the flag, pass remainder to add-backlog workflow
- If it is `--seed`: strip the flag, pass remainder to plant-seed workflow
- If it is `--list`: pass remainder (optional area filter) to check-todos workflow
- Otherwise: pass all of $ARGUMENTS to add-todo workflow
</context>

<process>
1. Parse the leading flag (if any) from $ARGUMENTS.
2. Load and execute the appropriate workflow end-to-end based on the routing table above.
3. Preserve all workflow gates from the target workflow (directory structure, duplicate detection, commits, etc.).
</process>
