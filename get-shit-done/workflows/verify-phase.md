<purpose>
Verify phase goal achievement through goal-backward analysis. Check that the codebase delivers what the phase promised, not just that tasks completed.

Executed by a verification subagent spawned from execute-phase.md.
</purpose>

<core_principle>
**Task completion ≠ Goal achievement**

A task "create chat component" can be marked complete when the component is a placeholder. The task was done — but the goal "working chat interface" was not achieved.

Goal-backward verification:
1. What must be TRUE for the goal to be achieved?
2. What must EXIST for those truths to hold?
3. What must be WIRED for those artifacts to function?
4. What must TESTS PROVE for those truths to be evidenced?

Then verify each level against the actual codebase.
</core_principle>

<required_reading>
@~/.claude/get-shit-done/references/verification-patterns.md
@~/.claude/get-shit-done/templates/verification-report.md
</required_reading>

<process>

<step name="load_context" priority="first">
Load phase operation context:

```bash
INIT=$(gsd-sdk query init.phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Extract from init JSON: `phase_dir`, `phase_number`, `phase_name`, `has_plans`, `plan_count`.

Then load phase details and list plans/summaries:
```bash
gsd-sdk query roadmap.get-phase "${phase_number}"
grep -E "^| ${phase_number}" .planning/REQUIREMENTS.md 2>/dev/null || true
ls "$phase_dir"/*-SUMMARY.md "$phase_dir"/*-PLAN.md 2>/dev/null || true
```

Load full milestone phases for deferred-item filtering (Step 9b):
```bash
gsd-sdk query roadmap.analyze
```

Extract **phase goal** from ROADMAP.md (the outcome to verify, not tasks), **requirements** from REQUIREMENTS.md if it exists, and **all milestone phases** from roadmap analyze (for cross-referencing gaps against later phases).
</step>

<step name="establish_must_haves">
**Option A: Must-haves in PLAN frontmatter**

Use `gsd-sdk query` verify handlers (or legacy gsd-tools) to extract must_haves from each PLAN:

```bash
for plan in "$PHASE_DIR"/*-PLAN.md; do
  MUST_HAVES=$(gsd-sdk query frontmatter.get "$plan" --field must_haves)
  echo "=== $plan ===" && echo "$MUST_HAVES"
done
```

Returns JSON: `{ truths: [...], artifacts: [...], key_links: [...] }`

Aggregate all must_haves across plans for phase-level verification.

**Option B: Use Success Criteria from ROADMAP.md**

If no must_haves in frontmatter (MUST_HAVES returns error or empty), check for Success Criteria:

```bash
PHASE_DATA=$(gsd-sdk query roadmap.get-phase "${phase_number}" --raw)
```

Parse the `success_criteria` array from the JSON output. If non-empty:
1. Use each Success Criterion directly as a **truth** (they are already written as observable, testable behaviors)
2. Derive **artifacts** (concrete file paths for each truth)
3. Derive **key links** (critical wiring where stubs hide)
4. Document the must-haves before proceeding

Success Criteria from ROADMAP.md are the contract — they override PLAN-level must_haves when both exist.

**Option C: Derive from phase goal (fallback)**

If no must_haves in frontmatter AND no Success Criteria in ROADMAP:
1. State the goal from ROADMAP.md
2. Derive **truths** (3-7 observable behaviors, each testable)
3. Derive **artifacts** (concrete file paths for each truth)
4. Derive **key links** (critical wiring where stubs hide)
5. Document derived must-haves before proceeding
</step>

<step name="verify_truths">
For each observable truth, determine if the codebase enables it.

**Status:** ✓ VERIFIED (all supporting artifacts pass) | ✗ FAILED (artifact missing/stub/unwired) | ? UNCERTAIN (needs human)

For each truth: identify supporting artifacts → check artifact status → check wiring → determine truth status.

**Example:** Truth "User can see existing messages" depends on Chat.tsx (renders), /api/chat GET (provides), Message model (schema). If Chat.tsx is a stub or API returns hardcoded [] → FAILED. If all exist, are substantive, and connected → VERIFIED.
</step>

<step name="verify_artifacts">
Use `gsd-sdk query verify.artifacts` (or legacy gsd-tools) for artifact verification against must_haves in each PLAN:

```bash
for plan in "$PHASE_DIR"/*-PLAN.md; do
  ARTIFACT_RESULT=$(gsd-sdk query verify.artifacts "$plan")
  echo "=== $plan ===" && echo "$ARTIFACT_RESULT"
done
```

Parse JSON result: `{ all_passed, passed, total, artifacts: [{path, exists, issues, passed}] }`

**Artifact status from result:**
- `exists=false` → MISSING
- `issues` not empty → STUB (check issues for "Only N lines" or "Missing pattern")
- `passed=true` → VERIFIED (Levels 1-2 pass)

**Level 3 — Wired (manual check for artifacts that pass Levels 1-2):**
```bash
grep -r "import.*$artifact_name" src/ --include="*.ts" --include="*.tsx"  # IMPORTED
grep -r "$artifact_name" src/ --include="*.ts" --include="*.tsx" | grep -v "import"  # USED
```
WIRED = imported AND used. ORPHANED = exists but not imported/used.

| Exists | Substantive | Wired | Status |
|--------|-------------|-------|--------|
| ✓ | ✓ | ✓ | ✓ VERIFIED |
| ✓ | ✓ | ✗ | ⚠️ ORPHANED |
| ✓ | ✗ | - | ✗ STUB |
| ✗ | - | - | ✗ MISSING |

**Export-level spot check (WARNING severity):**

For artifacts that pass Level 3, spot-check individual exports:
- Extract key exported symbols (functions, constants, classes — skip types/interfaces)
- For each, grep for usage outside the defining file
- Flag exports with zero external call sites as "exported but unused"

This catches dead stores like `setPlan()` that exist in a wired file but are
never actually called. Report as WARNING — may indicate incomplete cross-plan
wiring or leftover code from plan revisions.
</step>

<step name="verify_wiring">
Use `gsd-sdk query verify.key-links` (or legacy gsd-tools) for key link verification against must_haves in each PLAN:

```bash
for plan in "$PHASE_DIR"/*-PLAN.md; do
  LINKS_RESULT=$(gsd-sdk query verify.key-links "$plan")
  echo "=== $plan ===" && echo "$LINKS_RESULT"
done
```

Parse JSON result: `{ all_verified, verified, total, links: [{from, to, via, verified, detail}] }`

**Link status from result:**
- `verified=true` → WIRED
- `verified=false` with "not found" → NOT_WIRED
- `verified=false` with "Pattern not found" → PARTIAL

**Fallback patterns (if key_links not in must_haves):**

| Pattern | Check | Status |
|---------|-------|--------|
| Component → API | fetch/axios call to API path, response used (await/.then/setState) | WIRED / PARTIAL (call but unused response) / NOT_WIRED |
| API → Database | Prisma/DB query on model, result returned via res.json() | WIRED / PARTIAL (query but not returned) / NOT_WIRED |
| Form → Handler | onSubmit with real implementation (fetch/axios/mutate/dispatch), not console.log/empty | WIRED / STUB (log-only/empty) / NOT_WIRED |
| State → Render | useState variable appears in JSX (`{stateVar}` or `{stateVar.property}`) | WIRED / NOT_WIRED |

Record status and evidence for each key link.
</step>

<step name="verify_requirements">
If REQUIREMENTS.md exists:
```bash
grep -E "Phase ${PHASE_NUM}" .planning/REQUIREMENTS.md 2>/dev/null || true
```

For each requirement: parse description → identify supporting truths/artifacts → status: ✓ SATISFIED / ✗ BLOCKED / ? NEEDS HUMAN.
</step>

<step name="verify_decisions">
**Decision coverage validation gate (issue #2492).**

After requirements coverage, also check that each trackable CONTEXT.md
`<decisions>` entry shows up somewhere in the shipped artifacts (plans,
SUMMARY.md, files modified by the phase, or recent commit subjects on the
phase branch).

This gate is **non-blocking / warning only** by deliberate asymmetry with
the plan-phase translation gate. The plan-phase gate already blocked at
translation time, so by the time verification runs every decision has
either been translated or explicitly deferred. This gate's job is to
surface decisions that *were* translated but vanished during execution —
that's a soft signal because "honors a decision" is a fuzzy substring
heuristic, and we don't want a paraphrase miss to fail an otherwise good
phase.

**Skip if** `workflow.context_coverage_gate` is explicitly set to `false`
(absent key = enabled). Also skip cleanly when CONTEXT.md is missing or has
no `<decisions>` block.

```bash
GATE_CFG=$(gsd-sdk query config-get workflow.context_coverage_gate 2>/dev/null || echo "true")
if [ "$GATE_CFG" != "false" ]; then
  # Discover the phase CONTEXT.md via glob expansion rather than `ls | head`
  # (review F17 / ShellCheck SC2012). Globs preserve filenames containing
  # spaces and avoid an extra subprocess.
  CONTEXT_PATH=""
  for f in "${PHASE_DIR}"/*-CONTEXT.md; do
    [ -e "$f" ] && CONTEXT_PATH="$f" && break
  done
  DECISION_RESULT=$(gsd-sdk query check.decision-coverage-verify "${PHASE_DIR}" "${CONTEXT_PATH}")
fi
```

The handler returns JSON `{ skipped, blocking: false, total, honored,
not_honored: [...], message }`.

**Reporting:** Append the handler's `message` (a `### Decision Coverage`
section) to VERIFICATION.md regardless of outcome — even when all
decisions are honored, recording the count helps reviewers spot drift over
time. Set `decision_coverage` in the verification result to
`{honored, total, not_honored: [...]}` so downstream tooling can read it.

**Status impact:** none. The decision gate does NOT influence the
`gaps_found` / `human_needed` / `passed` decision tree in
`determine_status`. Its findings are warnings the user reviews and may act
on by re-opening the phase or by acknowledging the decision was abandoned
intentionally.
</step>

<step name="behavioral_verification">
**Run the project's test suite and CLI commands to verify behavior, not just structure.**

Static checks (grep, file existence, wiring) catch structural gaps but miss runtime
failures. This step runs actual tests and project commands to verify the phase goal
is behaviorally achieved.

This follows Anthropic's harness engineering principle: separating generation from
evaluation, with the evaluator interacting with the running system rather than
inspecting static artifacts.

**Step 1: Run test suite**

```bash
# Resolve test command: project config > Makefile > language sniff
TEST_CMD=$(gsd-sdk query config-get workflow.test_command --default "" 2>/dev/null || true)
if [ -z "$TEST_CMD" ]; then
  if [ -f "Makefile" ] && grep -q "^test:" Makefile; then
    TEST_CMD="make test"
  elif [ -f "Justfile" ] || [ -f "justfile" ]; then
    TEST_CMD="just test"
  elif [ -f "package.json" ]; then
    TEST_CMD="npm test"
  elif [ -f "Cargo.toml" ]; then
    TEST_CMD="cargo test"
  elif [ -f "go.mod" ]; then
    TEST_CMD="go test ./..."
  elif [ -f "pyproject.toml" ] || [ -f "requirements.txt" ]; then
    TEST_CMD="python -m pytest -q --tb=short 2>&1 || uv run python -m pytest -q --tb=short"
  else
    TEST_CMD="false"
    echo "⚠ No test runner detected — skipping test suite"
  fi
fi
# Detect test runner and run all tests (timeout: 5 minutes)
TEST_EXIT=0
timeout 300 bash -c "$TEST_CMD" 2>&1
TEST_EXIT=$?
if [ "${TEST_EXIT}" -eq 0 ]; then
  echo "✓ Test suite passed"
elif [ "${TEST_EXIT}" -eq 124 ]; then
  echo "⚠ Test suite timed out after 5 minutes"
else
  echo "✗ Test suite failed (exit code ${TEST_EXIT})"
fi
```

Record: total tests, passed, failed, coverage (if available).

**If any tests fail:** Mark as `behavioral_failures` — these are BLOCKER severity
regardless of whether static checks passed. A phase cannot be verified if tests fail.

**Step 2: Run project CLI/commands from success criteria (if testable)**

For each success criterion that describes a user command (e.g., "User can run
`mixtiq validate`", "User can run `npm start`"):

1. Check if the command exists and required inputs are available:
   - Look for example files in `templates/`, `fixtures/`, `test/`, `examples/`, or `testdata/`
   - Check if the CLI binary/script exists on PATH or in the project
2. **If no suitable inputs or fixtures exist:** Mark as `? NEEDS HUMAN` with reason
   "No test fixtures available — requires manual verification" and move on.
   Do NOT invent example inputs.
3. If inputs are available: run the command and verify it exits successfully.

```bash
# Only run if both command and input exist
if command -v {project_cli} &>/dev/null && [ -f "{example_input}" ]; then
  {project_cli} {example_input} 2>&1
fi
```

Record: command, exit code, output summary, pass/fail (or SKIPPED if no fixtures).

**Step 3: Report**

```
## Behavioral Verification

| Check | Result | Detail |
|-------|--------|--------|
| Test suite | {N} passed, {M} failed | {first failure if any} |
| {CLI command 1} | ✓ / ✗ | {output summary} |
| {CLI command 2} | ✓ / ✗ | {output summary} |
```

**If all behavioral checks pass:** Continue to scan_antipatterns.
**If any fail:** Add to verification gaps with BLOCKER severity.
</step>

<step name="scan_antipatterns">
Extract files modified in this phase from SUMMARY.md, scan each:

| Pattern | Search | Severity |
|---------|--------|----------|
| TODO/FIXME/XXX/HACK | `grep -n -E "TODO\|FIXME\|XXX\|HACK"` | ⚠️ Warning |
| Placeholder content | `grep -n -iE "placeholder\|coming soon\|will be here"` | 🛑 Blocker |
| Empty returns | `grep -n -E "return null\|return \{\}\|return \[\]\|=> \{\}"` | ⚠️ Warning |
| Log-only functions | Functions containing only console.log | ⚠️ Warning |

Categorize: 🛑 Blocker (prevents goal) | ⚠️ Warning (incomplete) | ℹ️ Info (notable).
</step>

<step name="audit_test_quality">
**Verify that tests PROVE what they claim to prove.**

This step catches test-level deceptions that pass all prior checks: files exist, are substantive, are wired, and tests pass — but the tests don't actually validate the requirement.

**1. Identify requirement-linked test files**

From PLAN and SUMMARY files, map each requirement to the test files that are supposed to prove it.

**2. Disabled test scan**

For ALL test files linked to requirements, search for disabled/skipped patterns:

```bash
grep -rn -E "it\.skip|describe\.skip|test\.skip|xit\(|xdescribe\(|xtest\(|@pytest\.mark\.skip|@unittest\.skip|#\[ignore\]|\.pending|it\.todo|test\.todo" "$TEST_FILE"
```

**Rule:** A disabled test linked to a requirement = requirement NOT tested.
- 🛑 BLOCKER if the disabled test is the only test proving that requirement
- ⚠️ WARNING if other active tests also cover the requirement

**3. Circular test detection**

Search for scripts/utilities that generate expected values by running the system under test:

```bash
grep -rn -E "writeFileSync|writeFile|fs\.write|open\(.*w\)" "$TEST_DIRS"
```

For each match, check if it also imports the system/service/module being tested. If a script both imports the system-under-test AND writes expected output values → CIRCULAR.

**Circular test indicators:**
- Script imports a service AND writes to fixture files
- Expected values have comments like "computed from engine", "captured from baseline"
- Script filename contains "capture", "baseline", "generate", "snapshot" in test context
- Expected values were added in the same commit as the test assertions

**Rule:** A test comparing system output against values generated by the same system is circular. It proves consistency, not correctness.

**4. Expected value provenance** (for comparison/parity/migration requirements)

When a requirement demands comparison with an external source ("identical to X", "matches Y", "same output as Z"):

- Is the external source actually invoked or referenced in the test pipeline?
- Do fixture files contain data sourced from the external system?
- Or do all expected values come from the new system itself or from mathematical formulas?

**Provenance classification:**
- VALID: Expected value from external/legacy system output, manual capture, or independent oracle
- PARTIAL: Expected value from mathematical derivation (proves formula, not system match)
- CIRCULAR: Expected value from the system being tested
- UNKNOWN: No provenance information — treat as SUSPECT

**5. Assertion strength**

For each test linked to a requirement, classify the strongest assertion:

| Level | Examples | Proves |
|-------|---------|--------|
| Existence | `toBeDefined()`, `!= null` | Something returned |
| Type | `typeof x === 'number'` | Correct shape |
| Status | `code === 200` | No error |
| Value | `toEqual(expected)`, `toBeCloseTo(x)` | Specific value |
| Behavioral | Multi-step workflow assertions | End-to-end correctness |

If a requirement demands value-level or behavioral-level proof and the test only has existence/type/status assertions → INSUFFICIENT.

**6. Coverage quantity**

If a requirement specifies a quantity of test cases (e.g., "30 calculations"), check if the actual number of active (non-skipped) test cases meets the requirement.

**Reporting — add to VERIFICATION.md:**

```markdown
### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|----------------|---------|

**Disabled tests on requirements:** {N} → {BLOCKER if any req has ONLY disabled tests}
**Circular patterns detected:** {N} → {BLOCKER if any}
**Insufficient assertions:** {N} → {WARNING}
```

**Impact on status:** Any BLOCKER from test quality audit ��� overall status = `gaps_found`, regardless of other checks passing.
</step>

<step name="identify_human_verification">
**First: determine if this is an infrastructure/foundation phase.**

Infrastructure and foundation phases — code foundations, database schema, internal APIs, data models, build tooling, CI/CD, internal service integrations — have no user-facing elements by definition. For these phases:

- Do NOT invent artificial manual steps (e.g., "manually run git commits", "manually invoke methods", "manually check database state").
- Mark human verification as **N/A** with rationale: "Infrastructure/foundation phase — no user-facing elements to test manually."
- Set `human_verification: []` and do **not** produce a `human_needed` status solely due to lack of user-facing features.
- Only add human verification items if the phase goal or success criteria explicitly describe something a user would interact with (UI, CLI command output visible to end users, external service UX).

**How to determine if a phase is infrastructure/foundation:**
- Phase goal or name contains: "foundation", "infrastructure", "schema", "database", "internal API", "data model", "scaffolding", "pipeline", "tooling", "CI", "migrations", "service layer", "backend", "core library"
- Phase success criteria describe only technical artifacts (files exist, tests pass, schema is valid) with no user interaction required
- There is no UI, CLI output visible to end users, or real-time behavior to observe

**If the phase IS infrastructure/foundation:** auto-pass UAT — skip the human verification items list entirely. Log:

```markdown
## Human Verification

N/A — Infrastructure/foundation phase with no user-facing elements.
All acceptance criteria are verifiable programmatically.
```

**If the phase IS user-facing:** Only flag items that genuinely require a human. Do not invent steps.

**Always needs human (user-facing phases only):** Visual appearance, user flow completion, real-time behavior (WebSocket/SSE), external service integration, performance feel, error message clarity.

**Needs human if uncertain (user-facing phases only):** Complex wiring grep can't trace, dynamic state-dependent behavior, edge cases.

Format each as: Test Name → What to do → Expected result → Why can't verify programmatically.
</step>

<step name="determine_status">
Classify status using this decision tree IN ORDER (most restrictive first):

1. IF any truth FAILED, artifact MISSING/STUB, key link NOT_WIRED, blocker found, **or test quality audit found blockers (disabled requirement tests, circular tests)**:
   → **gaps_found**

2. IF the previous step produced ANY human verification items:
   → **human_needed** (even if all truths VERIFIED and score is N/N)

3. IF all checks pass AND no human verification items:
   → **passed**

**passed is ONLY valid when no human verification items exist.**

**Score:** `verified_truths / total_truths`
</step>

<step name="filter_deferred_items">
Before reporting gaps, cross-reference each gap against later phases in the milestone using the full roadmap data loaded in load_context (from `roadmap analyze`).

For each potential gap identified in determine_status:
1. Check if the gap's failed truth or missing item is covered by a later phase's goal or success criteria
2. **Match criteria:** The gap's concern appears in a later phase's goal text, success criteria text, or the later phase's name clearly suggests it covers this area
3. If a clear match is found → move the gap to a `deferred` list with the matching phase reference and evidence text
4. If no match in any later phase → keep as a real `gap`

**Important:** Be conservative. Only defer a gap when there is clear, specific evidence in a later phase. Vague or tangential matches should NOT cause deferral — when in doubt, keep it as a real gap.

**Deferred items do NOT affect the status determination.** Recalculate after filtering:
- If gaps list is now empty and no human items exist → `passed`
- If gaps list is now empty but human items exist → `human_needed`
- If gaps list still has items → `gaps_found`

Include deferred items in VERIFICATION.md frontmatter (`deferred:` section) and body (Deferred Items table) for transparency. If no deferred items exist, omit these sections.
</step>

<step name="generate_fix_plans">
If gaps_found:

1. **Cluster related gaps:** API stub + component unwired → "Wire frontend to backend". Multiple missing → "Complete core implementation". Wiring only → "Connect existing components".

2. **Generate plan per cluster:** Objective, 2-3 tasks (files/action/verify each), re-verify step. Keep focused: single concern per plan.

3. **Order by dependency:** Fix missing → fix stubs → fix wiring → **fix test evidence** → verify.
</step>

<step name="create_report">
```bash
REPORT_PATH="$PHASE_DIR/${PHASE_NUM}-VERIFICATION.md"
```

Fill template sections: frontmatter (phase/timestamp/status/score), goal achievement, artifact table, wiring table, requirements coverage, anti-patterns, human verification, gaps summary, fix plans (if gaps_found), metadata.

See ~/.claude/get-shit-done/templates/verification-report.md for complete template.
</step>

<step name="return_to_orchestrator">
Return status (`passed` | `gaps_found` | `human_needed`), score (N/M must-haves), report path.

If gaps_found: list gaps + recommended fix plan names.
If human_needed: list items requiring human testing.

Orchestrator routes: `passed` → update_roadmap | `gaps_found` → create/execute fixes, re-verify | `human_needed` → present to user.
</step>

</process>

<success_criteria>
- [ ] Must-haves established (from frontmatter or derived)
- [ ] All truths verified with status and evidence
- [ ] All artifacts checked at all three levels
- [ ] All key links verified
- [ ] Requirements coverage assessed (if applicable)
- [ ] CONTEXT.md decisions checked against shipped artifacts (#2492 — non-blocking)
- [ ] Anti-patterns scanned and categorized
- [ ] Test quality audited (disabled tests, circular patterns, assertion strength, provenance)
- [ ] Human verification items identified
- [ ] Overall status determined
- [ ] Deferred items filtered against later milestone phases (if gaps found)
- [ ] Fix plans generated (if gaps_found after filtering)
- [ ] VERIFICATION.md created with complete report
- [ ] Results returned to orchestrator
</success_criteria>
