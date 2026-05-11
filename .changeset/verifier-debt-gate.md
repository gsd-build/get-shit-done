---
type: Fixed
pr: 3343
---
**Phase verification no longer passes with unresolved `TBD`/`FIXME`/`XXX` markers** — the SDK phase runner now blocks advance after a nominal verifier pass when phase-modified source files contain untracked debt markers. Same-line issue/PR references and `DEF-*` IDs remain allowed for formal deferrals.

The debt scan covers literal source paths declared in phase plan `files_modified` frontmatter and task `files`; globs are not expanded, and undeclared files modified during execution are not scanned. Git-diff-based coverage would be a separate enhancement.
