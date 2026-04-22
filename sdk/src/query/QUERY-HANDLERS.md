# Query handler conventions (`sdk/src/query/`)

This document records contracts for the typed query layer consumed by `gsd-sdk query` and programmatic `createRegistry()` callers.

## Registry coverage vs `gsd-tools.cjs`

- **In scope:** Native handlers are registered in `createRegistry()` (`index.ts`) so SDK output can match `get-shit-done/bin/gsd-tools.cjs` JSON (see `sdk/src/golden/`).
- **Explicitly not registered** (product decision): `**graphify**`, `**from-gsd2**` / `**gsd2-import**` — remain CLI-only.
- **CLI name differences** (same behavior, different dispatch string):
  - CJS `**summary-extract**` → SDK `**summary.extract**` / `**summary extract**` / `**history-digest**` (see `index.ts`).
  - CJS top-level `**scaffold <type> ...**` → SDK `**phase.scaffold**` / `**phase scaffold**` with the scaffold type as the first argument (no separate `scaffold` alias on the registry).

## `gsd-sdk query` routing

1. **`normalizeQueryCommand()`** (`normalize-query-command.ts`) — maps the first argv tokens to the same **command + subcommand** patterns as `gsd-tools` `runCommand()` where needed (e.g. `state json` → `state.json`, `init execute-phase 9` → `init.execute-phase` with args `['9']`, `scaffold …` → `phase.scaffold`). Re-exported from **`@gsd-build/sdk`** and **`createRegistry`’s module** (`sdk/src/query/index.ts`) so programmatic callers can mirror CLI tokenization without importing a deep path.
2. **`resolveQueryArgv()`** (`registry.ts`) — **longest-prefix match** on the normalized argv: tries joined keys `a.b.c` then `a b c` for each prefix length, longest first. Example: `state update status X` → handler `state.update` with args `[status, X]`.
3. **Dotted single token**: one token like `init.new-project` matches the registry; if the first pass finds no handler, a single dotted token is split and matching runs again.
4. **CJS fallback (CLI)**: if nothing matches a registered handler and `GSD_QUERY_FALLBACK` is not `off`/`never`/`false`/`0`, the CLI shells out to `gsd-tools.cjs` with argv derived from the normalized tokens (dotted commands are split into CJS-style segments). stderr receives a short bridge warning. Set `GSD_QUERY_FALLBACK=off` for strict mode (parity tests). CLI-only commands such as `graphify` rely on this path until native handlers exist.
5. **Output**: JSON written to stdout for successful handler results.

**Registered:** `phase.add-batch` / `phase add-batch` — batch append (see `phaseAddBatch` in `phase-lifecycle.ts`).

## Error handling

- **Validation and programmer errors**: Handlers throw `GSDError` with an `ErrorClassification` (e.g. missing required args, invalid phase). The CLI maps these to exit codes via `exitCodeFor()`.
- **Expected domain failures**: Handlers return `{ data: { error: string, ... } }` for cases that are not exceptional in normal use (file not found, intel disabled, todo missing, etc.). Callers must check `data.error` when present.
- Do not mix both styles for the same failure mode in new code: prefer **throw** for "caller must fix input"; prefer `**data.error`** for "operation could not complete in this project state."

## Mutation commands and events

- `QUERY_MUTATION_COMMANDS` in `index.ts` lists every command name (including space-delimited aliases) that performs durable writes. It drives optional `GSDEventStream` wrapping so mutations emit structured events.
- Init composition handlers (`init.*`) are **not** included: they return JSON for workflows; agents perform filesystem work.
- `**state.validate`** is **read-only** — not listed in `QUERY_MUTATION_COMMANDS`.
- `**skill-manifest`**: writes to disk only when invoked with `**--write**`. It is **not** in `QUERY_MUTATION_COMMANDS`, so conditional writes do not emit mutation events today. If event consumers need `skill-manifest` writes, add a follow-up that either registers a dedicated command name for the write path or documents the exception.

## Intel: `intel.update`

- `**intel.update`** / `**intel update**` matches CJS `intel.cjs` `intelUpdate` **JSON** (not an in-process graph refresh): when intel is enabled it returns `{ action: 'spawn_agent', message: '...' }`; when disabled, `{ disabled: true, message: '...' }`. The **gsd-intel-updater** agent performs the actual refresh after spawn. Golden tests use full `toEqual` vs `gsd-tools.cjs` on this repo’s intel config.

## Session correlation (`sessionId`)

- `createRegistry(eventStream, sessionId)` threads the optional `sessionId` string into mutation-related events emitted via `eventStream`. `GSDTools` accepts `sessionId` in its constructor and forwards it to `createRegistry`; `GSD` accepts `sessionId` in `GSDOptions` and passes it through `createTools()`. When omitted, `sessionId` is empty.

## Lockfiles (`state-mutation.ts`)

- `STATE.md` (and ROADMAP) locks use a sibling `.lock` file with the holder's PID. Stale locks are cleared when the PID no longer exists (`process.kill(pid, 0)` fails) or when the lock file is older than the existing time-based threshold.

## Intel JSON search

- `searchJsonEntries` in `intel.ts` caps recursion depth (`MAX_JSON_SEARCH_DEPTH`) to avoid stack overflow on pathological nested JSON.

## Phase / plan listing (SDK-only)

No `gsd-tools.cjs` mirror — agents use these instead of shell `ls`/`find`/`grep`:

- `**phase.list-plans**` `<phase>` [`**--with-schema**` `<yamlKey>`] — PLAN files in the phase dir; optional filter when a frontmatter key is present (`phase-list-queries.ts`).
- `**phase.list-artifacts**` `<phase>` `**--type**` `context|summary|verification|research` — matching `*-CONTEXT.md`, `*-SUMMARY.md`, etc.
- `**plan.task-structure**` `<path-to-PLAN.md>` — wave, `depends_on`, task/checkpoint counts via `parsePlan()`.
- `**requirements.extract-from-plans**` `<phase>` — deduped `requirements:` frontmatter across plans.

## State extensions (Phase 3)

Handlers for `**state.signal-waiting`**, `**state.signal-resume**`, `**state.validate**`, `**state.sync**` (supports `--verify` dry-run), and `**state.prune**` live in `state-mutation.ts`, with dotted and `state …` space aliases in `index.ts`.

**`state.json` vs `state.load` (different CJS commands):**

- **`state.json`** / `state json` — port of **`cmdStateJson`** (`state.ts` `stateJson`): rebuilt STATE.md frontmatter JSON. Read-only golden: `read-only-parity.integration.test.ts` compares to CJS `state json` with **`last_updated`** stripped.
- **`state.load`** / `state load` — port of **`cmdStateLoad`** (`state-project-load.ts` `stateProjectLoad`): `{ config, state_raw, state_exists, roadmap_exists, config_exists }`; **`config`** comes from **`get-shit-done/bin/lib/core.cjs`** `loadConfig` (resolved via the same candidate paths as a normal GSD install). Read-only golden: full `toEqual` vs `state load`. If `core.cjs` cannot be resolved, dispatch throws **`GSDError`** (document for minimal `@gsd-build/sdk`-only installs).

`stateExtractField` in `helpers.ts` uses **horizontal whitespace only** after `Field:` so YAML keys such as lowercase `progress:` in frontmatter are not mistaken for the body `Progress:` line (see `get-shit-done/bin/lib/state.cjs` — same rule).

## Golden parity: coverage and exceptions

Subprocess reference: `captureGsdToolsOutput()` / `captureGsdToolsStdout()` → `get-shit-done/bin/gsd-tools.cjs` (`sdk/src/golden/capture.ts`). Plain-text commands (e.g. `config-path`) use stdout string comparison in `read-only-parity.integration.test.ts`.

**Authoritative accounting (every canonical handler):** `sdk/src/golden/golden-policy.ts` merges `golden-integration-covered.ts` (canonicals hit by `golden.integration.test.ts`) with `read-only-golden-rows.ts` / special cases (`verify.commits`, `config-path`) into `GOLDEN_PARITY_INTEGRATION_COVERED`, and builds `GOLDEN_PARITY_EXCEPTIONS` for the rest. `getCanonicalRegistryCommands()` (`registry-canonical-commands.ts`) lists one dispatch string per unique handler; each canonical must be either covered or receive a built-in exception string (mutations → shared rationale; read-only without a subprocess row → per-command note). `sdk/src/golden/golden-policy.test.ts` calls `verifyGoldenPolicyComplete()` so the policy cannot drift silently.

**Integration test files:**

| File | Role |
| ---- | ---- |
| `sdk/src/golden/golden.integration.test.ts` | Primary golden suite: subset/shape/full parity as documented in the tables below. |
| `sdk/src/golden/read-only-parity.integration.test.ts` | Read-only handlers with full `toEqual` on `sdkResult.data` vs CJS JSON; rows listed in `read-only-golden-rows.ts`. Also `config-path` / `verify.commits`, dedicated blocks for **`state.json`** (strip `last_updated`) and **`state.load`** (full `cmdStateLoad` parity). |

This section summarizes **how** each covered command is compared so readers do not have to infer rules from assertions alone.

### Golden registry coverage matrix (human summary)

- **Covered by subprocess golden** — canonical names appear in `GOLDEN_PARITY_INTEGRATION_COVERED`; see the tables below and the two integration files for assertion style (mostly full `toEqual`; remaining subset cases: `frontmatter.get`, `find-phase`).
- **Not in covered set** — either listed in `QUERY_MUTATION_COMMANDS` (durable writes; handler tests in `sdk/src/query/*.test.ts` and mutation-focused tests) or a read-only handler whose full CJS JSON match is deferred (see auto-generated exception text in `golden-policy.ts`).

### Full JSON equality (`toEqual` on result data)

These tests expect `sdkResult.data` to match the parsed CJS stdout JSON (possibly after shared normalization helpers):


| SDK dispatch (representative) | Notes                                                                                                 |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| `generate-slug`               | Includes fixture + multi-word cases.                                                                  |
| `config-get`                  | Sample: top-level key `model_profile`.                                                                |
| `config-set`                  | Temp `.planning/` tree; reset between CJS capture and SDK dispatch; `toEqual` on `{ updated, key, value, previousValue? }`. |
| `state.validate`              | Full object parity.                                                                                   |
| `state.sync`                  | With `--verify` (dry-run); full object parity.                                                        |
| `detect-custom-files`         | Temp `--config-dir` fixture; full object parity.                                                      |
| `roadmap.analyze` / `progress` | Full object parity (`progress` uses `progress json` CJS path).                                       |
| `frontmatter.validate`       | Plan schema fixture under `.planning/phases/11-state-mutations/`.                                     |
| `verify.plan-structure` / `validate.consistency` / `verify.phase-completeness` | Full object parity on representative repo paths.                          |
| `init.execute-phase` / `init.plan-phase` / `init.resume` / `init.verify-work` | Full `toEqual` vs CJS.                                              |
| `init.quick`                  | Full parity **after** stripping `quick_id`, `timestamp`, `branch_name`, `task_dir` (`init-golden-normalize.ts`). |
| `intel.update`                | Full `toEqual` vs CJS for this project (disabled vs spawn-hint payload per `intel.cjs`).               |

From `read-only-parity.integration.test.ts` (full `toEqual` on this repo):

| SDK dispatch (canonical) | Notes |
| ------------------------ | ----- |
| `resolve-model` | Args e.g. `gsd-planner`. |
| `phase-plan-index` | Phase number arg. |
| `roadmap.get-phase` | Phase number arg. |
| `list.todos` | No args. |
| `phase.next-decimal` | Phase number arg. |
| `phases.list` | No args. |
| `verify.summary` | Plan path. |
| `verify.path-exists` | Path under repo. |
| `verify.artifacts` | Plan path. |
| `verify.commits` | Two git SHAs (`HEAD~1` / `HEAD` or fallback). |
| `websearch` | Limited query (may hit network — test uses small limit). |
| `workstream.get` / `workstream.list` / `workstream.status` | Default workstream where applicable (`status` uses full CJS shape when the workstream dir exists). |
| `learnings.list` | No args. |
| `intel.status` | No args. |
| `intel.diff` / `intel.validate` / `intel.query` | When intel is disabled, disabled payload matches CJS (including message text). |
| `init.list-workspaces` | No args. |
| `agent-skills` | No agent type → JSON `""` (same as CJS). |
| `scan-sessions` | `--json`; SDK `scanSessions` output matches CJS project array (`profile-scan-sessions.ts`). |
| `summary.extract` | Fixture `sdk/src/golden/fixtures/summary-extract-sample.md`; uses `extractFrontmatterLeading` (first `---` block) for parity with `frontmatter.cjs`. |
| `history.digest` | No args; aggregate over `.planning/phases` + archived milestone phase dirs (`commands.cjs` `cmdHistoryDigest`). |
| `audit-uat` | No args; full JSON parity with `uat.cjs` `cmdAuditUat` (`results`, `summary` with `by_category` / `by_phase`). |
| `skill-manifest` | No args; full manifest parity with `init.cjs` `buildSkillManifest` / `cmdSkillManifest`. Handler uses `extractFrontmatterLeading` (first `---` block) like CJS `frontmatter.cjs` `extractFrontmatter` — not TS `extractFrontmatter` (last block), so skills with multiple `---` sections match CJS. |
| `validate.agents` | No args; `agents_dir` matches `core.cjs` `getAgentsDir` (`GSD_AGENTS_DIR` or `sdk/dist/query/../../../agents` in this monorepo — same absolute path as CLI). `MODEL_PROFILES` / `expected` list stays aligned with `get-shit-done/bin/lib/model-profiles.cjs`. |
| `state.get` | Dedicated tests: no args → full `{ content }` vs `state get`; one field (`milestone`) → `{ milestone: "…" }` vs `state get milestone` (frontmatter line match). |
| `state.json` | `state json` vs SDK; **`last_updated`** stripped before `toEqual` (volatile). |
| `state.load` | `state load` vs SDK; full **`cmdStateLoad`** object graph (`config`, `state_raw`, existence flags). |
| `uat.render-checkpoint` | Fixture `sdk/src/golden/fixtures/uat-render-checkpoint-sample.md`; full JSON parity with `uat.cjs` `cmdRenderCheckpoint` (`file_path`, `test_number`, `test_name`, `checkpoint` — same box + `buildCheckpoint` text as CJS; `sanitizeForDisplay` on name/expected). |
| `config-path` | Plain stdout path vs `{ path }` — compared with `path.normalize` in tests. |


### Normalized or field-omitted comparison


| SDK / test  | Rule                                                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `audit-open` | `audit-open --json`: `**scanned_at**` stripped before `toEqual` (volatile ISO time). `sanitizeForDisplay` in `audit-open.ts` matches `security.cjs` (CRLF body lines can leave `\r` in `items.todos[].summary`, matching CLI). |
| `extract.messages` / `extract-messages` | Fixture `sdk/src/golden/fixtures/extract-messages-sessions/` passed as `--path` (sessions root). `**output_file**` stripped before `toEqual` (temp path under `os.tmpdir()`); then the two JSONL files are compared byte-for-byte. Parity with `profile-pipeline.cjs` `cmdExtractMessages` (`streamExtractMessages`, `isGenuineUserMessage`, batch limit 300). |
| `docs-init` | `existing_docs` sorted by `path` before compare; `**agents_installed`** and `**missing_agents**` omitted (subprocess vs in-process path resolution for `~/.claude/...`). |


### Structural, subset, or shape-only parity

Assertions deliberately compare only selected fields (not full `toEqual`):


| SDK dispatch (representative) | What is compared |
| ----------------------------- | ---------------- |
| `frontmatter.get`             | Scalar fields `phase`, `plan`, `type`; same top-level key set as CJS. |
| `find-phase`                  | `found`, `directory`, `phase_number`, `phase_name`, `plans` (SDK payload is a **subset** of CJS — extra CJS fields ignored). |

`template.select` is **not** in `golden.integration.test.ts`: CJS `template select <plan-path>` scores PLAN **content** for summary templates; SDK `template.select <phase>` uses phase-directory heuristics — different algorithms. Covered in `sdk/src/query/template.test.ts`.

### Time- and environment-dependent


| Command             | Rule                                                                                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `current-timestamp` | `**full`**: same shape and valid ISO strings; not the same instant. `**date**`: same calendar day when the test does not cross midnight. `**filename**`: full `toEqual` (back-to-back capture vs SDK). |


### Conditional writes (not in `QUERY_MUTATION_COMMANDS`)


| Command          | Rule                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `skill-manifest` | Disk writes only with `**--write`**; registry does not emit mutation events for this command (see **Mutation commands and events** above). |


### Registered but not in the golden suite

Handlers in `createRegistry()` that are **not** covered by `golden.integration.test.ts` are not automatically “non-parity” — they simply have **no** automated cross-check against CJS yet. Add golden tests when tightening coverage; until then, treat absence here as a **test gap**, not a behavior guarantee.

---

## Decision routing (SDK-only)

These handlers implement `.planning/research/decision-routing-audit.md` — **no `gsd-tools.cjs` mirror yet** (orchestration JSON only). Invoke via `gsd-sdk query` / `registry.dispatch()` after `normalizeQueryCommand()` where argv uses `check …` / `detect …` / `route …` prefixes.

### Tier 1

| Dispatch | Purpose |
| -------- | ------- |
| `check.config-gates` / `check config-gates [workflow]` | Single JSON blob of merged `workflow.*` (+ `context_window`) for batch config gates. |
| `check.phase-ready` / `check phase-ready <phase>` | Phase directory stats, `dependencies_met`, `next_step` (`discuss` / `plan` / `execute` / `verify` / `complete`). |
| `route.next-action` / `route next-action` | Suggested next slash command from `next.md`-style rules (`/gsd-discuss-phase`, `/gsd-execute-phase`, `/gsd-resume-work`, gates, etc.). |

### Tier 2

| Dispatch | Purpose |
| -------- | ------- |
| `check.auto-mode` / `check auto-mode` | `active` (OR of `workflow.auto_advance` and `workflow._auto_chain_active`), `source` (`none` / `auto_advance` / `auto_chain` / `both`), plus the two booleans. Replaces paired `config-get` calls in checkpoint and auto-advance steps. Use `--pick active` or `--pick auto_chain_active` when a workflow only needs one field. |
| `detect.phase-type` / `detect phase-type <phase>` | Structured UI/schema/API/infra detection for a phase. Returns `has_frontend`, `frontend_indicators`, `has_schema`, `schema_orm`, `schema_files`, `has_api`, `has_infra`, `push_command` (null, reserved). Replaces fragile grep-based UI detection in `autonomous.md`, `plan-phase.md`, etc. (audit §3.6). |
| `check.completion` / `check completion <phase\|milestone> <id>` | Phase or milestone completion rollup. Phase mode: `plans_total`, `plans_with_summaries`, `missing_summaries`, `verification_status`, `uat_status`, `debt` (`uat_gaps`, `verification_failures`, `human_needed`), `complete`. Milestone mode: `phase_count`, `phases_complete`, `phases_incomplete`, `complete`. Replaces PLAN/SUMMARY counting in `transition.md`, `complete-milestone.md` (audit §3.7). |

### Tier 3

| Dispatch | Purpose |
| -------- | ------- |
| `check.gates` / `check gates <workflow> [--phase <N>]` | Safety gate consolidation. Checks `.continue-here.md` presence (blocker), STATE.md error/failed status (blocker), and VERIFICATION.md FAIL rows (warning). Returns `passed`, `blockers`, `warnings`. Replaces per-workflow gate logic in `next.md`, `execute-phase.md`, `discuss-phase.md` (audit §3.2). SDK-only — no CJS mirror. |
| `check.verification-status` / `check verification-status <phase>` | VERIFICATION.md parser. Returns `status` (`pass`/`fail`/`partial`/`missing`), `score` (e.g. `"3/4"`), `gaps`, `human_items`, `deferred`. Handles prefixed filenames and missing files. Replaces VERIFICATION.md grep/parse in `execute-phase.md`, `autonomous.md`, `progress.md` (audit §3.8). SDK-only — no CJS mirror. |
| `check.ship-ready` / `check ship-ready <phase>` | Ship preflight: `clean_tree`, `on_feature_branch`, `current_branch`, `base_branch`, `remote_configured`, `gh_available`, `gh_authenticated` (always false — advisory, no network call), `verification_passed`, `blockers`, `ready`. Replaces ship.md preflight checks (audit §3.9). SDK-only — no CJS mirror. |

**Stability:** Shapes are versioned with the audit doc; add integration tests when workflows adopt these queries. Re-run after file writes that change `.planning/` (stale read caveat in audit §6). All Tier 1–3 handlers are implemented and unit-tested.

---

## CJS command surface vs SDK registry

Authoritative CJS entry points: `runCommand` `switch (command)` in `get-shit-done/bin/gsd-tools.cjs`. SDK entry points: `createRegistry()` in `sdk/src/query/index.ts`.

**Naming aliases (registered, different string):**

- CJS `**summary-extract`** → SDK `**summary.extract**`, `**summary extract**`, `**history-digest**` (history digest helpers).
- CJS top-level `**scaffold <type> …**` → SDK `**phase.scaffold**` / `**phase scaffold**` (type + options in args).

**CLI-only (no SDK registry handler; intentional unless requirements change):**


| CJS surface           | Justification                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| `**graphify`**        | Depends on Graphify CLI / Python stack; not ported to the typed query layer.                   |
| `**from-gsd2**`       | Legacy GSD2 → GSD migration (`gsd2-import.cjs`); CLI-only helper.                              |


**SDK-only (registered dispatch without an equivalent `gsd-tools` top-level subcommand):**


| SDK dispatch                                | Notes                                                                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `**phases.archive`** / `**phases archive**` | CJS `phases` supports only `**list**` and `**clear**`; archive behavior is available via SDK (and workflows), not as `gsd-tools phases archive`. |


### Matrix: top-level `gsd-tools` command → SDK

Disposition: **Registered** = handled in `createRegistry()` under the listed SDK name(s); **CLI-only** = no registry handler; **Alias** = same behavior, different primary dispatch string.


| CJS `command` (first argv)                                                                                                              | SDK dispatch name(s)                                                      | Disposition             | Notes                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------- |
| `state` (subcommands)                                                                                                                   | `state.load`, `state.json`, `state.get`, `state.update`, `state.patch`, … | Registered              | Dotted and `state …` space aliases in `index.ts`.                         |
| `resolve-model`                                                                                                                         | `resolve-model`                                                           | Registered              |                                                                           |
| `find-phase`                                                                                                                            | `find-phase`                                                              | Registered              | Golden: subset parity (see above).                                        |
| `commit`, `check-commit`, `commit-to-subrepo`                                                                                           | `commit`, `check-commit`, `commit-to-subrepo`                             | Registered              |                                                                           |
| `verify-summary`                                                                                                                        | `verify-summary`, `verify.summary`, `verify summary`                      | Registered              |                                                                           |
| `template`                                                                                                                              | `template.fill`, `template.select`, …                                     | Registered              |                                                                           |
| `frontmatter`                                                                                                                           | `frontmatter.get`, `frontmatter.set`, …                                   | Registered              |                                                                           |
| `verify`                                                                                                                                | `verify.plan-structure`, `verify.phase-completeness`, …                   | Registered              |                                                                           |
| `generate-slug`                                                                                                                         | `generate-slug`                                                           | Registered              |                                                                           |
| `current-timestamp`                                                                                                                     | `current-timestamp`                                                       | Registered              | Golden: time semantics (see above).                                       |
| `list-todos`                                                                                                                            | `list-todos`, `list.todos`                                                | Registered              |                                                                           |
| `verify-path-exists`                                                                                                                    | `verify-path-exists`, `verify.path-exists`, …                             | Registered              |                                                                           |
| `config-ensure-section`, `config-set`, `config-set-model-profile`, `config-get`, `config-new-project`, `config-path`                    | same kebab-case names                                                     | Registered              |                                                                           |
| `agent-skills`                                                                                                                          | `agent-skills`                                                            | Registered              |                                                                           |
| `skill-manifest`                                                                                                                        | `skill-manifest`, `skill manifest`                                        | Registered              | Writes only with `--write`.                                               |
| `history-digest`                                                                                                                        | `history-digest`, `history.digest`, …                                     | Alias                   | Same as `**summary.extract`** family for digest-style output.             |
| `phases`                                                                                                                                | `phases.list`, `phases.clear`, `phases.archive`, …                        | Registered (+ SDK-only) | CJS: `**list**`, `**clear**` only; `**archive**` is SDK-only (see above). |
| `roadmap`                                                                                                                               | `roadmap.analyze`, `roadmap.get-phase`, `roadmap.update-plan-progress`, … | Registered              |                                                                           |
| `requirements`                                                                                                                          | `requirements.mark-complete`, …                                           | Registered              |                                                                           |
| `phase`                                                                                                                                 | `phase.add`, `phase.add-batch`, `phase.insert`, …                           | Registered              |                                                                           |
| `milestone`                                                                                                                             | `milestone.complete`, …                                                   | Registered              |                                                                           |
| `validate`                                                                                                                              | `validate.consistency`, `validate.health`, `validate.agents`, …           | Registered              |                                                                           |
| `progress`                                                                                                                              | `progress`, `progress.json`, `progress.bar`, …                            | Registered              |                                                                           |
| `audit-uat`                                                                                                                             | `audit-uat`                                                               | Registered              |                                                                           |
| `audit-open`                                                                                                                            | `audit-open`, `audit open`                                                | Registered              |                                                                           |
| `uat`                                                                                                                                   | `uat.render-checkpoint`, …                                                | Registered              |                                                                           |
| `stats`                                                                                                                                 | `stats`, `stats.json`, …                                                  | Registered              |                                                                           |
| `todo`                                                                                                                                  | `todo.complete`, `todo.match-phase`, …                                    | Registered              |                                                                           |
| `scaffold`                                                                                                                              | `phase.scaffold`, `phase scaffold`                                        | Alias                   | Top-level `**scaffold**` in CJS; no separate `scaffold` registry key.     |
| `init`                                                                                                                                  | `init.execute-phase`, `init.new-project`, …                               | Registered              | Dotted and `init …` space aliases.                                        |
| `phase-plan-index`                                                                                                                      | `phase-plan-index`                                                        | Registered              |                                                                           |
| `state-snapshot`                                                                                                                        | `state-snapshot`                                                          | Registered              |                                                                           |
| `summary-extract`                                                                                                                       | `summary.extract`, `summary extract`, `history-digest`, …                 | Alias                   |                                                                           |
| `websearch`                                                                                                                             | `websearch`                                                               | Registered              |                                                                           |
| `scan-sessions`                                                                                                                         | `scan-sessions`                                                           | Registered              |                                                                           |
| `extract-messages`                                                                                                                      | `extract-messages`, `extract.messages`                                    | Registered              | Golden: `output_file` strip + JSONL bytes (see **Normalized** table).      |
| `profile-sample`, `profile-questionnaire`, `write-profile`, `generate-dev-preferences`, `generate-claude-profile`, `generate-claude-md` | same kebab-case names                                                     | Registered              |                                                                           |
| `workstream`                                                                                                                            | `workstream.get`, `workstream.list`, …                                    | Registered              |                                                                           |
| `intel`                                                                                                                                 | `intel.status`, `intel.diff`, `intel.update`, …                           | Registered              | `**intel.update**`: JSON parity with CJS spawn hint / disabled payload (see **Intel: intel.update**).                                     |
| `graphify`                                                                                                                              | —                                                                         | CLI-only                | See **CLI-only** table.                                                   |
| `docs-init`                                                                                                                             | `docs-init`                                                               | Registered              | Golden: normalized compare (see above).                                   |
| `learnings`                                                                                                                             | `learnings.list`, `learnings.query`, …                                    | Registered              |                                                                           |
| `detect-custom-files`                                                                                                                   | `detect-custom-files`                                                     | Registered              | Requires `--config-dir`.                                                  |
| `from-gsd2`                                                                                                                             | —                                                                         | CLI-only                | See **CLI-only** table.                                                   |


---

## Other registered areas

- `**detect-custom-files`**: requires `--config-dir <path>`; scans installer manifest vs GSD-managed dirs (`detect-custom-files.ts`).
- `**docs-init**`: docs-update workflow payload (`docs-init.ts`), aligned with `docs.cjs`. Golden tests omit `**agents_installed**` / `**missing_agents**` when comparing SDK vs CLI because the subprocess may resolve `~/.claude/...` differently than in-process checks.

