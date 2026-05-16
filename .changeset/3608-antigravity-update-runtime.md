---
type: Fixed
issue: 3608
---
**`/gsd-update` invoked from Antigravity now resolves the correct runtime instead of collapsing into base Gemini** — `get-shit-done/workflows/update.md` now models `antigravity` as a first-class runtime everywhere it lists candidate dirs / env vars / classification rules. `RUNTIME_DIRS`, the `PREFERRED_RUNTIME` env-var ladder, the local-scope scan loops, the `ENV_RUNTIME_DIRS` env push, and the path-to-runtime classification bullets all list `antigravity:.gemini/antigravity` (and `ANTIGRAVITY_CONFIG_DIR`) before the base Gemini entry so the more-specific match wins. Adds `tests/bug-3608-antigravity-update-runtime-classification.test.cjs` as a structural regression guard.
