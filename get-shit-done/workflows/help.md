<purpose>
Display GSD command help at the tier the user asked for. Output ONLY the reference content of the chosen mode. Do NOT add project-specific analysis, git status, next-step suggestions, or any commentary beyond the reference.
</purpose>

<progressive_disclosure>
**Mode files are lazy-loaded.** Read only the one mode file that matches `$ARGUMENTS`, then output its `<reference>` body verbatim.

| When `$ARGUMENTS` is | Read |
|---|---|
| `--brief` (or `-b`) alone | `workflows/help/modes/brief.md` |
| `--full` (or `-f`, `--all`) alone | `workflows/help/modes/full.md` |
| empty / unset | `workflows/help/modes/default.md` |
| `--brief <topic>` (or `-b <topic>`) | `workflows/help/modes/topic.md` in compact scope (signature + one-line summary of the matched section) |
| anything else — bare topic, `--full <topic>`, or topic with leading `--` | `workflows/help/modes/topic.md` in full scope (entire matched section) |

Argument parsing rules:
- Trim and lowercase `$ARGUMENTS`.
- Recognize the long form, short form, and obvious aliases listed above.
- A bare token like `debug`, `--debug`, `capture`, `workflow`, `config` is a topic — route to `topic.md`.
- Multiple flags: `--brief` and `--full` are mutually exclusive — if both appear *without* a topic, prefer `--full`.
- `--brief` combined with a topic invokes `topic.md` in compact scope; `--full` combined with a topic invokes `topic.md` in full scope (the default topic behavior). When passing arguments through to `topic.md`, retain the `--brief` flag so the mode can pick the right scope.

After loading the chosen mode, emit its `<reference>` block content directly. No additions, no project context, no suggestions.
</progressive_disclosure>
