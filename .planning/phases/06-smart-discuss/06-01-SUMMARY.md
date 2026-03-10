---
phase: 06-smart-discuss
plan: 01
subsystem: autonomous-workflow
tags: [smart-discuss, workflow-engineering, grey-areas, context-gathering]

dependency_graph:
  requires: [autonomous.md, discuss-phase.md patterns]
  provides: [smart_discuss step, inline grey area proposal UX]
  affects: [autonomous workflow, CONTEXT.md generation]

tech_stack:
  added: []
  patterns: [table-based proposals, per-area batch acceptance, infrastructure detection]

key_files:
  modified:
    - get-shit-done/workflows/autonomous.md

decisions:
  - Smart discuss step uses 5 sub-steps inline (not separate steps) for cohesion
  - Sub-step headings use sentence case to match verification patterns
  - Infrastructure detection uses 3-criteria heuristic (keywords + technical criteria + no user-facing behavior)
  - CONTEXT.md template shown in markdown code block to prevent XML tag interpretation
  - 542 total lines (was 245, added 297 for smart discuss + modified 3a)

metrics:
  duration: 6min
  completed: 2025-03-10
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
---

# Phase 6 Plan 01: Smart Discuss Inline Logic Summary

Replaced Skill(gsd:discuss-phase) call in autonomous.md with inline smart discuss step that proposes grey area answers in batch tables and lets users accept or override per area, producing identical CONTEXT.md output.

## What Was Done

### Task 1: Add smart discuss steps to autonomous.md

Added `<step name="smart_discuss">` (lines 162-455) with 5 clearly labeled sub-steps:

1. **Load prior context** — Reads PROJECT.md, REQUIREMENTS.md, STATE.md, and all prior CONTEXT.md files to build internal prior_decisions context. Avoids re-asking decided questions.

2. **Scout codebase** — Checks .planning/codebase/*.md maps first, falls back to targeted grep. Builds internal codebase_context with reusable assets, patterns, integration points. Budget: ~5% context.

3. **Analyze phase and generate proposals** — Gets phase details via `roadmap get-phase`, determines domain type (SEE/CALL/RUN/READ/ORGANIZED), generates 3-4 grey areas with ~4 questions each. Pre-selects recommended answers based on prior decisions, codebase patterns, and domain conventions. **Includes infrastructure detection** — phases matching all 3 criteria (infrastructure keywords, technical-only success criteria, no user-facing behavior) skip directly to minimal CONTEXT.md.

4. **Present proposals per area** — Shows one grey area at a time as a table with columns: #, Question, ✅ Recommended, Alternative(s). Uses AskUserQuestion with dynamic options: "Accept all", "Change Q1"–"Change Q4", "Discuss deeper" (capped at 6). Handles change flow (re-display updated table), deeper discussion (4-question loops like discuss-phase), free text input, and scope creep (deferred ideas).

5. **Write CONTEXT.md** — Writes file using identical structure to discuss-phase output: domain, decisions, code_context, specifics, deferred XML-wrapped sections. Commits via gsd-tools.

### Task 2: Wire execute_phase step 3a to use smart discuss inline

- Replaced step 3a label from "Discuss" to "Smart Discuss"
- Removed `Skill(skill="gsd:discuss-phase")` call entirely
- Added `has_context` pre-check — if CONTEXT.md already exists, skip discuss
- After smart_discuss completes, verify context was written (handle_blocker if missing)
- Preserved steps 3b (plan) and 3c (execute) with their Skill() calls unchanged
- Updated success_criteria to mention "smart discuss" and added new criterion about table proposals

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Step count | 6 steps | 6 steps (initialize, discover_phases, execute_phase, smart_discuss, iterate, handle_blocker) | ✅ |
| Skill(discuss-phase) references | 0 | 0 | ✅ |
| Skill(plan/execute) preserved | 2 | 2 | ✅ |
| XML format sections | ≥5 | 12 | ✅ |
| File line count | ~400-500 | 542 | ✅ |
| smart_discuss step exists | 1 | 1 | ✅ |
| Prior context loading | present | present | ✅ |
| Codebase scout | present | present | ✅ |
| Infrastructure detection | present | present | ✅ |
| Accept/Change/Deeper UX | present | present | ✅ |

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| b16e13f | feat | Replace Skill(discuss-phase) with inline smart discuss — 302 insertions, 5 deletions |

## Self-Check: PASSED

All files exist, all commits verified.
