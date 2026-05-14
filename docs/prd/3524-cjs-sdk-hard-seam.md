# PRD: CJS↔SDK hard seam — phased migration

- **Status:** Reference
- **Date:** 2026-05-14
- **Tracking issue:** [#3524](https://github.com/gsd-build/get-shit-done/issues/3524)
- **Related ADR:** [`docs/adr/3524-cjs-sdk-hard-seam.md`](../adr/3524-cjs-sdk-hard-seam.md)

## Why this PRD exists

The ADR defines the target architecture. This PRD defines *how to get there* without breaking the running system. The seam touches eight high-traffic responsibilities across two parallel implementations and ~80 KB of CJS plus ~150 TypeScript files of SDK. A big-bang rewrite would be a recipe for a regression cascade. The migration is phased so each phase is independently shippable, independently reversible, and produces measurable drift reduction.

## Problem statement

The CJS↔SDK boundary in `gsd-build/get-shit-done` is structurally permeable. Both sides define overlapping constants, defaults, schemas, and behavior. Today the boundary is policed only by:
- A naming-parity test (`tests/config-schema-sdk-parity.test.cjs`)
- Output-parity golden tests for read-only handlers (`sdk/src/golden/read-only-parity.integration.test.ts`)

These catch some drift but miss:
- Structure drift under defaults (#3523: top-level `branching_strategy` returned as `'none'` by CJS, `'phase'` by SDK)
- Warning/error-message drift (#3523: CJS warns falsely; SDK silently grafts)
- Mutation-path drift (each side tested separately; no cross-side mutation fixture)
- New-domain drift (a new constant added to one side and not the other is invisible)

Each of #1535, #1542, #2047/#2052, #2638/#2655, #2653/#2670, #2687/#2706, #2798/#2816, #3055/#3116, #3523 fits this shape.

## Goals

1. Eliminate the drift bug class. Concretely: zero new bugs with the `drift-recurrence` retroactive label in the four months following the seam landing.
2. One canonical owner per responsibility, enforced structurally.
3. CJS and SDK both consume a single source of truth for shared logic.
4. The mechanism scales: adding a new shared symbol is a one-place change.

## Non-goals

- Removing the CJS CLI. `gsd-tools` continues to exist for shell-script back-compat.
- Replacing the imperative CJS router with the declarative SDK registry.
- Migrating CJS-only domains (graphify, gsd2-import, schema-detect, fallow-runner, intel, drift) to SDK handlers.
- Changing the workflow-markdown convention for which CLI to invoke.

## Approach

A shared-core architecture with a dual CJS+ESM build artifact. Symbols in the canonical-owner table (see ADR §2) live in exactly one place. The losing-side definition is deleted; the losing side imports from shared core via `require()` (CJS) or `import` (SDK). Enforcement is layered: build-time greps, type-level contract test, mutation parity test, CODEOWNERS gate, in-file banner.

### Build pipeline addition

A new build step compiles `sdk/src/core/**/*.ts` to:
- `sdk/dist/core/*.cjs` (CommonJS, for `bin/lib/*.cjs` to `require`)
- `sdk/dist/core/*.mjs` (ESM, for SDK and downstream consumers)
- `sdk/dist/core/*.d.ts` (Type declarations)

Toolchain: `tsup` (preferred — single-config dual-format) or `tsc + rollup`. Decision in Phase 1.

The package.json `exports` map for `@gsd-build/sdk` adds a `./core` subpath:
```json
"exports": {
  ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" },
  "./core": { "require": "./dist/core/index.cjs", "import": "./dist/core/index.mjs", "types": "./dist/core/index.d.ts" }
}
```

CJS imports use a stable relative path during transition (e.g. `require('../../sdk/dist/core/config.cjs')`) before being switched to the package-subpath import once the npm publish includes both. The transition path is documented in Phase 1.

## Phased plan

Each phase has its own GitHub issue, linked back to #3524, opened only after the previous phase ships. Phases are independently revertible.

---

### Phase 1 — Shared data layer + build pipeline

**Goal:** Eliminate constant-definition drift. The smallest, lowest-risk, highest-confidence step.

**Scope:**
- Extract `CONFIG_DEFAULTS`, `VALID_CONFIG_KEYS`, `DYNAMIC_KEY_PATTERNS`, `RUNTIME_STATE_KEYS` to `sdk/shared/config-schema.json` and `sdk/shared/config-defaults.json`.
- Update `bin/lib/config-schema.cjs` and `bin/lib/core.cjs` to load these from JSON instead of inline.
- Update `sdk/src/query/config-schema.ts` and `sdk/src/config.ts` to load from the same JSON.
- Delete inline duplicates.
- Add `scripts/check-seam-ownership.cjs` and wire to CI. Initial allowlist covers only the symbols introduced in this phase.
- Add a banner generator (`scripts/generate-seam-banner.cjs`) and CI check that asserts each participating CJS file has the banner.
- Decide and document the dual-build toolchain (tsup vs tsc+rollup). Implement the empty `sdk/src/core/` build target wired into `npm run build:sdk`.

**Acceptance criteria:**
- [ ] `git grep -l 'CONFIG_DEFAULTS\s*=' get-shit-done/bin/lib/` returns no matches outside of `require()` statements.
- [ ] `git grep -l 'VALID_CONFIG_KEYS\s*=' get-shit-done/bin/lib/ sdk/src/` returns only the consumer of the shared JSON.
- [ ] `tests/config-schema-sdk-parity.test.cjs` passes against the shared JSON (no longer a Set-equality assertion, now a JSON-equality assertion).
- [ ] CI gate `scripts/check-seam-ownership.cjs` runs on every PR. Tested by intentional regression PR that fails the gate.
- [ ] `sdk/dist/core/` exists with at least one compiled module (placeholder shared util) and a documented build invocation.
- [ ] Banner present on participating CJS files; banner CI check passes.

**Out of phase 1:**
- Behavior consolidation. Phase 1 only moves *data*. Logic still duplicated.

**Rollback criteria:**
- Revert the branch. The data files become unreferenced; nothing crashes because the inline definitions are restored.

---

### Phase 2 — Config logic consolidation (closes the #3523 class)

**Goal:** One implementation of config load + normalization, used by both sides. Closes the bug class that triggered this work.

**Scope:**
- Move config-loading logic to `sdk/src/core/config.ts`:
  - `loadConfig(cwd)` — reads `.planning/config.json`, applies defaults, normalizes legacy keys, returns merged config.
  - `normalizeLegacyKeys(parsed)` — handles top-level `branching_strategy`, `sub_repos`, `multiRepo`, `depth`. Returns normalized object plus a list of normalizations applied (for migration logging).
  - `mergeDefaults(parsed)` — merges with `CONFIG_DEFAULTS` from shared data.
  - `migrateConfigOnDisk(cwd)` — explicit, opt-in disk writeback. Called by `gsd-tools migrate-config` and by the installer; *not* called silently inside `loadConfig`.
- Compile to `sdk/dist/core/config.cjs` and `.mjs`.
- Update `bin/lib/core.cjs:loadConfig` to delegate: `return require('../../sdk/dist/core/config.cjs').loadConfig(cwd)`. Delete the inline implementation. Keep the wrapper function shape so existing callers don't change.
- Update `sdk/src/config.ts` to re-export from `./core/config`. Delete the inline `mergeDefaults`.
- Update the seam-ownership grep to forbid local re-definitions of these functions in `bin/lib/*.cjs`.
- Promote `sdk/src/golden/read-only-parity.integration.test.ts` to include a fixture matrix for the four legacy-key normalizations (`branching_strategy` top-level, `sub_repos` top-level, `multiRepo: true`, `depth` set).
- Resolve the false-positive warning at `bin/lib/core.cjs:444-449` (the trigger bug #3523).

**Acceptance criteria:**
- [ ] `git grep -l 'function loadConfig' get-shit-done/bin/lib/` returns no matches that contain logic (only the delegating wrapper).
- [ ] `git grep -l 'function mergeDefaults' sdk/src/config.ts` returns the re-export only.
- [ ] Bug #3523 fixture passes: a `.planning/config.json` with top-level `branching_strategy: 'phase'` produces `branching_strategy: 'phase'` AND no false-positive warning, on both CJS and SDK paths.
- [ ] Same fixture applied to the other three legacy keys passes.
- [ ] Golden parity test green across the matrix.
- [ ] Bug #3523 closed with a back-reference to this phase.

**Rollback criteria:**
- Revert the branch; the inline implementations are restored from git history. The shared core file is left in place but orphaned. Documented in the rollback runbook.

---

### Phase 3 — Project-root + path projection consolidation

**Goal:** Single implementation of `findProjectRoot` and supporting path resolution.

**Scope:**
- Move `findProjectRoot`, `findEffectiveRoot`, and related project-root heuristics to `sdk/src/core/project-root.ts`.
- CJS `core.cjs:74-140` becomes a wrapper around the shared-core export.
- SDK `helpers.ts:497-630` becomes a wrapper around the shared-core export.
- Verify ADR-0006's `planningPaths()` is the only path-composition entry point on either side; refactor any remaining direct path joins.
- Extend golden parity test to cover sub_repo monorepo project-root resolution (the historical drift carrier).

**Acceptance criteria:**
- [ ] `git grep 'function findProjectRoot' get-shit-done/bin/lib/ sdk/src/` returns the canonical owner plus delegating wrappers only.
- [ ] Parity tests pass for: standalone project, monorepo with `planning.sub_repos`, legacy `multiRepo: true`.
- [ ] No regressions in init-handler tests on either side.

---

### Phase 4 — State + verify handler consolidation

**Goal:** State management and verify/audit logic share one canonical owner.

**Scope (state):**
- Promote `sdk/src/query/state*.ts` to canonical owner.
- CJS `state.cjs` shrinks to a thin subprocess shim that calls `gsd-sdk query state.*`. Sync I/O on the CJS side becomes a subprocess with the same exit semantics as today.
- Extend golden parity test for state mutations (`state.update`, `state.signal-waiting`, `state.sync`).

**Scope (verify):**
- Promote `sdk/src/query/verify.ts` to canonical owner.
- CJS `verify.cjs` becomes a subprocess shim.
- Golden parity test extended to verify-mutation pathways.

**Acceptance criteria:**
- [ ] CJS `state.cjs` and `verify.cjs` are <500 lines combined (down from ~3,000+). Logic gone; shim only.
- [ ] No workflow-markdown regression: all `gsd-tools state`/`gsd-tools verify` calls in `commands/` still produce equivalent output.
- [ ] Golden parity tests cover the canonical mutation handlers.

**Trade-off documented:**
- Subprocess overhead (~50–100 ms per CJS state/verify invocation). Acceptable because (a) most callers are workflow-markdown that already uses `gsd-sdk`, (b) the eliminated drift class outweighs the per-call cost.

---

### Phase 5 — Enforcement hardening + cleanup

**Goal:** Make the seam non-bypassable.

**Scope:**
- `sdk/src/contract/cjs-sdk-contract.test.ts` — type-level contract test that imports the CJS public surface (via a TS shim that types the `require()` results) and the SDK public surface, asserts shape equality on every symbol in the canonical-owner table.
- CODEOWNERS rule applied: `bin/lib/*.cjs` and `sdk/src/core/**` require `@gsd-build/architecture` review.
- Banner regenerator runs on pre-commit (via `husky` if present, or `lint-staged`) and on CI; absence fails the build.
- The seam-ownership grep is extended to cover every symbol in the canonical-owner table.
- ADR-0005's seam map is updated to reference this seam.
- ADR-0001 is amended to clarify CJS routers shell out to SDK for canonical handlers.
- Documentation: `docs/agents/cjs-sdk-seam.md` written, linked from CONTRIBUTING.md.
- Retrospective: review the recurring-bug list (#1535 ... #3523) and confirm each one would have been blocked by the now-in-place enforcement.

**Acceptance criteria:**
- [ ] CI has at least four independent checks for the seam: ownership grep, banner presence, contract test, golden parity matrix.
- [ ] Each of the recurring bugs is retroactively analyzed; for each, which enforcement layer would have blocked it is documented in `docs/agents/cjs-sdk-seam.md`.
- [ ] No PR can land that re-introduces a forbidden duplicate. Demonstrated by an intentional regression PR that gets blocked on every layer.

---

## Cross-phase concerns

### Backwards compatibility

The CJS public CLI surface (`gsd-tools <subcommand>`) does not change. Every flag, exit code, and stdout shape is preserved. Phases 2–4 promote internal logic without changing the external contract.

### Performance

Phases 1 and 5 add no runtime cost. Phase 2 may add 5–10 ms per `loadConfig` call (single `require` resolution into the compiled core). Phase 4 adds 50–100 ms per CJS state/verify invocation (subprocess startup). For workflow-markdown consumers the cost is zero because they call `gsd-sdk` directly.

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Subprocess shim regresses behavior in edge cases (env var inheritance, signal handling) | Medium | Golden parity tests catch divergence. Subprocess wrapper has explicit env-passthrough and signal-forwarding policy in code. |
| Dual-build pipeline produces drift between `.cjs` and `.mjs` outputs | Low | Same TypeScript source compiles to both. `tsup` handles this without configuration drift. Contract test exercises both outputs. |
| Phase 2 disk-writeback removal (`migrateConfigOnDisk` becomes explicit) silently changes user behavior | Medium | One-shot migration in installer is invoked on next `npm install -g get-shit-done-cc`. Release note. Manual `gsd-tools migrate-config` command added. |
| CODEOWNERS rule slows down architecture-team responsiveness, becomes a velocity blocker | Medium | Apply CODEOWNERS only to seam-canonical files. Adapters remain open. Architecture team commits to <24h SLA. |
| Phase boundaries are misjudged, work bleeds across phases | Low | Each phase ships independently. Bleed is detected at PR review and re-scoped. |

### Open questions

1. **Dual-build toolchain choice — tsup vs tsc+rollup?** Decided in Phase 1, before any other work.
2. **Subpath import strategy — package-relative vs `dist/` direct?** Decided in Phase 1.
3. **`migrateConfigOnDisk` rollout** — installer-only, or also a one-time hook on first `gsd-tools` invocation post-upgrade? Decided in Phase 2.
4. **Test fixture sharing format** — keep tmpdir-ephemeral, or move to committed fixture trees under `tests/fixtures/seam/`? Decided in Phase 2.

## Done when

#3524 is closed when all five phases have shipped, each with its own merged PR closing its own phase issue, and the retrospective check confirms every historical drift bug would have been blocked.
