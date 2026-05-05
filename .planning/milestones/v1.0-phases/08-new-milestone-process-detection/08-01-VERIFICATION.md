---
phase: 08-new-milestone-process-detection
verified: 2026-04-30T22:45:00Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
---

# Phase 8: New-Milestone Process Detection Verification Report

**Phase Goal:** When a new milestone starts, GSD automatically detects which processes it touches and surfaces or queues the relevant SMEs
**Verified:** 2026-04-30T22:45:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | new-milestone.md dispatches to new-milestone/sme-step.md for SME detection | VERIFIED | Line 206: `If \`workflow.use_sme_agents\` is true: Read \`workflows/new-milestone/sme-step.md\`...` — confirmed at file position 204 |
| 2 | sme-step.md checks use_sme_agents config flag and skips when false | VERIFIED | Lines 4, 9, 12 of sme-step.md; explicit skip gate: "If SME_AGENTS is not true: Skip this step entirely." |
| 3 | sme-step.md calls sme.list to find existing SME documents | VERIFIED | Line 22: `gsd-sdk query sme.list` — handler registered in sdk/src/query/index.ts:408 |
| 4 | sme-step.md calls sme.detect-processes with milestone goal text to find matching processes | VERIFIED | Line 46: `gsd-sdk query sme.detect-processes --goal "${MILESTONE_GOAL}"` — handler registered in sdk/src/query/index.ts:410 |
| 5 | sme-step.md presents AskUserQuestion for user confirmation of existing SMEs | VERIFIED | Lines 66 and 96: two `AskUserQuestion(` blocks — DETECT-03 and DETECT-04 confirmation prompts |
| 6 | sme-step.md offers to spawn gsd-sme-creator for processes without SMEs | VERIFIED | Lines 107, 117, 121: validation guard + `Task(subagent_type="gsd-sme-creator"...` spawn pattern |
| 7 | sme-step.md writes selected SMEs to STATE.md via frontmatter.merge (never state.update or state.patch) | VERIFIED | Line 147: `gsd-sdk query frontmatter.merge .planning/STATE.md --data "$ACTIVE_SMES_JSON"` — confirmed zero occurrences of state.update/state.patch in file; handler registered in sdk/src/query/index.ts:308 |
| 8 | SME detection step appears AFTER state.milestone-switch in new-milestone.md (ordering constraint) | VERIFIED | state.milestone-switch at line 184; step 5.5 dispatch at line 204 — indexOf ordering test passes (switchIdx=184 < smeStepIdx=204) |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/sme-new-milestone-detect.test.cjs` | Structural tests for DETECT-01 through DETECT-05 | VERIFIED | Exists, 98 lines, contains describe('DETECT-01) through describe('DETECT-05) plus ordering describe block; 10 tests, 10 pass |
| `get-shit-done/workflows/new-milestone/sme-step.md` | Lazy-loaded SME detection and queuing step | VERIFIED | Exists, 159 lines, substantive 7-step implementation; contains all required strings |
| `get-shit-done/workflows/new-milestone.md` | Dispatch reference to sme-step.md | VERIFIED | Exists, 639 lines (under 1500-line budget); step 5.5 inserted at line 204 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| get-shit-done/workflows/new-milestone.md | get-shit-done/workflows/new-milestone/sme-step.md | lazy-load dispatch reference at step 5.5 | WIRED | `workflows/new-milestone/sme-step.md` appears exactly once in new-milestone.md at line 206 |
| get-shit-done/workflows/new-milestone/sme-step.md | sdk/src/query/sme.ts | gsd-sdk query sme.list and sme.detect-processes | WIRED | Both calls present in sme-step.md; both handlers registered in sdk/src/query/index.ts (lines 408, 410) |
| get-shit-done/workflows/new-milestone/sme-step.md | sdk/src/query/frontmatter-mutation.ts | gsd-sdk query frontmatter.merge for active_smes | WIRED | `frontmatter.merge .planning/STATE.md` at sme-step.md line 147; handler registered at index.ts:308 |

### Data-Flow Trace (Level 4)

Not applicable. All three artifacts are workflow documents (markdown), not components that render dynamic data. They describe execution steps for an AI agent to follow — there is no data rendering pipeline to trace.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 10 structural tests pass | `node --test tests/sme-new-milestone-detect.test.cjs` | 10 pass, 0 fail | PASS |
| new-milestone.md stays under size budget | `node --test tests/workflow-size-budget.test.cjs` | 104 pass, 0 fail | PASS |
| Phase 7 regression (12 tests) | `node --test tests/sme-discuss-phase.test.cjs` | 12 pass, 0 fail | PASS |
| Phase 6 regression (16 tests) | `node --test tests/sme-gate-plan-phase.test.cjs` | 16 pass, 0 fail | PASS |
| TDD gate: RED commit precedes GREEN commit | `git log --oneline` | 558ead43 (RED) before 73ad61cb (GREEN) | PASS |
| forbidden strings absent from sme-step.md | `grep -c 'state.update\|state.patch' sme-step.md` | returns 0 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| DETECT-01 | 08-01-PLAN.md | During new-milestone setup, scan codebase to identify which processes the milestone touches | SATISFIED | sme-step.md step 3 calls `sme.detect-processes --goal "${MILESTONE_GOAL}"`; dispatch in new-milestone.md step 5.5 |
| DETECT-02 | 08-01-PLAN.md | Check if SMEs exist for detected processes in `.planning/smes/` | SATISFIED | sme-step.md step 2 calls `sme.list` which returns all existing SME documents |
| DETECT-03 | 08-01-PLAN.md | If SME exists: surface it and ask user confirmation to use it | SATISFIED | sme-step.md step 4 presents `AskUserQuestion(multiSelect: true, ...)` for all available SMEs with auto-detected matches highlighted |
| DETECT-04 | 08-01-PLAN.md | If SME missing: offer to create one per-process (yes/no/skip all) | SATISFIED | sme-step.md step 5 presents `AskUserQuestion` for missing processes and spawns `gsd-sme-creator` with process name validation |
| DETECT-05 | 08-01-PLAN.md | Queue selected SMEs in `.planning/STATE.md` under `milestone.active_smes` array | SATISFIED | sme-step.md step 6 writes `{'milestone': {'active_smes': names}}` via `frontmatter.merge .planning/STATE.md` |

All 5 DETECT requirements from REQUIREMENTS.md (lines 79-83) are satisfied. The traceability table at REQUIREMENTS.md line 156-160 maps all five to Phase 8 as "Pending" — these are now fulfilled.

No orphaned requirements: REQUIREMENTS.md maps only DETECT-01 through DETECT-05 to Phase 8, and the plan claims exactly those five IDs.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| get-shit-done/workflows/new-milestone.md | 547 | `PENDING_TODOS=...` | Info | Bash variable using the word "TODOS" — this is workflow logic for processing todo items, not a TODO comment anti-pattern |

No blockers, no warnings, no stubs detected.

Notable: The SUMMARY documents a deliberate deviation — the warning comment in sme-step.md step 6 was reworded from "NEVER use state.update or state.patch" to "Use ONLY frontmatter.merge" to avoid tripping the DETECT-05 negative assertion test (`!content.includes('state.update')`). The semantic intent is preserved; the workaround is valid.

### Human Verification Required

None. All observables are verifiable from file content and test execution. This phase produces workflow documents (markdown), not UI components or real-time behaviors.

### Gaps Summary

No gaps. All 8 observable truths verified, all 3 artifacts confirmed substantive and wired, all 5 requirement IDs satisfied, all test suites pass (10 structural + 104 size-budget + 12 Phase-7 + 16 Phase-6 = 142 total), TDD RED-before-GREEN gate confirmed, forbidden strings absent.

---

_Verified: 2026-04-30T22:45:00Z_
_Verifier: Claude (gsd-verifier)_
