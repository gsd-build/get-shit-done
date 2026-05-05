---
phase: 09-post-execution-refresh
reviewed: 2026-05-01T10:15:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - tests/sme-post-execution-refresh.test.cjs
  - get-shit-done/workflows/execute-phase.md
  - get-shit-done/workflows/plan-phase.md
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 09: Code Review Report

**Reviewed:** 2026-05-01T10:15:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed the new SME post-execution refresh feature across a test file and two workflow specifications. The test file (`sme-post-execution-refresh.test.cjs`) is well-structured and validates structural markers correctly using Node.js built-in test runner. The workflow files contain the implementation specifications being tested.

Two warnings were identified: a bug in the `sme_refresh` step where the commit command only references the last process name instead of all refreshed SME files, and a fragile YAML parsing approach for extracting changed files. One informational finding notes redundant file reads in the test file (acceptable pattern for test isolation).

## Warnings

### WR-01: sme_refresh commit only includes last process's SME file

**File:** `get-shit-done/workflows/execute-phase.md:1626-1627`
**Issue:** The commit command after the "For each process in `matches[]`" loop uses `${PROCESS_NAME}`, which at that point only holds the value from the last loop iteration. If multiple processes were refreshed (e.g., two SMEs matched), only the last one's file would be committed. The commit message says "refresh SME documents" (plural) but the `--files` argument is singular.
**Fix:** Accumulate all refreshed process names during the loop and use a glob or expanded list in the commit:
```bash
gsd-sdk query commit "docs(phase-${PHASE_NUMBER}): refresh SME documents after execution" \
  --files .planning/smes/*-SME.md || true
```
Alternatively, collect process names into an array during the loop and expand them:
```bash
# Inside loop: REFRESHED_SMES+=(".planning/smes/${PROCESS_NAME}-SME.md")
# After loop:
gsd-sdk query commit "docs(phase-${PHASE_NUMBER}): refresh SME documents after execution" \
  --files ${REFRESHED_SMES[@]} || true
```

### WR-02: Fragile YAML parsing for files_modified in sme_refresh step

**File:** `get-shit-done/workflows/execute-phase.md:1583-1584`
**Issue:** The `CHANGED_FILES` extraction uses `grep -h "files_modified:"` which only captures the line containing the key itself. YAML block-style arrays (the most common format in PLAN.md frontmatter) list items on subsequent lines:
```yaml
files_modified:
  - src/foo.ts
  - src/bar.ts
```
The grep only captures `files_modified:` (the key line with no values). The subsequent `tr ' ' '\n' | grep "^\s*-"` pipeline then finds nothing because the array items are on lines not captured by the initial grep. This means `CHANGED_FILES` would be empty for plans using block-style YAML arrays, causing `sme.detect-processes` to receive no file paths and potentially skipping the refresh entirely.
**Fix:** Use a multi-line extraction approach, or leverage the SDK to parse YAML properly:
```bash
CHANGED_FILES=$(gsd-sdk query phase-plan-index "${PHASE_NUMBER}" 2>/dev/null \
  | jq -r '.plans[].files_modified[]' 2>/dev/null | tr '\n' ' ')
```
This reuses the existing `phase-plan-index` query handler which already parses PLAN.md frontmatter correctly, avoiding fragile grep-based YAML parsing.

## Info

### IN-01: Repeated file reads in test file

**File:** `tests/sme-post-execution-refresh.test.cjs:28-29,34-35,39-40,49-50,59-60`
**Issue:** `fs.readFileSync(EXECUTE_PHASE, 'utf-8')` is called in every individual test case (6 times for execute-phase.md, 3 times for plan-phase.md). While this ensures test isolation and is a common pattern, the files are read synchronously and their content does not change between tests.
**Fix:** Consider reading each file once in a `describe`-level variable if test runner supports it, or accept the current pattern for clarity and isolation:
```javascript
describe('REFRESH-01: post-execution SME process detection', () => {
  const content = fs.readFileSync(EXECUTE_PHASE, 'utf-8');
  // ... tests use `content` directly
});
```

---

_Reviewed: 2026-05-01T10:15:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
