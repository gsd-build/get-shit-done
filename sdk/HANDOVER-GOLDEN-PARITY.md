# Handover: Query layer + golden parity

Use this document at the start of a new session so work continues in context without re-deriving history.

**Related:** `HANDOVER-PARITY-DOCS.md` (#2302 scope); **`sdk/src/query/QUERY-HANDLERS.md`** (golden matrix, CJS↔SDK routing).

---

## Goal for the next session (primary)

**Track A (Golden/parity) is complete.** 127/128 canonicals covered — the single exception (`phases.archive`) is permanent (SDK-only, no CJS analogue). Focus shifts to the remaining #2302 acceptance criteria.

**Ongoing:** pick next gap from **`GOLDEN_PARITY_EXCEPTIONS`** / registry orphans (run `golden-policy.test.ts`) or expand **`READ_ONLY_JSON_PARITY_ROWS`** for read-only handlers still on generic exceptions. The read-only batch in **§ Next batch** below is **done**.

**Follow-up:** confirm **`GOLDEN_PARITY_EXCEPTIONS`** for any remaining read-only registry gaps (`learnings.query`, `progress.bar`, `profile-questionnaire` — still exception-only until strict rows); extend **`read-only-golden-rows.ts`** when aligned.

### Remaining work — ordered by priority

1. **Track C — Runner alignment** (not started)
   - `PhaseRunner` and `InitRunner` both take `GSDTools` (subprocess bridge) as a `tools` dependency (`phase-runner.ts:55`, `init-runner.ts:70`).
   - Issue #2302 says: "Align programmatic paths with the same contracts as query handlers (shared helpers or registry dispatch), **without** removing `GSDTools`."
   - Concretely: where runners currently shell out via `GSDTools.run('state update …')`, they could call the typed handler (`stateUpdate()`) directly or dispatch through `createRegistry()`. This eliminates subprocess overhead on the hot path while keeping `GSDTools` exported for backward compatibility.
   - Files to touch: `sdk/src/phase-runner.ts`, `sdk/src/init-runner.ts`, `sdk/src/index.ts` (re-exports). Tests: `phase-runner.integration.test.ts`, `init-e2e.integration.test.ts`, `lifecycle-e2e.integration.test.ts`.
   - **Risk:** Runner integration tests are slow and sensitive to state. Approach: swap one `tools.run()` call at a time, verify the integration test still passes, then proceed to the next.

2. **Track B — CHANGELOG.md [Unreleased] entries** (not started)
   - `CHANGELOG.md` has an `[Unreleased]` section but no Phase 3 entries yet.
   - Add entries covering: golden parity policy gate, mutation subprocess infrastructure, handler alignment, profile-output port, CJS deprecation header.
   - `docs/CLI-TOOLS.md` already references `QUERY-HANDLERS.md` and SDK query layer — may need minor polish but is substantively done.
   - `QUERY-HANDLERS.md` is maintained and current.

3. **Track D — CJS deprecation headers** (done)
   - `gsd-tools.cjs` already has `@deprecated` JSDoc header (lines 3-6) pointing to `gsd-sdk query` and `@gsd-build/sdk`.
   - No additional CJS file deletion in scope per #2302.

4. **CI verification** (should run before any PR)
   - Run full integration suite: `npx vitest run --project integration` (mutation subprocess + read-only parity + golden composition).
   - Verify against CI matrix expectations: Ubuntu + macOS, Node 22 + 24.

### Acceptance criteria from #2302 — status

| Criterion | Status | Notes |
| --------- | ------ | ----- |
| Policy gate | **Done** | `verifyGoldenPolicyComplete()` green; 0 orphan canonicals |
| Parity | **Done** | 127/128 covered; strict rows, mutation subprocess, composition goldens |
| Registry | **Done** | CJS-only matrix in `QUERY-HANDLERS.md`; `docs/CLI-TOOLS.md` updated |
| Runners (Track C) | **Not started** | `PhaseRunner`/`InitRunner` still use `GSDTools` subprocess bridge |
| Deprecation (Track D) | **Done** | `@deprecated` header on `gsd-tools.cjs` |
| Docs | **Partial** | `QUERY-HANDLERS.md` current; `CHANGELOG.md` [Unreleased] needs Phase 3 entries |
| CI | **Not verified** | Unit tests green (1261/1261); integration suite not run this session |

---

## Repo / branch

- **Workspace:** `D:\Repos\get-shit-done` (GSD PBR backport initiative).
- **Feature branch:** `feat/sdk-phase3-query-layer` (62 commits ahead of `main`; confirm against `origin` before merging).
- **Upstream PRs:** `gsd-build/get-shit-done` issue #2302.

---

## Golden parity architecture (current)

| Piece | Role |
| ----- | ---- |
| `sdk/src/golden/registry-canonical-commands.ts` | One canonical dispatch string per unique handler (`pickCanonicalCommandName`). |
| `sdk/src/golden/golden-integration-covered.ts` | Canonicals exercised by **`golden.integration.test.ts`** (subset/full/shape tests). |
| `sdk/src/golden/read-only-golden-rows.ts` | **Strict** `JsonParityRow[]` for `read-only-parity.integration.test.ts` (`toEqual` on parsed CJS JSON vs `sdkResult.data`). |
| `sdk/src/golden/read-only-parity.integration.test.ts` | Rows from `READ_ONLY_JSON_PARITY_ROWS` + **`config-path`** (plain stdout vs `{ path }`, `path.normalize`) + **`verify.commits`**. |
| `sdk/src/golden/capture.ts` | `captureGsdToolsOutput` (JSON stdout); **`captureGsdToolsStdout`** (raw stdout, e.g. `config-path`). |
| `sdk/src/golden/golden-policy.ts` | `GOLDEN_PARITY_INTEGRATION_COVERED` = integration ∪ `readOnlyGoldenCanonicals()` ∪ **`GOLDEN_MUTATION_SUBPROCESS_COVERED`**; `GOLDEN_PARITY_EXCEPTIONS` includes `NO_CJS_SUBPROCESS_REASON`, then `MUTATION_DEFERRED_REASON` for remaining mutations, else read-only. |
| `sdk/src/golden/golden-mutation-covered.ts` | Canonicals exercised by **`mutation-subprocess.integration.test.ts`** (must match non-skipped tests). |
| `sdk/src/golden/mutation-subprocess.integration.test.ts` | Tmp fixture + `captureGsdToolsOutput` vs `registry.dispatch`; dual sandbox per comparison. |
| `sdk/src/golden/mutation-sandbox.ts` | `createMutationSandbox({ git?: boolean })` — copy fixture, optional `git init` + commit. |
| `sdk/src/golden/golden-policy.test.ts` | Calls `verifyGoldenPolicyComplete()` so every canonical is covered or excepted. |

**Invariant:** Every canonical from `getCanonicalRegistryCommands()` is either in `GOLDEN_PARITY_INTEGRATION_COVERED` or has an exception string—**never** leave orphans by removing tests.

---

## Reference pattern: porting like `scan-sessions` and `workstream.status`

These were fixed by **aligning the TypeScript handler with the CJS implementation**, then adding a row to `READ_ONLY_JSON_PARITY_ROWS`.

1. **Find the CJS source of truth**  
   - `scan-sessions`: `get-shit-done/bin/lib/profile-pipeline.cjs` → `cmdScanSessions`  
   - `workstream status`: `get-shit-done/bin/lib/workstream.cjs` → `cmdWorkstreamStatus`  
   - `gsd-tools.cjs` `runCommand` switch shows the top-level command and argv.

2. **Implement or adjust the SDK module**  
   - Example: `sdk/src/query/profile-scan-sessions.ts` mirrors the project-array build from `cmdScanSessions`; `scanSessions` in `profile.ts` parses `--path` / `--verbose`, throws when no sessions root (same error text as CJS), returns `{ data: projects }` where `projects` matches CJS JSON array.

3. **Add a parity row** in `read-only-golden-rows.ts` with `canonical`, `sdkArgs`, `cjs`, `cjsArgs` (must match what `execFile(node, [gsdToolsPath, command, ...args])` expects).

4. **Run**  
   `cd sdk && npm run build && npx vitest run src/golden/read-only-parity.integration.test.ts src/golden/golden-policy.test.ts --project integration --project unit`

5. **Policy**  
   `readOnlyGoldenCanonicals()` picks up new canonicals automatically; no manual duplicate if the canonical is already in the JSON row list.

**When not to copy line-for-line:** subprocess-only concerns (e.g. `agents_installed` / `missing_agents` differing from in-process `~` resolution). Then **normalize in the test** (see `golden.integration.test.ts` `docs-init`: sort `existing_docs`, omit install fields)—**document in QUERY-HANDLERS.md**, do not delete the assertion.

---

## Completed — Track A (golden parity)

All 127 portable canonicals have subprocess or in-process parity coverage. Summary of completed work by batch:

### Profile-output + milestone subprocess batch (latest)

**`write-profile`**, **`generate-claude-profile`**, **`generate-dev-preferences`**, **`generate-claude-md`** — implemented in **`sdk/src/query/profile-output.ts`** (templates from `get-shit-done/templates/`, same JSON as `profile-output.cjs`); re-exported from **`profile.ts`**. **`milestone.complete`** — full port of **`cmdMilestoneComplete`** in **`phase-lifecycle.ts`**; **`readModifyWriteStateMdFull`** in **`state-mutation.ts`** for STATE writes matching CJS.

### Mutation subprocess infrastructure

**`mutation-subprocess.integration.test.ts`** — tmp fixture `sdk/src/golden/fixtures/mutation-project/` + `createMutationSandbox()` (`mutation-sandbox.ts`). **`assertJsonParity`** runs CJS and SDK on **two fresh sandboxes** (factory fn) so neither run sees the other's filesystem mutations. **`GOLDEN_MUTATION_SUBPROCESS_COVERED`** lists canonicals with non-skipped subprocess assertions. Handlers covered: `config-ensure-section`, `commit`, `commitToSubrepo`, `configSetModelProfile`, `state.patch`, `frontmatter.set`/`merge`, `workstream.progress`, `workstream.set`, nine `state.*` subprocess tests, `write-profile`, `generate-claude-profile`, `generate-dev-preferences`, `generate-claude-md`, `milestone.complete`, `init.remove-workspace`.

### CJS mutation handler alignment

`commit.ts` — `--files` argv boundary, `commitToSubrepo` config check, `checkCommit` `allowed` field. `state-mutation.ts` — `readModifyWriteStateMdFull`, `statePlannedPhase`=`cmdStatePlannedPhase`, record-session/add-decision/add-blocker/resolve-blocker/record-metric/update-progress JSON shapes. `phase-lifecycle.ts` — `milestone.complete`. `workstream.ts` — `workstream.progress` (`cmdWorkstreamProgress`), `workstream.set`. `roadmap.ts` — extracted `roadmapUpdatePlanProgress` to own module. `frontmatter-mutation.ts` — `--field`/`--value`, `--data` parsing. `config-mutation.ts` — `configSetModelProfile` CJS-shaped `{ updated, profile, previousProfile, agentToModelMap }`. `config-query.ts` — `getAgentToModelMapForProfile()`.

### Read-only parity rows (earlier batches)

`progress.table` / `stats.table`, `progress.bar`, `learnings.query`, `profile-questionnaire`, `verify.references`, `init.*` composition goldens (9 handlers), `profile-sample`, `extract-messages`, `uat.render-checkpoint`, `validate.agents` + `state.get`, `skill-manifest`, `audit-open` + `audit-uat`, `intel.extract-exports`, `summary-extract` + `history-digest`, `stats.json`, `todo.match-phase`, `verify.key-links`, `verify.schema-drift`, `state-snapshot`, `state.json`/`state.load`, `scan-sessions`, `workstream.status`.

---

## Next batch — summary / audit / skill / validate / UAT / intel / profile / init

**Same workflow as above:** read `gsd-tools.cjs` `runCommand` for argv → implement/adjust `sdk/src/query/*.ts` → add `READ_ONLY_JSON_PARITY_ROWS` and/or a **named `describe` block** with documented omissions → `npm run build` → `read-only-parity.integration.test.ts` + `golden-policy.test.ts`.

| Priority | Command (CLI) | `gsd-tools.cjs` case / args | CJS implementation | SDK module | Notes |
| -------- | ------------- | -------------------------- | -------------------- | ---------- | ----- |
| ~~1~~ | ~~`summary-extract <path>`~~ `[--fields a,b]` | `summary-extract` | `commands.cjs` `cmdSummaryExtract` (~L425) | `summary.ts` `summaryExtract` | **Done:** strict `READ_ONLY_JSON_PARITY_ROWS`; `summary.ts` aligned with `commands.cjs`; `extractFrontmatterLeading` in `frontmatter.ts` for first-`---`-block parity with `frontmatter.cjs`. |
| ~~2~~ | ~~`history-digest`~~ | `history-digest` | `commands.cjs` `cmdHistoryDigest` (~L133) | `summary.ts` `historyDigest` | **Done:** same row / handler alignment as above. |
| ~~3~~ | ~~`audit-open`~~ | `audit-open` `[--json]` | `audit.cjs` `auditOpenArtifacts` + optional `formatAuditReport` | `audit-open.ts` | **Done:** `--json` parity test + `scanned_at` normalization; `sanitizeForDisplay` = `security.cjs`. |
| ~~4~~ | ~~`audit-uat`~~ | `audit-uat` | `uat.cjs` `cmdAuditUat` | `uat.ts` `auditUat` | **Done:** `auditUat` ports `cmdAuditUat` (`parseUatItems`, milestone filter, `summary.by_*`); strict `READ_ONLY_JSON_PARITY_ROWS` row. |
| ~~5~~ | ~~`skill-manifest`~~ | `skill-manifest` + args | `init.cjs` `cmdSkillManifest` (~L1829) | `skill-manifest.ts` | **Done:** strict row; `extractFrontmatterLeading` for CJS parity (see `QUERY-HANDLERS.md`). |
| ~~6~~ | ~~`validate agents`~~ | `validate` + `agents` | `verify.cjs` `cmdValidateAgents` (~L997) | `validate.ts` `validateAgents` | **Done:** strict row; `getAgentsDir` parity with `core.cjs`; `MODEL_PROFILES` includes `gsd-pattern-mapper` (sync with `model-profiles.cjs`). |
| ~~7~~ | ~~`uat render-checkpoint --file <path>`~~ | `uat` subcommand | `uat.cjs` `cmdRenderCheckpoint` | `uat.ts` `uatRenderCheckpoint` | **Done:** strict row; fixture `sdk/src/golden/fixtures/uat-render-checkpoint-sample.md`; see `QUERY-HANDLERS.md`. |
| ~~8~~ | ~~`intel extract-exports <file>`~~ | `intel` `extract-exports` | `intel.cjs` `intelExtractExports` (~L502) | `intel.ts` `intelExtractExports` | **Done:** strict row + handler parity with `intel.cjs` (fixed file e.g. `sdk/src/query/utils.ts`). |
| ~~9~~ | ~~`extract-messages`~~ | `extract-messages` + project/session flags | `profile-pipeline.cjs` | `profile.ts` `extractMessages` | **Done:** `profile-extract-messages.ts` + golden `output_file` strip + JSONL compare; fixture `extract-messages-sessions/`. |
| ~~10~~ | ~~`profile-sample`~~ | `profile-sample` | `profile-pipeline.cjs` | `profile.ts` `profileSample` | **Done:** `profile-sample.ts` + golden `output_file` strip + JSONL compare; fixture `profile-sample-sessions/`. |
| ~~11~~ | ~~**`init.*` read-only JSON**~~ | various | `init.cjs` / `init-complex` | `init.ts`, `init-complex.ts` | **Done:** `golden.integration.test.ts` + nine init composition tests; `withProjectRoot` / `subagent_timeout` / `GOLDEN_INTEGRATION_MAIN_FILE_CANONICALS`; see `QUERY-HANDLERS.md`. |

**Suggested order:** Audit/read-only batch above is complete — follow-ups via **`GOLDEN_PARITY_EXCEPTIONS`** / new strict rows as needed (`learnings.query`, `progress.bar`, `profile-questionnaire`, etc.).

**Done (this line of work):** `summary-extract` + `history-digest` — strict `READ_ONLY_JSON_PARITY_ROWS`; `summary.ts` aligned with `commands.cjs`; `extractFrontmatterLeading` in `frontmatter.ts` for first-`---`-block parity with `frontmatter.cjs`.

**Done (profile-output + milestone mutation batch):** `write-profile`, `generate-claude-profile`, `generate-dev-preferences`, `generate-claude-md` (`profile-output.ts`); `milestone.complete` (`phase-lifecycle.ts` + `readModifyWriteStateMdFull`); `GOLDEN_MUTATION_SUBPROCESS_COVERED` updated; **`MUTATION_SUBPROCESS_GAP_REASON` removed** from `golden-policy.ts`.

**Mutations** (`QUERY_MUTATION_COMMANDS`): subprocess coverage is **`mutation-subprocess.integration.test.ts`** + `GOLDEN_MUTATION_SUBPROCESS_COVERED`. Remaining mutation canonicals without a subprocess row use **`MUTATION_DEFERRED_REASON`** (see `golden-policy.ts`). For known gaps before parity, prefer **`it.skip`** with an explicit rationale in code comments or restore a dedicated gap map — do not rely on silent deferral alone.

---

## Backlog: other read-only handlers (lower priority or follow-ups)

Confirm against `GOLDEN_PARITY_EXCEPTIONS` in `golden-policy.ts` for the live list.

**Mutations:** Prefer tmp fixture + dual sandbox (see `mutation-sandbox.ts`). Do not green the suite by deleting subprocess tests; skip with **`it.skip`** and document the gap (policy entry or comment) until parity is restored.

---

## Not in the SDK registry (product decision)

- **`graphify`**, **`from-gsd2` / `gsd2-import`** — CLI-only; no registry handler.

---

## Files to know (updated)

| Path | Role |
| ---- | ---- |
| `sdk/src/query/index.ts` | `createRegistry()`, `QUERY_MUTATION_COMMANDS`. |
| `sdk/src/golden/golden-policy.ts` | Coverage set + exceptions; `verifyGoldenPolicyComplete()`. |
| `sdk/src/golden/read-only-golden-rows.ts` | Strict read-only JSON matrix. |
| `sdk/src/golden/read-only-parity.integration.test.ts` | Subprocess + dispatch parity tests. |
| `sdk/src/golden/capture.ts` | `captureGsdToolsOutput`, `captureGsdToolsStdout`. |
| `sdk/src/golden/fixtures/mutation-project/` | Ephemeral copy for mutation subprocess tests. |
| `sdk/src/golden/mutation-subprocess.integration.test.ts` | Mutation handler subprocess parity. |
| `sdk/src/golden/mutation-sandbox.ts` | `createMutationSandbox({ git?: boolean })`. |
| `sdk/src/query/profile-output.ts` | CJS-parity profile output handlers. |
| `sdk/src/phase-runner.ts` | **Track C target** — currently uses `GSDTools`. |
| `sdk/src/init-runner.ts` | **Track C target** — currently uses `GSDTools`. |
| `sdk/src/gsd-tools.ts` | Subprocess bridge; **not deleted** in Phase 3 scope. |
| `get-shit-done/bin/gsd-tools.cjs` | `runCommand` — argv routing. Has `@deprecated` header. |
| `get-shit-done/bin/lib/*.cjs` | Per-command implementations (CJS source of truth). |

---

## Commands (verification)

```bash
cd sdk
npm run build
npm run test:unit
npm run test:integration
```

Focused:

```bash
npx vitest run src/golden/read-only-parity.integration.test.ts src/golden/golden.integration.test.ts --project integration
npx vitest run src/golden/mutation-subprocess.integration.test.ts --project integration
npx vitest run src/golden/golden-policy.test.ts --project unit
```

---

## Success criteria (extend, not replace)

- **No regression:** `golden-policy.test.ts` / `verifyGoldenPolicyComplete()` stays green.
- **Track A complete:** 127/128 covered; read-only rows, mutation subprocess, composition goldens all in place.
- **Track C:** Runner alignment — `PhaseRunner` and `InitRunner` use typed handlers where possible; `GSDTools` remains exported.
- **CHANGELOG.md** [Unreleased] updated with Phase 3 entries.
- **`QUERY-HANDLERS.md`** updated when assertion style changes (full `toEqual` vs normalized subset).

**Do not "green the suite" by deleting or shrinking golden tests.** If a handler cannot match CJS byte-for-byte without product decisions, use **documented normalization** in the test or **fix the TypeScript handler** — do not silently remove assertions.

---

## Commit history (this branch)

62 commits ahead of `main` on `feat/sdk-phase3-query-layer`. Recent batch (5 commits):

```
95db59c docs(sdk): update handover for profile-output and mutation subprocess batch
05e8238 sdk(golden): mutation subprocess test infrastructure and golden policy
593d9be sdk(query): port profile output handlers from profile-output.cjs
a2d0eb6 sdk(query): CJS parity for state, phase-lifecycle, workstream, roadmap, frontmatter, config, and intel
8bd9f1d sdk(query): align commit handler with CJS --files argv and allowed field
```

**Cherry-pick notes:** Commits 1 (`8bd9f1d`) and 3 (`593d9be`) are independently cherry-pickable. Commit 2 (`a2d0eb6`) is a bulk handler alignment (13 files). Commit 4 (`05e8238`) depends on handlers from 2+3 at test-runtime but compiles independently. Commit 5 is docs-only.

---

*Update this file when registry or golden milestones change.*
