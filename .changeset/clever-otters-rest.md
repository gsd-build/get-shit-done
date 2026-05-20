---
type: Fixed
pr: 3770
---
Pre-execution commits via `gsd-sdk query commit` (used by /gsd-discuss-phase, /gsd-plan-phase) now honor `git.branching_strategy`. Ports PR #1279's strategy-branch-before-commit logic from the CJS `cmdCommit` path to the SDK commit handler so planning artifacts land on the configured phase/milestone branch instead of `main`.
