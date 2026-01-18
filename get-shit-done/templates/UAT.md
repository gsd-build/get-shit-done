# UAT Template

Template for `.planning/phases/XX-name/{phase}-UAT.md` — persistent UAT session tracking.

---

## File Template

```markdown
---
status: testing | complete | diagnosed
phase: XX-name
source: [list of SUMMARY.md files tested]
started: [ISO timestamp]
updated: [ISO timestamp]
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: [N]
name: [test name]
expected: |
  [what user should observe]
awaiting: user response

## Tests

### 1. [Test Name]
expected: [observable behavior - what user should see]
verification_type: ui | api | data | file | cli
automatable: true | false
result: [pending]

### 2. [Test Name]
expected: [observable behavior]
verification_type: ui
automatable: true
result: pass:auto
auto_method: playwright
auto_evidence: "Element #login-form found and visible"

### 3. [Test Name]
expected: [observable behavior]
verification_type: ui
automatable: false
result: pass
<!-- Human verification for subjective UI - no auto_evidence -->

### 4. [Test Name]
expected: [observable behavior]
verification_type: api
automatable: true
result: issue:auto
auto_method: http
auto_evidence: "Expected 200 OK but got 401 Unauthorized"

### 5. [Test Name]
expected: [observable behavior]
verification_type: ui
automatable: false
result: issue
reported: "[verbatim user response]"
severity: major

### 6. [Test Name]
expected: [observable behavior]
verification_type: data
automatable: true
result: pass:auto
auto_method: supabase
auto_evidence: "Record found in users table with expected fields"

### 7. [Test Name]
expected: [observable behavior]
verification_type: ui
automatable: false
result: skipped
reason: [why skipped]

...

## Summary

total: [N]
passed: [N]
passed_auto: [N]
passed_human: [N]
issues: [N]
pending: [N]
skipped: [N]
automation_status: full | partial | unavailable | disabled

## Gaps

<!-- YAML format for plan-phase --gaps consumption -->
- truth: "[expected behavior from test]"
  status: failed
  reason: "User reported: [verbatim response]"
  severity: blocker | major | minor | cosmetic
  test: [N]
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
- `started`: IMMUTABLE - set on creation
- `updated`: OVERWRITE - update on every change

**Current Test:**
- OVERWRITE entirely on each test transition
- Shows which test is active and what's awaited
- On completion: "[testing complete]"

**Tests:**
- Each test: OVERWRITE result field when user responds or automation completes
- `result` values: [pending], pass, pass:auto, issue, issue:auto, skipped
- `verification_type`: ui, api, data, file, or cli
- `automatable`: true for mechanical checks, false for subjective judgments
- If automated: add `auto_method` (tool used) and `auto_evidence` (verification result)
- If human issue: add `reported` (verbatim) and `severity` (inferred)
- If skipped: add `reason` if provided

**Summary:**
- OVERWRITE counts after each response
- Tracks: total, passed, passed_auto, passed_human, issues, pending, skipped
- `automation_status`: full (all automatable passed), partial (some automated), unavailable (no tools available), disabled (config off)

**Gaps:**
- APPEND only when issue found (YAML format)
- After diagnosis: fill `root_cause`, `artifacts`, `missing`, `debug_session`
- This section feeds directly into /gsd:plan-phase --gaps

</section_rules>

<diagnosis_lifecycle>

**After testing complete (status: complete), if gaps exist:**

1. User runs diagnosis (from verify-work offer or manually)
2. diagnose-issues workflow spawns parallel debug agents
3. Each agent investigates one gap, returns root cause
4. UAT.md Gaps section updated with diagnosis:
   - Each gap gets `root_cause`, `artifacts`, `missing`, `debug_session` filled
5. status → "diagnosed"
6. Ready for /gsd:plan-phase --gaps with root causes

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

**Creation:** When /gsd:verify-work starts new session
- Extract tests from SUMMARY.md files
- Set status to "testing"
- Categorize each test for automation potential (automatable: true/false, verification_type)
- Current Test points to test 1
- All tests have result: [pending]

**Automation phase (if enabled):**
- Check config.agent_acceptance_testing.auto_enabled
- Detect available verification tools (Playwright, database MCPs, HTTP tools, etc.)
- For each test with automatable: true:
  - Select appropriate tool based on verification_type
  - Execute verification and record auto_method used
  - Record pass:auto or issue:auto with auto_evidence
  - On error or no tool available: fall back to [pending] for human verification
- Update automation_status in Summary

**During human testing:**
- Skip tests with result: pass:auto
- For tests with result: issue:auto: present with evidence, allow "override" to pass
- Present remaining test from Current Test section
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
phase: 04-comments
source: 04-01-SUMMARY.md, 04-02-SUMMARY.md
started: 2025-01-15T10:30:00Z
updated: 2025-01-15T10:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. View Comments on Post
expected: Comments section expands, shows count and comment list
verification_type: ui
automatable: true
result: pass:auto
auto_method: playwright
auto_evidence: "Element [data-testid='comments-section'] visible with 3 comments"

### 2. Create Top-Level Comment
expected: Submit comment via rich text editor, appears in list with author info
verification_type: ui
automatable: true
result: issue:auto
auto_method: playwright
auto_evidence: "Form submitted but comment not found in list after 5s wait"

### 3. Reply to a Comment
expected: Click Reply, inline composer appears, submit shows nested reply
verification_type: ui
automatable: true
result: pass:auto
auto_method: playwright
auto_evidence: "Reply button clicked, composer visible, reply submitted and nested under parent"

### 4. Visual Nesting
expected: 3+ level thread shows indentation, left borders, caps at reasonable depth
verification_type: ui
automatable: false
result: pass
<!-- Human verified - subjective visual design -->

### 5. Delete Own Comment
expected: Click delete on own comment, removed or shows [deleted] if has replies
verification_type: ui
automatable: true
result: pass:auto
auto_method: playwright
auto_evidence: "Delete clicked, confirmation accepted, comment replaced with [deleted]"

### 6. Comment Count
expected: Post shows accurate count, increments when adding comment
verification_type: ui
automatable: true
result: pass:auto
auto_method: playwright
auto_evidence: "Count element shows '4', incremented from '3' after adding comment"

### 7. API Returns Comments
expected: GET /api/comments returns array of comment objects with id, text, author
verification_type: api
automatable: true
result: pass:auto
auto_method: http
auto_evidence: "Response 200 OK, body contains array with 4 comment objects"

### 8. Comment Persisted to Database
expected: New comment record exists in comments table with correct post_id
verification_type: data
automatable: true
result: pass:auto
auto_method: supabase
auto_evidence: "SELECT returned 1 row matching post_id and user_id"

## Summary

total: 8
passed: 7
passed_auto: 6
passed_human: 1
issues: 1
pending: 0
skipped: 0
automation_status: partial

## Gaps

- truth: "Comment appears immediately after submission in list"
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
</good_example>
