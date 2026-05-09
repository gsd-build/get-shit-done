---
type: Fixed
pr: 3269
---
**Workstream name normalization** — workstream names are now consistently validated across CJS and SDK layers, accepting alphanumeric, hyphens, underscores, and dots (e.g. `v1.0`); path traversal via `..` sequences is blocked in both layers. The `model_profile: 'inherit'` sentinel no longer leaks as a literal model ID in session-runner. SDK `writeActiveWorkstream` now validates that the target workstream directory exists before writing the pointer.
