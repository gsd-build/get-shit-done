---
name: gsd:note
description: Capture quick observations during execution without interrupting flow
argument-hint: "[append|list|promote] [content...]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

<objective>
Lightweight zero-friction note capture for observations that surface during execution. Notes live in `.planning/notes/` and can later be promoted to formal todos.

Subcommands:
- **append** - Capture a quick observation with a single command
- **list** - View all captured notes with previews
- **promote** - Convert a note into a formal todo item

Routes to the note workflow which handles:
- Timestamped note file creation with YAML frontmatter
- Note listing with preview and promotion status
- Promotion to `.planning/todos/pending/` with back-references
</objective>

<execution_context>
@.planning/STATE.md
@~/.claude/get-shit-done/workflows/note.md
</execution_context>

<process>
**Follow the note workflow** from `@~/.claude/get-shit-done/workflows/note.md`.

The workflow handles all logic including:
1. Subcommand parsing (append, list, promote)
2. Directory creation for `.planning/notes/`
3. Timestamped file creation with frontmatter
4. Note listing with previews and status
5. Promotion to todo with cross-references
</process>
