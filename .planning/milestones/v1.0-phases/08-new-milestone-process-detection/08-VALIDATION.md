---
phase: 8
slug: new-milestone-process-detection
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-30
validated: 2026-04-30
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (CJS) |
| **Config file** | none — uses node built-in test runner |
| **Quick run command** | `node --test tests/sme-new-milestone-detect.test.cjs` |
| **Full suite command** | `node --test tests/sme-*.test.cjs` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/sme-new-milestone-detect.test.cjs`
- **After every plan wave:** Run `node --test tests/sme-*.test.cjs`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 0 | DETECT-01, DETECT-02, DETECT-03, DETECT-04, DETECT-05 | T-08-01 | Process name regex validation | structural | `node --test tests/sme-new-milestone-detect.test.cjs` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/sme-new-milestone-detect.test.cjs` — structural tests for SME detection step file, workflow dispatch, and STATE.md active_smes queuing (10/10 pass)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Interactive process selection prompts | DETECT-03, DETECT-04 | AskUserQuestion requires live user interaction | Run `/gsd-new-milestone` and verify process selection prompts appear |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** complete

## Validation Audit 2026-04-30

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 10 structural tests pass (DETECT-01 through DETECT-05 + ordering constraint). No gaps detected — phase was already fully covered by automated tests from TDD execution.
