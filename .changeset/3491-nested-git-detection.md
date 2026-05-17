---
type: Fixed
pr: 3502
---
**`/gsd-new-project` and `/gsd-ingest-docs` no longer create a nested `.git` inside an existing worktree (#3491)** — the shallow `has_git: false` check (which only looked for `.git` in the current directory) has been replaced with `git rev-parse --is-inside-work-tree` semantics. The init payload now surfaces `git_worktree_root` and `in_nested_subdir` so the workflows correctly skip `git init` when invoked from a subdirectory of an existing repo and warn that planning files will be tracked by the outer repo.
