---
type: Fixed
pr: 3106
---
**`gsd-sdk query commit` is now scoped to its own staged paths.** Pre-staged unrelated index entries (for example a prior `git rm`) no longer leak into the commit alongside the files passed via `--files`. The same scope guarantee now applies to the `.planning/` fallback, `--amend`, and `commit-to-subrepo`.
