---
phase: 4
slug: creation-command-workflow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | sdk/vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | CMD-01 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 4-01-02 | 01 | 1 | CMD-02 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 4-01-03 | 01 | 1 | CMD-03 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 4-01-04 | 01 | 1 | CMD-04 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `sdk/src/agents/create-sme-workflow-structure.test.ts` — structural validation stubs for CMD-01 through CMD-04

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Interactive process menu renders correctly | CMD-02 | AskUserQuestion TUI rendering | Run `/gsd-create-sme` with no args, verify menu appears |
| Progress indicators display during creation | CMD-04 | Visual output verification | Run `/gsd-create-sme contribution`, verify banners appear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
