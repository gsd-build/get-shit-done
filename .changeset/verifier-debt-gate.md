---
type: Fixed
pr: 3343
---
**Phase verification no longer passes with unresolved `TBD`/`FIXME`/`XXX` markers** — the SDK phase runner now blocks advance after a nominal verifier pass when phase-modified source files contain untracked debt markers. Same-line issue/PR references and `DEF-*` IDs remain allowed for formal deferrals.
