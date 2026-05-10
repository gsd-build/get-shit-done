# Runtime Install Policy Module as shared runtime data

- **Status:** Accepted
- **Date:** 2026-05-10

We decided to make runtime install targeting a shared **Runtime Install Policy Module** backed by shipped runtime data, with thin CJS and SDK Adapters projecting the existing install and query Interfaces.

## Context

Before this decision, runtime facts were spread across `bin/install.js`, CJS installer helpers, and SDK query helpers. Supported runtime keys, config directory fallbacks, skills layouts, hook capabilities, display names, and first-run notes could drift because each surface owned its own partial switch statement.

That shape fails the deletion test: deleting one Adapter should not require maintainers to rediscover runtime facts from another Adapter or from tests. The real behavior is the runtime install policy contract, not the syntax of an installer branch.

## Decision

The Runtime Install Policy Module owns:

- supported runtime keys and the all-runtimes selection option;
- local and global runtime target directory policy;
- runtime skills, agents, hooks, settings, and managed config mutation capabilities;
- install-mode staging metadata and first-run/display metadata;
- pure install plan projection from selected runtimes and environment inputs.

The canonical runtime data lives in `sdk/shared/runtime-install-policy.json`. CJS install surfaces load that data through `get-shit-done/bin/lib/runtime-install-policy.cjs`; SDK query surfaces load the same data directly for runtime config and skills path projection.

`bin/install.js` must remain an installer orchestrator. It may select runtimes, copy shared catalogs into the installed payload, and call the Runtime Install Executor, but it must not re-own runtime directory policy, skills layout policy, or config mutation intent selection.

Runtime-specific mutation behavior remains in concrete Adapters. `get-shit-done/bin/lib/runtime-install-executor.cjs` dispatches explicit plan intents through an adapter registry; it does not decide which runtimes support which capabilities.

## Consequences

Adding or removing a runtime fact happens in one shared data file, then CJS and SDK Adapters project the result.

Tests should compare Adapter projections to the shared Runtime Install Policy data and exercise representative install/query behavior. They should not keep duplicate runtime switches alive as the source of truth.

The installed package must include `get-shit-done/bin/shared/runtime-install-policy.json` next to the CJS policy Adapter so installed runtimes can resolve policy data without source-tree paths.

This decision extends the SDK seam map from `0005-sdk-architecture-seam-map.md` and complements the Model Catalog Module in `0003-model-catalog-module.md`; model defaults and runtime install targeting remain separate shared-policy seams.
