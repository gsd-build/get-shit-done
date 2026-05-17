---
type: Changed
pr: 3540
---
**Configuration Module unifies CJS and SDK config sources** — `CONFIG_DEFAULTS`, `VALID_CONFIG_KEYS`, `DYNAMIC_KEY_PATTERNS`, and the four legacy-key migrations (`branching_strategy`, `sub_repos`, `multiRepo`, `depth`) now derive from two canonical manifests (`sdk/shared/config-{defaults,schema}.manifest.json`) via a generator-emitted mirror, eliminating the parallel-definition drift that caused the #1535/#1542/#2047/#2638/#2653/#2687/#2798/#3055/#3523 bug class. `mergeDefaults` now recursively deep-merges instead of spreading per-section, preserving sibling keys under partial overlays. Adds a new opt-in `gsd-tools migrate-config` subcommand for explicit on-disk canonicalization of legacy-key shapes.
