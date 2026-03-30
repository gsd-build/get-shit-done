---
phase: 04-verification-gate-test-suite
plan: "02"
subsystem: workflows
tags: [verification, fix-loop, secret-scanning, workflow-authoring]
dependency_graph:
  requires: [gsd-doc-verifier agent (04-01), gsd-doc-writer fix_mode (04-01)]
  provides: [verification gate in docs-update workflow, fix_loop step, scan_for_secrets step]
  affects: [get-shit-done/workflows/docs-update.md]
tech_stack:
  added: []
  patterns: [GSD workflow step XML blocks, bounded fix loop with regression detection, grep-based secret scanning]
key_files:
  created: []
  modified:
    - get-shit-done/workflows/docs-update.md
decisions:
  - "verify_only_report positioned between fix_loop and scan_for_secrets in file for readability, but reached only via preservation_check early exit — normal flow is verify_docs -> fix_loop -> scan_for_secrets -> commit_docs -> report"
  - "scan_for_secrets uses exact grep pattern from map-codebase.md per D-08 (no deviations)"
  - "fix_loop re-verifies ALL docs after each iteration, not just the fixed ones — ensures no cross-doc regressions"
metrics:
  duration: "~2 minutes"
  completed: "2026-03-30T22:19:00Z"
  tasks_completed: 1
  files_changed: 1
---

# Phase 04 Plan 02: Verification Gate Workflow Steps Summary

**One-liner:** Extended docs-update workflow with verify_docs, fix_loop (bounded 2-iteration + regression detection), scan_for_secrets, and real gsd-doc-verifier invocation in verify_only_report.

## What Was Built

### Task 1: verify_docs, fix_loop, scan_for_secrets steps + updated verify_only_report

Added three new steps and updated one existing step in `get-shit-done/workflows/docs-update.md`.

**verify_docs step (new):**
- Spawns `gsd-doc-verifier` agent per generated doc with a `<verify_assignment>` block (doc_path + project_root)
- Reads structured JSON result from `.planning/tmp/verify-{doc_filename}.json` per D-01
- Collects all results into `verification_results` array
- Presents verification summary table (Doc, Claims, Passed, Failed)
- Routes: if all pass → skip fix_loop → scan_for_secrets; if any fail → fix_loop

**fix_loop step (new):**
- Bounded at `MAX_FIX_ITERATIONS = 2` per D-06
- Tracks `previous_passed_docs` for regression detection per D-05
- Spawns `gsd-doc-writer` with `mode: fix` and failures array for each failing doc (one spawn per doc per D-04)
- Re-verifies ALL docs after each iteration (not just fixed ones)
- Regression detection: if a previously-passing doc now fails → HALT immediately with regression report
- After loop exhaustion: reports remaining failures as requiring manual correction
- Continues to scan_for_secrets in all exit paths

**scan_for_secrets step (new):**
- Runs once after fix_loop, before commit_docs per D-07
- Uses exact grep pattern from map-codebase.md per D-08: sk-, sk_live_, ghp_, gho_, glpat-, AKIA, xox[baprs]-, `-----BEGIN.*PRIVATE KEY`, JWT patterns
- Builds file list dynamically from the generation queue (not hardcoded)
- If secrets found: presents SECURITY ALERT with grep output, waits for "safe to proceed" or "abort"
- If no secrets: continues to commit_docs

**verify_only_report step (updated from stub):**
- Now invokes `gsd-doc-verifier` for each file in `existing_docs` (real filesystem verification)
- Also counts VERIFY markers as before
- Presents combined table: Claims Checked, Passed, Failed, VERIFY Markers
- Shows failed claim details with file:line references
- Cleans up `.planning/tmp/verify-*.json` temp files
- Removed the Phase 4 stub text ("Full codebase fact-checking requires the gsd-doc-verifier agent (Phase 4)")

**Step ordering in final file:**
`sequential_generation` → `verify_docs` → `fix_loop` → `verify_only_report` → `scan_for_secrets` → `commit_docs` → `report`

(verify_only_report is an early-exit step positioned there for readability; normal flow bypasses it)

**success_criteria updated** with 4 new items for verification gate.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 240e031 | feat(04-02): add verify_docs, fix_loop, scan_for_secrets steps to docs-update workflow |

## Decisions Made

1. **verify_only_report file position:** Placed between fix_loop and scan_for_secrets for readability (mirrors historical position). The step is only reached via the early-exit path in preservation_check when --verify-only flag is present. Normal generation flow skips it entirely.

2. **fix_loop re-verifies all docs:** After each fix iteration, ALL docs are re-verified (not just the ones that received fixes). This ensures a fix to one doc doesn't accidentally break claims that reference a shared file or structure verified by another doc.

3. **scan_for_secrets exact grep pattern from map-codebase:** Per D-08, copied the exact grep regex from map-codebase.md without modification. Ensures consistent secret detection behavior across the two workflows.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all three new steps are fully specified with complete logic, including all exit conditions, error handling, and user interaction patterns. The verify_only_report stub ("Phase 4" placeholder text) has been replaced with the real verifier invocation.

## Self-Check

### Files Modified

- `get-shit-done/workflows/docs-update.md` — FOUND (178 lines added, 18 removed)

### Commits

- 240e031 — FOUND (feat(04-02): add verify_docs, fix_loop, scan_for_secrets steps...)

### Acceptance Criteria

- `grep 'step name="verify_docs"' get-shit-done/workflows/docs-update.md` matches exactly once — PASS (count: 1)
- `grep 'step name="fix_loop"' get-shit-done/workflows/docs-update.md` matches exactly once — PASS (count: 1)
- `grep 'step name="scan_for_secrets"' get-shit-done/workflows/docs-update.md` matches exactly once — PASS (count: 1)
- `grep 'MAX_FIX_ITERATIONS' get-shit-done/workflows/docs-update.md` matches — PASS (count: 4)
- `grep 'REGRESSION' get-shit-done/workflows/docs-update.md` matches — PASS (count: 2)
- `grep 'gsd-doc-verifier' get-shit-done/workflows/docs-update.md` matches in both verify_docs and verify_only_report — PASS (count: 4)
- `grep 'mode: fix' get-shit-done/workflows/docs-update.md` matches in fix_loop step — PASS (count: 1)
- `grep 'sk-' get-shit-done/workflows/docs-update.md` matches — PASS (count: 1)
- `grep 'PRIVATE KEY' get-shit-done/workflows/docs-update.md` matches — PASS (count: 1)
- verify_only_report no longer contains stub text — PASS (count: 0)
- Steps in correct order: verify_docs (643), fix_loop (680), verify_only_report (747), scan_for_secrets (797), commit_docs (836) — PASS

## Self-Check: PASSED
