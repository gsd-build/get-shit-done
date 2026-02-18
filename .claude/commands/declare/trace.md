---
description: Trace a node's why-chain upward through the DAG to its source declarations
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
---

Trace why a node exists by following its upward causation chain through the Declare DAG.

**Step 1: Determine the node to trace.**

If `$ARGUMENTS` contains a node ID (matching pattern `A-XX`, `M-XX`, or `D-XX`):
- Use that ID directly. Proceed to Step 2.

If `$ARGUMENTS` contains `--output <path>`, note the output path but still look for a node ID in the remaining arguments.

If `$ARGUMENTS` is empty or contains no node ID (interactive mode):
- Run the tool without arguments to get available nodes:

```bash
node dist/declare-tools.cjs trace
```

- Parse the JSON output. It contains a `nodes` object with `declarations`, `milestones`, and `actions` arrays.
- Present a numbered list grouped by type:

**Declarations:**
1. D-01: [title] [STATUS]
2. D-02: [title] [STATUS]

**Milestones:**
3. M-01: [title] [STATUS]
...

**Actions:**
N. A-01: [title] [STATUS]
...

- Ask the user: "Which node would you like to trace? Provide the ID (e.g., A-01)."
- Wait for the user's response, then use their provided ID in Step 2.

**Step 2: Run the trace.**

Build the command:

```bash
node dist/declare-tools.cjs trace <node-id>
```

If `--output <path>` was provided in `$ARGUMENTS`, append it:

```bash
node dist/declare-tools.cjs trace <node-id> --output <path>
```

Run the command and parse the JSON output.

**Step 3: Handle errors.**

If the output contains an `error` field:
- Display the error message.
- If the error mentions "not found", suggest running `/declare:trace` without arguments to see available nodes.
- If the error mentions "No Declare project", suggest running `/declare:init`.

**Step 4: Display the trace.**

Use the `formatted` field from the JSON output as the primary display. It contains a pre-rendered tree with Unicode connectors showing the why-chain from the traced node upward to its source declarations.

Display it in a code block for proper formatting:

```
[contents of formatted field]
```

Below the tree, add context:
- "Traced **N** path(s) from **[node-id]** to source declarations."
- If `truncated` is true: "Showing 20 of [totalPaths] paths. Use --output to capture all paths."

If `outputFile` is present in the result, inform the user: "Output written to [path]."
