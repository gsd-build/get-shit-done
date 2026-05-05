---
phase: 07-discuss-phase-integration
reviewed: 2026-04-30T12:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - tests/sme-discuss-phase.test.cjs
  - get-shit-done/workflows/discuss-phase/sme-step.md
  - get-shit-done/workflows/discuss-phase/templates/context.md
  - get-shit-done/workflows/discuss-phase.md
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-04-30T12:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the SME discuss-phase integration: the sme-step.md workflow step, its test file, the context template update, and the parent discuss-phase.md dispatch point. The integration is structurally sound -- tests validate static markers correctly, the template includes the conditional `<sme_context>` block, and the dispatch ordering is correct. Two warnings relate to shell scripting robustness in sme-step.md (unquoted variable in for-loop and missing separator in string concatenation). Two informational items note implicit variable dependencies and a structural inconsistency in the workflow dispatch.

## Warnings

### WR-01: Unquoted variable in for-loop risks word splitting

**File:** `get-shit-done/workflows/discuss-phase/sme-step.md:42`
**Issue:** `for PROCESS_NAME in $ACTIVE_SMES` uses an unquoted variable. If `ACTIVE_SMES` contains process names with spaces or glob characters (e.g., `my-process *`), word splitting and pathname expansion will produce incorrect iterations. While process names are likely identifiers, this is a robustness gap.
**Fix:**
```bash
# Use a while-read loop to handle names safely
echo "$ACTIVE_SMES" | while IFS= read -r PROCESS_NAME; do
  [ -z "$PROCESS_NAME" ] && continue
  CTX=$(gsd-sdk query sme.context-block "${PROCESS_NAME}" 2>/dev/null || echo '{"data":{"found":false}}')
  # ... rest of loop body
done
```

### WR-02: SME context blocks concatenated without separator

**File:** `get-shit-done/workflows/discuss-phase/sme-step.md:47`
**Issue:** `SME_CONTEXT_BLOCKS="${SME_CONTEXT_BLOCKS}${BLOCK}"` concatenates multiple SME context blocks with no newline or delimiter between them. When multiple SMEs are active, the auditor receives a wall of text where one block's last line runs directly into the next block's first line, making it harder to parse distinct SME contexts.
**Fix:**
```bash
SME_CONTEXT_BLOCKS="${SME_CONTEXT_BLOCKS}
${BLOCK}"
```
Or more explicitly:
```bash
SME_CONTEXT_BLOCKS="${SME_CONTEXT_BLOCKS}\n---\n${BLOCK}"
```

## Info

### IN-01: Implicit variable dependency on parent workflow context

**File:** `get-shit-done/workflows/discuss-phase/sme-step.md:62-75`
**Issue:** Step 4 references `${PHASE_GOAL}` and `${PHASE}` which are never defined within sme-step.md. These are inherited from the parent discuss-phase.md runtime context. The file's header documents the lazy-load gating conditions but does not document which variables must be in scope when this file is executed.
**Fix:** Add a brief "Expected context variables" note to the header block:
```markdown
> **Required context from parent:** `PHASE` (phase number), `PHASE_GOAL` (goal text from ROADMAP.md).
```

### IN-02: SME dispatch instruction sits outside step tags

**File:** `get-shit-done/workflows/discuss-phase.md:280`
**Issue:** The SME dispatch (`If use_sme_agents is true: Read workflows/discuss-phase/sme-step.md...`) is a free-floating instruction between the `</step>` closing `cross_reference_todos` (line 278) and `<step name="scout_codebase">` (line 282). All other workflow logic lives inside `<step>` elements. This is intentional (lazy-load dispatch, not a proper step), but the structural inconsistency could confuse agent parsers that expect all executable instructions to reside within step boundaries.
**Fix:** Consider wrapping in a minimal step tag for structural consistency:
```xml
<step name="sme_check" priority="conditional">
If `use_sme_agents` is true: Read `workflows/discuss-phase/sme-step.md` and execute its steps. Otherwise skip.
</step>
```

---

_Reviewed: 2026-04-30T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
