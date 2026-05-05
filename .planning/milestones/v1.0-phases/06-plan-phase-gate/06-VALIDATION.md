---
phase: 6
slug: plan-phase-gate
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (CJS structural tests) + vitest (SDK unit tests) |
| **Config file** | `vitest.config.ts` (vitest), none for node:test |
| **Quick run command** | `node --test tests/sme-gate-plan-phase.test.cjs` |
| **Full suite command** | `node --test tests/sme-*.test.cjs && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/sme-gate-plan-phase.test.cjs`
- **After every plan wave:** Run `node --test tests/sme-*.test.cjs && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | GATE-01 | — | N/A | structural | `node --test tests/sme-gate-plan-phase.test.cjs` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | GATE-01..08, CONFIG-04 | — | N/A | structural | `node --test tests/sme-gate-plan-phase.test.cjs` | ✅ (created by Task 1) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/sme-gate-plan-phase.test.cjs` — structural tests for SME gate in plan-phase.md
- [ ] Verify existing test infrastructure covers SDK handler integration

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Soft mode surfaces warnings without blocking | GATE-03 | Requires live plan-phase run with SME docs | Run `/gsd-plan-phase` with `use_sme_agents: true` and `block_mode: soft` |
| Strict mode blocks on BLOCKER findings | GATE-04 | Requires live plan-phase run with BLOCKER findings | Run `/gsd-plan-phase` with `block_mode: strict` and a plan triggering a BLOCKER |
| `--acknowledge-sme-risk` flag overrides strict | GATE-05 | Requires live plan-phase run with flag | Run `/gsd-plan-phase --acknowledge-sme-risk` after BLOCKER |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
