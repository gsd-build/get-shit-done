---
phase: 01-schema-config
plan: 02
subsystem: config
tags: [config-schema, sme, typescript, defaults, documentation]
dependency_graph:
  requires: []
  provides:
    - SME config key validation in CJS schema (workflow.use_sme_agents, sme.blocking, sme.processes.*.block_mode)
    - SME config key validation in SDK schema (mirrors CJS exactly)
    - TypeScript types for SME config (WorkflowConfig.use_sme_agents, GSDConfig.sme)
    - New-project defaults (workflow.use_sme_agents: false, sme.blocking: soft)
    - CONFIGURATION.md documentation for all SME config keys
  affects:
    - get-shit-done/bin/lib/config-schema.cjs
    - sdk/src/query/config-schema.ts
    - sdk/src/config.ts
    - get-shit-done/bin/lib/config.cjs
    - sdk/src/query/config-mutation.ts
    - docs/CONFIGURATION.md
tech_stack:
  added: []
  patterns:
    - Config key allowlist pattern (VALID_CONFIG_KEYS Set + DYNAMIC_KEY_PATTERNS array)
    - CJS-to-SDK schema parity enforced by CI tests
    - Three-level deep merge for new-project config defaults
key_files:
  created: []
  modified:
    - get-shit-done/bin/lib/config-schema.cjs
    - sdk/src/query/config-schema.ts
    - sdk/src/config.ts
    - get-shit-done/bin/lib/config.cjs
    - sdk/src/query/config-mutation.ts
    - docs/CONFIGURATION.md
decisions:
  - workflow.use_sme_agents defaults to false for backward compatibility (opt-in feature gate)
  - sme key not added to CONFIG_DEFAULTS in sdk/src/config.ts — CJS buildNewProjectConfig is canonical defaults location; index signature covers runtime access
  - Dynamic pattern sme.processes.{name}.block_mode restricts process names to [a-zA-Z0-9_-]+ (T-01-02 mitigation)
metrics:
  duration: 10m
  completed: "2026-04-28"
  tasks_completed: 2
  files_modified: 6
requirements-completed: [CONFIG-01, CONFIG-02, CONFIG-03]
---

# Phase 01 Plan 02: SME Config Keys Registration Summary

**One-liner:** Registered `workflow.use_sme_agents`, `sme.blocking`, and `sme.processes.<name>.block_mode` across all six config-system files with CJS/SDK/docs parity CI passing and all 40 config-mutation unit tests passing.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Register SME config keys in CJS schema, SDK schema, and docs | 2d4c5501 | config-schema.cjs, config-schema.ts, CONFIGURATION.md |
| 2 | Add SME config defaults to new-project config and TypeScript types | 780ce965 | config.cjs, sdk/src/config.ts, config-mutation.ts |

## What Was Built

All six files that must stay in sync were updated atomically to register the SME feature gate config keys:

**CJS schema (`get-shit-done/bin/lib/config-schema.cjs`):**
- Added `'workflow.use_sme_agents'` and `'sme.blocking'` to `VALID_CONFIG_KEYS`
- Added `sme.processes.<name>.block_mode` dynamic pattern to `DYNAMIC_KEY_PATTERNS`

**SDK schema (`sdk/src/query/config-schema.ts`):**
- Added same two static keys to `VALID_CONFIG_KEYS` (CJS parity)
- Added SME dynamic pattern with `source` field for parity test comparison

**TypeScript types (`sdk/src/config.ts`):**
- Added `use_sme_agents: boolean` to `WorkflowConfig` interface
- Added `sme?: { blocking?: string; [key: string]: unknown }` to `GSDConfig` interface
- Added `use_sme_agents: false` to `CONFIG_DEFAULTS.workflow`

**New-project defaults (`get-shit-done/bin/lib/config.cjs`):**
- Added `use_sme_agents: false` to `hardcoded.workflow` in `buildNewProjectConfig`
- Added `sme: { blocking: 'soft' }` as new top-level key in `hardcoded`
- Added `sme` merge block in three-level deep merge section

**SDK configNewProject (`sdk/src/query/config-mutation.ts`):**
- Added `use_sme_agents: false` to SDK workflow defaults
- Added `sme: { blocking: 'soft' }` defaults and sme deep-merge block
- Fixed pre-existing `commit_docs: false` bug (Rule 1)

**Documentation (`docs/CONFIGURATION.md`):**
- Added `workflow.use_sme_agents` row to Workflow Toggles table
- Added new `## SME Settings` section with `sme.blocking` and `sme.processes.<name>.block_mode` entries

## Verification Results

- `node --test tests/config-schema-docs-parity.test.cjs` — PASS (1/1 tests)
- `node --test tests/config-schema-sdk-parity.test.cjs` — PASS (2/2 tests)
- `cd sdk && npm run test:unit -- src/query/config-mutation.test.ts` — PASS (40/40 tests)
- `gsd-tools config-set workflow.use_sme_agents false` — accepted
- `gsd-tools config-set sme.blocking soft` — accepted
- `gsd-tools config-set sme.processes.payments.block_mode strict` — accepted

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing `commit_docs: false` in SDK configNewProject**
- **Found during:** Task 2 verification
- **Issue:** `sdk/src/query/config-mutation.ts` `configNewProject` had `commit_docs: false` hardcoded while the CJS version uses `CONFIG_DEFAULTS.commit_docs` which is `true`. The existing test `configNewProject > creates config.json with defaults` was failing before my changes.
- **Fix:** Changed `commit_docs: false` to `commit_docs: true` to match CJS parity
- **Files modified:** `sdk/src/query/config-mutation.ts`
- **Commit:** 780ce965

## Known Stubs

None — all config keys are wired to real validation and defaults.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: input-validation | get-shit-done/bin/lib/config-schema.cjs | sme.processes.{name}.block_mode dynamic pattern constrains process names to [a-zA-Z0-9_-]+ per T-01-02 mitigation |

## Self-Check: PASSED

- `get-shit-done/bin/lib/config-schema.cjs` — FOUND
- `sdk/src/query/config-schema.ts` — FOUND
- `docs/CONFIGURATION.md` — FOUND
- `get-shit-done/bin/lib/config.cjs` — FOUND
- `sdk/src/config.ts` — FOUND
- `sdk/src/query/config-mutation.ts` — FOUND
- Task 1 commit `2d4c5501` — FOUND
- Task 2 commit `780ce965` — FOUND
