---
phase: 5
slug: sme-auditor-agent
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-30
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | AUDIT-01 | — | N/A | structural | `npx vitest run` | ✅ | ✅ green |
| 5-01-02 | 01 | 1 | AUDIT-02 | — | N/A | structural | `npx vitest run` | ✅ | ✅ green |
| 5-01-03 | 01 | 1 | AUDIT-03 | — | N/A | structural | `npx vitest run` | ✅ | ✅ green |
| 5-01-04 | 01 | 1 | AUDIT-04 | — | N/A | structural | `npx vitest run` | ✅ | ✅ green |
| 5-01-05 | 01 | 1 | AUDIT-05 | — | N/A | structural | `npx vitest run` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `sdk/src/agents/sme-auditor-structure.test.ts` — structural validation tests for agent definition (16 tests, all GREEN)
- [x] Existing vitest infrastructure covers all phase requirements

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Adversarial stance produces accurate findings | AUDIT-01 | Requires LLM judgment evaluation | Run auditor against sample PLAN.md with known SME risks, verify findings match expected |
| Read-only mode prevents file modification | AUDIT-02 | Requires runtime agent tool restriction | Inspect agent YAML tools list, confirm Write/Edit excluded |

---

## Validation Audit 2026-04-30

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 5 requirements (AUDIT-01 through AUDIT-05) have automated structural tests in `sdk/src/agents/sme-auditor-structure.test.ts`. 16 tests pass GREEN.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s (207ms actual)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** complete
