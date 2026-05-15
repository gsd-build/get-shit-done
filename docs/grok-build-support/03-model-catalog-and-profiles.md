# Grok Build: Model Catalog and Profile Resolution

## Single Source of Truth

`sdk/shared/model-catalog.json` (shipped both in the root package and inside `@gsd-build/sdk`) is the **only** place that declares supported runtimes and their default tier → model mappings.

Adding Grok requires only a new key under `runtimeTierDefaults`:

```json
"grok": {
  "opus":   { "model": "grok-4" },
  "sonnet": { "model": "grok-3" },
  "haiku":  { "model": "grok-3-mini" }
}
```

(Exact model names to be confirmed with xAI Grok Build team / release notes at implementation time. Current Grok coding models as of 2026-04 are expected to be `grok-4`, `grok-3`, and lighter variants.)

If Grok Build does not benefit from GSD's `quality`/`balanced`/`budget`/`adaptive` profile aliases (because users primarily select models inside the TUI or via `config.toml`), we can use `null` for all three tiers (like `kilo`, `cline`, `cursor`, `windsurf`, etc.). In that case `resolveRuntimeTierDefault('grok', ...)` returns null and callers fall back to `model_overrides` or the runtime's native model picker.

**Recommendation for first cut:** Provide concrete Grok model IDs so that `/gsd-config --model-profile quality` and the agent router (`resolve-model`) produce useful defaults when a user is in a pure-Grok workflow. Users can always override per-agent.

## Derived Exports (no code change needed)

Once the JSON key exists:

- `SUPPORTED_RUNTIMES` in `sdk/src/model-catalog.ts` automatically includes `"grok"`.
- `sdk/src/query/helpers.ts:detectRuntime` accepts it.
- `get-shit-done/bin/lib/model-catalog.cjs` (via the JSON loader) exposes it to all CJS paths (`core.cjs`, `model-profiles.cjs`, `gsd-tools.cjs`).
- `RUNTIME_PROFILE_MAP`, `KNOWN_RUNTIMES`, `RUNTIMES_WITH_REASONING_EFFORT` are derived.
- `runtimesWithReasoningEffort()` will **not** include `grok` unless we later discover Grok supports an `reasoning_effort`-style parameter (unlikely; Grok uses its own thinking controls).

## Agent Catalog (unchanged)

The 33+ `gsd-*` agents keep their existing `golden`/`balanced`/`budget` + `routingTier` assignments. When `runtime === 'grok'`, the model resolver in `sdk/src/session-runner.ts` and `core.cjs` will simply look up the Grok-side tier defaults instead of the Claude ones.

No new agent entries required.

## Config Surface (`/gsd-config` and `settings-advanced`)

`docs/CONFIGURATION.md` and `get-shit-done/workflows/settings-advanced.md` contain a runtime → model table that is validated against the catalog (see ADR-0003 and the test `tests/model-catalog-runtime-defaults.test.cjs`).

Adding the `grok` row will make the table and the interactive `/gsd-settings` model picker show Grok tiers automatically.

Example expected row (after impl):

| Runtime | Quality (opus) | Balanced (sonnet) | Budget (haiku) | Notes |
|---------|----------------|-------------------|----------------|-------|
| Grok Build | grok-4 | grok-3 | grok-3-mini | xAI native models |

## `model_overrides` and `model_profile_overrides`

Users who want per-runtime fine-grained control can already do:

```json
{
  "model_profile_overrides": {
    "grok": {
      "gsd-executor": "grok-4-latest",
      "gsd-planner": "grok-4"
    }
  }
}
```

No schema change required — the config schema is generic.

## Session Runner & SDK Execution

`sdk/src/session-runner.ts` currently special-cases only `claude` (imports `@anthropic-ai/claude-agent-sdk`).

For Grok Build the primary usage mode is the **TUI itself** (`grok` binary), not the Node SDK. Therefore:

- When `runtime: 'grok'`, the SDK path (`GSDTools`, `createRegistry`, `gsd-sdk query`) should still function for tool calls inside a Grok session (via the Runtime Bridge), but we do **not** need to launch a Grok sub-process from the SDK in the same way the Claude SDK path does.
- The `assertRuntimeSupportsAutoMode` guard in `runtime-gate.ts` will treat `grok` like `codex` / `opencode` (allowed, but certain auto-orchestration features may be limited or routed differently).

If Grok Build later exposes an official Node/TypeScript agent SDK (similar to Claude's), a follow-up can add a `grok-agent-sdk` import path guarded by `if (runtime === 'grok')`.

## Tests That Will Need Updates

- `sdk/src/runtime-gate.test.ts`
- `sdk/src/session-runner.test.ts` (add `grok` cases mirroring the `codex` ones)
- `tests/model-catalog-runtime-defaults.test.cjs`
- Any snapshot or golden file that prints the full runtime list.

## Back-compat

Unknown runtimes fall back to Claude behavior in several places. Adding `grok` removes it from the "unknown" set, which is the desired outcome.

## Summary of Edits

**Only one data change:**

1. Edit `sdk/shared/model-catalog.json` → add the `"grok"` object under `runtimeTierDefaults`.

All other behavior (TS types, CJS exports, docs tables, profile resolution) is derived or already generic.

This is the lowest-risk, highest-leverage part of the entire plan.
