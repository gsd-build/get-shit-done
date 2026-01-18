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

<template>
@~/.claude/get-shit-done/templates/UAT.md
</template>

<process>

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

Parse $ARGUMENTS as phase number (e.g., "4") or plan number (e.g., "04-02").

```bash
# Find phase directory (match both zero-padded and unpadded)
PADDED_PHASE=$(printf "%02d" ${PHASE_ARG} 2>/dev/null || echo "${PHASE_ARG}")
PHASE_DIR=$(ls -d .planning/phases/${PADDED_PHASE}-* .planning/phases/${PHASE_ARG}-* 2>/dev/null | head -1)

# Find SUMMARY files
ls "$PHASE_DIR"/*-SUMMARY.md 2>/dev/null
```

Read each SUMMARY.md to extract testable deliverables.
</step>

<step name="extract_tests">
**Extract testable deliverables from SUMMARY.md:**

Parse for:
1. **Accomplishments** - Features/functionality added
2. **User-facing changes** - UI, workflows, interactions

Focus on USER-OBSERVABLE outcomes, not implementation details.

For each deliverable, create a test:
- name: Brief test name
- expected: What the user should see/experience (specific, observable)
- verification_type: ui, api, data, file, or cli
- automatable: true for mechanical checks, false for subjective judgments

**Verification types:**

| Type | Keywords | Example |
|------|----------|---------|
| ui | visible, click, button, page, form, input, navigate | "Login button redirects to dashboard" |
| api | returns, response, endpoint, HTTP, status code | "GET /api/users returns 200" |
| data | database, record, table, persisted, stored | "User saved to users table" |
| file | file exists, created, written to, output | "Config file created at ~/.app/config" |
| cli | command outputs, terminal, exit code | "build command exits 0" |

**Automatable vs human-required:**
- `automatable: true` — Mechanical interactions and structural checks (click works, element exists, form submits, component at location X)
- `automatable: false` — Subjective quality judgments: "looks", "feels", "design", "intuitive", "matches mockup"

Skip internal/non-observable items (refactors, type changes, etc.).
</step>

<step name="check_automation_config">
**Check if automated verification is enabled:**

Read `.planning/config.json` and extract `agent_acceptance_testing` section:

```javascript
{
  "agent_acceptance_testing": {
    "auto_enabled": false,      // Master switch
    "fallback_to_human": true   // Graceful degradation
  }
}
```

**If `auto_enabled` is false or missing:**
- Set `AUTOMATION_ENABLED = false`
- Skip to `create_uat_file` (manual-only flow)
- Set `automation_status: disabled` in Summary

**If `auto_enabled` is true:**
- Set `AUTOMATION_ENABLED = true`
- Capture `fallback_to_human` setting
- Proceed to `detect_automation_tools`
</step>

<step name="detect_automation_tools">
**Detect available verification tools:**

Probe for available tools by verification type. Record which tools are available:

```
AVAILABLE_TOOLS = {}
```

**UI verification (Playwright):**
```
Try: mcp__plugin_playwright_playwright__browser_navigate(url: "about:blank")
If succeeds: AVAILABLE_TOOLS.ui = "playwright", close browser
If fails: AVAILABLE_TOOLS.ui = null
```

**API verification (HTTP tools):**
- WebFetch tool is always available for basic HTTP checks
- Set `AVAILABLE_TOOLS.api = "webfetch"`

**Data verification (Database MCPs):**
```
Probe for available database MCPs:
- Supabase MCP: Try listing tables or a simple query
- Other database MCPs: Similar probes

If any available: AVAILABLE_TOOLS.data = "[mcp_name]"
If none: AVAILABLE_TOOLS.data = null
```

**File verification:**
- Read/Glob tools are always available
- Set `AVAILABLE_TOOLS.file = "read"`

**CLI verification:**
- Bash tool is always available
- Set `AVAILABLE_TOOLS.cli = "bash"`

**After probing:**

Count how many verification types have tools available.

**If no tools available for any automatable tests:**
- **If `fallback_to_human: true`:**
  - Display: "No automated verification tools available. Using manual verification."
  - Set `automation_status: unavailable` in Summary
  - Proceed to `create_uat_file` (manual-only flow)
- **If `fallback_to_human: false`:**
  - Display error: "Automated verification enabled but no tools available. Configure MCPs or set `fallback_to_human: true`."
  - Exit workflow

**If some tools available:**
- Proceed to `run_automated_tests` with `AVAILABLE_TOOLS`
</step>

<step name="run_automated_tests">
**Execute automated verification for eligible tests:**

For each test with `automatable: true`, check if a tool is available for its `verification_type`:

**Based on verification_type and AVAILABLE_TOOLS:**

| Type | Tool | Verification approach |
|------|------|----------------------|
| ui | playwright | Navigate to app, take snapshot, verify elements/interactions |
| api | webfetch | Make HTTP request, verify response status and body |
| data | supabase/db-mcp | Execute query, verify record exists with expected values |
| file | read/glob | Check file existence, read contents, verify expected content |
| cli | bash | Run command, capture output, verify expected result |

**For each test:**
1. Check if `AVAILABLE_TOOLS[verification_type]` exists
2. If tool available:
   - Attempt verification using the appropriate tool
   - **On success:** Set `result: pass:auto`, `auto_method: "[tool]"`, `auto_evidence: "[what was verified]"`
   - **On failure:** Set `result: issue:auto`, `auto_method: "[tool]"`, `auto_evidence: "[what failed]"`
   - **On error (tool error, timeout, etc.):** Keep `result: [pending]` for human verification
3. If no tool available for this type:
   - Keep `result: [pending]` for human verification

**Verification approaches by type:**

**ui (Playwright):**
- Navigate to app URL (inferred from project or test context)
- Take snapshot, search for described elements
- For interactions: click, verify state change
- For forms: fill fields, submit, verify result

**api (WebFetch/HTTP):**
- Make request to endpoint mentioned in expected behavior
- Verify response status code
- Verify response body contains expected data

**data (Database MCP):**
- Execute query based on expected behavior
- Verify record exists with expected values
- Example: "SELECT * FROM users WHERE email = 'test@example.com'"

**file (Read/Glob):**
- Check file existence with Glob
- Read file contents with Read
- Verify expected content present

**cli (Bash):**
- Execute command from expected behavior
- Capture stdout/stderr
- Verify expected output or exit code

**After all automated tests:**
- Count results: `passed_auto`, `issue_auto`, `pending_for_human`
- Update Summary with automation counts
- Display automated results table:

```
## Automated Results

| Test | Type | Method | Result | Evidence |
|------|------|--------|--------|----------|
| 1. Login visible | ui | playwright | pass:auto | Element #login-form found |
| 2. API returns user | api | webfetch | pass:auto | 200 OK, user object in body |
| 3. User in database | data | supabase | pass:auto | Record found with matching email |
| 4. Config file created | file | read | issue:auto | File exists but missing 'debug' key |

{N} tests require human verification.
```

Clean up any open resources (close browser, etc.) and proceed to `create_uat_file`.
</step>

<step name="create_uat_file">
**Create UAT file with all tests:**

```bash
mkdir -p "$PHASE_DIR"
```

Build test list from extracted deliverables, including automation metadata.

Create file:

```markdown
---
status: testing
phase: XX-name
source: [list of SUMMARY.md files]
started: [ISO timestamp]
updated: [ISO timestamp]
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: [first test name]
expected: |
  [what user should observe]
awaiting: user response

## Tests

### 1. [Test Name]
expected: [observable behavior]
verification_type: [ui | api | data | file | cli]
automatable: true | false
result: [pending] | pass:auto | issue:auto
auto_method: "[tool used, if automated]"
auto_evidence: "[if automated]"

### 2. [Test Name]
expected: [observable behavior]
verification_type: [ui | api | data | file | cli]
automatable: true | false
result: [pending] | pass:auto | issue:auto
auto_method: "[tool used, if automated]"
auto_evidence: "[if automated]"

...

## Summary

total: [N]
passed: 0
passed_auto: [N from run_automated_tests, or 0]
passed_human: 0
issues: 0
pending: [N]
skipped: 0
automation_status: [full | partial | unavailable | disabled]

## Gaps

[none yet]
```

**Determine automation_status:**
- `disabled`: `auto_enabled` was false in config
- `unavailable`: `auto_enabled` was true but no tools available for any test types
- `partial`: Some tests automated, some require human (or no tool for their type)
- `full`: All automatable tests passed (only human-required tests remain)

Write to `.planning/phases/XX-name/{phase}-UAT.md`

Proceed to `present_test`.
</step>

<step name="present_test">
**Present current test to user:**

Read Current Test section from UAT file.

**Skip tests with `result: pass:auto`** - these were verified automatically.

**For tests with `result: issue:auto`:**
Present with automated evidence and allow override:

```
╔══════════════════════════════════════════════════════════════╗
║  CHECKPOINT: Automated Issue Detected                        ║
╚══════════════════════════════════════════════════════════════╝

**Test {number}: {name}**

{expected}

**Automated Evidence:**
{auto_evidence}

──────────────────────────────────────────────────────────────
→ Type "override" if this actually works, or confirm the issue
──────────────────────────────────────────────────────────────
```

**For tests with `result: [pending]`:**
Display standard checkpoint box:

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

**If current test has `result: issue:auto` and response is "override":**
- User confirms the automated issue was a false positive
- Change result from `issue:auto` to `pass`
- Keep auto_method and auto_evidence for record
- Increment passed_human, decrement issues

Update Tests section:
```
### {N}. {name}
expected: {expected}
automatable: {preserved}
verification_type: {preserved}
result: pass
auto_method: {preserved}
auto_evidence: "{preserved} [OVERRIDDEN by user]"
```

**If response indicates pass:**
- Empty response, "yes", "y", "ok", "pass", "next", "approved", "✓"

Update Tests section:
```
### {N}. {name}
expected: {expected}
automatable: {preserved}
verification_type: {preserved}
result: pass
```

Increment `passed_human` count.

**If response indicates skip:**
- "skip", "can't test", "n/a"

Update Tests section:
```
### {N}. {name}
expected: {expected}
automatable: {preserved}
verification_type: {preserved}
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
automatable: {preserved}
verification_type: {preserved}
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
  artifacts: []  # Filled by diagnosis
  missing: []    # Filled by diagnosis
```

**After any response:**

Update Summary counts (total passed = passed_auto + passed_human).
Update frontmatter.updated timestamp.

If more tests remain (pending or issue:auto not yet reviewed) → Update Current Test, go to `present_test`
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
git add ".planning/phases/XX-name/{phase}-UAT.md"
git commit -m "test({phase}): complete UAT - {passed} passed, {issues} issues"
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

**UAT with diagnoses:**
@.planning/phases/{phase_dir}/{phase}-UAT.md

**Project State:**
@.planning/STATE.md

**Roadmap:**
@.planning/ROADMAP.md

</planning_context>

<downstream_consumer>
Output consumed by /gsd:execute-phase
Plans must be executable prompts.
</downstream_consumer>
""",
  subagent_type="gsd-planner",
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

**Plans to verify:**
@.planning/phases/{phase_dir}/*-PLAN.md

</verification_context>

<expected_output>
Return one of:
- ## VERIFICATION PASSED — all checks pass
- ## ISSUES FOUND — structured issue list
</expected_output>
""",
  subagent_type="gsd-plan-checker",
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

**Existing plans:**
@.planning/phases/{phase_dir}/*-PLAN.md

**Checker issues:**
{structured_issues_from_checker}

</revision_context>

<instructions>
Read existing PLAN.md files. Make targeted updates to address checker issues.
Do NOT replan from scratch unless issues are fundamental.
</instructions>
""",
  subagent_type="gsd-planner",
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
- [ ] UAT file created with all tests from SUMMARY.md
- [ ] Tests categorized for automation potential (automatable, verification_type)
- [ ] If auto_enabled: config checked and available tools detected
- [ ] If tools available: automated tests executed with auto_method and auto_evidence
- [ ] Tests with pass:auto skipped in human verification
- [ ] Tests with issue:auto presented with evidence, override supported
- [ ] Human tests presented one at a time with expected behavior
- [ ] User responses processed as pass/issue/skip/override
- [ ] Severity inferred from description (never asked)
- [ ] Summary includes passed_auto, passed_human, automation_status
- [ ] Batched writes: on issue, every 5 passes, or completion
- [ ] Committed on completion
- [ ] If issues: parallel debug agents diagnose root causes
- [ ] If issues: gsd-planner creates fix plans (gap_closure mode)
- [ ] If issues: gsd-plan-checker verifies fix plans
- [ ] If issues: revision loop until plans pass (max 3 iterations)
- [ ] Ready for `/gsd:execute-phase --gaps-only` when complete
</success_criteria>
