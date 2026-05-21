# CommandRoutingHub as single dispatch seam for CJS command families

- **Status:** Accepted
- **Date:** 2026-05-20

## Context

Eight `*-command-router.cjs` files (`phase`, `phases`, `roadmap`, `state`, `verify`, `validate`, `init`, `frontmatter`) each duplicate the same three-part dispatch pattern: (1) check `GSD_WORKSTREAM` + `tryLoadSdk()` to decide whether to use the SDK or CJS handler, (2) invoke the selected path, (3) map errors to the `error()` callback. The duplicated mode-selection logic means a policy change (e.g., adding a new fallback condition) must be applied in eight places. Tests for these routers are mock-heavy — they stub `tryLoadSdk`, stub `getExecuteForCjs`, and assert on internal call shapes rather than observable dispatch outcomes. The SDK-vs-CJS fallback decision is smeared across every router, making it impossible to reason about or test the policy in isolation.

## Decision

Introduce `CommandRoutingHub` (`get-shit-done/bin/lib/command-routing-hub.cjs`) as the single dispatch seam for all CJS command family routers. The hub contract:

```
createHub({ mode: 'sdk' | 'cjs', sdkLoader, cjsRegistry, manifest }) -> hub
hub.dispatch({ family, subcommand, args, cwd, raw }) -> Result

Result = { ok: true, data }
       | { ok: false, errorKind, message, details? }
```

Load-bearing design properties:

- **Pure result**: the hub never prints to stdout/stderr, never calls `process.exit`, and never throws. All internal throws are caught and converted to `{ ok: false, errorKind: 'HandlerFailure' }`.
- **Mode fixed at construction**: `mode` is set once when `createHub` is called; it is never re-evaluated per dispatch call. Each adapter (caller) computes mode based on its own env/sdk-load context before constructing the hub.
- **No transparent fallback**: an SDK-mode hub that encounters an SDK crash or load failure returns `{ ok: false, errorKind: 'SdkDispatchFailed' }` or `'SdkLoadFailed'` respectively. It does not silently retry via the CJS registry.
- **Closed `errorKind` enum**: the six error kinds (`UnknownCommand`, `InvalidArgs`, `HandlerRefusal`, `HandlerFailure`, `SdkLoadFailed`, `SdkDispatchFailed`) are exported as a frozen `ERROR_KINDS` object. Callers switch on `ERROR_KINDS` values, not bare string literals. Adding a new error kind requires amending this ADR.

The router adapter's responsibilities shrink to: determine mode from env, build stubs/registry, construct hub, dispatch, translate the pure Result to `output()`/`error()` calls. Each adapter remains a thin CLI-facing translation layer.

`phase-command-router.cjs` is migrated as the proof-of-concept for this PR. Remaining routers migrate in follow-up issues.

## Consequences

- **Positive**: policy (mode decision, no-throw contract, error taxonomy) is concentrated in one module rather than duplicated across eight. Testing the policy requires only the hub unit tests; adapter tests verify translation correctness (args → dispatch, Result → output/error).
- **Positive**: future routers can be onboarded by wiring `cjsRegistry` entries rather than hand-replicating the SDK/CJS conditional block.
- **Constraint**: adding a new `errorKind` value requires updating `ERROR_KINDS` in `command-routing-hub.cjs` AND amending this ADR. The closed enum is the drift-prevention property; the amendment requirement makes scope of impact explicit.
- **Constraint**: each adapter must compute mode before hub construction (no lazy re-evaluation). This is intentional — mode ambiguity at dispatch time is a prior source of subtle test flakiness.

## References

- Extends ADR-0001 (Dispatch Policy Module) — the hub implements the no-throw + structured-result contract ADR-0001 established for the SDK query layer, applying it to the CJS adapter layer.
- Issue: [#3788](https://github.com/gsd-build/get-shit-done/issues/3788)
