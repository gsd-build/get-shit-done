---
phase: 2
slug: sdk-query-handlers
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-29
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | sdk/vitest.config.ts |
| **Quick run command** | `npx vitest run sdk/src/query/sme.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run sdk/src/query/sme.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | SDK-01 | — | N/A | unit | `npx vitest run sdk/src/query/sme.test.ts -t "sme.list"` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | SDK-02 | — | N/A | unit | `npx vitest run sdk/src/query/sme.test.ts -t "sme.detect-processes"` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | SDK-03 | — | N/A | unit | `npx vitest run sdk/src/query/sme.test.ts -t "sme.context-block"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `sdk/src/query/sme.test.ts` — stubs for SDK-01, SDK-02, SDK-03
- [ ] Test fixtures for `.planning/smes/` directory with sample SME documents

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
