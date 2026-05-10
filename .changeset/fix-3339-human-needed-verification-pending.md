---
type: Fixed
pr: 3339
---
**Human-needed verification no longer completes phases or passes ship preflight** — SDK phase execution now keeps `human_needed` and missing verification results pending instead of advancing to `phaseComplete`, and `check.ship-ready` only passes explicit `pass` / `passed` verification status. Closes #3323.
