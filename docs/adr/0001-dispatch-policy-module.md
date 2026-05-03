# Dispatch policy module as single seam for query execution outcomes

We decided to centralize query dispatch outcomes in one Dispatch Policy Module that returns a structured union result (`ok` success or failure with typed `kind`, `details`, and final `exit_code`) instead of mixing throws and ad-hoc error mapping across CLI and SDK paths. This keeps fallback policy, timeout classification, and exit mapping in one place for better locality, prevents drift between native and fallback behavior, and makes callers thin adapters over a stable interface.

## Amendment (2026-05-03): query seam deepening completion

To complete the query architecture pass, we deepened adjacent seams around the Dispatch Policy Module:

- Extracted **Query Runtime Context Module** to own `projectDir` + `ws` resolution policy.
- Extracted **Native Dispatch Adapter Module** so Dispatch Policy consumes a stable native dispatch Interface (not closure-wired call sites).
- Extracted **Query CLI Output Module** to own projection from dispatch results/errors to CLI output contract.
- Converged internal command-resolution and policy imports onto canonical modules and removed dead wrapper modules.
- Added **Command Topology Module** as dispatch-facing seam that resolves commands, projects command policy, binds handler Adapters, and emits no-match diagnosis consumed by Dispatch Policy.
- Locked **pre-project query config policy** for parity-sensitive query Interfaces: when `.planning/config.json` is absent, use built-in defaults and parity-aligned empty model ids for model-resolution surfaces.
- Gated real-CLI SDK E2E suites behind explicit opt-in (`GSD_ENABLE_E2E=1`) to keep default CI/local verification deterministic while preserving full-path validation when requested.

### Dead-wrapper convergence

Removed wrapper Modules after call-site convergence:
- `normalize-query-command.ts`
- `command-resolution.ts`
- `policy-convergence.ts`
- `query-policy-snapshot.ts`
- `query-registry-capability.ts`

This amendment preserves the original ADR direction: keep policy depth high, adapters thin, and locality concentrated in explicit modules.
