# Handover: SDK query layer (registry, CLI, parity docs)

Paste this document (or `@sdk/HANDOVER-QUERY-LAYER.md`) at the start of a new session so work continues without re-deriving scope.

## Parent tracking

- **Issue:** [gsd-build/get-shit-done#2302](https://github.com/gsd-build/get-shit-done/issues/2302) — Phase 3 SDK query parity, registry, docs (umbrella #2007).
- **Workspace:** `D:\Repos\get-shit-done` (PBR backport). **Upstream:** `gsd-build/get-shit-done`. Confirm branch with `git branch` (typical: `feat/sdk-phase3-query-layer`).

### Scope anchors (do not confuse issues)


| Role                                    | GitHub                                                                                 | Notes                                                                                                                                                                                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Product / requirements anchor**       | [#2007](https://github.com/gsd-build/get-shit-done/issues/2007)                        | Problem statement, user stories, and target architecture for the SDK-first migration. **Do not** treat its original acceptance-checklist boxes as proof of what is merged upstream; work was split into phased PRs after maintainer review. |
| **Phase 3 execution scope**             | [#2302](https://github.com/gsd-build/get-shit-done/issues/2302) **+ this handover**    | What this branch is actually doing now: registry/CLI parity, docs, harness gaps, runner alignment follow-ups as listed below.                                                                                                               |
| **Patch mine (if local tree is short)** | [PR #2008](https://github.com/gsd-build/get-shit-done/pull/2008) and matching branches | Large pre-phasing PR; cherry-pick or compare when something looks missing vs that line of work.                                                                                                                                             |


---

## What was delivered (this line of work)

### 1. Parity documentation (`QUERY-HANDLERS.md`)

- **”Golden parity: coverage and exceptions”** — How `golden.integration.test.ts` compares SDK vs `gsd-tools.cjs` (full `toEqual`, subset, normalized `docs-init`, `intel.update` CJS parity, time-dependent fields, etc.).
- **”CJS command surface vs SDK registry”** — Naming aliases, CLI-only rows, SDK-only rows, and a **top-level `gsd-tools` command → SDK** matrix.
- `docs/CLI-TOOLS.md` — Short “Parity & registry” pointer into those sections.
- `HANDOVER-GOLDEN-PARITY.md` — One paragraph linking to the same sections.

### 2. `gsd-sdk query` tokenization (`normalizeQueryCommand`)

- **Problem:** `gsd-sdk query` used only argv[0] as the registry key, so `query state json` dispatched `state` (unregistered) instead of `state.json`.
- **Fix:** `sdk/src/query/normalize-query-command.ts` merges the same **command + subcommand** patterns as `gsd-tools` `runCommand()` (e.g. `state json` → `state.json`, `init execute-phase 9` → `init.execute-phase`, `scaffold …` → `phase.scaffold`, `progress bar` → `progress.bar`). Wired in `sdk/src/cli.ts` before `registry.dispatch()`.
- **Tests:** `sdk/src/query/normalize-query-command.test.ts`.

### 3. `phase add-batch` in the registry

- **Implementation:** `phaseAddBatch` in `sdk/src/query/phase-lifecycle.ts` — port of `cmdPhaseAddBatch` from `get-shit-done/bin/lib/phase.cjs` (batch append under one roadmap lock; sequential or `phase_naming: custom`).
- **Registration:** `phase.add-batch` and `phase add-batch` in `sdk/src/query/index.ts`; listed in `QUERY_MUTATION_COMMANDS` (dotted + space forms).
- **Tests:** `describe('phaseAddBatch')` in `sdk/src/query/phase-lifecycle.test.ts`.
- **Docs:** `QUERY-HANDLERS.md` updated — `phase add-batch` is **registered**; CLI-only table no longer lists it.

### 4. `state load` fully in the registry (split from `state json`)

Previously `state.json` and `state.load` were easy to confuse: CJS has two different commands — `cmdStateJson` (`state json`, rebuilt frontmatter) vs `cmdStateLoad` (`state load`, `loadConfig` + `state_raw` + existence flags).

- `stateJson` — `sdk/src/query/state.ts`; registry key `state.json`.
- `stateProjectLoad` — `sdk/src/query/state-project-load.ts`; registry key `state.load`. Uses `createRequire` to call `core.cjs` `loadConfig(projectDir)` from the same resolution paths as a normal install (bundled monorepo path, `projectDir/.claude/get-shit-done/...`, `~/.claude/get-shit-done/...`). `GSDTools.stateLoad()` and `formatRegistryRawStdout` for `--raw` no longer force a subprocess solely for this command.
- **Risk:** If `core.cjs` is absent (e.g. some `@gsd-build/sdk`-only layouts), `state.load` throws `GSDError` — document; future option is a TS `loadConfig` port or bundling.
- **Goldens:** `read-only-parity.integration.test.ts` — one block compares `state.json` to `state json` (strip `last_updated`); another compares `state.load` to `state load` (full `toEqual`). `read-only-golden-rows.ts` `readOnlyGoldenCanonicals()` includes both `state.json` and `state.load`.

---

## Query surface completeness (snapshot)


| Status                   | Surface                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| **Registered**           | Essentially all `gsd-tools.cjs` `runCommand` surfaces, including `phase.add-batch`.          |
| **CLI-only (by design)** | `graphify`, `from-gsd2` — not in `createRegistry()`; documented in `QUERY-HANDLERS.md`.  |
| **SDK-only extra**       | `phases.archive` — no `gsd-tools phases archive` subcommand (CJS has `list` / `clear` only). |


**Programmatic API:** `createRegistry()` / `registry.dispatch('dotted.name', args, projectDir)`.

**CLI:** `gsd-sdk query …` — apply `normalizeQueryCommand` semantics (or pass dotted names explicitly).

**Still not unified:** `GSDTools` (`sdk/src/gsd-tools.ts`) shells out to `gsd-tools.cjs` for plan/session flows; migrating callers to the registry is separate #2302 / runner work. `state load` is **not** among the subprocess-only exceptions anymore (it uses the registry like other native query handlers when native query is active).

---

## Canonical files


| Path                                        | Role                                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------------- |
| `sdk/src/query/index.ts`                    | `createRegistry()`, `QUERY_MUTATION_COMMANDS`, handler wiring.                         |
| `sdk/src/query/state-project-load.ts`       | `state.load` — CJS `cmdStateLoad` parity (`loadConfig` + `state_raw` + flags). |
| `sdk/src/query/normalize-query-command.ts`  | CLI argv → registry command string.                                                    |
| `sdk/src/cli.ts`                            | `gsd-sdk query` path (uses `normalizeQueryCommand`).                                   |
| `sdk/src/query/QUERY-HANDLERS.md`           | Registry contracts, parity tiers, CJS matrix, mutation notes.                          |
| `sdk/src/golden/golden.integration.test.ts` | Golden parity vs `captureGsdToolsOutput()`.                                            |
| `docs/CLI-TOOLS.md`                         | User-facing CLI; links to parity sections.                                             |


Related handovers: `HANDOVER-GOLDEN-PARITY.md`, `HANDOVER-PARITY-DOCS.md` (older parity-doc brief; content largely folded into `QUERY-HANDLERS.md`).

---

## Roadmap: parity vs decision offloading

Work that moves **deterministic** orchestration out of AI/bash and into **SDK queries** (historically `gsd-tools.cjs`) has **two layers**. Do not confuse them:


| Layer                    | Goal                                                                                                                                                                         | What “done” looks like                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Parity / migration**   | Existing CLI behavior is **stable and testable** in the registry so callers can use `gsd-sdk query` instead of `node …/gsd-tools.cjs` without silent drift.                  | Goldens + `QUERY-HANDLERS.md`; same JSON/`--raw` contracts as CJS.                      |
| **Offloading decisions** | **New or consolidated** queries replace repeated `grep`, `ls` piped to `wc -l`, many `config-get`s, and inline `node -e` in workflows — so the model does less parsing and branching. | Fewer inline shell blocks; measurable token/step reduction on representative workflows. |


Phase 3–style registry work mainly advances **parity**. The `decision-routing-audit.md` proposals are mostly **offloading** — they assume parity exists for commands workflows already call.

### Decision-routing audit (proposed `gsd-tools` / SDK queries)

Source: `.planning/research/decision-routing-audit.md` §3. **Tier** = priority from §5 (implementation order). **Do not implement** = explicitly rejected in the audit.

| # | Proposed command | Tier | Notes |
|---|------------------|------|--------|
| 3.1 | `route next-action` | **1** | Next slash-command from `/gsd-next`-style routing. |
| 3.2 | `check gates <workflow>` | 3 | Safety gates (continue-here, error state, verification debt). |
| 3.3 | `check config-gates <workflow>` | **1** | Batch `workflow.*` config for orchestration (replaces many `config-get`s). |
| 3.4 | `check phase-ready <phase>` | **1** | Phase directory readiness + `next_step` hint. |
| 3.5 | `check auto-mode` | 2 | `auto_advance` + `_auto_chain_active` → single boolean. |
| 3.6 | `detect phase-type <phase>` | 2 | Structured UI/schema detection (replaces fragile grep). |
| 3.7 | `check completion <scope>` | 2 | Phase or milestone completion rollup. |
| 3.8 | `check verification-status <phase>` | 3 | VERIFICATION.md parsing for routing. |
| 3.9 | `check ship-ready <phase>` | 3 | Ship preflight (`ship.md`). |
| 3.10 | `route workflow-steps <workflow>` | ❌ **Do not implement** | Pre-computed step lists are unsound when mid-workflow writes change state. See `review-and-risks.md` §3.6. |

**Not in audit:** `phase-artifact-counts` was only an example in an older handover line; there is no §3.11 for it — add via a new research doc if needed.

**SDK registry (Tier 1):** **Done** — `check.config-gates`, `check.phase-ready`, `route.next-action` in `createRegistry()` (`sdk/src/query/index.ts`). Documented in `sdk/src/query/QUERY-HANDLERS.md` § Decision routing (**SDK-only** until/unless mirrored in `gsd-tools.cjs`).

**Simple roadmap (execute in order):**

1. **Harden parity** for surfaces workflows already depend on (registry dispatch, goldens, docs) so swaps from CJS to `gsd-sdk query` stay safe.
2. **Ship 1–2 high-leverage consolidation handlers** from the audit (pick based on impact and risk; examples: `check auto-mode`, `phase-artifact-counts`, `route next-action` — with **display/routing fields** required by `review-and-risks.md` if applicable). Each needs handlers, tests, and `QUERY-HANDLERS.md` notes. **Progress:** `check.auto-mode` shipped (`sdk/src/query/check-auto-mode.ts`); Tier 1 `route.next-action` already registered.
3. **Rewrite one heavy workflow** (e.g. `next.md` or a focused slice of `autonomous.md`) to consume those queries and **measure** before/after (steps, tokens, or both). **Progress:** `execute-phase.md`, `discuss-phase.md`, `discuss-phase-assumptions.md`, and `plan-phase.md` (UI gate) now use `check auto-mode` instead of paired `config-get`s where applicable.
4. **Maintain a living boundary** between SDK (**data, deterministic checks**) and workflows (**judgment, sequencing, user-facing messages**). Extend `decision-routing-audit.md` §6 (decisions that stay with the AI) and `review-and-risks.md` “Do not implement” (e.g. no pre-computed `route workflow-steps`) as you add primitives. **Progress:** audit §3.5 / Tier 2 #4 updated to reference SDK implementation.

**Gaps to keep in mind when designing new queries:** call-time vs stale data after file writes (re-query volatile fields); workflows own gates/UX; behavioral contracts (e.g. UI keyword lists) must match existing greps; `stderr`/`stdout` and JSON shapes stable for bash/`jq`; hybrid `require(core.cjs)` paths called out for minimal installs.

**Research references (repo root):** `.planning/research/decision-routing-audit.md`, `.planning/research/review-and-risks.md`, `.planning/research/inline-computation-audit.md`, `.planning/research/questions.md` (Q1 boundary). For parity mechanics, prefer `sdk/src/query/QUERY-HANDLERS.md` and `HANDOVER-GOLDEN-PARITY.md`.

---

## Suggested next session

(Strategic ordering of **parity vs decision offloading** is in **Roadmap** above.)

1. ~~**Golden test for `phase.add-batch`**~~ — Done: `sdk/src/golden/mutation-subprocess.integration.test.ts` (`phase.add-batch` JSON parity vs CJS).
2. ~~**Re-export `normalizeQueryCommand`**~~ — Done: exported from `sdk/src/query/index.ts` and `sdk/src/index.ts` (`@gsd-build/sdk`).
3. **Issue #2302 follow-ups** — Runner alignment (`GSDTools` → registry where appropriate). **`configGet`** now uses `dispatchNativeJson` with canonical `config-get` (fixes subprocess argv vs real `gsd-tools.cjs`, which has no `config` + `get` top-level). Keep `graphify` / `from-gsd2` out of scope unless product reopens.
4. **Drift check** — When adding CJS commands, update `QUERY-HANDLERS.md` matrix and golden docs in the same PR.

---

## Verification commands

```bash
cd sdk
npm run build
npx vitest run src/query/normalize-query-command.test.ts src/query/phase-lifecycle.test.ts src/query/registry.test.ts --project unit
npx vitest run src/golden/golden.integration.test.ts --project integration
```

(Adjust `--project` to match `sdk/vitest.config.ts`.)

---

## Success criteria (query-layer slice)

- Parity expectations and CJS↔SDK matrix documented in one place (`QUERY-HANDLERS.md`).
- `gsd-sdk query` understands two-token command patterns like `gsd-tools`.
- `phase add-batch` implemented and registered; **only** intentional CLI-only gaps remain (**graphify**, **from-gsd2**).

---

*Created/updated for query-layer handoff. Revise when registry surface, golden coverage, or the parity/offloading roadmap changes materially.*