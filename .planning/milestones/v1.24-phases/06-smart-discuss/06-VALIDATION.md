---
phase: 6
slug: smart-discuss
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-10
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Structural grep validation (no unit tests — this is markdown workflow engineering) |
| **Config file** | N/A |
| **Quick run command** | `grep 'step name=' get-shit-done/workflows/autonomous.md` |
| **Full suite command** | `npm test` (existing suite — confirms no regressions in roadmap/install tests) |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run structural grep checks from task `<verify>` blocks
- **After plan completion:** Run `npm test` for full regression suite (645+ tests)
- **Before `/gsd-verify-work`:** Manual execution of `gsd:autonomous --from N` on a test phase
- **Max feedback latency:** 5 seconds for grep checks, 10 seconds for full suite

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | DISC-01, DISC-02, DISC-03, DISC-04 | structural | `grep -c 'step name="smart_discuss"' + section checks` | N/A (inline) | ⬜ pending |
| 06-01-02 | 01 | 1 | DISC-01 | structural | `! grep 'gsd:discuss-phase' + has_context check pattern` | N/A (inline) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No Wave 0 test creation needed. Justification:

- **DISC-01 through DISC-03** are workflow UX behaviors — they describe how an AI agent presents tables and handles user choices within a markdown workflow file. These cannot be unit-tested; they are verified by structural grep (step exists, sections present) and manual execution.
- **DISC-04** (CONTEXT.md format) is verified structurally by checking that the write_smart_context sub-step contains all 5 required XML section tags (`<domain>`, `<decisions>`, `<code_context>`, `<specifics>`, `<deferred>`).
- **Existing test suite** (`npm test`, 645+ tests) catches regressions in roadmap parsing and installer behavior — no new test files needed for workflow markdown changes.

---

## Manual-Only Verifications

| Requirement | What to Verify | How |
|-------------|---------------|-----|
| DISC-01 | Grey areas presented one at a time with table proposals | Run `gsd:autonomous` on a test phase, observe output |
| DISC-02 | Table shows ✅ Recommended column with rationale and alternatives | Visual inspection during autonomous execution |
| DISC-03 | "Accept all" / "Change QN" / "Discuss deeper" options work | Interactive test — try each option path |
| DISC-04 | Output CONTEXT.md has same sections as regular discuss-phase | `diff` structure of autonomous-produced CONTEXT.md vs discuss-phase-produced CONTEXT.md |

**Justification:** Markdown workflow files are interpreted by the AI agent at runtime. The "test" is executing the workflow and observing behavior. Structural grep validates the instruction content exists; manual execution validates the AI agent follows the instructions correctly.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands (structural grep)
- [x] Sampling continuity: both tasks have automated verify (no gaps)
- [x] Wave 0 not needed — no test file dependencies
- [x] No watch-mode flags
- [x] Feedback latency < 5s (grep is instant)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
