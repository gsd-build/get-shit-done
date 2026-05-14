# CJS↔SDK hard seam — single canonical owner per responsibility

- **Status:** Proposed
- **Date:** 2026-05-14
- **Tracking issue:** [#3524](https://github.com/gsd-build/get-shit-done/issues/3524)
- **Related PRD:** [`docs/prd/3524-cjs-sdk-hard-seam.md`](../prd/3524-cjs-sdk-hard-seam.md)
- **Extends:** ADR-0005 (SDK Architecture seam map)

We decided to make the boundary between the CJS tooling layer (`get-shit-done/bin/lib/*.cjs`) and the SDK (`sdk/src/**/*.ts`) a hard architectural seam with exactly one canonical owner per responsibility. The trigger is the recurring drift bug class — #1535, #1542, #2047/#2052, #2638/#2655, #2653/#2670, #2687/#2706, #2798/#2816, #3055/#3116, #3523 — each of which was a fix landing on one side without the other. The class keeps recurring because the boundary today is a soft convention enforced only by output-parity tests, which catch naming mismatch and read-output divergence but not structure divergence, warning/error divergence, or mutation-path divergence.

## Decision

### 1. Three layers, sharp boundaries

| Layer | Location | Owns | Imported by |
|---|---|---|---|
| **Shared data** | `sdk/shared/*.json` | Constants, enums, schemas as pure JSON. Examples: `config-schema.json` (VALID_CONFIG_KEYS, DYNAMIC_KEY_PATTERNS, RUNTIME_STATE_KEYS, CONFIG_DEFAULTS), `model-catalog.json` (already in this shape). | Both CJS and SDK via `require`/`import` of the JSON file. |
| **Shared core (logic)** | `sdk/src/core/**/*.ts` compiled to `sdk/dist/core/*.{cjs,mjs,d.ts}` via dual CJS+ESM build. | All behavior that today lives in *both* sides: config load/normalize/migrate, project-root resolution, path projection, model resolution, validation. | Both CJS (`require('@gsd-build/sdk/core')` or relative path into the published `dist/`) and SDK (`import` from the source). |
| **Adapter** | `get-shit-done/bin/lib/*.cjs` (CJS adapter) and `sdk/src/query/**/*.ts` (SDK adapter) | Surface-shape — CJS dispatch/router, SDK query handler registry. Adapters call into shared core for behavior. **Adapters do not define schemas, defaults, or normalization logic.** | CLI entry points (`bin/gsd-tools.cjs`, `sdk/dist/cli.js`), MCP server, hooks, workflow markdown. |

### 2. Canonical owners per responsibility

| Responsibility | Canonical owner | Adapter shape |
|---|---|---|
| Config schema (VALID_CONFIG_KEYS, DYNAMIC_KEY_PATTERNS, RUNTIME_STATE_KEYS) | Shared data: `sdk/shared/config-schema.json` | Both sides `require`/`import` |
| CONFIG_DEFAULTS | Shared data: `sdk/shared/config-defaults.json` | Both sides `require`/`import` |
| Config load + legacy-key normalization (top-level `branching_strategy`, `sub_repos`, `multiRepo`, `depth`) | Shared core: `sdk/src/core/config.ts` exports `loadConfig(cwd)`, `mergeDefaults(parsed)`, `normalizeLegacyKeys(parsed)` | `bin/lib/config.cjs`, `bin/lib/core.cjs` import; `sdk/src/config.ts` re-exports |
| Project-root resolution (`findProjectRoot`) | Shared core: `sdk/src/core/project-root.ts` | Both sides import |
| Planning path projection | SDK (sealed per ADR-0006) — `helpers.planningPaths()` | CJS to be migrated off `planning-workspace.cjs` per Phase 3 of the PRD |
| Model catalog | Shared data: `sdk/shared/model-catalog.json` (sealed per ADR-0003) | Loader hardened to single path (Phase 2 of the PRD) |
| Command contract validation | Shared core: `sdk/src/core/command-contract.ts` | CJS routers consult before dispatch |
| Shell command projection (platform abstraction) | CJS canonical: `bin/lib/shell-command-projection.cjs` (ADR-0009) | SDK file ops import via shared-core wrapper rather than raw `fs`/`child_process` |
| File ops engine (safe mutations) | CJS canonical: `bin/lib/file-operation-engine.cjs` family (ADR-0010) | SDK mutation handlers import wrapper |
| State management | SDK canonical: `sdk/src/query/state*.ts` | CJS `state.cjs` becomes a subprocess shim for `gsd-tools state ...` legacy callers |
| Query routing/dispatch | SDK canonical: `sdk/src/query/registry.ts` + `query-dispatch.ts` (ADR-0001 amendment) | CJS `gsd-tools.cjs` shells out to `gsd-sdk query` for canonical commands |
| Installer/migration | CJS canonical: `bin/lib/installer-migrations.cjs` (legacy runtime is CJS) | SDK package-compatibility shim consumes |
| Verify/audit | SDK canonical: `sdk/src/query/verify.ts` | CJS `verify.cjs` becomes subprocess shim |

### 3. CJS-only domains (intentional asymmetry)

These remain CJS-only and are **out of scope** for the seam — drift cannot occur because there is no SDK counterpart:

- `bin/lib/graphify.cjs` — codebase knowledge-graph indexing
- `bin/lib/gsd2-import.cjs` — GSD v2→v3 migration
- `bin/lib/schema-detect.cjs` — project compatibility auto-detection
- `bin/lib/fallow-runner.cjs` — optional fallow code-quality scanning
- `bin/lib/intel.cjs` — technical intelligence file management
- `bin/lib/drift.cjs` — code drift detection vs baseline

If any of these later need an SDK counterpart, the migration is a new enhancement, not a parallel implementation.

### 4. Enforcement mechanisms

The seam is enforced at four layers; defeating any one of them surfaces in CI before merge.

1. **Build-time single source** — `sdk/shared/*.json` and `sdk/dist/core/` are the *only* legal definers of the symbols in the responsibility table. A CI script (`scripts/check-seam-ownership.cjs`) greps `bin/lib/*.cjs` for forbidden patterns (e.g. `CONFIG_DEFAULTS\s*=`, `VALID_CONFIG_KEYS\s*=`, function declarations whose canonical owner is shared-core) outside of `require()` lines, and fails the build on a match. Allowlist is explicit, in the script.
2. **Type-level parity check** — `sdk/src/contract/cjs-sdk-contract.test.ts` imports the CJS public surface (via a thin TS shim) and the SDK public surface and asserts shape equality on the seam-managed symbols. Compile-time failure if drift creeps back in.
3. **Golden mutation parity** — `sdk/src/golden/golden.integration.test.ts` is extended from read-only to mutations. Every canonical handler in the responsibility table has a golden test that asserts CJS and SDK produce identical observable state after the same mutation.
4. **CODEOWNERS gate** — `bin/lib/*.cjs` and `sdk/src/core/**` are owned by `@gsd-build/architecture`. PRs touching either require explicit architecture-team review.
5. **In-file banner** — every CJS file participating in the seam carries a top-of-file comment block pointing at this ADR and the canonical owner. Banner is regenerated by the build; absence fails CI.

### 5. Migration policy

- Adapters are converted **one responsibility at a time** per the PRD's phasing. No big-bang rewrites.
- During migration, the parity test for the responsibility being moved is **promoted to a required CI check** before the duplicate is deleted on the losing side.
- A responsibility is considered "sealed" when (a) the canonical owner exists, (b) the losing-side definition has been deleted, (c) the parity test passes, and (d) the enforcement grep covers it.

## Consequences

- **Drift becomes structurally impossible** for symbols in the responsibility table. A contributor cannot add a parallel definition without the seam-ownership CI check or the type-level contract test failing.
- **The CJS surface shrinks** to (a) CJS-only domains, (b) thin adapters around shared core, and (c) subprocess shims for the SDK-canonical responsibilities.
- **The SDK becomes the canonical engine.** All canonical behavior lives in TypeScript and is compiled to a dual-target artifact. CJS continues to exist as a back-compat CLI for shell scripts and legacy workflows but does not own any logic outside its CJS-only domains.
- **Per-handler subprocess startup cost** for CJS-shelled-out responsibilities is added (~50–100 ms per invocation for shell-script consumers of `gsd-tools`). For workflow markdown consumers, no change — workflows already converge on `gsd-sdk` >90%.
- **Build pipeline grows** to compile `sdk/src/core/` to dual CJS+ESM. Modern bundlers (`tsup`, `rollup`) handle this with a few lines of config; the cost is justified by the elimination of an entire bug class.
- **ADR-0005's seam map is extended** to include this seam. ADR-0001 (dispatch policy) is amended to require CJS dispatch shells out for canonical handlers.
- **The golden test suite becomes load-bearing.** Promoting mutation parity from optional to required raises the bar for new handlers — every canonical handler must have a parity fixture. This is acceptable; the alternative is the next #3523.

## Out of scope

- Replacing the imperative CJS router with the SDK's declarative registry — that is a larger architecture rewrite, separate enhancement.
- Migrating CJS-only domains (graphify, gsd2-import, schema-detect, fallow-runner, intel, drift) to SDK handlers.
- Changing the workflow-markdown convention for which CLI to call.

## Amendments

_(Append-only. Use a dated header when the decision evolves.)_
