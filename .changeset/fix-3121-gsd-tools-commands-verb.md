---
type: Fixed
pr: 3121
---
**`gsd-sdk query commands` no longer returns "Unknown command"** — `commands` was referenced in `references/workstream-flag.md` and by agent tooling for verb discovery but had no SDK handler. A new `commandsList` handler in the native registry returns a sorted JSON array of all registered verb strings. `check.decision-coverage-plan` and `check.decision-coverage-verify` were already registered in the SDK native registry; the remaining gap was the `commands` introspection verb. Closes #3121.
