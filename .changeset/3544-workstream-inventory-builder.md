---
type: Added
pr: 3548
---
**Adds a generated Workstream Inventory Builder seam with freshness guards** — introduces `sdk/src/workstream-inventory/builder.ts` (and tests) as the canonical builder source, generates `get-shit-done/bin/lib/workstream-inventory-builder.generated.cjs`, wires `check-workstream-inventory-builder-fresh` into hooks/CI, and updates inventory docs/manifests so SDK and installer-facing artifacts stay synchronized.
