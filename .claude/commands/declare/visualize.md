---
description: Visualize the Declare DAG as a top-down ASCII tree with status markers
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Write
---

Render the Declare DAG as a top-down tree showing declarations, milestones, and actions with their status.

**Step 1: Build the command.**

Start with the base command:

```bash
node dist/declare-tools.cjs visualize
```

If `$ARGUMENTS` contains a scope ID (matching pattern `D-XX` or `M-XX`):
- Append it to scope the visualization to that subtree:

```bash
node dist/declare-tools.cjs visualize <scope-id>
```

If `$ARGUMENTS` contains `--output <path>`:
- Append it to write the tree to a file:

```bash
node dist/declare-tools.cjs visualize --output <path>
```

Both scope and output can be combined:

```bash
node dist/declare-tools.cjs visualize <scope-id> --output <path>
```

**Step 2: Run the command and parse JSON output.**

**Step 3: Handle errors.**

If the output contains an `error` field:
- Display the error message.
- If "not found", suggest valid IDs by running `/declare:status` to see available nodes.
- If "No Declare project", suggest running `/declare:init`.

**Step 4: Display the tree.**

Use the `formatted` field from the JSON output directly. It contains the pre-rendered ASCII tree with Unicode box-drawing connectors and status markers.

Display it in a code block for proper alignment:

```
[contents of formatted field]
```

**Status marker legend:**
- `[checkmark]` = DONE
- `[>]` = ACTIVE
- `[circle]` = PENDING
- `[!]` = BLOCKED (has non-done children)

**Step 5: Show stats.**

Below the tree, display: "**N** declarations, **N** milestones, **N** actions"

Using the `stats` object from the JSON output.

If scope was used, note: "Scoped to subtree of **[scope-id]**."

If `outputFile` is present in the result, inform the user: "Output written to [path]."
