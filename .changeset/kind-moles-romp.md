---
type: Changed
pr: 3356
---
**Config schema validation now uses shared shipped schema data** — CJS and SDK config validators project exact keys, runtime-state keys, and dynamic key patterns from one Config Schema Module.

**New project configs keep planning docs committed by default** — `config-new-project` writes `commit_docs: true` only when creating a fresh `.planning/config.json`; existing configs and in-flight artifacts are not rewritten. Opt out with `gsd config-set commit_docs false`; new projects will commit generated `.planning/` docs unless explicitly opted out.
