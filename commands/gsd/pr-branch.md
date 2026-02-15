---
name: gsd:pr-branch
description: Create or update a filtered PR branch without planning files
argument-hint: "[--dry-run] [--base branch]"
allowed-tools:
  - Bash
  - Read
---
<objective>
Create or update a PR branch that contains only code commits, filtering out all .planning/ commits.

Wraps `gsd-tools.js pr-branch` — the tool handles all git operations:
- Classifies commits as planning-only, code-only, or mixed
- Cherry-picks code-only commits onto a {source}-pr branch
- Reports results including any skipped mixed commits

Use `--dry-run` to preview without modifying branches.
Use `--base <branch>` to override the default base branch.
</objective>

<process>
## 1. Run PR branch tool

```bash
node ~/.claude/get-shit-done/bin/gsd-tools.js pr-branch $ARGUMENTS
```

## 2. Present results

Display the tool output to the user. Key items to highlight:
- Number of commits cherry-picked vs skipped
- PR branch name
- Any mixed commits that were skipped and need manual splitting
- Any conflicts that occurred during cherry-pick
</process>
