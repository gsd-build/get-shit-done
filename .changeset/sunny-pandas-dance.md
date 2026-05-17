---
type: Fixed
pr: 3527
---
**Top-level `branching_strategy` in `.planning/config.json` no longer triggers a false "unknown config key" warning** — `loadConfig` in `core.cjs` actively read the key via its nested fallback (`git.branching_strategy`) but the `KNOWN_TOP_LEVEL` allowlist was built from dot-notation paths via `.split('.')[0]`, turning `'git.branching_strategy'` into `'git'` instead of `'branching_strategy'`. The fix adds a self-healing on-disk migration (mirroring the existing `multiRepo → planning.sub_repos` precedent): on first `loadConfig`, the top-level key is grafted into `git.branching_strategy` and the stale top-level entry is removed. A module-level deduplication Set also prevents the same unknown-key warning from appearing twice when `loadConfig` is invoked multiple times in a single CLI call. A contract test asserts CJS and SDK agree on legacy-shape fixtures. (#3523)
