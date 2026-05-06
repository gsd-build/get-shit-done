<!-- CLASSIFICATION: UNCLASSIFIED -->
# IC Pack Architecture

> **Status:** Stub. The full architectural treatment lives in [the design spec](../specs/2026-05-05-ic-agent-pack-design.md). This document will be expanded into a customer-friendly subset as agents land in Plans 1–8.

## Six-layer model (summary; see spec §4.1)

```
Layer 5: Program project context     (.planning/intel-context.md)
Layer 4: Customer skill overlay      (one selected at install)
Layer 3: Skills (4 behavioral)       (skills/)
Layer 2: Manifest-indexed refs       (intel-refs/MANIFEST.json + intel-refs/**/*.md)
Layer 1: Thin agent files (58)       (agents/gsd-*.md)
Layer 0: Hooks (3, deterministic)    (hooks/gsd-*.js)
```

CI/validation gates every state change to any layer.

## Seamless-fork guarantee

With every gate and hook disabled in `.planning/intel-gates.json`, an installed program behaves bit-for-bit identically to a stock GSD program. The IC pack adds capabilities; it never silently changes or removes stock GSD behavior. Validated on every release by `tools/ci/validate-seamless-fork.sh`.
