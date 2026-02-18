---
description: Rank actions by unblocking power (dependency weight score)
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
---

Show a ranked list of actions ordered by their unblocking power -- how many milestones and declarations each action contributes to.

**Step 1: Build the command.**

Start with the base command:

```bash
node dist/declare-tools.cjs prioritize
```

If `$ARGUMENTS` contains `--declaration D-XX`:
- Append `--declaration D-XX` to filter actions to those under a specific declaration's subtree:

```bash
node dist/declare-tools.cjs prioritize --declaration D-XX
```

If `$ARGUMENTS` contains `--output <path>`:
- Append `--output <path>` to write the ranking to a file:

```bash
node dist/declare-tools.cjs prioritize --output <path>
```

Both flags can be combined.

**Step 2: Run the command and parse JSON output.**

**Step 3: Handle errors.**

If the output contains an `error` field:
- Display the error message.
- If "not found", suggest checking declaration IDs with `/declare:status`.
- If "No Declare project", suggest running `/declare:init`.

**Step 4: Display the ranking.**

If `totalActions` is 0:
- Display: "No actions found. Create actions first with `/declare:actions`."
- Stop here.

Otherwise, render the ranked list as a formatted table:

| Rank | ID | Action | Score |
|------|----|--------|-------|
| 1 | A-03 | [title] | 4 |
| 2 | A-01 | [title] | 3 |
| ... | ... | ... | ... |

Use the `ranking` array from the JSON output. Each entry has: `rank`, `id`, `title`, `score`.

**Explain the score:** "Score = number of milestones and declarations this action contributes to (unblocking power). Higher score means completing this action unblocks more of the graph."

If `filter` is non-null, note: "Filtered to actions under **[filter]**."

If `outputFile` is present in the result, inform the user: "Output written to [path]."
