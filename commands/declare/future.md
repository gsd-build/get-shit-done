---
description: Declare futures through guided conversation
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
argument-hint: "[--add]"
---

Guide the user through declaring their project's future as present-tense truth statements.

**Step 1: Load current graph state.**

```bash
node /Users/guilherme/Projects/get-shit-done/dist/declare-tools.cjs load-graph
```

Parse the JSON output. If the output contains an `error` field (e.g., "No Declare project found"), tell the user to run `/declare:init` first and stop.

Note the existing declarations from the graph (if any) -- the workflow needs this context.

**Step 2: Determine mode.**

- If `$ARGUMENTS` contains `--add`, skip the intro and go directly to the per-declaration loop (adding to existing declarations).
- If the graph already has declarations and `--add` is NOT present, show existing declarations and ask: "Would you like to add to these, or start fresh?"

**Step 3: Follow the declaration capture workflow.**

Read and follow the full workflow instructions:

@/Users/guilherme/Projects/get-shit-done/workflows/future.md

Pass the loaded graph state into the workflow so it knows about existing declarations.

**Step 4: Persist each confirmed declaration.**

After each declaration passes language detection and NSR validation and the user confirms it, persist it:

```bash
node /Users/guilherme/Projects/get-shit-done/dist/declare-tools.cjs add-declaration --title "Short Title" --statement "Full present-tense declaration statement"
```

Parse the JSON output to confirm the declaration was created and note its assigned ID (e.g., D-01).

**Step 5: Show summary and suggest next step.**

After all declarations are captured:

1. List all declarations with their IDs and statements.
2. Suggest: "Run `/declare:milestones` to work backward from these declarations to milestones and actions."
