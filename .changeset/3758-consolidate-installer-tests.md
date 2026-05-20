---
type: Changed
pr: 3758
---
<!-- docs-exempt: internal test refactor, no API/behavior change -->
**Consolidate Installer Module tests — 11 files → 2** — Merged `hermes-install`, `kilo-install`, `qwen-install`, `trae-install`, `antigravity-install`, `install-minimal`, `install-minimal-all-runtimes`, `install-minimal-backcompat`, `install-hermes-regressions`, `install-hooks-copy`, and `install-uninstall-layout-loop` test files into `tests/install.test.cjs` (parameterized over all 15 runtimes) and `tests/install-regressions.test.cjs` (date-stamped bug reproductions). Adds Contract 6 counter-test: `resolveRuntimeArtifactLayout` throws `TypeError` for unknown runtimes. Fixes latent `GSD_TEST_MODE` env-pollution bug in all spawned-installer tests. (#3758)
