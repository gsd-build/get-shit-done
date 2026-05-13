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
| [0009-shell-command-projection-module.md](0009-shell-command-projection-module.md) | Shell Command Projection Module owns runtime-aware OS command rendering | Accepted |
| [0010-file-operation-engine-module.md](0010-file-operation-engine-module.md) | File Operation Engine Module owns safe runtime/config file mutations | Proposed |
| [0011-skill-surface-budget-module.md](0011-skill-surface-budget-module.md) | Skill Surface Budget Module owns install-time profile staging and runtime surface control | Accepted |

## Seam map

ADR 0005 is the top-level SDK seam index. It references per-seam ADRs and states the narrow-waist principle each seam follows. Use it as the entry point for understanding SDK module ownership.

ADR 0006 documents how SDK query handlers project planning paths (`cwd → effectiveRoot → .planning/<project>/...`). Cross-reference with the Planning Workspace Module (ADR 0004) for workstream pointer policy.

ADR 0008 documents the Installer Migration Module for safe install-time moves, removals, config rewrites, and user-data preservation.

ADR 0009 documents the Shell Command Projection Module seam for runtime-aware
projection of installer-owned command text and projection IR.

ADR 0010 documents the File Operation Engine Module seam for converging
installer/migration/planning file mutation safety policy, and its relationship
to ADR 0009 hook-command ownership policy.

ADR 0011 documents the Skill Surface Budget Module for install-time skill/agent
profile staging (`--profile=<name>`, `.gsd-profile` marker, `requires:` closure)
and the Phase 2 runtime `/gsd:surface` command for cluster-level enable/disable
without reinstall.
