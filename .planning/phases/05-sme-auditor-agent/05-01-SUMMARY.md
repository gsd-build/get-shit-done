---
phase: 05-sme-auditor-agent
plan: "01"
subsystem: agent-definitions
tags: [sme, auditor, adversarial, read-only, structural-tests, tdd]
dependency-graph:
  requires: []
  provides: [gsd-sme-auditor-agent, sme-auditor-contracts]
  affects: [get-shit-done/references/agent-contracts.md]
tech-stack:
  added: []
  patterns: [adversarial-stance, force-stance, structured-return-markers, severity-calibration-examples]
key-files:
  created:
    - agents/gsd-sme-auditor.md
    - sdk/src/agents/sme-auditor-structure.test.ts
  modified:
    - get-shit-done/references/agent-contracts.md
decisions:
  - "Agent tools restricted to Read, Bash, Glob, Grep — no Write/Edit — enforcing AUDIT-02 at SDK level"
  - "Severity must be inherited from SME document, never re-assessed — prevents BLOCKER inflation"
  - "ADDRESSED defined as requiring both specific file path AND function call from Evidence field"
  - "block_mode is gate logic, not auditor logic — agent reports all findings regardless of block_mode"
  - "SME_APPROVED requires zero unaddressed BLOCKERs; WARNINGs/WATCHes reported in both outcomes"
metrics:
  duration: "4 minutes"
  completed: "2026-04-30T18:24:15Z"
  tasks-completed: 2
  files-created: 2
  files-modified: 1
requirements-completed: [AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04, AUDIT-05]
---

# Phase 05 Plan 01: SME Auditor Agent Definition Summary

**One-liner:** Adversarial read-only SME auditor agent with FORCE stance, severity calibration examples, and structured `## SME_APPROVED` / `## SME_CONCERNS` return markers — all AUDIT-01 through AUDIT-05 requirements validated by 16 passing structural tests.

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Structural validation tests | 0812e8e2 | sdk/src/agents/sme-auditor-structure.test.ts |
| 2 (GREEN) | Agent definition + contracts update | e3723585 | agents/gsd-sme-auditor.md, get-shit-done/references/agent-contracts.md |

## TDD Gate Compliance

- **RED commit** (`0812e8e2`): `test(05-01): add structural validation tests for sme-auditor agent (RED)` — 16 tests failing because target files did not exist
- **GREEN commit** (`e3723585`): `feat(05-01): create gsd-sme-auditor agent and register markers in agent-contracts` — all 16 tests passing

Gate sequence is correct: RED gate then GREEN gate, in order.

## What Was Built

### agents/gsd-sme-auditor.md (235 lines)

A read-only adversarial auditor agent with these sections in order:

1. **YAML frontmatter** — `tools: Read, Bash, Glob, Grep` (no Write, no Edit, no Task)
2. **`<role>`** — identity, adversarial mindset statement ("domain risks ARE present"), read-only mode declaration
3. **`<adversarial_stance>`** — FORCE stance, 5 common soft failure modes, BLOCKER/WARNING/WATCH classification rules
4. **`<severity_examples>`** — 3 inline few-shot calibration examples: BLOCKER ADDRESSED, BLOCKER UNADDRESSED, WARNING PARTIALLY ADDRESSED
5. **`<execution_flow>`** — 3 steps: `load_context` (parse SME findings from all 5 sections), `cross_reference` (match against plan tasks using file path + function call), `determine_outcome` (route to SME_APPROVED or SME_CONCERNS)
6. **`<critical_rules>`** — 5 rules: INHERIT SEVERITY FROM SME, ADDRESSED REQUIRES FILE PATH + FUNCTION, REPORT ALL FINDINGS, READ-ONLY, BLOCK_MODE DOES NOT CHANGE YOUR OUTPUT
7. **`<structured_returns>`** — complete format examples for both `## SME_APPROVED` and `## SME_CONCERNS`

### sdk/src/agents/sme-auditor-structure.test.ts (136 lines)

16 structural tests across 5 describe blocks (AUDIT-01 through AUDIT-05), following the sme-creator-structure.test.ts pattern exactly. Uses top-level `beforeAll` to load both agent file and contracts file once.

### get-shit-done/references/agent-contracts.md (updated)

Three additions:
- Registry table row: `| gsd-sme-auditor | SME domain audit | \`## SME_APPROVED\`, \`## SME_CONCERNS\` |`
- New "SME Auditor Output Contract" subsection in Key Handoff Contracts
- `## SME_APPROVED` / `## SME_CONCERNS` entry in plan-phase.md Workflow Regex Patterns

## Verification Results

```
cd sdk && npx vitest run --project unit src/agents/sme-auditor-structure.test.ts

Tests  16 passed (16)
```

Full unit suite: 1398 passed, 5 pre-existing failures in unrelated files (`state-mutation.test.ts` bug-2420, `decomposed-handlers.test.ts`, `registry.test.ts`). None of the failures are in files modified by this plan.

## Deviations from Plan

None — plan executed exactly as written.

The pre-existing 5 failing tests in the full unit suite are out-of-scope (they cover `stateBeginPhase` flag parsing and query registry dispatch, in files not modified by this plan). Logged here for transparency — these were failing before this plan's changes.

## Known Stubs

None. The agent definition is complete with all required sections. No placeholder data flows to any UI or downstream consumer.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Agent definition is a read-only markdown file consumed by the Claude agent SDK at invocation time. The threat model entries T-05-01 through T-05-04 in the PLAN.md cover the relevant surface; no new surface was added during implementation.

## Self-Check: PASSED

**Files exist:**
- [x] `agents/gsd-sme-auditor.md` — FOUND
- [x] `sdk/src/agents/sme-auditor-structure.test.ts` — FOUND
- [x] `get-shit-done/references/agent-contracts.md` — FOUND (modified)

**Commits exist:**
- [x] `0812e8e2` — FOUND (RED: test commit)
- [x] `e3723585` — FOUND (GREEN: feat commit)

**All 16 structural tests pass GREEN:** CONFIRMED

**TDD gate sequence (RED then GREEN):** CONFIRMED
