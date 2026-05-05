---
phase: 10-fix-new-milestone-sme-creator-integration
plan: "01"
subsystem: workflows/agents
tags:
  - tdd
  - sme-creator
  - new-milestone
  - config-driven
  - gap-closure
dependency_graph:
  requires: []
  provides:
    - sme-step.md resolves CREATOR_MODEL and AGENT_SKILLS_CREATOR before Task() spawn
    - sme-step.md checks ## SME Creation Complete marker before adding to SELECTED_SMES
    - gsd-sme-creator.md uses config-driven block_mode from sme.blocking
  affects:
    - get-shit-done/workflows/new-milestone/sme-step.md
    - agents/gsd-sme-creator.md
tech_stack:
  added: []
  patterns:
    - TDD structural tests (CJS node:test + Vitest TypeScript)
    - gsd-sdk query resolve-model / agent-skills pattern (from execute-phase.md)
    - gsd-sdk query config-get with --raw flag and fallback default
    - ## SME Creation Complete marker check pattern (from create-sme.md)
key_files:
  created: []
  modified:
    - tests/sme-new-milestone-detect.test.cjs
    - sdk/src/agents/sme-creator-structure.test.ts
    - get-shit-done/workflows/new-milestone/sme-step.md
    - agents/gsd-sme-creator.md
decisions:
  - "Resolve model/skills once before the per-process loop (not inside it) — avoids redundant queries"
  - "Use || echo fallback pattern from execute-phase.md for safe degradation when gsd-sdk unavailable"
  - "block_mode validation accepts only soft/strict; defaults to soft for any other value (T-10-01 mitigation)"
metrics:
  duration_minutes: 2
  completed_date: "2026-05-05"
  tasks_completed: 2
  files_modified: 4
requirements-completed: [CONFIG-03]
---

# Phase 10 Plan 01: Fix New-Milestone SME Creator Integration Summary

**One-liner:** TDD-based fix of three integration bugs — resolve-model/agent-skills before Task() spawn, SME Creation Complete marker check on return, and config-driven block_mode via sme.blocking in gsd-sme-creator.

## What Was Built

Three integration gaps (CONFIG-03, DETECT-04, DETECT-05) in the new-milestone SME creation flow were closed using TDD:

1. **DETECT-04 (sme-step.md model/skills resolution):** `CREATOR_MODEL` and `AGENT_SKILLS_CREATOR` were template placeholders with no resolution code — they would arrive as literal `{CREATOR_MODEL}` strings in the Task() call. Added `gsd-sdk query resolve-model gsd-sme-creator` and `gsd-sdk query agent-skills gsd-sme-creator` calls before the per-process loop.

2. **DETECT-05 (completion marker check):** After `Task(gsd-sme-creator)` returned, the old code unconditionally added the process name to `SELECTED_SMES` regardless of whether creation succeeded. Replaced with a check for the `## SME Creation Complete` marker — failed creations are logged as warnings and skipped rather than polluting `SELECTED_SMES`.

3. **CONFIG-03 (config-driven block_mode):** `gsd-sme-creator.md` hardcoded `block_mode: soft` in the SME document template. Added `gsd-sdk query config-get sme.blocking --raw` with validation (only `soft`/`strict` accepted; defaults to `soft`) so projects can configure block severity without editing the agent.

## TDD Gate Compliance

- **RED commit:** `53c4a40b` — 5 new failing tests (3 CJS + 2 Vitest); all 10+21 pre-existing tests remained green
- **GREEN commit:** `97d90173` — all 3 workflow/agent fixes applied; 13/13 CJS + 23/23 Vitest tests pass

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | RED — Add failing structural test assertions | 53c4a40b | tests/sme-new-milestone-detect.test.cjs, sdk/src/agents/sme-creator-structure.test.ts |
| 2 | GREEN — Apply three fixes to make all tests pass | 97d90173 | get-shit-done/workflows/new-milestone/sme-step.md, agents/gsd-sme-creator.md |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all three fixes wire real behavior; no placeholders remain.

## Threat Flags

No new security-relevant surface introduced. All threat model mitigations from the plan were applied:

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-10-01 | BLOCK_MODE validated against `soft`/`strict` allowlist; invalid values default to `soft` |
| T-10-02 | `## SME Creation Complete` marker checked before adding to SELECTED_SMES; failures skip without blocking |
| T-10-03 | Pre-existing PROCESS_NAME regex validation at sme-step.md line 110 unchanged (accepted) |

## Self-Check: PASSED

Files confirmed to exist:
- `get-shit-done/workflows/new-milestone/sme-step.md` — FOUND
- `agents/gsd-sme-creator.md` — FOUND
- `tests/sme-new-milestone-detect.test.cjs` — FOUND
- `sdk/src/agents/sme-creator-structure.test.ts` — FOUND

Commits confirmed to exist:
- `53c4a40b` — FOUND (test(10-01): add failing structural test assertions for all three fixes)
- `97d90173` — FOUND (feat(10-01): apply three integration fixes for new-milestone SME creator flow)
