<!-- docs-exempt: internal test refactor only — no user-facing surface changed -->

## Summary

Consolidates the Runtime Artifact Layout Module test cluster (ADR-3660) from 12 files spanning three module names (`surface-*`, `runtime-artifact-layout-*`, `install-profiles-*`) into 3 files, resolving the three-module-names → one-module name collapse.

- **8 files → `tests/runtime-artifact-layout.test.cjs` + `tests/runtime-artifact-layout-surface.test.cjs`**: layout-resolve (per-runtime structural shape, 15 runtimes), edge-cases (TypeError on unknown runtime / invalid args), stage (kind.stage() per kind type), applySurface/_syncGsdDir (file-sync behavior), resolveSurface (profile + cluster + explicit combinations), readSurface/writeSurface (state I/O round-trips), CLUSTERS data structure integrity, listSurface (enabled/disabled/tokenCost)
- **4 files → `tests/runtime-artifact-layout-install-profiles.test.cjs`**: stageSkillsForProfile, stageAgentsForProfile, stageSkillsForRuntimeAsSkills, resolveProfile transitive closure, PROFILES map, loadSkillsManifest frontmatter parsing, readActiveProfile/writeActiveProfile marker persistence
- All 122 tests preserved; 12 source files deleted
- Allowlist update deferred to rebase after #3738 merges
