---
type: Fixed
pr: 3196
---
**Workstream resolution in `init.milestone-op` and `roadmap.analyze`** — both handlers now respect the `--ws` flag, `GSD_WORKSTREAM` env, and the `.planning/active-workstream` file; workstream-scoped repos no longer exit with "All phases complete — Nothing left to do" due to `phase_count: 0` caused by reading from the wrong (root) `.planning/` directory.
