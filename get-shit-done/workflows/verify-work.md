<purpose>
Validate built features through conversational testing with persistent state. Creates UAT.md that tracks test progress, survives /clear, and feeds gaps into /gsd:plan-phase --gaps.

User tests, Claude records. One test at a time. Plain text responses.
</purpose>

<philosophy>
**Show expected, ask if reality matches.**

Claude presents what SHOULD happen. User confirms or describes what's different.
- "yes" / "y" / "next" / empty → pass
- Anything else → logged as issue, severity inferred

No Pass/Fail buttons. No severity questions. Just: "Here's what should happen. Does it?"
</philosophy>

<critical_rules>
**NEVER substitute existence checks for success criteria.**

The ROADMAP Success Criteria are the ONLY source of truth for Phase Goal tests.

| ROADMAP says | WRONG interpretation | CORRECT interpretation |
|--------------|---------------------|------------------------|
| "deployed and healthy" | "files exist" | "az containerapp show returns Running + health endpoint 200" |
| "configured and validated" | "config in file" | "deploy and verify behavior occurs" |
| "test passes with X data" | "test file exists" | "run test with X data, assertions pass" |
| "throughput >N docs/sec" | "batch size configured" | "run pipeline, measure actual throughput" |
| "scaled to N replicas" | "maxReplicas=N in config" | "trigger scaling, verify N replicas running" |

**If a success criterion requires deployment to verify, the test MUST require deployment.**
Do NOT downgrade deployment criteria to local file checks.
</critical_rules>

<template>
@~/.claude/get-shit-done/templates/UAT.md
</template>

<process>

<step name="initialize" priority="first">
If $ARGUMENTS contains a phase number, load context:

```bash
INIT=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs init verify-work "${PHASE_ARG}")
```

Parse JSON for: `planner_model`, `checker_model`, `commit_docs`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `has_verification`.
</step>

<step name="check_active_session">
**First: Check for active UAT sessions**

```bash
find .planning/phases -name "*-UAT.md" -type f 2>/dev/null | head -5
```

**If active sessions exist AND no $ARGUMENTS provided:**

Read each file's frontmatter (status, phase) and Current Test section.

Display inline:

```
## Active UAT Sessions

| # | Phase | Status | Current Test | Progress |
|---|-------|--------|--------------|----------|
| 1 | 04-comments | testing | 3. Reply to Comment | 2/6 |
| 2 | 05-auth | testing | 1. Login Form | 0/4 |

Reply with a number to resume, or provide a phase number to start new.
```

Wait for user response.

- If user replies with number (1, 2) → Load that file, go to `resume_from_file`
- If user replies with phase number → Treat as new session, go to `create_uat_file`

**If active sessions exist AND $ARGUMENTS provided:**

Check if session exists for that phase. If yes, offer to resume or restart.
If no, continue to `create_uat_file`.

**If no active sessions AND no $ARGUMENTS:**

```
No active UAT sessions.

Provide a phase number to start testing (e.g., /gsd:verify-work 4)
```

**If no active sessions AND $ARGUMENTS provided:**

Continue to `create_uat_file`.
</step>

<step name="find_summaries">
**Find what to test:**

Use `phase_dir` from init (or run init if not already done).

**1. Read phase section from ROADMAP.md:**

```bash
cat .planning/ROADMAP.md
```

Parse the ROADMAP to find the phase matching `phase_number` or `phase_name`.
Extract the **Success Criteria** section for that phase (numbered list under `**Success Criteria:**` or `**Success Criteria** (what must be TRUE):`).

**2. Find SUMMARY.md files:**

```bash
ls "$phase_dir"/*-SUMMARY.md 2>/dev/null
```

Read each SUMMARY.md to extract implementation details.
</step>

<step name="extract_success_criteria">
**Extract phase success criteria from ROADMAP.md (PRIMARY TESTS):**

Parse the **Success Criteria** section found in find_summaries step.
Each numbered criterion becomes a "Phase Goal" test.

**VERBATIM RULE:** The test name and expected behavior MUST directly reflect the criterion.

WRONG:
- Criterion: "All 4 worker types deployed and healthy"
- Test: "Worker Files Exist" ← NOT the same thing

CORRECT:
- Criterion: "All 4 worker types deployed and healthy"
- Test: "All 4 Workers Deployed and Healthy"
- Expected: "Run `az containerapp list` - all 4 workers show 'Running'. Hit /healthz endpoint for each - returns 200."

**If you cannot verify a criterion without deployment, state that in the expected field:**
- Expected: "REQUIRES DEPLOYMENT: Run `az containerapp show --name parser-worker` and verify status is 'Running'"

For each criterion, create a test with:
- name: Brief test name from criterion
- expected: Observable verification that proves the criterion is met
- source: "ROADMAP Success Criteria #N"
- category: "Phase Goal"

**Generate intelligent verification methods based on phase type:**

| Phase Type | Indicators | Verification Approach | DO NOT |
|------------|------------|----------------------|--------|
| Infrastructure | "provision", "deploy" | Azure CLI status checks, Terraform state | grep config files |
| Worker/Job | "deployed", "healthy", "running" | Container status, health endpoints, logs | check if files exist |
| Data Pipeline | "throughput", "passes", "verified" | Run pipeline, measure metrics | check batch_size in code |
| Scaling | "scaled to N", "replicas" | Trigger load, count actual replicas | check maxReplicas config |
| API/Backend | "endpoint", "API", "service" | curl/httpie commands, API response validation | check route definitions |
| Frontend/UI | "dashboard", "UI", "display" | Browser verification, visual inspection | check component imports |

**Examples:**
- Criterion: "FTP download worker can connect to ftp.ncbi.nlm.nih.gov"
  → Name: "FTP Server Connection"
  → Expected: "FTP client establishes connection to ftp.ncbi.nlm.nih.gov (verify via logs or test connection)"

- Criterion: "~1,200 baseline XML files downloaded to Blob Storage"
  → Name: "Baseline Files in Blob Storage"
  → Expected: "Azure blob container shows ~1,200 XML files (run: `az storage blob list --container pubmed-raw --query 'length(@)'`)"

- Criterion: "All files pass MD5 checksum validation"
  → Name: "MD5 Validation Complete"
  → Expected: "State tracker shows all downloads completed with status 'validated' (no checksum failures)"

**If no Success Criteria found in ROADMAP:**
- Log: "No Success Criteria found in ROADMAP for phase {phase}. Using SUMMARY.md only."
- Continue to extract_tests with empty success criteria list
</step>

<step name="extract_tests">
**Extract implementation tests from SUMMARY.md (SECONDARY TESTS):**

Parse each SUMMARY.md for:
1. **Accomplishments** - Features/functionality added
2. **User-facing changes** - UI, workflows, interactions

Focus on FUNCTIONAL verification, not existence checks.

For each deliverable, create a test with:
- name: Brief test name
- expected: What the user should see/experience (specific, observable)
- source: The SUMMARY.md filename (e.g., "MASS-02-01-SUMMARY.md")
- category: "Implementation"

**Generate functional tests, not import checks:**

BAD (existence check):
- "MD5 module imports successfully"
- "Retry handler function exists"

GOOD (functional verification):
- "MD5 validation detects corrupt file and reports failure"
- "Retry handler recovers from temporary FTP disconnection"

**Examples:**
- Accomplishment: "FTP streaming client that downloads directly to blob without loading full file in memory"
  → Name: "FTP Streaming to Blob"
  → Expected: "Large file download completes without memory spike (verify via logs showing chunk uploads)"

- Accomplishment: "Added comment threading with infinite nesting"
  → Name: "Reply to a Comment"
  → Expected: "Clicking Reply opens inline composer below comment. Submitting shows reply nested under parent with visual indentation."

Skip internal/non-observable items (refactors, type changes, etc.).
</step>

<step name="create_uat_file">
**Create UAT file with categorized tests:**

```bash
mkdir -p "$PHASE_DIR"
```

Build test list from:
1. Success Criteria (from extract_success_criteria) - numbered first
2. Implementation details (from extract_tests) - numbered after

Create file:

```markdown
---
status: testing
phase: XX-name
source: [list of SUMMARY.md files]
roadmap_criteria: [number of success criteria from ROADMAP]
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

number: 1
name: [first test name]
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
result: [pending]
source: ROADMAP Success Criteria #2

...

<!-- Implementation (from SUMMARY.md) -->

### N. [Test Name]
expected: [functional verification]
result: [pending]
source: XX-YY-SUMMARY.md

...

## Summary

total: [N]
phase_goal: [count of Phase Goal tests]
implementation: [count of Implementation tests]
passed: 0
issues: 0
pending: [N]
skipped: 0

## Gaps

[none yet]
```

Write to `.planning/phases/XX-name/{phase_num}-UAT.md`

Proceed to `validate_tests_match_criteria`.
</step>

<step name="validate_tests_match_criteria">
**Before presenting tests, validate alignment:**

For each Phase Goal test, verify:
1. Test name reflects the ROADMAP criterion (not a downgraded version)
2. Expected behavior would actually prove the criterion is met
3. Tests requiring deployment are marked as such

**Red flags that indicate wrong tests:**
- Test name contains "exists" or "file" when criterion says "deployed" or "running"
- Expected uses `grep` or `ls` when criterion requires runtime verification
- Test checks config values when criterion says "validated" or "verified"
- Missing criterion (fewer Phase Goal tests than ROADMAP success criteria)

If any red flag detected, regenerate the Phase Goal tests using the VERBATIM RULE.

Proceed to `present_test`.
</step>

<step name="present_test">
**Present current test to user:**

Read Current Test section from UAT file.

Display using checkpoint box format:

```
╔══════════════════════════════════════════════════════════════╗
║  CHECKPOINT: Verification Required                           ║
╚══════════════════════════════════════════════════════════════╝

**Test {number}: {name}**

{expected}

──────────────────────────────────────────────────────────────
→ Type "pass" or describe what's wrong
──────────────────────────────────────────────────────────────
```

Wait for user response (plain text, no AskUserQuestion).
</step>

<step name="process_response">
**Process user response and update file:**

**If response indicates pass:**
- Empty response, "yes", "y", "ok", "pass", "next", "approved", "✓"

Update Tests section:
```
### {N}. {name}
expected: {expected}
result: pass
```

**If response indicates skip:**
- "skip", "can't test", "n/a"

Update Tests section:
```
### {N}. {name}
expected: {expected}
result: skipped
reason: [user's reason if provided]
```

**If response is anything else:**
- Treat as issue description

Infer severity from description:
- Contains: crash, error, exception, fails, broken, unusable → blocker
- Contains: doesn't work, wrong, missing, can't → major
- Contains: slow, weird, off, minor, small → minor
- Contains: color, font, spacing, alignment, visual → cosmetic
- Default if unclear: major

Update Tests section:
```
### {N}. {name}
expected: {expected}
result: issue
reported: "{verbatim user response}"
severity: {inferred}
```

Append to Gaps section (structured YAML for plan-phase --gaps):
```yaml
- truth: "{expected behavior from test}"
  status: failed
  reason: "User reported: {verbatim user response}"
  severity: {inferred}
  test: {N}
  category: {Phase Goal | Implementation}
  source: "{ROADMAP Success Criteria #N or SUMMARY.md filename}"
  artifacts: []  # Filled by diagnosis
  missing: []    # Filled by diagnosis
```

**After any response:**

Update Summary counts.
Update frontmatter.updated timestamp.

If more tests remain → Update Current Test, go to `present_test`
If no more tests → Go to `complete_session`
</step>

<step name="resume_from_file">
**Resume testing from UAT file:**

Read the full UAT file.

Find first test with `result: [pending]`.

Announce:
```
Resuming: Phase {phase} UAT
Progress: {passed + issues + skipped}/{total}
Issues found so far: {issues count}

Continuing from Test {N}...
```

Update Current Test section with the pending test.
Proceed to `present_test`.
</step>

<step name="complete_session">
**Complete testing and commit:**

Update frontmatter:
- status: complete
- updated: [now]

Clear Current Test section:
```
## Current Test

[testing complete]
```

Commit the UAT file:
```bash
node ~/.claude/get-shit-done/bin/gsd-tools.cjs commit "test({phase_num}): complete UAT - {passed} passed, {issues} issues" --files ".planning/phases/XX-name/{phase_num}-UAT.md"
```

Present summary:
```
## UAT Complete: Phase {phase}

| Result | Count |
|--------|-------|
| Passed | {N}   |
| Issues | {N}   |
| Skipped| {N}   |

[If issues > 0:]
### Issues Found

[List from Issues section]
```

**If issues > 0:** Proceed to `diagnose_issues`

**If issues == 0:**
```
All tests passed. Ready to continue.

- `/gsd:plan-phase {next}` — Plan next phase
- `/gsd:execute-phase {next}` — Execute next phase
```
</step>

<step name="diagnose_issues">
**Diagnose root causes before planning fixes:**

```
---

{N} issues found. Diagnosing root causes...

Spawning parallel debug agents to investigate each issue.
```

- Load diagnose-issues workflow
- Follow @~/.claude/get-shit-done/workflows/diagnose-issues.md
- Spawn parallel debug agents for each issue
- Collect root causes
- Update UAT.md with root causes
- Proceed to `plan_gap_closure`

Diagnosis runs automatically - no user prompt. Parallel agents investigate simultaneously, so overhead is minimal and fixes are more accurate.
</step>

<step name="plan_gap_closure">
**Auto-plan fixes from diagnosed gaps:**

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PLANNING FIXES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning planner for gap closure...
```

Spawn gsd-planner in --gaps mode:

```
Task(
  prompt="""
<planning_context>

**Phase:** {phase_number}
**Mode:** gap_closure

<files_to_read>
- {phase_dir}/{phase_num}-UAT.md (UAT with diagnoses)
- .planning/STATE.md (Project State)
- .planning/ROADMAP.md (Roadmap)
</files_to_read>

</planning_context>

<downstream_consumer>
Output consumed by /gsd:execute-phase
Plans must be executable prompts.
</downstream_consumer>
""",
  subagent_type="gsd-planner",
  model="{planner_model}",
  description="Plan gap fixes for Phase {phase}"
)
```

On return:
- **PLANNING COMPLETE:** Proceed to `verify_gap_plans`
- **PLANNING INCONCLUSIVE:** Report and offer manual intervention
</step>

<step name="verify_gap_plans">
**Verify fix plans with checker:**

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► VERIFYING FIX PLANS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning plan checker...
```

Initialize: `iteration_count = 1`

Spawn gsd-plan-checker:

```
Task(
  prompt="""
<verification_context>

**Phase:** {phase_number}
**Phase Goal:** Close diagnosed gaps from UAT

<files_to_read>
- {phase_dir}/*-PLAN.md (Plans to verify)
</files_to_read>

</verification_context>

<expected_output>
Return one of:
- ## VERIFICATION PASSED — all checks pass
- ## ISSUES FOUND — structured issue list
</expected_output>
""",
  subagent_type="gsd-plan-checker",
  model="{checker_model}",
  description="Verify Phase {phase} fix plans"
)
```

On return:
- **VERIFICATION PASSED:** Proceed to `present_ready`
- **ISSUES FOUND:** Proceed to `revision_loop`
</step>

<step name="revision_loop">
**Iterate planner ↔ checker until plans pass (max 3):**

**If iteration_count < 3:**

Display: `Sending back to planner for revision... (iteration {N}/3)`

Spawn gsd-planner with revision context:

```
Task(
  prompt="""
<revision_context>

**Phase:** {phase_number}
**Mode:** revision

<files_to_read>
- {phase_dir}/*-PLAN.md (Existing plans)
</files_to_read>

**Checker issues:**
{structured_issues_from_checker}

</revision_context>

<instructions>
Read existing PLAN.md files. Make targeted updates to address checker issues.
Do NOT replan from scratch unless issues are fundamental.
</instructions>
""",
  subagent_type="gsd-planner",
  model="{planner_model}",
  description="Revise Phase {phase} plans"
)
```

After planner returns → spawn checker again (verify_gap_plans logic)
Increment iteration_count

**If iteration_count >= 3:**

Display: `Max iterations reached. {N} issues remain.`

Offer options:
1. Force proceed (execute despite issues)
2. Provide guidance (user gives direction, retry)
3. Abandon (exit, user runs /gsd:plan-phase manually)

Wait for user response.
</step>

<step name="present_ready">
**Present completion and next steps:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► FIXES READY ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {X}: {Name}** — {N} gap(s) diagnosed, {M} fix plan(s) created

| Gap | Root Cause | Fix Plan |
|-----|------------|----------|
| {truth 1} | {root_cause} | {phase}-04 |
| {truth 2} | {root_cause} | {phase}-04 |

Plans verified and ready for execution.

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Execute fixes** — run fix plans

`/clear` then `/gsd:execute-phase {phase} --gaps-only`

───────────────────────────────────────────────────────────────
```
</step>

</process>

<update_rules>
**Batched writes for efficiency:**

Keep results in memory. Write to file only when:
1. **Issue found** — Preserve the problem immediately
2. **Session complete** — Final write before commit
3. **Checkpoint** — Every 5 passed tests (safety net)

| Section | Rule | When Written |
|---------|------|--------------|
| Frontmatter.status | OVERWRITE | Start, complete |
| Frontmatter.updated | OVERWRITE | On any file write |
| Current Test | OVERWRITE | On any file write |
| Tests.{N}.result | OVERWRITE | On any file write |
| Summary | OVERWRITE | On any file write |
| Gaps | APPEND | When issue found |

On context reset: File shows last checkpoint. Resume from there.
</update_rules>

<severity_inference>
**Infer severity from user's natural language:**

| User says | Infer |
|-----------|-------|
| "crashes", "error", "exception", "fails completely" | blocker |
| "doesn't work", "nothing happens", "wrong behavior" | major |
| "works but...", "slow", "weird", "minor issue" | minor |
| "color", "spacing", "alignment", "looks off" | cosmetic |

Default to **major** if unclear. User can correct if needed.

**Never ask "how severe is this?"** - just infer and move on.
</severity_inference>

<success_criteria>
- [ ] Success Criteria extracted from ROADMAP.md for the phase (if present)
- [ ] UAT file created with categorized tests (Phase Goal + Implementation)
- [ ] Phase Goal tests numbered first, sourced from ROADMAP Success Criteria
- [ ] Implementation tests numbered after, sourced from SUMMARY.md files
- [ ] Infrastructure phases get verification commands (Azure CLI, Terraform)
- [ ] Code phases get functional tests (not just import/existence checks)
- [ ] Test source tracked (ROADMAP vs which SUMMARY.md)
- [ ] Tests presented one at a time with expected behavior
- [ ] User responses processed as pass/issue/skip
- [ ] Severity inferred from description (never asked)
- [ ] Batched writes: on issue, every 5 passes, or completion
- [ ] Committed on completion
- [ ] If issues: parallel debug agents diagnose root causes
- [ ] If issues: gsd-planner creates fix plans (gap_closure mode)
- [ ] If issues: gsd-plan-checker verifies fix plans
- [ ] If issues: revision loop until plans pass (max 3 iterations)
- [ ] Ready for `/gsd:execute-phase --gaps-only` when complete
- [ ] Backward compatible: works if phase has no Success Criteria in ROADMAP
</success_criteria>
