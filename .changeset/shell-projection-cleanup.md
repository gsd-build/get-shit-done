---
type: Changed
pr: 3468
---
Remove the now-unused legacy I/O wrappers (`atomicWriteFileSync`, `safeReadFile`, `normalizeMd`) from `core.cjs` after Phase 3 migrated every call site to the `shell-command-projection` seam. Migrates 3 stragglers Phase 3 missed (`graphify.cjs`, `template.cjs`, dead `safeReadFile` import in `profile-pipeline.cjs`). Wrapper-specific tests retired or repointed at the seam; behavioral / snapshot / perf regression coverage for markdown normalization preserved via `normalizeContent`. See #3468.
