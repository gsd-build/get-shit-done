---
phase: 10
slug: fix-new-milestone-sme-creator-integration
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-04
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (CJS)** | Node.js built-in test runner (`node:test`) |
| **Framework (TS)** | Vitest 3.2.4 |
| **Config file (Vitest)** | `sdk/vitest.config.ts` |
| **Quick run command (CJS)** | `node --test tests/sme-new-milestone-detect.test.cjs` |
| **Quick run command (Vitest)** | `cd sdk && npx vitest run src/agents/sme-creator-structure.test.ts` |
| **Full suite command** | `node --test tests/sme-new-milestone-detect.test.cjs && cd sdk && npx vitest run src/agents/sme-creator-structure.test.ts` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/sme-new-milestone-detect.test.cjs && cd sdk && npx vitest run src/agents/sme-creator-structure.test.ts`
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | DETECT-04 | — | N/A | structural | `node --test tests/sme-new-milestone-detect.test.cjs` | Exists (Wave 0: add new assertions) | pending |
| 10-01-02 | 01 | 1 | DETECT-05 | — | N/A | structural | `node --test tests/sme-new-milestone-detect.test.cjs` | Exists (Wave 0: add new assertions) | pending |
| 10-01-03 | 01 | 1 | CONFIG-03 | — | N/A | structural | `cd sdk && npx vitest run src/agents/sme-creator-structure.test.ts` | Exists (Wave 0: add new assertions) | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] Structural tests for placeholder resolution (DETECT-04) — `tests/sme-new-milestone-detect.test.cjs`
- [ ] Structural tests for completion marker check (DETECT-05) — `tests/sme-new-milestone-detect.test.cjs`
- [ ] Structural tests for sme.blocking config consumption (CONFIG-03) — `sdk/src/agents/sme-creator-structure.test.ts`

*Existing infrastructure covers test framework — only test assertions needed.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
