---
name: gsd:merge-milestone
description: Merge a milestone branch into target with AI-assisted .planning/ and code conflict resolution
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
---

# /gsd:merge-milestone [target-branch]

Merge the current milestone branch into a target branch using squash merge. Handles .planning/ artifact conflicts with GSD command-aware merge logic and code conflicts with AI-assisted resolution guided by merged .planning/ context.

## Usage

```
/gsd:merge-milestone main
/gsd:merge-milestone master
/gsd:merge-milestone --dry-run
```

If no target branch specified, prompts the user to select.

## What It Does

1. **Pre-check** — Verifies milestone phases have summaries (warns if incomplete)
2. **Preview** — Shows all commits, changed files, and potential conflicts at once
3. **Merge** — Squash merge (all conflicts surfaced in one pass, not per-commit)
4. **Context** — Reads both branches' .planning/ to understand what each side built
5. **.planning/ resolve** — Merges each planning file using its GSD command logic, with preview + user confirmation
6. **Code resolve** — AI reads merged .planning/ to understand intent, proposes code conflict resolutions with preview + user confirmation
7. **Review** — Cross-file consistency check, impact assessment, optional test run
8. **Commit & cleanup** — Squash commit, optional branch deletion and push, full summary
