# UAT Template

Template for `.planning/phases/XX-name/{phase_num}-UAT.md` — persistent UAT session tracking.

---

## File Template

```markdown
---
status: testing | complete | diagnosed
phase: XX-name
source: [list of SUMMARY.md files tested]
roadmap_criteria: [number of success criteria from ROADMAP, 0 if none]
started: [ISO timestamp]
updated: [ISO timestamp]
---

## Test Categories

| Category | Tests | Purpose |
|----------|-------|---------|
| **Phase Goal** | 1-N | Verify phase achieved its GOAL per ROADMAP.md Success Criteria |
| **Implementation** | N+1-M | Verify code artifacts work as designed per SUMMARY.md |

*Primary focus: Phase Goal tests (1-N) must pass for phase to be considered complete.*

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: [N]
name: [test name]
expected: |
  [what user should observe]
awaiting: user response

## Tests

<!-- Phase Goal (from ROADMAP.md Success Criteria) -->

### 1. [Test Name]
expected: [observable verification from success criterion]
result: [pending]
source: ROADMAP Success Criteria #1

### 2. [Test Name]
expected: [observable verification]
result: pass
source: ROADMAP Success Criteria #2

<!-- Implementation (from SUMMARY.md) -->

### 3. [Test Name]
expected: [functional verification]
result: issue
reported: "[verbatim user response]"
severity: major
source: XX-YY-SUMMARY.md

### 4. [Test Name]
expected: [functional verification]
result: skipped
reason: [why skipped]
source: XX-YY-SUMMARY.md

...

## Summary

total: [N]
phase_goal: [N]
implementation: [N]
passed: [N]
issues: [N]
pending: [N]
skipped: [N]

## Gaps

<!-- YAML format for plan-phase --gaps consumption -->
- truth: "[expected behavior from test]"
  status: failed
  reason: "User reported: [verbatim response]"
  severity: blocker | major | minor | cosmetic
  test: [N]
  category: Phase Goal | Implementation
  source: "[ROADMAP Success Criteria #N or SUMMARY.md filename]"
  root_cause: ""     # Filled by diagnosis
  artifacts: []      # Filled by diagnosis
  missing: []        # Filled by diagnosis
  debug_session: ""  # Filled by diagnosis
```

---

<section_rules>

**Frontmatter:**
- `status`: OVERWRITE - "testing" or "complete"
- `phase`: IMMUTABLE - set on creation
- `source`: IMMUTABLE - SUMMARY files being tested
- `roadmap_criteria`: IMMUTABLE - count of success criteria from ROADMAP (0 if none)
- `started`: IMMUTABLE - set on creation
- `updated`: OVERWRITE - update on every change

**Test Categories:**
- IMMUTABLE - set on creation
- Documents which tests are Phase Goal vs Implementation

**Current Test:**
- OVERWRITE entirely on each test transition
- Shows which test is active and what's awaited
- On completion: "[testing complete]"

**Tests:**
- Each test: OVERWRITE result field when user responds
- `result` values: [pending], pass, issue, skipped
- `source`: IMMUTABLE - tracks origin (ROADMAP Success Criteria #N or SUMMARY.md filename)
- If issue: add `reported` (verbatim) and `severity` (inferred)
- If skipped: add `reason` if provided

**Summary:**
- OVERWRITE counts after each response
- Tracks: total, phase_goal, implementation, passed, issues, pending, skipped

**Gaps:**
- APPEND only when issue found (YAML format)
- Include `category` (Phase Goal | Implementation) and `source`
- After diagnosis: fill `root_cause`, `artifacts`, `missing`, `debug_session`
- This section feeds directly into $gsd-plan-phase --gaps

</section_rules>

<diagnosis_lifecycle>

**After testing complete (status: complete), if gaps exist:**

1. User runs diagnosis (from verify-work offer or manually)
2. diagnose-issues workflow spawns parallel debug agents
3. Each agent investigates one gap, returns root cause
4. UAT.md Gaps section updated with diagnosis:
   - Each gap gets `root_cause`, `artifacts`, `missing`, `debug_session` filled
5. status → "diagnosed"
6. Ready for $gsd-plan-phase --gaps with root causes

**After diagnosis:**
```yaml
## Gaps

- truth: "Comment appears immediately after submission"
  status: failed
  reason: "User reported: works but doesn't show until I refresh the page"
  severity: major
  test: 2
  root_cause: "useEffect in CommentList.tsx missing commentCount dependency"
  artifacts:
    - path: "src/components/CommentList.tsx"
      issue: "useEffect missing dependency"
  missing:
    - "Add commentCount to useEffect dependency array"
  debug_session: ".planning/debug/comment-not-refreshing.md"
```

</diagnosis_lifecycle>

<lifecycle>

**Creation:** When $gsd-verify-work starts new session
- Extract Success Criteria from ROADMAP.md for phase (Phase Goal tests)
- Extract accomplishments from SUMMARY.md files (Implementation tests)
- Number Phase Goal tests first, then Implementation tests
- Set status to "testing"
- Current Test points to test 1
- All tests have result: [pending]

**During testing:**
- Present test from Current Test section
- User responds with pass confirmation or issue description
- Update test result (pass/issue/skipped)
- Update Summary counts
- If issue: append to Gaps section (YAML format), infer severity
- Move Current Test to next pending test

**On completion:**
- status → "complete"
- Current Test → "[testing complete]"
- Commit file
- Present summary with next steps

**Resume after /clear:**
1. Read frontmatter → know phase and status
2. Read Current Test → know where we are
3. Find first [pending] result → continue from there
4. Summary shows progress so far

</lifecycle>

<severity_guide>

Severity is INFERRED from user's natural language, never asked.

| User describes | Infer |
|----------------|-------|
| Crash, error, exception, fails completely, unusable | blocker |
| Doesn't work, nothing happens, wrong behavior, missing | major |
| Works but..., slow, weird, minor, small issue | minor |
| Color, font, spacing, alignment, visual, looks off | cosmetic |

Default: **major** (safe default, user can clarify if wrong)

</severity_guide>

<good_example>
```markdown
---
status: diagnosed
phase: MASS-02
source: MASS-02-01-SUMMARY.md, MASS-02-02-SUMMARY.md, MASS-02-03-SUMMARY.md
roadmap_criteria: 4
started: 2026-03-05T10:30:00Z
updated: 2026-03-05T10:45:00Z
---

## Test Categories

| Category | Tests | Purpose |
|----------|-------|---------|
| **Phase Goal** | 1-4 | Verify phase achieved its GOAL per ROADMAP.md Success Criteria |
| **Implementation** | 5-7 | Verify code artifacts work as designed per SUMMARY.md |

*Primary focus: Phase Goal tests (1-4) must pass for phase to be considered complete.*

## Current Test

[testing complete]

## Tests

<!-- Phase Goal (from ROADMAP.md Success Criteria) -->

### 1. FTP Server Connection
expected: FTP download worker establishes connection to ftp.ncbi.nlm.nih.gov (verify via logs or test connection)
result: pass
source: ROADMAP Success Criteria #1

### 2. Baseline Files in Blob Storage
expected: ~1,200 XML files exist in pubmed-raw container (verify: `az storage blob list --container pubmed-raw --query 'length(@)'`)
result: pass
source: ROADMAP Success Criteria #2

### 3. MD5 Validation Complete
expected: All downloaded files pass checksum validation (verify state tracker shows no checksum failures)
result: issue
reported: "3 files show checksum mismatch in state tracker"
severity: major
source: ROADMAP Success Criteria #3

### 4. Download Performance
expected: Total download time <4 hours (verify via logs or metrics dashboard)
result: pass
source: ROADMAP Success Criteria #4

<!-- Implementation (from SUMMARY.md) -->

### 5. FTP Streaming to Blob
expected: Large file download completes without memory spike (verify logs show chunk uploads, not full-file buffer)
result: pass
source: MASS-02-01-SUMMARY.md

### 6. Retry Handler Recovery
expected: Retry handler recovers from temporary FTP disconnection (verify reconnection in logs)
result: pass
source: MASS-02-02-SUMMARY.md

### 7. State Tracker Updates
expected: State tracker reflects download progress in real-time (verify tracker shows incremental updates)
result: pass
source: MASS-02-01-SUMMARY.md

## Summary

total: 7
phase_goal: 4
implementation: 3
passed: 6
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "All downloaded files pass MD5 checksum validation"
  status: failed
  reason: "User reported: 3 files show checksum mismatch in state tracker"
  severity: major
  test: 3
  category: Phase Goal
  source: "ROADMAP Success Criteria #3"
  root_cause: "FTP server returned truncated file for 3 large XMLs during network congestion"
  artifacts:
    - path: "src/workers/ftp-download/checksum.ts"
      issue: "Missing retry on checksum failure"
  missing:
    - "Add automatic re-download when checksum fails"
  debug_session: ".planning/debug/checksum-mismatch.md"
```
</good_example>
