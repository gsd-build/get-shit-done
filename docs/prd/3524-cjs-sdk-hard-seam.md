# PRD: CJS↔SDK hard seam — Shared-Module migration

- **Status:** Reference
- **Date:** 2026-05-14
- **Tracking issue:** [#3524](https://github.com/gsd-build/get-shit-done/issues/3524)
- **Related ADR:** [`docs/adr/3524-cjs-sdk-hard-seam.md`](../adr/3524-cjs-sdk-hard-seam.md)

## Why this PRD exists

The ADR defines the target architecture — one source of truth per Shared Module, reusing the existing `command-aliases.generated.*` precedent. This PRD defines *how to get there* without breaking the running system. The migration is sequenced so the smallest, lowest-risk Shared Module ships first as a working proof of the pattern. Subsequent phases apply the same pattern to higher-stakes Modules. Each phase is independently shippable and independently reversible.

## Problem statement

The CJS↔SDK boundary in `gsd-build/get-shit-done` is structurally permeable. Multiple Shared Modules — STATE.md Document Module, Workstream Inventory Module, and several others — exist today as **hand-synced pairs** of `.cjs` and `.ts` files with character-identical implementations. Constants (`CONFIG_DEFAULTS`, `VALID_CONFIG_KEYS`) are likewise defined twice. The boundary is policed only by:

- A naming-parity test (`tests/config-schema-sdk-parity.test.cjs`)
- Output-parity golden tests for read-only handlers (`sdk/src/golden/read-only-parity.integration.test.ts`)

These catch some drift but miss:
- Structure drift under defaults (#3523: top-level `branching_strategy` returned as `'none'` by CJS, `'phase'` by SDK)
- Warning/error-message drift (#3523: CJS warns falsely; SDK silently grafts)
- Mutation-path drift (each side tested separately; no cross-side mutation fixture)
- New-Module drift (a new constant added to one side and not the other is invisible)

Each of #1535, #1542, #2047/#2052, #2638/#2655, #2653/#2670, #2687/#2706, #2798/#2816, #3055/#3116, #3523 fits this shape.

The fix is mechanical: for every hand-synced pair, replace one side with a generated artifact derived from the other side as the source of truth, modeled on the existing `sdk/scripts/gen-command-aliases.ts` + `sdk/scripts/check-command-aliases-fresh.mjs` pattern.

## Goals

1. Eliminate the drift bug class. Concretely: zero new bugs with the `drift-recurrence` retroactive label in the four months following the seam landing.
2. One source of truth per Shared Module, enforced by per-Module freshness checks at PR time.
3. Hand-synced pairs of `.cjs`/`.ts` files become impossible to merge (lint gate).
4. No new build tooling. The existing generator pattern scales.

## Non-goals

- Removing the CJS CLI. `gsd-tools` continues to exist for shell-script back-compat. (Its dispatcher delegates to the SDK runtime bridge after Phase 5; the external CLI contract is unchanged.)
- Migrating CJS-only Modules (graphify, gsd2-import, schema-detect, fallow-runner, intel, drift) to SDK handlers.
- Defining a Verify Module before the verify surface has a shared Interface. Verify-surface deepening is precondition work for a future enhancement.

## Approach

The repo already has a working precedent for shared CJS/SDK Modules: `sdk/scripts/gen-command-aliases.ts` emits both `sdk/src/query/command-aliases.generated.ts` and `get-shit-done/bin/lib/command-aliases.generated.cjs` from a single TypeScript source. `sdk/scripts/check-command-aliases-fresh.mjs` is the CI freshness gate that fails when either generated file drifts from the source. This PRD generalizes that pattern to every Shared Module.

For each Shared Module being migrated:

1. Promote one side to the source of truth (the TS source, because it already carries types).
2. Write `sdk/scripts/gen-<module>.ts` that emits both `.generated.ts` and `.generated.cjs`.
3. Write `sdk/scripts/check-<module>-fresh.mjs` modeled on `check-command-aliases-fresh.mjs`.
4. Replace the hand-authored CJS file with a thin re-export from the generated file.
5. Wire the freshness check into CI.
6. Once green for one release cycle, delete the now-unreferenced hand-authored content from history's view by removing dead re-exports.

A separate, standing CI lint (`scripts/lint-shared-module-handsync.cjs`, introduced in Phase 6) blocks any new hand-synced pair from being merged.

## Phased plan

Phases are sized to ship in one to two PRs each. Each phase has its own GitHub issue, linked back to #3524, opened only after the previous phase ships.

---

### Phase 1 — STATE.md Document Module (smallest possible proof)

**Why first.** `bin/lib/state-document.cjs` and `sdk/src/query/state-document.ts` are already a character-identical hand-synced pair of pure transforms (the file headers explicitly say "Pure transforms for STATE.md text. This module does not read the filesystem and does not own persistence or locking."). Deletion test passes on contact: one side can be deleted as soon as the other becomes the generated artifact. This is the safest possible first step and the canonical proof that the generator pattern works for executable logic, not just alias tables.

**Scope:**
- Promote `sdk/src/query/state-document.ts` to a source under `sdk/src/state-document/index.ts` (or keep in place — decided in implementation).
- Write `sdk/scripts/gen-state-document.ts` that emits `get-shit-done/bin/lib/state-document.generated.cjs` (and optionally re-exports the TS form at its existing location).
- Write `sdk/scripts/check-state-document-fresh.mjs` modeled on `check-command-aliases-fresh.mjs`.
- Replace `bin/lib/state-document.cjs` content with a thin re-export from `state-document.generated.cjs`. Keep the existing filename so callers (e.g. `workstream-inventory.cjs:16`) don't need to update imports.
- Wire `check-state-document-fresh.mjs` into CI alongside `check-command-aliases-fresh.mjs`.

**Acceptance criteria:**
- [ ] `bin/lib/state-document.cjs` contains only a re-export from `state-document.generated.cjs`.
- [ ] `sdk/scripts/check-state-document-fresh.mjs` passes in CI and fails when intentionally desynchronized.
- [ ] All existing call sites (CJS: `state.cjs`, `workstream-inventory.cjs`; SDK: `state-mutation.ts`, `state-project-load.ts`, others importing `state-document`) work unchanged.
- [ ] Existing STATE.md unit tests on both sides pass.
- [ ] CONTEXT.md "STATE.md Document Module" entry is amended (one sentence) to note the source-of-truth file path.

**Rollback:** Revert the branch. Re-importing the deleted CJS file content from git history restores the prior hand-synced shape. No external consumer is broken.

---

### Phase 2 — Configuration Module (closes the #3523 class)

**Why second.** This is the Module that triggered the work. It is the highest-leverage drift surface and the test of whether the pattern scales from a pure-transform Module to a Module that consumes data manifests.

**Scope:**
- Add a **Configuration Module** entry to `CONTEXT.md` first. Definition: "Module owning config load, legacy-key normalization, defaults merge, and explicit on-disk migration for `.planning/config.json`." Interface and invariants per ADR §6.
- Extract `CONFIG_DEFAULTS`, `VALID_CONFIG_KEYS`, `DYNAMIC_KEY_PATTERNS`, `RUNTIME_STATE_KEYS` to two data manifests: `sdk/shared/config-schema.manifest.json` and `sdk/shared/config-defaults.manifest.json`. Precedent: `sdk/shared/model-catalog.json`.
- Write the Configuration Module source at `sdk/src/configuration/index.ts`. Implementation imports the two manifests and exports `loadConfig`, `normalizeLegacyKeys`, `mergeDefaults`, `migrateOnDisk`.
- Write `sdk/scripts/gen-configuration.ts` to emit `get-shit-done/bin/lib/configuration.generated.cjs` and (if needed) `sdk/src/query/config-schema.generated.ts`.
- Write `sdk/scripts/check-configuration-fresh.mjs`.
- Replace the inline implementations in `bin/lib/core.cjs:loadConfig` (lines 220–243, 434–449, 485) and `bin/lib/config.cjs` (the validation surface) with thin Adapters over the generated Module. Delete the inline `CONFIG_DEFAULTS`, the false-positive warning at `core.cjs:444-449`, and the duplicated `_deepMergeConfig`.
- Replace `sdk/src/config.ts:mergeDefaults` (lines 192–218) with a re-export from the new Module.
- Extend `sdk/src/golden/read-only-parity.integration.test.ts` with a fixture matrix for the four legacy-key normalizations: top-level `branching_strategy`, top-level `sub_repos`, `multiRepo: true`, top-level `depth`.

**Acceptance criteria:**
- [ ] `CONTEXT.md` contains a Configuration Module entry with the Interface contract.
- [ ] `bin/lib/core.cjs` and `bin/lib/config.cjs` contain no local `CONFIG_DEFAULTS` or `VALID_CONFIG_KEYS` literals; both load from the manifests via the generated Module.
- [ ] Bug #3523 fixture matrix passes on both CJS and SDK paths; the false-positive warning at the old `core.cjs:444-449` site is gone.
- [ ] Golden parity matrix green for all four legacy-key shapes.
- [ ] Bug #3523 closed with a back-reference to this phase.

**Rollback:** Revert the branch; inline implementations restore from git history. The manifest files remain unreferenced.

---

### Phase 3 — Workstream Inventory Builder + remaining hand-synced pairs

**Why third.** Phase 1 proves the pattern for pure transforms. Phase 2 proves it for data-manifest-backed logic. Phase 3 generalizes across the remaining hand-synced pairs surfaced by the audit. The Workstream Inventory Module is the headline because it requires the **Builder/Reader split** — the projection logic is pure and shareable, but the directory traversal is legitimately sync (CJS) vs async (SDK). This is the pattern for every paired Module with mixed pure-and-I/O concerns.

**Scope:**
- Write the Workstream Inventory Builder source at `sdk/src/workstream-inventory/builder.ts`. Pure function: takes a list of directory entries plus per-workstream STATE.md text plus plan-scan results and returns the typed `WorkstreamPhaseInventory`/`WorkstreamInventory` projection. No fs reads.
- Write `sdk/scripts/gen-workstream-inventory-builder.ts` to emit `get-shit-done/bin/lib/workstream-inventory-builder.generated.cjs` and `sdk/src/query/workstream-inventory-builder.generated.ts`.
- Write `sdk/scripts/check-workstream-inventory-builder-fresh.mjs`.
- Refactor `bin/lib/workstream-inventory.cjs` to a sync Reader Adapter: does `fs.readdirSync` + `readFileSync` of STATE.md, calls the Builder. The projection logic is removed.
- Refactor `sdk/src/query/workstream-inventory.ts` to an async Reader Adapter: same shape, async I/O, calls the Builder.
- Amend the `CONTEXT.md` "Workstream Inventory Module" entry with a sub-paragraph documenting the Builder/Reader split.
- Audit remaining likely pairs (`frontmatter.cjs`↔`frontmatter-mutation.ts`, `plan-scan.cjs`↔`plan-scan` SDK equivalents) for pure-transform sharability. For each confirmed-shareable pair, apply the same Builder pattern in this phase. For pairs whose duplication is structural (e.g. routing tables, sync vs async with different return shapes), document the decision in the phase issue and defer.

**Acceptance criteria:**
- [ ] `bin/lib/workstream-inventory.cjs` and `sdk/src/query/workstream-inventory.ts` no longer share projection logic; both call the generated Builder.
- [ ] CONTEXT.md "Workstream Inventory Module" entry reflects the split.
- [ ] Workstream-related golden tests pass on both sides.
- [ ] Every additional Module in scope has its own freshness check.
- [ ] Each Module not migrated in this phase has a one-paragraph deferral note (in the phase issue, not in the ADR).

---

### Phase 4 — Project-Root Resolution Module

**Scope:**
- Add a **Project-Root Resolution Module** entry to `CONTEXT.md`. Interface: `findProjectRoot(startDir)`, `findEffectiveRoot(startDir, options)`.
- Source at `sdk/src/project-root/index.ts`. Pure function: takes a path and an injected fs probe (or just uses `node:fs` since both runtimes have it synchronously).
- Generator at `sdk/scripts/gen-project-root.ts`.
- Freshness check at `sdk/scripts/check-project-root-fresh.mjs`.
- Replace `bin/lib/core.cjs:74-140` with a thin Adapter over the generated Module.
- Replace `sdk/src/helpers.ts:497-630` with a thin Adapter over the same Module.
- Extend parity tests for: standalone project, monorepo with `planning.sub_repos`, legacy `multiRepo: true`, deep nesting.

**Acceptance criteria:**
- [ ] `findProjectRoot` is defined exactly once in source form.
- [ ] Both sides import the generated Module.
- [ ] Parity tests pass for the four configurations above.

---

### Phase 5 — CJS Command Router Adapter: delegate to the SDK runtime bridge

**Why fifth.** Phases 1–4 collapse drift in *shared* logic. Phase 5 collapses drift in *parallel* logic — the per-side state/verify/init/phase/roadmap/validate handler implementations on the CJS side. After Phase 5, every canonical command running via `gsd-tools` executes the same SDK handler that `gsd-sdk query` executes, in-process, with no subprocess hop. The seam becomes a real wall.

**Scope:**
- Amend the existing `CJS Command Router Adapter Module` CONTEXT.md entry to document runtime-bridge delegation.
- Expose a synchronous-friendly entry on `QueryRuntimeBridge` for CJS callers. Today `QueryRuntimeBridge.execute()` is async; the bridge gains a `executeForCjs(input) → { exitCode, stdoutChunks, stderrLines }` synchronous wrapper that runs the dispatch under `deasync` or a controlled `runUntil` semantic. (Toolchain choice resolved in the Phase 5 issue; if synchronous bridging is not viable, fall back to `Atomics.wait` on a worker channel — never `gsd-sdk` subprocess.)
- Replace each canonical-family `handlers` map in `bin/lib/*-command-router.cjs` with a generated delegate emitter that, per subcommand, calls `executeForCjs({ canonical, argv, env, cwd })` and writes the result through the existing CJS output Adapter.
- For each canonical command family in order — `state.*`, `verify.*`, `phase.*`, `phases.*`, `validate.*`, `roadmap.*`, `init.*`, `frontmatter.*`, `config.*`, plus the non-family commands listed in `sdk/src/query/command-manifest.non-family.ts` — migrate one family per sub-PR. Run the golden parity matrix per family before merging.
- Delete CJS-side handler files (or shrink to delegates) for each migrated family: `state.cjs`, `verify.cjs`, `init.cjs`, `phase.cjs`, `phases.cjs`, `validate.cjs`, `roadmap.cjs`, `milestone.cjs`, `frontmatter.cjs`, `config.cjs` write paths, plan-scan handlers, etc. The pure-transform Shared Modules from Phases 1–4 remain untouched; only the per-family handler entry points are replaced.
- CJS-only Module handlers (`graphify`, `gsd2-import`, `schema-detect`, `fallow-runner`, `intel`, `drift`, `installer-migrations`) keep their in-process CJS implementations. They are not in the canonical family registry and do not route through the SDK runtime bridge.
- Extend `sdk/src/golden/golden.integration.test.ts` to verify identical exit code + stdout chunks + stderr lines between `gsd-tools <family> <subcommand>` (now delegated) and `gsd-sdk query <canonical>` for every canonical command in the manifest.

**Acceptance criteria:**
- [ ] CONTEXT.md "CJS Command Router Adapter Module" entry documents runtime-bridge delegation.
- [ ] `QueryRuntimeBridge.executeForCjs` (or equivalent) ships with the synchronous semantics resolved in the phase issue.
- [ ] Every canonical command family in `command-manifest.*.ts` routes via `executeForCjs`. CJS-only commands continue to route via the existing CJS handler.
- [ ] Each per-family CJS handler file (`state.cjs`, `verify.cjs`, …) contains no command-specific logic — only the delegate wiring or has been deleted entirely.
- [ ] Golden parity matrix verifies output equivalence across `gsd-tools` and `gsd-sdk` for every canonical command. No regressions in workflow markdown that calls `gsd-tools`.
- [ ] Subprocess overhead per `gsd-tools` invocation does not increase (the bridge is in-process, not a `gsd-sdk` subprocess).

**Rollback (per family):** Each family's PR is independently revertible. The CJS handler files for an un-migrated family remain on disk in git history; if a family's delegation regresses, revert that family's PR and the CJS-side handler is restored.

**Out-of-scope under Phase 5:** The CJS-only Modules (graphify, gsd2-import, etc.) and workflow markdown that calls them — those calls continue to hit the in-process CJS handler, no change. Migrating CJS-only Modules to SDK is a separate enhancement.

---

### Phase 6 — Enforcement hardening + retrospective

**Scope:**
- Write `scripts/lint-shared-module-handsync.cjs`. Greps for any pair of files at `get-shit-done/bin/lib/<name>.cjs` and `sdk/src/query/<name>.ts` (or `sdk/src/<name>.ts`) where neither file matches `*.generated.*` and the pair is not on an explicit allow-list. Allow-list documents the cooperating-sibling exceptions (e.g. routing files where the implementations are structurally different).
- Verify each Shared Module from Phases 1–4 has its own freshness check wired to CI.
- Verify Phase 5's golden parity matrix covers every canonical command family.
- Add CODEOWNERS rules for `sdk/src/<module>/**` for each Shared Module source-of-truth directory, for `sdk/shared/*.manifest.json`, and for `sdk/src/query-runtime-bridge.ts` (the Phase 5 boundary). Architecture-team review required.
- Retrospectively walk the recurring-bug list (#1535 ... #3523). For each, document in `docs/agents/cjs-sdk-seam.md` which enforcement layer (handsync lint, freshness check, manifest data isolation, per-Module drift lint, runtime-bridge delegation) would have blocked it.
- Write `docs/agents/cjs-sdk-seam.md` as a CONTRIBUTING-linked guide for adding a new Shared Module and for adding a new canonical command.

**Acceptance criteria:**
- [ ] `lint-shared-module-handsync.cjs` runs in CI; demonstrated to block an intentional regression PR.
- [ ] Every Shared Module from Phases 1–4 appears in a freshness-check workflow step.
- [ ] Phase 5's golden parity matrix is in CI on every PR that touches `bin/lib/*` or `sdk/src/query/*`.
- [ ] CODEOWNERS rules in place.
- [ ] Retrospective document committed.
- [ ] No PR can land that re-introduces the #3523 anti-pattern or that bypasses the runtime-bridge delegation for a canonical command.

---

## Cross-phase concerns

### Backwards compatibility

The CJS public CLI surface (`gsd-tools <subcommand>`) does not change. Flags, exit codes, stdout shapes preserved. Every phase replaces internal implementations behind the existing Module Interfaces; the external contracts are pinned by the existing golden parity suite plus the new fixture matrices.

### Performance

No subprocess overhead anywhere. The generated `.cjs` files are `require`-able CommonJS modules; the SDK consumes the TS source directly. Module load cost adds ≤ 10 ms per `require` across all phases combined.

Phase 5 specifically preserves the in-process model: `QueryRuntimeBridge.executeForCjs` runs the SDK handler in the same Node process as the CJS dispatcher. No `gsd-sdk` subprocess is invoked. Synchronous bridging adds at most a handful of microseconds per call vs the previous direct CJS handler invocation, dominated by the existing dispatch policy overhead.

### Build/install pipeline impact

- Each generator runs at build time on the developer machine (and in CI for the freshness check). No runtime generator execution.
- The published `get-shit-done-cc` package already includes both `get-shit-done/bin/` and `sdk/dist/`. The generated `.cjs` files are committed to the repo (like `command-aliases.generated.cjs` today), so the install flow is unchanged — no on-install code generation.
- `npm run build:sdk` continues to do what it does. Generators are invoked via `npm run gen:<module>` per the existing precedent.

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Generator output drifts from source between commits | Medium | `check-<module>-fresh.mjs` per Module catches this at PR time. Precedent already in use for command-aliases. |
| A Shared Module's TS source uses features not expressible in CommonJS output | Low | Generator emits a CJS-compatible subset (no ESM-only syntax in source). Existing `gen-command-aliases.ts` template covers this. |
| Phase 2's removal of inline `_deepMergeConfig` changes a subtle merge semantic | Medium | Golden parity matrix is the test. If `_deepMergeConfig` and the new Module disagree on a fixture, the matrix fails and the new Module is amended before merge. |
| `migrateOnDisk` rollout silently changes user-visible behavior on upgrade | Medium | `migrateOnDisk` is explicit and opt-in; installer calls it once on next upgrade, with a release-note entry. Standalone command `gsd-tools migrate-config` for manual invocation. |
| CODEOWNERS rule slows down architecture-team responsiveness | Medium | Apply CODEOWNERS only to source-of-truth directories and manifests. Adapters and `.generated.*` files remain open. Architecture team commits to a ≤ 24 h SLA. |
| Phase 3's audit surfaces more pairs than expected, scope creeps | Medium | Each non-Phase-1/2 Module is scope-checked in its phase issue. Pairs that don't fit cleanly are deferred with a documented reason. |
| Phase 5's synchronous-bridging mechanism (`executeForCjs`) has no clean shape — `deasync` is C++-bound, `Atomics.wait` requires a Worker, refactoring every SDK handler to be sync is huge | High | Phase 5 spike resolves this before any family migration. If no clean mechanism exists, Phase 5 is descoped to the families whose SDK handlers are already synchronous, and the remainder shift to a follow-up enhancement. |
| Phase 5 family migrations regress observable CJS output (exit codes, stdout/stderr shape) | Medium | Golden parity matrix per family is the gate. A family's PR cannot merge until the matrix is green across every canonical command in that family. |
| Phase 5 changes startup time because the SDK runtime bridge eagerly loads more handlers than the previous CJS routers | Low | Lazy-load handlers behind the bridge (already the SDK's model). Measure `time gsd-tools state load` before/after migration; fail the family PR if median latency regresses >20 ms. |

### Open questions (resolved before the phase that depends on them)

1. **Phase 1 source location** — `sdk/src/state-document/index.ts` (move) vs `sdk/src/query/state-document.ts` (in place). Decided when Phase 1 PR is drafted.
2. **Phase 2 manifest format** — JSON vs JSONC vs TypeScript-as-source. Decided in Phase 2. JSON wins unless we need comments for invariants documentation.
3. **Phase 3 sibling-Module audit** — exact list of pairs that get Builder-split vs deferred. Decided as a deliverable of Phase 3's spike.
4. **Phase 5 synchronous-bridging mechanism** — `executeForCjs` implementation strategy: `deasync` native module (battle-tested but C++ binding), `Atomics.wait` on a worker channel (zero-binding but spins a Worker), or refactor every async SDK handler to expose a sync entry point (cleanest but largest scope). Decided in the Phase 5 spike issue before any family migration begins.
5. **Phase 5 family migration order** — which canonical family migrates first. Recommended order: smallest read-only family first (likely `frontmatter.*` or `config.* read paths`) as the proof of pattern, then state/verify/phase/roadmap/validate/init in increasing complexity. Decided in the Phase 5 issue.
6. **Phase 6 retrospective format** — table vs prose. Decided when the retrospective document is drafted.

## Done when

`#3524` is closed when all six phases have shipped, each with its own merged PR closing its own phase issue, and the Phase 6 retrospective confirms every historical drift bug from the recurring list would have been blocked by one of the five enforcement layers (handsync lint, freshness check, manifest data isolation, per-Module drift lint, runtime-bridge delegation).
