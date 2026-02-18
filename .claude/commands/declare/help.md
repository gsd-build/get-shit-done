---
description: Show available Declare commands
allowed-tools:
  - Read
  - Bash
---

Show the Declare command reference.

**Step 1: Run the help tool.**

```bash
node dist/declare-tools.cjs help
```

Parse the JSON output.

**Step 2: Format the help display.**

Display a clean command reference:

**Header:** "Declare -- Future-first project planning"

**Brief description:** Declare lets you define what you want to be true about the future, then builds a causal graph of milestones and actions to get there. It validates structural integrity and tracks progress through the graph.

**Available Commands:** For each command in the JSON output, display:
- Command name (bold)
- Description
- Usage example

**Version:** Show the version number at the bottom.
