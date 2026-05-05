---
phase: 05-sme-auditor-agent
reviewed: 2026-04-30T13:31:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - agents/gsd-sme-auditor.md
  - get-shit-done/references/agent-contracts.md
  - sdk/src/agents/sme-auditor-structure.test.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-04-30T13:31:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed the SME auditor agent definition, its registration in agent-contracts.md, and the structural validation test suite. The agent definition is well-structured with a clear adversarial stance, proper severity classification, and consistent use of project conventions (tooling, `@~/` path prefix, YAML frontmatter). All 16 structural tests pass.

Two warnings were found: a discrepancy between the agent-contracts.md condition description and the agent's actual trigger logic for SME_CONCERNS, and a missing validation step for finding count reconciliation. Two informational items note test assertion looseness and a minor missing cross-reference in the agent definition.

No critical security or correctness issues were found.

## Warnings

### WR-01: Imprecise SME_CONCERNS condition in agent-contracts.md

**File:** `get-shit-done/references/agent-contracts.md:71`
**Issue:** The SME Auditor Output Contract table says `## SME_CONCERNS` is returned when there are "One or more unaddressed findings." However, the agent definition (`agents/gsd-sme-auditor.md:143-148`) specifies that SME_CONCERNS is only returned when there are one or more unaddressed **BLOCKERs** (N_B >= 1). Unaddressed WARNINGs and WATCHes alone trigger SME_APPROVED (with the warnings listed in the tally). This discrepancy could cause a workflow author to expect SME_CONCERNS when only WARNINGs are unaddressed, but the agent would actually return SME_APPROVED.
**Fix:** Update the Condition column for `## SME_CONCERNS` to match the agent's actual logic:
```markdown
| `## SME_CONCERNS` | One or more unaddressed BLOCKERs | Gate routes per block_mode (soft: warn + proceed, strict: halt until acknowledged) |
```

### WR-02: No finding count reconciliation in load_context step

**File:** `agents/gsd-sme-auditor.md:109-115`
**Issue:** The `sme_context` block includes a `finding_counts` YAML frontmatter section (blocker: N, warning: N, watch: N) that declares how many findings of each severity are expected. However, the `load_context` step instructs the agent to parse findings from the five sections but never instructs it to validate that the number of parsed findings matches the declared `finding_counts`. If the SME document has a stale or incorrect `finding_counts` header, or if the agent fails to parse some findings, the discrepancy would go undetected. This could lead to silently dropped findings.
**Fix:** Add a reconciliation instruction at the end of the `load_context` step:
```markdown
After parsing all findings, verify the parsed count matches the declared
`finding_counts` from the SME frontmatter. If counts diverge, halt and report
the discrepancy — a mismatch means findings were either not parsed or the
SME document metadata is stale.
```

## Info

### IN-01: Test regex for AUDIT-04 is loosely scoped

**File:** `sdk/src/agents/sme-auditor-structure.test.ts:113-114`
**Issue:** The test for "requires file paths in BLOCKER evidence" uses the regex `/file path|function call/i`, which matches if either phrase appears anywhere in the entire agent document. Since these phrases appear many times throughout the file (in examples, rules, and structured returns), this test would pass even if the BLOCKER evidence section were removed, as long as the phrases exist elsewhere. The test validates document content but not structural placement.
**Fix:** Consider scoping the assertion to the `<adversarial_stance>` or `<cross_reference>` block content specifically:
```typescript
const crossRefSection = auditor.match(/<step name="cross_reference">([\s\S]*?)<\/step>/);
expect(crossRefSection).not.toBeNull();
expect(crossRefSection![1]).toMatch(/file path/i);
```
Note: This is informational only -- the current test still provides value as a structural guard against wholesale removal of the concept.

### IN-02: Five SME sections listed but not individually validated in tests

**File:** `sdk/src/agents/sme-auditor-structure.test.ts:1-137`
**Issue:** The agent definition references five SME document sections that must be parsed: Identified Risks, Test Gaps, Outdated Logic, Edge Cases, and Known Blockers (line 109 of agent definition). The test suite does not validate that all five section names appear in the agent definition. If a section name were accidentally removed during editing, existing tests would not catch it.
**Fix:** Add a test case to AUDIT-01 or a new AUDIT-06 group:
```typescript
it('references all five SME document sections', () => {
  for (const section of ['Identified Risks', 'Test Gaps', 'Outdated Logic', 'Edge Cases', 'Known Blockers']) {
    expect(auditor).toContain(section);
  }
});
```

---

_Reviewed: 2026-04-30T13:31:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
