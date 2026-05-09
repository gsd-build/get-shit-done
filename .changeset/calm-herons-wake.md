---
type: Fixed
pr: 3272
---
**`gsd-sdk query milestone.complete --help` (and all mutating query handlers) no longer execute mutations** — the dispatcher now short-circuits to a non-mutating help stub when `--help`/`-h` appears in args for any native mutating handler (dispatcher-level guard, fail-closed by default). `milestoneComplete` also rejects `--help`/`-h` as a version value before any disk write (handler-level defense-in-depth).
