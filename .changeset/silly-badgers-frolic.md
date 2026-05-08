---
type: Fixed
pr: 3248
---
**`gsd-tools <domain>.<subcommand>` (dotted form) now accepted natively by the CJS dispatcher** — previously only worked when invoked via the SDK, which split the form client-side. Stale SDK binaries and direct CJS callers no longer hit "Unknown command" on the canonical form.
