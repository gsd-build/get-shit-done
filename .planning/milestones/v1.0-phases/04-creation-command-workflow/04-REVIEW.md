---
phase: 04-creation-command-workflow
reviewed: 2026-05-01T17:30:29Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - commands/gsd/create-sme.md
  - get-shit-done/templates/sme.md
  - get-shit-done/workflows/create-sme.md
  - sdk/src/agents/create-sme-workflow-structure.test.ts
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-05-01T17:30:29Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the create-sme command definition, SME template, orchestration workflow, and the structural validation test suite. The four files form a cohesive command-workflow-template-test chain. Input validation is solid -- the process name regex (`^[a-zA-Z0-9_-]+$`) on workflow line 64 prevents path traversal and injection before any filesystem access. The fuzzy overlap detection (bidirectional case-insensitive substring matching) is correctly implemented. The template frontmatter includes all required fields including `related_smes`. All 24 structural tests pass.

One warning-level logic bug persists in the commit step, and three informational items relate to maintainability and defensive coding.

## Warnings

### WR-01: Commit message ignores UPDATE_MODE

**File:** `get-shit-done/workflows/create-sme.md:221`
**Issue:** The `commit_and_complete` step always uses the commit message `"feat: create ${PROCESS_NAME} SME document"` regardless of whether the workflow is in update mode (`UPDATE_MODE=true`). When a user chooses "Update existing" (line 120 or line 157), the resulting git commit message will say "create" when it should say "update," producing misleading git history.
**Fix:**
```bash
if [ "$UPDATE_MODE" = "true" ]; then
  COMMIT_VERB="update"
else
  COMMIT_VERB="create"
fi
gsd-sdk query commit "feat: ${COMMIT_VERB} ${PROCESS_NAME} SME document" --files ".planning/smes/${PROCESS_NAME}-SME.md"
```

## Info

### IN-01: Numeric step references are fragile

**File:** `get-shit-done/workflows/create-sme.md:31,164,209`
**Issue:** Three places reference steps by number ("Skip to step 3", "continue to step 5", "Continue to step 7") while steps are defined with `<step name="...">` attributes. If steps are reordered or inserted, numeric references silently become incorrect. The numbers are currently accurate (step 3 = `validate_process_name`, step 5 = `spawn_creator`, step 7 = `commit_and_complete`) but rely on manual counting.
**Fix:** Replace numeric references with step names:
- Line 31: "Skip to step 3 (validation)" -> "Skip to `validate_process_name`"
- Line 164: "continue to step 5" -> "continue to `spawn_creator`"
- Line 209: "Continue to step 7 (commit_and_complete)" -> "Continue to `commit_and_complete`"

### IN-02: Unused helper function in test file

**File:** `sdk/src/agents/create-sme-workflow-structure.test.ts:32-39`
**Issue:** The `countOccurrences` helper function is defined but never called anywhere in the test file. This is dead code that adds minor maintenance burden.
**Fix:** Remove lines 32-39:
```typescript
// Delete:
function countOccurrences(content: string, needle: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = content.indexOf(needle, pos)) !== -1) {
    count++;
    pos += needle.length;
  }
  return count;
}
```

### IN-03: Multi-overlap update path underspecified

**File:** `get-shit-done/workflows/create-sme.md:159`
**Issue:** When the "Update existing" option is chosen in Case B with multiple fuzzy overlaps, the workflow says "ask user which one to update (numbered list)" but provides no `AskUserQuestion` template or text-mode fallback pattern, unlike every other user interaction in the workflow. The executing agent must infer the interaction format, which may lead to inconsistent behavior across runtimes.
**Fix:** Add an explicit interaction specification, e.g.:
```markdown
- If multiple overlaps: present numbered list via AskUserQuestion:
  ```
  AskUserQuestion(
    header: "Select SME to Update",
    question: "Multiple overlapping SMEs found. Which one would you like to update?",
    options:
      {for each overlap: "- {overlap_name}"}
      - "Cancel"
  )
  ```
```

---

_Reviewed: 2026-05-01T17:30:29Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
