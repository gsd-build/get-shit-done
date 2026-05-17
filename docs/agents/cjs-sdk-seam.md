# CJS↔SDK Hard-Seam Migration: Complete Reference
## Issue #3575 (Parent: #3524)

---

## Migration overview

The CJS↔SDK hard-seam migration (#3524) eliminates a class of config-schema drift bugs by introducing single sources of truth at every decision point where CJS and SDK code previously diverged. The migration proceeded in six phases:

| Phase | PR | Summary |
|-------|----|---------|
| Phase 1 | [#3531](https://github.com/gsd-build/get-shit-done/pull/3531) | `state-document` Shared Module — source-of-truth at `sdk/src/state-document/`, generator, freshness check, CJS Adapter (`state-document.generated.cjs`). Worked example for the pattern. |
| Phase 2 | [#3540](https://github.com/gsd-build/get-shit-done/pull/3540) | `configuration` Shared Module — `sdk/shared/config-schema.manifest.json` + `sdk/shared/config-defaults.manifest.json` as data manifests; generator + freshness check + CJS Adapter. |
| Phase 3 | [#3548](https://github.com/gsd-build/get-shit-done/pull/3548) | `workstream-inventory` Shared Module — source-of-truth at `sdk/src/workstream-inventory/`, builder, generator, freshness check, CJS Adapter. |
| Phase 4 | [#3554](https://github.com/gsd-build/get-shit-done/pull/3554) | `project-root` Shared Module — source-of-truth at `sdk/src/project-root/`, generator, freshness check, CJS Adapter. |
| Phase 5.0 | [#3558](https://github.com/gsd-build/get-shit-done/pull/3558) | `runtime-bridge-sync` worker — enables CJS-side execution of SDK native handlers; state.* family initial router delegation via `executeForCjs`. |
| Phase 5.1 | [#3574](https://github.com/gsd-build/get-shit-done/pull/3574) | `state.*` router delegation complete — all known state subcommands delegated via `executeForCjs`; Phase 5.0 worker bug fix. |
| Phase 6 | [#3577](https://github.com/gsd-build/get-shit-done/pull/3577) (closes [#3575](https://github.com/gsd-build/get-shit-done/issues/3575)) | Enforcement hardening + Final completion — hand-sync drift lint, CODEOWNERS, 6 family-router migrations, 5 Shared Module migrations (plan-scan, secrets, schema-detect, decisions, workstream-name-policy), workstream native support, parity fixes. Migration feature-complete: 22 cooperating siblings, 0 backlog pairs. |

---

## Phase 6 Retrospective: 15 config-schema drift bugs

This section captures 15 recurring config-schema drift bugs that motivated the migration. For each, we record what drifted, the surgical fix, and which Phase 6 enforcement layer would have prevented it.

---

### #1535 — Silent failure on unrecognized config.json keys
- **Drifted:** `loadConfig` silently ignored any top-level key in `.planning/config.json` not in `VALID_CONFIG_KEYS`, giving users no feedback when hand-edited or external-tool-added keys had no effect.
- **Fix landed:** PR #1542 — added stderr warning listing unrecognized keys.
- **Would have been blocked by:** **handsync lint** — a seam-aware linter would forbid having parallel hand-authored config validators (CJS `config.cjs` and SDK `config-mutation.ts`) that could silently diverge.

---

### #1542 — fix(config): warn on unrecognized keys in config.json instead of silent drop
- **Drifted:** No drift in this bug itself; it *fixed* #1535's silent-drop behavior by adding the warning.
- **Fix landed:** PR #1542 — merged as the direct fix for #1535.
- **Would have been blocked by:** **per-Module drift lint** (freshness check on config validation) — both CJS and SDK config paths would be regenerated from a single source-of-truth schema module, eliminating the silent-drop risk.

---

### #2047 — bug: config-set rejects intel.enabled despite being a documented config key
- **Drifted:** `intel.enabled` was documented in workflows and gated in runtime code (`intel.cjs:58`), but missing from `VALID_CONFIG_KEYS` in `config.cjs`, so `config-set` rejected it.
- **Fix landed:** PR #2021 — added `intel.enabled` to `VALID_CONFIG_KEYS` in CJS.
- **Would have been blocked by:** **handsync lint** — linter would enforce that every config key gated in runtime code or documented in workflows must appear in the validator allowlist.

---

### #2052 — fix(config): add intel.enabled to VALID_CONFIG_KEYS
- **Drifted:** Same as #2047 (missing from allowlist).
- **Fix landed:** PR #2021 (same PR as #2047 fix).
- **Would have been blocked by:** **handsync lint** — same as #2047.

---

### #2638 — bug: loadConfig writes sub_repos to top-level, then warns it's unknown
- **Drifted:** After #2561 canonicalized `sub_repos` to `planning.sub_repos`, the legacy migration and filesystem auto-sync in `loadConfig` still wrote to top-level `parsed.sub_repos`, which was then flagged as unknown.
- **Fix landed:** PR #2668 — rewrote both paths to target `parsed.planning.sub_repos` and deleted stale top-level copy.
- **Would have been blocked by:** **per-Module drift lint** (freshness check for config shape) — the canonical location for `sub_repos` would be codified in a schema, and any code path writing to it would be verified against that schema at lint time.

---

### #2655 — fix(core): write sub_repos to planning.sub_repos, not top-level
- **Drifted:** Same as #2638.
- **Fix landed:** PR #2668 (same as #2638 fix).
- **Would have been blocked by:** **per-Module drift lint** — same as #2638.

---

### #2653 — bug: SDK config-set rejects documented config keys accepted by CJS config-set
- **Drifted:** SDK's `config-mutation.ts` had a hand-maintained `VALID_CONFIG_KEYS` set that had drifted **28 keys** behind CJS's `config-schema.cjs`, so documented commands like `gsd-sdk query config-set planning.sub_repos` were rejected.
- **Fix landed:** PR #2670 — extracted shared `sdk/src/query/config-schema.ts` module mirroring CJS exactly; added parity test to fail on future drift.
- **Would have been blocked by:** **manifest data isolation** — the config schema would live in one place (e.g., `sdk/shared/config.manifest.json`), and both CJS and SDK would read it, eliminating the possibility of independent drift.

---

### #2670 — fix(#2653): eliminate SDK↔CJS config-schema drift
- **Drifted:** Same as #2653 (28-key drift).
- **Fix landed:** PR #2670 (same as #2653 fix).
- **Would have been blocked by:** **manifest data isolation** — same as #2653.

---

### #2687 — bug: loadConfig warns on valid dynamic-pattern containers in .planning/config.json
- **Drifted:** Keys like `review.models.<cli>` were registered in `config-schema.cjs`'s `DYNAMIC_KEY_PATTERNS` but absent from the hand-maintained `KNOWN_TOP_LEVEL` set in `core.cjs`, causing false-positive "unknown key" warnings.
- **Fix landed:** PR #2706 — added `topLevel` field to `DYNAMIC_KEY_PATTERNS` entries; derived `KNOWN_TOP_LEVEL` from schema instead of maintaining it manually.
- **Would have been blocked by:** **per-Module drift lint** — the validator that builds `KNOWN_TOP_LEVEL` would be regenerated from the schema each run, not hand-maintained.

---

### #2706 — fix(#2687): loadConfig no longer warns on valid dynamic-pattern containers
- **Drifted:** Same as #2687 (false warnings on valid dynamic keys).
- **Fix landed:** PR #2706 (same as #2687 fix).
- **Would have been blocked by:** **per-Module drift lint** — same as #2687.

---

### #2798 — context_window missing from VALID_CONFIG_KEYS
- **Drifted:** `context_window` was documented in workflows and read in SDK runtime (`init.js:190`, `validate.js:575`), but missing from allowlists in both `config-mutation.ts` and `config-schema.cjs`, so writes were rejected.
- **Fix landed:** PR #2816 — added `context_window` to `VALID_CONFIG_KEYS` in both SDK and CJS.
- **Would have been blocked by:** **handsync lint** — linter would enforce that every key read at runtime must be in the allowlist.

---

### #2816 — fix(#2798): add context_window to VALID_CONFIG_KEYS allowlist
- **Drifted:** Same as #2798 (missing from allowlists).
- **Fix landed:** PR #2816 (same as #2798 fix).
- **Would have been blocked by:** **handsync lint** — same as #2798.

---

### #3055 — bug: top-level branching_strategy silently becomes "none"
- **Drifted:** `.planning/config.json` with top-level `branching_strategy: "phase"` was flagged as unknown and dropped by validator, causing `loadConfig` to fall back to the `"none"` default, so phase commits landed on the operator's current branch instead of creating `gsd/phase-{N}` branches.
- **Fix landed:** PR #3116 — SDK-side only; added legacy normalization in `mergeDefaults()` to graft top-level value into canonical `git.branching_strategy` slot before validation.
- **Would have been blocked by:** **per-Module drift lint** — the canonical location for `branching_strategy` would be codified in schema; validator would not strip the value before migrations had a chance to run, or CJS and SDK would share the same migration code.

---

### #3116 — fix: normalize legacy top-level branching_strategy into git config
- **Drifted:** Same as #3055 (legacy top-level shape not normalized before validator strips it).
- **Fix landed:** PR #3116 (SDK-side normalization in `mergeDefaults()`).
- **Would have been blocked by:** **per-Module drift lint** — same as #3055, but SDK-side fix would be shared with CJS via seam layer instead of being ported separately.

---

### #3523 — bug: CJS loadConfig warns top-level branching_strategy 'will be ignored', but actively reads it
- **Drifted:** After PR #3116 fixed the SDK side, the CJS path still emitted false "will be ignored" warnings on the same legacy top-level key, because `KNOWN_TOP_LEVEL` derivation extracted top-level names from `VALID_CONFIG_KEYS` (which contains `'git.branching_strategy'` but not `'branching_strategy'`), and the warning was factually incorrect — `core.cjs:485` does read the legacy value via fallback logic.
- **Fix landed:** PR #3527 — added `'branching_strategy'` to the `KNOWN_TOP_LEVEL` hand-maintained list under the deprecated-keys bucket, suppressing the false warning.
- **Would have been blocked by:** **runtime-bridge delegation** — if CJS and SDK config loading shared a common normalization routine (via `executeForCjs` or a shared seam module), the SDK fix in #3116 would automatically apply to CJS; no separate CJS-side warning would be possible.

---

## Surprises

None. All 15 bugs are genuine CJS↔SDK schema/validation drift, exactly the class the seam migration prevents.

## Phase 6 Enforcement Summary

The seam migration introduces these layers:

1. **handsync lint** (`scripts/lint-shared-module-handsync.cjs`) — Forbids parallel hand-authored validator modules; catches #1535, #2047, #2798.
2. **freshness check** (`sdk/scripts/check-<module>-fresh.mjs`) — Regenerates config validators from schema each run; catches #2687, #3055.
3. **manifest data isolation** (`sdk/shared/*.manifest.json`) — Single source-of-truth for schema; catches #2653.
4. **per-Module drift lint** — Combination of freshness checks and schema-derived allowlists; catches #2638, #2687, #3055.
5. **runtime-bridge delegation** (`executeForCjs` + shared seam modules) — Eliminates parallel CJS/SDK implementations; catches #3523 by preventing separate CJS warning logic.

Together, these layers eliminate the 15-bug class by enforcing single sources of truth at each decision point.

---

## Guide: Adding a new Shared Module

Use this when you want to extract a new piece of data or logic that both CJS and SDK currently duplicate hand-by-hand. Phase 1's `state-document` migration is the worked example.

**Step 1 — Create the source-of-truth file**

```text
sdk/src/<module>/index.ts
```

This is the canonical definition. It may export a schema, a set of keys, a type, or a data object. It must not import from CJS or from generated files.

**Step 2 — Write the generator script**

```text
sdk/scripts/gen-<module>.mjs
```

The generator reads `sdk/src/<module>/index.ts` (or `sdk/shared/<module>.manifest.json` for pure-data manifests), produces a generated output file (either `sdk/src/<module>.generated.ts` or `get-shit-done/bin/lib/<module>.generated.cjs`), and exits 0. It must be idempotent: running it twice produces the same output.

**Step 3 — Write the freshness check**

```text
sdk/scripts/check-<module>-fresh.mjs
```

The freshness check re-runs the generator into a temp location, diffs against the committed file, and exits 1 with a clear message if they diverge. This is what CI runs.

**Step 4 — Write the parity test** (optional but recommended)

```text
tests/<module>-parity.test.cjs
```

Assert that the CJS Adapter and the SDK source-of-truth agree on every field that matters (key sets, defaults, schema shape). This test catches generator bugs that the freshness check cannot.

**Step 5 — Wire CI**

Add a step in `.github/workflows/test.yml` after the existing freshness-check block (before "Run tests with coverage"), gated on `matrix.os == 'ubuntu-latest' && matrix.node-version == 24`:

```yaml
- name: SDK generated <module> artifact drift check
  if: matrix.os == 'ubuntu-latest' && matrix.node-version == 24
  shell: bash
  run: node sdk/scripts/check-<module>-fresh.mjs
```

**Step 6 — Run inventory regen**

If the module affects `CONTEXT.md`'s module inventory, update that section. Also update `scripts/shared-module-handsync-allowlist.json`: move any matching entry from `migrateMeBacklog` to `cooperatingSiblings` (or remove it entirely if the CJS hand-copy is now deleted).

**Step 7 — Update CODEOWNERS**

Add the new source-of-truth path to `.github/CODEOWNERS` under the Phase 6 block to make the architectural ownership explicit.

**Reference:** Phase 1 PR [#3531](https://github.com/gsd-build/get-shit-done/pull/3531) — `state-document` migration.

---

## Guide: Adding a new canonical command

Use this when adding a new `gsd-sdk query <family>.<subcommand>` that should be handled natively in the SDK (not delegated to CJS). Phase 5.1's `state.update` migration (PR [#3574](https://github.com/gsd-build/get-shit-done/pull/3574)) is the worked example.

**Step 1 — Declare in the command manifest**

Add the command definition to `sdk/src/query/command-manifest.<family>.ts`. Include the full argument schema and a `handler` reference.

**Step 2 — Implement the SDK handler**

Write the handler in `sdk/src/query/<subcommand>.ts` (or inline in the manifest file for simple cases). The handler receives validated args and the runtime context; it must not shell out to CJS.

**Step 3 — Add CJS router delegate (Phase 5.1+ pattern)**

In the family's CJS command router (e.g. `get-shit-done/bin/lib/state-command-router.cjs`), add a delegate case that calls `executeForCjs(subcommand, args)` from `cjs-command-router-adapter.cjs`. This ensures the CJS binary dispatches to the SDK native handler rather than re-implementing the logic.

**Step 4 — Add a golden parity test**

Add a test in `tests/<family>-command-router.test.cjs` (or a new file if the family has no test yet) that:
1. Invokes the command via the SDK query path.
2. Invokes the command via the CJS router path.
3. Asserts both produce identical output.

This test enforces that the delegate and the native handler stay aligned.

**Reference:** Phase 5.1 PR [#3574](https://github.com/gsd-build/get-shit-done/pull/3574) — `state.update` delegation.

---

## Phase 6 Final Completion Summary

Phase 6 (issue #3575, PR #3577) is feature-complete. The migration is done.

**What shipped in Phase 6:**

- **Shared Modules migrated (5 total in Phase 6):** `plan-scan`, `secrets`, `schema-detect`, `decisions`, `workstream-name-policy`. Each follows the full pattern: SDK source-of-truth, generator (`gen-<name>.mjs`), freshness check (`check-<name>-fresh.mjs`), generated CJS artifact (`<name>.generated.cjs`), CJS shim re-export, parity test, CI step, pre-commit hook, CODEOWNERS entry.
- **Workstream native support:** The sync bridge worker now correctly threads `workstream` through to `registry.dispatch()`. `GSDTransport` no longer forces subprocess for workstream-scoped requests. Workstream-scoped state commands execute natively.
- **State parity divergences resolved:** `state.record-metric` and `state.prune` SDK handlers now match CJS semantics exactly.
- **MIGRATE_ME pairs resolved:** `decisions` and `workstream-name-policy` migrated from `migrateMeBacklog` to `cooperatingSiblings` as ADAPTER-OVER-MODULE.
- **Lint final state:** 22 cooperating siblings, 0 backlog pairs.

**Decisions migration specifics (B1):**
- SDK `decisions.ts` regex aligned to CJS: `D-([A-Za-z0-9_-]+)` (alphanumeric IDs like `D-INFRA-01` accepted).
- SDK returns richer `{id, text, category, tags, trackable}`; CJS callers using only `{id, text}` safely ignore extras.
- Parity test: `tests/decisions-generator.test.cjs` (15 tests covering numeric IDs, alphanumeric IDs, richer schema fields).

**Workstream-name-policy migration specifics (B2):**
- Added `hasInvalidPathSegment` and `isValidActiveWorkstreamName` to SDK `workstream-name-policy.ts`.
- `validateWorkstreamName` is now an alias for `isValidActiveWorkstreamName` (consistent with CJS semantics).
- Parity test: `tests/workstream-name-policy-generator.test.cjs` (19 tests covering all four exports).

---

## Open follow-ups

No migration items remain. The following are future quality candidates, not defects:

- **`config.cjs` / `sdk/src/config.ts`** — These files are CJS-CLI-ONLY (per allowlist classification). The `config.cjs` file contains only CLI command handlers that use sync CJS APIs; `sdk/src/config.ts` provides the async SDK layer. They serve disjoint surfaces. A future migration would require converting the CLI handlers to async + SDK patterns, which is a larger refactor out of scope for this migration cycle.
- **`intel.cjs` / `sdk/src/query/intel.ts`** — Intentional architectural divergence (different file naming conventions between CJS and SDK; documented in allowlist). A future migration would require reconciling INTEL_FILES naming, which is a breaking change for existing consumers.
- **`model-catalog.cjs` / `sdk/src/model-catalog.ts`** — Both sides read from `sdk/shared/model-catalog.json` independently (ADAPTER-OVER-MODULE pattern). This is intentional; the shared JSON is the source-of-truth. No duplication of logic between CJS and SDK consumers.
