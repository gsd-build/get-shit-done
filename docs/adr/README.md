# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for GSD.

Each ADR documents one architectural decision: what was decided, why, and what consequences follow. ADRs are append-only. Amendments extend existing ADRs with a dated section rather than replacing them.

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [0001-dispatch-policy-module.md](0001-dispatch-policy-module.md) | Dispatch policy module as single seam for query execution outcomes | Accepted |
| [0002-command-contract-validation-module.md](0002-command-contract-validation-module.md) | Command Contract Validation Module | Accepted |
| [0003-model-catalog-module.md](0003-model-catalog-module.md) | Model Catalog Module as single source of truth for agent profiles and runtime tier defaults | Accepted |
| [0004-worktree-workstream-seam-module.md](0004-worktree-workstream-seam-module.md) | Planning Workspace Module as single seam for worktree and workstream state | Accepted |
| [0005-sdk-architecture-seam-map.md](0005-sdk-architecture-seam-map.md) | SDK Architecture seam map for query/runtime surfaces | Accepted |
| [0006-planning-path-projection-module.md](0006-planning-path-projection-module.md) | Planning Path Projection Module for SDK query handlers | Accepted |
| [0007-sdk-package-seam-module.md](0007-sdk-package-seam-module.md) | SDK Package Seam Module owns SDK-to-get-shit-done-cc compatibility | Accepted |

## Seam map

ADR 0005 is the top-level SDK seam index. It references per-seam ADRs and states the narrow-waist principle each seam follows. Use it as the entry point for understanding SDK module ownership.

ADR 0006 documents how SDK query handlers project planning paths (`cwd → effectiveRoot → .planning/<project>/...`). Cross-reference with the Planning Workspace Module (ADR 0004) for workstream pointer policy.
