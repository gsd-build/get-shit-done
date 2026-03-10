---
phase: 7
slug: phase-execution-chain
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-10
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Structural grep validation (no unit tests — this is markdown workflow engineering) |
| **Config file** | N/A |
| **Quick run command** | `grep -n 'Post-Execution Routing\|--no-transition\|VERIFY_STATUS\|gaps_found\|human_needed' get-shit-done/workflows/autonomous.md` |
| **Full suite command** | `npm test` (existing suite — confirms no regressions in roadmap/install tests) |
| **Estimated runtime** | ~3 seconds for grep, ~10 seconds for npm test |

---

## Sampling Rate

- **After every task commit:** Run structural grep checks from task `<verify>` blocks
- **After plan completion:** Run `npm test` for full regression suite (645+ tests)
- **Before `/gsd-verify-work`:** Manual execution of `gsd:autonomous --from N` on a test phase to observe routing behavior
- **Max feedback latency:** 5 seconds for grep checks, 10 seconds for full suite

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | EXEC-02, EXEC-03, EXEC-04 | structural | `grep --no-transition + VERIFY_STATUS + gaps_found + human_needed checks` | N/A (inline) | ⬜ pending |
| 07-01-02 | 01 | 1 | EXEC-01, EXEC-02, EXEC-03, EXEC-04 | structural | `step count + balance + sub-step order + npm test` | N/A (inline) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No Wave 0 test creation needed. Justification:

- **EXEC-01 through EXEC-04** are workflow orchestration behaviors — they describe how an AI agent chains Skill() calls and routes on verification results within a markdown workflow file. These cannot be unit-tested; they are verified by structural grep (flags present, routing logic sections exist) and manual execution.
- **Existing test suite** (`npm test`, 645+ tests) catches regressions in roadmap parsing and installer behavior — no new test files needed for workflow markdown changes.
- The `--no-transition` flag is already implemented and tested in execute-phase.md; this plan only adds it to the autonomous.md Skill() call.

---

## Manual-Only Verifications

| Requirement | What to Verify | How |
|-------------|---------------|-----|
| EXEC-01 | Plan-phase auto-invoked after discuss completes | Run `gsd:autonomous` on a test phase, observe plan-phase is called automatically |
| EXEC-02 | Execute-phase auto-invoked with --no-transition after plan completes | Observe execute-phase Skill() call in autonomous flow, verify it returns instead of chaining |
| EXEC-03 | Post-execution routing works for all 3 outcomes | Test each path: force a passed/human_needed/gaps_found VERIFICATION.md and observe routing |
| EXEC-04 | Plan-phase interactions (research, approval) surface to user | Run autonomous on a phase that triggers plan-phase questions, verify they appear inline |

**Justification:** Markdown workflow files are interpreted by the AI agent at runtime. The "test" is executing the workflow and observing behavior. Structural grep validates the instruction content exists; manual execution validates the AI agent follows the instructions correctly.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands (structural grep + npm test)
- [x] Sampling continuity: both tasks have automated verify (no gaps)
- [x] Wave 0 not needed — no test file dependencies
- [x] No watch-mode flags
- [x] Feedback latency < 5s (grep is instant)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
