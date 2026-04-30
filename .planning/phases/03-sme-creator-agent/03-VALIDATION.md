---
phase: 3
slug: sme-creator-agent
status: audited
nyquist_compliant: false
wave_0_complete: true
created: 2026-04-29
last_audited: 2026-04-30
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | sdk/vitest.config.ts |
| **Quick run command** | `cd sdk && npx vitest run --project unit src/agents/sme-creator-structure.test.ts` |
| **Full suite command** | `cd sdk && npx vitest run --project unit --reporter=verbose` |
| **Eval suite** | `npx promptfoo eval --config evals/sme-creator.promptfooconfig.yaml` |
| **Estimated runtime** | ~2 seconds (vitest structural) |

---

## Sampling Rate

- **After every task commit:** Run `cd sdk && npx vitest run --project unit --reporter=verbose`
- **After every plan wave:** Run `cd sdk && npx vitest run --project unit --reporter=verbose`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | CREATE-01 | unit | `cd sdk && npx vitest run --project unit src/agents/sme-creator-structure.test.ts` | sdk/src/agents/sme-creator-structure.test.ts | ✅ green |
| 03-01-02 | 01 | 1 | CREATE-02 | unit | `cd sdk && npx vitest run --project unit src/agents/sme-creator-structure.test.ts` | sdk/src/agents/sme-creator-structure.test.ts | ✅ green |
| 03-02-01 | 02 | 2 | CREATE-03 | unit | `cd sdk && npx vitest run --project unit src/agents/sme-creator-structure.test.ts` | sdk/src/agents/sme-creator-structure.test.ts | ✅ green |
| 03-02-02 | 02 | 2 | CREATE-04 | manual | — | — | ⬜ manual |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Wave 0 validation complete. Structural tests verify agent definition files and eval config meet all Phase 3 requirements (CREATE-01 through CREATE-03). CREATE-04 (domain accuracy) requires live agent execution and remains manual.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| HSA engine domain risks identified | CREATE-04 | Domain accuracy requires subject matter expert review of generated findings against real codebase | Run gsd-sme-creator against HSA engine codebase, verify fraud logic, member-ID fragility, COVID-era logic flagged |

---

## Validation Audit 2026-04-30

| Metric | Count |
|--------|-------|
| Gaps found | 3 |
| Resolved | 3 |
| Escalated | 0 |

### Tests Added

| File | Tests | Covers |
|------|-------|--------|
| sdk/src/agents/sme-creator-structure.test.ts | 21 | CREATE-01 (6), CREATE-02 (4), CREATE-03 (11) |

### Gap Resolution Detail

| Requirement | Before | After | How |
|-------------|--------|-------|-----|
| CREATE-01 | PARTIAL | COVERED | 6 vitest assertions: role block, severity_examples, 6 H2 sections, SECTION_COUNT self-check, >= 6 threshold, INCOMPLETE marker |
| CREATE-02 | PARTIAL | COVERED | 4 vitest assertions: git log --follow count >= 3, present in analysis_checklist (MANDATORY), process block, critical_rules |
| CREATE-03 | MISSING | COVERED | 11 vitest assertions: Task in orchestrator tools, NOT in analyzer, subagent_type/name match, sequential fallback with condition, eval config valid with >= 10 tests |
| CREATE-04 | MISSING | MANUAL | Domain accuracy requires live agent execution + expert review |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Manual-Only justification
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (CREATE-04 justified as manual)
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** partial — 3/4 requirements automated, 1 manual-only (CREATE-04)
