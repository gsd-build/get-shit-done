---
phase: 10-fix-new-milestone-sme-creator-integration
reviewed: 2026-05-04T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - tests/sme-new-milestone-detect.test.cjs
  - sdk/src/agents/sme-creator-structure.test.ts
  - get-shit-done/workflows/new-milestone/sme-step.md
  - agents/gsd-sme-creator.md
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-05-04T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Four files were reviewed covering the SME creator orchestrator agent, the new-milestone SME detection workflow step, and two test suites (a Node.js `node:test` .cjs suite and a Vitest `.ts` suite). The overall design is sound and all tests appear structurally correct against the current file contents.

Two warnings were found: one in the test suite and one in the workflow document. The test warning is a compound assertion whose diagnostic output is ambiguous. The workflow warning is an unvalidated code path where names sourced from `sme.list` (step 4 selections) are interpolated into a shell snippet without the same guard applied to step 5 process names. Three info items cover a minor test reliability concern, an eval config that passes at exact minimum boundary, and a `grep` scope asymmetry in the orchestrator.

## Warnings

### WR-01: Compound negative assertion obscures which condition failed

**File:** `tests/sme-new-milestone-detect.test.cjs:72-73`
**Issue:** The DETECT-05 test combines two independent negative checks into a single `assert.ok()`:
```js
assert.ok(!content.includes('state.update') && !content.includes('state.patch'),
  'sme-step.md must NOT use state.update or state.patch ...');
```
If `sme-step.md` accidentally gains a `state.update` call, the test fails with the combined message and no indication of *which* forbidden call appeared. Debugging requires re-reading the source.
**Fix:** Split into two assertions so each carries its own diagnostic:
```js
assert.ok(!content.includes('state.update'),
  'sme-step.md must NOT use state.update (erases custom frontmatter fields)');
assert.ok(!content.includes('state.patch'),
  'sme-step.md must NOT use state.patch (erases custom frontmatter fields)');
```

### WR-02: Names from sme.list (step 4) flow into python3 inline snippet without validation

**File:** `get-shit-done/workflows/new-milestone/sme-step.md:154`
**Issue:** Step 6 builds `ACTIVE_SMES_JSON` by interpolating `${SELECTED_SMES}` into a `python3 -c` heredoc-style triple-quoted string:
```bash
names = [n.strip() for n in '''${SELECTED_SMES}'''.split() if n.strip()]
```
`SELECTED_SMES` is populated from two sources: (a) existing SME names confirmed in step 4 (from `sme.list` output, which are not validated by the `^[a-zA-Z0-9_-]+$` guard), and (b) newly created SME names from step 5 (which ARE validated). If an existing SME was created with a process name containing characters like `\n`, embedded Python keywords, or unexpected whitespace, the expansion could produce malformed Python or silently drop names. The `^[a-zA-Z0-9_-]+$` validation applied to new process names in step 5 is not applied to names selected from the existing list in step 4.
**Fix:** Apply the same character validation to names chosen from `sme.list` before they are added to `SELECTED_SMES`, or use a safer JSON-based approach to pass the name list to Python instead of string interpolation:
```bash
ACTIVE_SMES_JSON=$(python3 -c "
import sys, json, os
raw = os.environ.get('SELECTED_SMES', '')
names = [n.strip() for n in raw.split() if n.strip()]
print(json.dumps({'milestone': {'active_smes': names}}))
" SELECTED_SMES="${SELECTED_SMES}")
```
Passing the value as an environment variable rather than via inline interpolation eliminates the expansion risk entirely.

## Info

### IN-01: beforeAll file reads in sme-creator-structure.test.ts produce cryptic failures if files are missing

**File:** `sdk/src/agents/sme-creator-structure.test.ts:51-53`
**Issue:** Each `describe` block loads agent files via `readFileSync` inside `beforeAll`. If a referenced file does not exist (e.g., `gsd-sme-creator-analyzer.md` is renamed or deleted), the `beforeAll` throws a Node.js `ENOENT` error and the entire `describe` block reports all tests as failed with a generic "beforeAll threw" message, rather than a targeted "file not found" assertion. This makes CI output harder to diagnose.
**Fix:** Wrap the `readFileSync` call or add an existence check with a descriptive assertion before loading:
```ts
beforeAll(() => {
  if (!existsSync(ORCHESTRATOR_PATH)) {
    throw new Error(`Orchestrator agent not found at: ${ORCHESTRATOR_PATH}`);
  }
  orchestrator = readAgent(ORCHESTRATOR_PATH);
});
```
Alternatively, expose the path check as its own `it` test so the failure is reported at the correct granularity.

### IN-02: Eval config test passes at exact lower bound (10 of 10 required)

**File:** `sdk/src/agents/sme-creator-structure.test.ts:235-241`
**Issue:** The eval config currently has exactly 10 `- description:` entries, and the test requires `>= 10`. The test passes at the minimum boundary. If a test case is accidentally deleted during a future edit, the count drops to 9 and the test fails — the boundary gives zero tolerance for accidental removal.
**Fix:** No code change required now, but document that the eval config minimum is 10 entries and add a comment in the test or the eval file noting this constraint. Consider raising the threshold to 8 (a guard band) if the intent is "at least 8 well-formed tests" rather than "exactly 10".

### IN-03: grep discovery in discover_process_files omits evals/ directory

**File:** `agents/gsd-sme-creator.md:68`
**Issue:** The `grep -rl "{PROCESS_NAME}"` command in the `discover_process_files` step searches only `sdk/src/ agents/ get-shit-done/`, while the subsequent `find .` command searches the whole repo. Eval configuration files (`evals/*.promptfooconfig.yaml`) containing the process name will be found by `find` but not by `grep`. This inconsistency means eval files may be included in partitions even when the process has no real source in those directories, or conversely that the grep-based count differs from the find-based count.
**Fix:** Either add `evals/` to the grep invocation for consistency, or document the intentional scope difference with a comment:
```bash
grep -rl "{PROCESS_NAME}" --include="*.ts" --include="*.md" --include="*.yaml" \
  sdk/src/ agents/ get-shit-done/ evals/ 2>/dev/null
```

---

_Reviewed: 2026-05-04T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
