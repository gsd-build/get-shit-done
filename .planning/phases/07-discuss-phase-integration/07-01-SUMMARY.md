---
phase: 07-discuss-phase-integration
plan: "01"
subsystem: discuss-phase
tags:
  - sme
  - discuss-phase
  - tdd
  - probing-questions
dependency_graph:
  requires:
    - "06-01 (SME plan-phase gate — gsd-sme-auditor agent exists)"
    - "sdk/src/query/sme.ts (sme.context-block handler)"
    - "sdk/src/query/frontmatter.ts (frontmatter.get handler)"
  provides:
    - "SME probing questions in discuss-phase before planning begins"
    - "sme_context block in CONTEXT.md for planner consumption"
    - "sme-step.md lazy-loaded sub-workflow"
  affects:
    - "get-shit-done/workflows/discuss-phase.md (dispatch reference added)"
    - "get-shit-done/workflows/discuss-phase/templates/context.md (sme_context section added)"
tech_stack:
  added: []
  patterns:
    - "Lazy-loaded sub-workflow pattern (mirrors plan-phase.md step 12.6)"
    - "frontmatter.get for active_smes (not state.json — preserves custom frontmatter fields)"
    - "Config-gated execution (use_sme_agents: false default)"
    - "Probing-questions auditor mode (no SME_APPROVED/SME_CONCERNS markers)"
key_files:
  created:
    - tests/sme-discuss-phase.test.cjs
    - get-shit-done/workflows/discuss-phase/sme-step.md
  modified:
    - get-shit-done/workflows/discuss-phase/templates/context.md
    - get-shit-done/workflows/discuss-phase.md
decisions:
  - "Use frontmatter.get (not state.json) to read active_smes — state.json rebuilds from body scanning and does not preserve custom fields like milestone.active_smes"
  - "Dispatch reference inserted AFTER cross_reference_todos step (line 279) not in progressive_disclosure table — keeps position test passing and respects workflow ordering"
  - "Probing-questions mode explicitly overrides auditor role — no PLAN.md to review, produces numbered risk questions instead"
  - "sme_risk_areas stored for injection into present_gray_areas and write_context — domain risks surface during discussion, not just planning"
metrics:
  duration: "1 minute"
  completed: "2026-05-01T02:36:40Z"
  tasks_completed: 2
  files_changed: 4
---

# Phase 07 Plan 01: SME Discuss-Phase Integration Summary

TDD implementation of SME domain probing in discuss-phase: 12 structural tests written RED, then sme-step.md sub-workflow created + context.md template updated + discuss-phase.md dispatch added to turn all tests GREEN.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | RED: Write structural tests for SME discuss-phase integration | 47eedac4 | tests/sme-discuss-phase.test.cjs |
| 2 | GREEN: Implement sme-step.md, update context template, add discuss-phase dispatch | 2b1ade34 | get-shit-done/workflows/discuss-phase/sme-step.md, get-shit-done/workflows/discuss-phase/templates/context.md, get-shit-done/workflows/discuss-phase.md |

## What Was Built

### sme-step.md (new, 91 lines)

A lazy-loaded sub-workflow with 5 ordered steps:

1. **Config guard** — skips silently when `use_sme_agents` is not `true`
2. **Read active_smes** — uses `frontmatter.get` on STATE.md to read `milestone.active_smes`; skips silently if empty
3. **Fetch SME context blocks** — calls `sme.context-block` per process name; warns if none found, never blocks
4. **Generate probing questions** — spawns `gsd-sme-auditor` in probing-questions mode (no PLAN.md review); captures numbered risk list as `sme_risk_areas`
5. **Output for CONTEXT.md** — stores `sme_risk_areas` for injection as `<sme_context>` block in CONTEXT.md via write_context step

### context.md template (modified)

- Added `<sme_context>` bullet to `## Conditional sections` documentation
- Added `<sme_context>` block to template body after `</deferred>`, with numbered probing questions and active SME list

### discuss-phase.md (modified, 499 lines)

- Added single dispatch line after `cross_reference_todos` step: `If 'use_sme_agents' is true: Read 'workflows/discuss-phase/sme-step.md' and execute its steps. Otherwise skip.`
- File stays at 499 lines (under the 500-line budget enforced by workflow-size-budget.test.cjs)

## TDD Gate Compliance

- RED gate: commit `47eedac4` — all 12 tests failing before any implementation
- GREEN gate: commit `2b1ade34` — all 12 tests passing after implementation
- Gate sequence: RED commit precedes GREEN commit in git log

## Verification Results

| Check | Result |
|-------|--------|
| `node --test tests/sme-discuss-phase.test.cjs` | 12/12 pass |
| `node --test tests/workflow-size-budget.test.cjs` | 104/104 pass |
| `node --test tests/sme-gate-plan-phase.test.cjs` | 16/16 pass (no regression) |
| `wc -l get-shit-done/workflows/discuss-phase.md` | 499 (< 500 budget) |
| `grep -c sme_context context.md` | 3 matches |
| `grep -c sme-step.md discuss-phase.md` | 1 match |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — sme-step.md references real SDK query handlers (sme.context-block, frontmatter.get, config-get) that exist from Phase 2 and Phase 6. The `sme_risk_areas` output variable is stored for the write_context step, which already supports conditional sections in CONTEXT.md.

## Threat Flags

No new security-relevant surface introduced. The sme-step.md file follows the same trust boundary pattern as plan-phase.md step 12.6. T-07-01 through T-07-04 mitigations from the plan's threat model are satisfied by existing SDK handler implementations.

## Self-Check: PASSED

Files verified present:
- tests/sme-discuss-phase.test.cjs: FOUND
- get-shit-done/workflows/discuss-phase/sme-step.md: FOUND
- get-shit-done/workflows/discuss-phase/templates/context.md: FOUND (modified)
- get-shit-done/workflows/discuss-phase.md: FOUND (modified)

Commits verified:
- 47eedac4 (RED): FOUND
- 2b1ade34 (GREEN): FOUND
