---
phase: 5
slug: skill-scaffolding-phase-discovery
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js `node:test` (built-in, no installation needed) |
| **Config file** | none — `node:test` requires no config |
| **Quick run command** | `node --test tests/roadmap.test.cjs` |
| **Full suite command** | `node --test tests/roadmap.test.cjs tests/copilot-install.test.cjs` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/roadmap.test.cjs`
- **After every plan wave:** Run `node --test tests/roadmap.test.cjs tests/copilot-install.test.cjs`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | ORCH-03 | unit (TDD) | `node --test tests/roadmap.test.cjs` | ✅ (extend) | ⬜ pending |
| 05-01-02 | 01 | 1 | ART-01, ART-03 | inline | `node -e "..."` frontmatter check | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 1 | ART-02 | inline | `node -e "..."` structure check | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 1 | ART-03 | unit (TDD) | `node --test tests/copilot-install.test.cjs` | ✅ (extend) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements:

- [x] `tests/roadmap.test.cjs` — exists; Task 05-01-01 extends it (TDD: RED→GREEN for regex fix)
- [x] `tests/copilot-install.test.cjs` — exists; Task 05-02-02 extends it (TDD: RED→GREEN for skill generation)
- [x] No framework install needed — `node:test` is built-in

Tasks 05-01-02 and 05-02-01 use inline `node -e` verification commands embedded in the plan (frontmatter field checks, workflow section checks). These run as part of the task commit and don't require pre-existing test files.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
