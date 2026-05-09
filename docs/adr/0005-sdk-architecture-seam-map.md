# SDK Architecture seam map for query/runtime surfaces

- **Status:** Accepted
- **Date:** 2026-05-09

We decided to keep SDK architecture explicitly module-seamed rather than allow feature logic to spread across query handlers, runtime adapters, and compatibility shims. This ADR is the top-level map for SDK seams and their ownership boundaries.

## Decision

- Treat the SDK as a composition of explicit seam Modules with thin call-site Adapters.
- Keep compatibility policy isolated behind the **SDK Package Seam Module** (see `0007-sdk-package-seam-module.md`).
- Keep dispatch transport/outcome policy behind the **Dispatch Policy Module** and **SDK Runtime Bridge Module** (see `0001-dispatch-policy-module.md` amendment).
- Keep model/runtime profile resolution behind the **Model Catalog Module** (see `0003-model-catalog-module.md`).
- Keep planning/worktree/workstream path-state policy behind the **Planning Workspace Module** (see `0004-worktree-workstream-seam-module.md`).
- Keep planning path projection policy explicit and centralized (detailed in `0006-planning-path-projection-module.md`).

## Consequences

- SDK callers (`init*`, query handlers, runtime entry points) remain thin Adapters over stable interfaces.
- Changes to package layout compatibility, dispatch transport, model policy, and planning path policy are localized to owning Modules.
- Architecture reviews can classify drift quickly: if behavior changes outside owning seam Module, it is a design violation.
