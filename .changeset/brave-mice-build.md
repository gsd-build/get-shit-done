---
type: Changed
pr: 3069
---

**query command metadata now flows through a canonical Command Definition Module seam** — registry assembly, mutation semantics, and alias generation consume one Interface (`family`, `canonical`, `aliases`, `mutation`, `output_mode`, `handler_key`) to improve locality and reduce drift.

**query fallback error mapping cleanup** — the CJS fallback catch path now passes original `err` to `mapFallbackDispatchError` (follow-up to prior review feedback missed in PR #3066).
