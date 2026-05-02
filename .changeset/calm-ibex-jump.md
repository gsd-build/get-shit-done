---
type: Changed
pr: 2986
---
Test suite for config-schema.cjs is now mutation-resistant — 95 typed assertions kill the 124 surviving Stryker mutants from the 4.62% baseline. Tests target static-key fast path, dynamic-pattern .some semantics, polarity, and regex-anchor tightening. See #2986.
