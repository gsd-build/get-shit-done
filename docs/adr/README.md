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
| [0008-installer-migration-module.md](0008-installer-migration-module.md) | Installer Migration Module owns install-time upgrade safety | Accepted |
| [0011-runtime-install-policy-module.md](0011-runtime-install-policy-module.md) | Runtime Install Policy Module as shared runtime data | Accepted |

> Note: ADR slots 0009 and 0010 are reserved for decisions in flight on other branches and intentionally skipped here.

## Seam map

ADR 0005 is the top-level SDK seam index. It references per-seam ADRs and states the narrow-waist principle each seam follows. Use it as the entry point for understanding SDK module ownership.

ADR 0006 documents how SDK query handlers project planning paths (`cwd → effectiveRoot → .planning/<project>/...`). Cross-reference with the Planning Workspace Module (ADR 0004) for workstream pointer policy.

ADR 0008 documents the Installer Migration Module for safe install-time moves, removals, config rewrites, and user-data preservation.

ADR 0011 documents runtime install policy ownership. Cross-reference with the Runtime Install Policy Module glossary entry in `CONTEXT.md` for the boundary between shared runtime data, install plan projection, runtime mutation Adapters, and SDK query path projection.
