---
type: Security
pr: 3587
---
**Fixed shell-injection in `check.ship-ready`** — a maliciously-named git branch (e.g. `foo;touch${IFS}INJ;bar`) could execute arbitrary shell commands when `gsd-sdk query check.ship-ready <phase>` ran from the repository. `sdk/src/query/check-ship-ready.ts` interpolated the current branch name into a shell-string `git config --get branch.${current_branch}.merge` and ran it via `execSync`. Every subprocess call in the module now uses argv-based `execFileSync` — the shell is never invoked, branch names are passed as opaque data, and no interpolation site exists.
