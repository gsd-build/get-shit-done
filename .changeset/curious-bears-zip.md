---
type: Changed
pr: 3554
---
**Project-Root Resolution Module unifies CJS and SDK `findProjectRoot` callers** — the previously-duplicated 67-line CJS and 94-line SDK implementations at `bin/lib/core.cjs:74-140` and `sdk/src/query/helpers.ts:497-590` are replaced by a single shared Module (`sdk/src/project-root/index.ts`) emitted to a CJS mirror via the existing generator pattern. The four-heuristic resolution logic (own `.planning/` guard #1362, parent `sub_repos`, legacy `multiRepo: true`, `.git` ancestor fallback) is byte-identical across runtimes, enforced by a CI freshness check. Two pre-existing CJS↔SDK drift deltas canonicalized to the SDK behavior: walk-up is now bounded by `FIND_PROJECT_ROOT_MAX_DEPTH = 10` (previously unbounded on CJS), and `.planning/config.json` is read via raw `readFileSync` (previously `platformReadSync` on CJS — functionally equivalent since the surrounding `try/catch` swallowed both fail-modes). Closes #3553. (`#3554`)
