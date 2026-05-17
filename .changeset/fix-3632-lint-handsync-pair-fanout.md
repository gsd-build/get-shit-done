---
type: Fixed
pr: 3632
---
**`lint-shared-module-handsync` now reports unauthorized ts siblings even when a co-named sibling is allowlisted** — when a `bin/lib/<name>.cjs` had two ts candidates on disk (e.g. `sdk/src/<name>.ts` and `sdk/src/query/<name>.ts`) and only one pair was in the allowlist, the `.some()` short-circuit silently skipped the unallowlisted sibling. Each ts candidate is now classified independently so partial-allowlist drift surfaces correctly.
