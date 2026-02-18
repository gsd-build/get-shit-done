---
description: Initialize Declare project with future declarations and graph structure
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
---

Initialize a Declare project in the current working directory.

**Step 1: Run the init tool.**

```bash
node dist/declare-tools.cjs init $ARGUMENTS
```

Parse the JSON output. It will contain:
- `initialized`: whether initialization succeeded
- `created`: list of files that were created
- `existing`: list of files that already existed
- `committed`: whether a git commit was made

**Step 2: Handle existing files.**

If the `existing` array is non-empty, present the existing files to the user and ask which ones they want to keep vs replace. For each file they want to replace:
1. Delete the existing file
2. Re-run `node dist/declare-tools.cjs init` to recreate it

**Step 3: Report results.**

Show the user a summary of what was created:
- List each created file with a brief description of its purpose
- If a commit was made, mention the commit hash
- Suggest next steps: "Add your first future declaration to `.planning/FUTURE.md`" and "Run `/declare:status` to see graph state"
