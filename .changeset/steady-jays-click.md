---
type: Fixed
pr: 3293
---
**`gsd-tools.cjs` and CJS fallback bridge work again post-install** — the install manifest now copies `sdk/shared/model-catalog.json` into the get-shit-done payload at `get-shit-done/bin/shared/model-catalog.json`, and `model-catalog.cjs` uses a resolve chain (co-located install path → source-repo dev path → `GSD_MODEL_CATALOG` env override). Regression introduced by #3230.
