---
type: Fixed
pr: 3572
---

**Installed `gsd-tools.cjs` can load generated configuration manifests** — runtime installs now copy `config-defaults.manifest.json` and `config-schema.manifest.json` into `get-shit-done/bin/shared/`, and `configuration.generated.cjs` resolves that co-located install path before falling back to the source checkout `sdk/shared/` path. This prevents direct installed CJS invocations from failing with `MODULE_NOT_FOUND` when no sibling `sdk/` checkout exists. (#3571)
