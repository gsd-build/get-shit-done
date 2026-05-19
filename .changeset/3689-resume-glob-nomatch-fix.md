---
type: Fixed
pr: 3693
---
**`/gsd-resume-work` no longer drops `.planning/.continue-here*.md` checkpoints under zsh's default `NOMATCH`** — the chained `ls` of bare globs in `resume-project.md`'s `check_incomplete_work` step aborted on the first non-matching pattern, silently swallowing every later pattern (including the one that surfaces top-level handoff files). Replaced with `find .planning -maxdepth 3` + `find . -maxdepth 1`, which doesn't use shell glob expansion and tolerates absent directories on both bash and zsh.
