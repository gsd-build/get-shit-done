---
type: Fixed
pr: 3763
---
**SDK commit handler now switches to the strategy branch before the first commit** — fixes the regression where PR #1279's branching logic only landed in the CJS path; pre-execution commits with `branching_strategy: phase` or `milestone` were landing on the wrong branch.
