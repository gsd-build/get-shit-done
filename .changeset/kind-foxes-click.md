---
type: Added
pr: 3522
---
**`gsd-sdk query commit --files` gains `--respect-staged` opt-in** — pass `--respect-staged` to skip the automatic `git add` step and commit only what is already staged within the requested pathspec. Callers using `git add -p` to stage individual hunks no longer have their partial staging silently overwritten. Without the flag, default behavior is unchanged (#3061 invariant preserved under both modes).
