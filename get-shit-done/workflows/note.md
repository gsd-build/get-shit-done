<purpose>
Lightweight zero-friction note capture for observations during execution. Enables "observe -> capture -> continue" without breaking flow. Notes can later be promoted to formal todos.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="parse_subcommand">
Determine the subcommand from arguments:

- `/gsd:note append <words...>` -> capture a new note
- `/gsd:note list` -> show all notes with previews
- `/gsd:note promote <filename>` -> convert note to todo

If no subcommand or unrecognized, default to `append` if content words are present, otherwise show usage help.
</step>

<step name="append">
Zero-friction note capture. Creates a timestamped markdown file in `.planning/notes/`.

```bash
node ~/.claude/get-shit-done/bin/gsd-tools.js note append <words...>
```

The tool handles:
1. Creating `.planning/notes/` directory if needed
2. Generating timestamp-based filename (`note-YYYYMMDD-HHMMSS.md`)
3. Writing file with YAML frontmatter (`created`, `source`) and content body
4. Returns JSON with `created`, `file`, `path`, `timestamp` fields

Confirm to user:
```
Note saved: .planning/notes/[filename]
  "[first line of content]"
```
</step>

<step name="list">
Show all captured notes with previews and promotion status.

```bash
node ~/.claude/get-shit-done/bin/gsd-tools.js note list
```

The tool handles:
1. Reading all `.md` files from `.planning/notes/`
2. Extracting created date and first content line as preview
3. Checking for `promoted:` field in frontmatter
4. Returns JSON with `count` and `notes` array

Display as formatted list:
```
Notes (N total):
  1. [date] [filename] - [preview]
  2. [date] [filename] - [preview] (promoted)
```
</step>

<step name="promote">
Convert a note into a formal todo item.

```bash
node ~/.claude/get-shit-done/bin/gsd-tools.js note promote <filename>
```

The tool handles:
1. Reading the note file and extracting content
2. Creating `.planning/todos/pending/` directory if needed
3. Writing todo file with note content
4. Updating original note with `promoted` date and `todo` reference in frontmatter
5. Returns JSON with `promoted`, `note`, `todo`, `todo_path` fields

Confirm to user:
```
Note promoted to todo: .planning/todos/pending/[todo-filename]
  Original: .planning/notes/[note-filename]
```
</step>

</process>

<success_criteria>
- [ ] append: Note file created with valid frontmatter and content
- [ ] list: All notes displayed with accurate previews and status
- [ ] promote: Todo created, original note updated with promotion reference
- [ ] Directory structures created as needed
</success_criteria>
