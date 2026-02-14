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

Then verify each level against the actual codebase.
</core_principle>

<required_reading>
@C:/Users/connessn/.claude/get-shit-done/references/verification-patterns.md
@C:/Users/connessn/.claude/get-shit-done/templates/verification-report.md
@C:/Users/connessn/.claude/skills/pytest-cov/SKILL.md
</required_reading>

<process>

<step name="load_context" priority="first">
Load phase operation context:

```bash
INIT=$(node C:/Users/connessn/.claude/get-shit-done/bin/gsd-tools.js init phase-op "${PHASE_ARG}")
```

Extract from init JSON: `phase_dir`, `phase_number`, `phase_name`, `has_plans`, `plan_count`.

Then load phase details and list plans/summaries:
```bash
node C:/Users/connessn/.claude/get-shit-done/bin/gsd-tools.js roadmap get-phase "${phase_number}"
grep -E "^| ${phase_number}" .planning/REQUIREMENTS.md 2>/dev/null
ls "$phase_dir"/*-SUMMARY.md "$phase_dir"/*-PLAN.md 2>/dev/null
```

Extract **phase goal** from ROADMAP.md (the outcome to verify, not tasks) and **requirements** from REQUIREMENTS.md if it exists.
</step>

<step name="establish_must_haves">
**Option A: Must-haves in PLAN frontmatter**

Use gsd-tools to extract must_haves from each PLAN:

```bash
for plan in "$PHASE_DIR"/*-PLAN.md; do
  MUST_HAVES=$(node C:/Users/connessn/.claude/get-shit-done/bin/gsd-tools.js frontmatter get "$plan" --field must_haves)
  echo "=== $plan ===" && echo "$MUST_HAVES"
done
```

Returns JSON: `{ truths: [...], artifacts: [...], key_links: [...] }`

Aggregate all must_haves across plans for phase-level verification.

**Option B: Derive from phase goal**

If no must_haves in frontmatter (MUST_HAVES returns error or empty):
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
Use gsd-tools for artifact verification against must_haves in each PLAN:

```bash
for plan in "$PHASE_DIR"/*-PLAN.md; do
  ARTIFACT_RESULT=$(node C:/Users/connessn/.claude/get-shit-done/bin/gsd-tools.js verify artifacts "$plan")
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
</step>

<step name="verify_wiring">
Use gsd-tools for key link verification against must_haves in each PLAN:

```bash
for plan in "$PHASE_DIR"/*-PLAN.md; do
  LINKS_RESULT=$(node C:/Users/connessn/.claude/get-shit-done/bin/gsd-tools.js verify key-links "$plan")
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
grep -E "Phase ${PHASE_NUM}" .planning/REQUIREMENTS.md 2>/dev/null
```

For each requirement: parse description → identify supporting truths/artifacts → status: ✓ SATISFIED / ✗ BLOCKED / ? NEEDS HUMAN.
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

<step name="run_tests">
Check if Python tests exist, run coverage measurement, classify gaps, and track trend.

**1. Detect Python test files:**

~~~bash
ls tests/test_*.py tests/**/test_*.py 2>/dev/null | head -20
~~~

**If no test files found:** Skip this step. Record in verification report:
~~~markdown
## Test Execution
No Python test files found. Test execution skipped.
~~~

**If Python test files exist, proceed with steps 2-8:**

**2. Read coverage threshold from config:**

~~~bash
CONFIG_THRESHOLD=$(cat .planning/config.json 2>/dev/null | grep -A5 '"python"' | grep 'coverage_threshold' | grep -oE '[0-9]+')
THRESHOLD=${CONFIG_THRESHOLD:-80}
echo "THRESHOLD=$THRESHOLD"
~~~

**3. Run pytest with coverage (do NOT use --cov-fail-under):**

~~~bash
uv run pytest --cov --cov-branch --cov-report=term-missing tests/ 2>&1
echo "EXIT_CODE=$?"
~~~

The `--cov` without `=PATH` defers to pyproject.toml `[tool.coverage.run] source` (configured by Phase 2 scaffolding). Do NOT use `--cov-fail-under` -- it changes the exit code on low coverage, conflating test failure with low coverage.

**4. Parse output for:**
- Test results: N passed, M failed, K errors
- Statement coverage percentage (from the TOTAL line)
- Branch coverage percentage (from the branch coverage summary)
- Uncovered lines per file (from term-missing output, the "Missing" column)

**5. Determine test execution status:**
- EXIT_CODE=0 AND branch coverage >= threshold -> **PASS**
- EXIT_CODE=0 AND branch coverage < threshold -> **BELOW_THRESHOLD**
- EXIT_CODE!=0 -> **FAILED** (tests themselves failed, regardless of coverage)

**6. If BELOW_THRESHOLD -- run gap analysis:**

Use the pytest-cov skill methodology (loaded via required_reading `@C:/Users/connessn/.claude/skills/pytest-cov/SKILL.md`):

- Group uncovered lines by file from the term-missing output
- For each group: read the source code at those lines, identify the BEHAVIOR (not just line numbers)
- Classify each gap:

| Classification | Description | Recommended Action |
|---------------|-------------|-------------------|
| Untested behavior | Feature code with no test exercising it | TDD RED plan (Phase 5 gap closure) |
| Untested error path | Exception/error handler never triggered | TDD RED plan targeting exception |
| Untested branch | if/else with only one path tested | Parametrized test for other path |
| Dead code | Code that can never be reached | Remove (no test needed) |
| Infrastructure code | `__main__`, CLI entry points, debug code | `pragma: no cover` or omit config |

Record results in an "Uncovered Behaviors" table for the verification report.

**7. Record coverage in STATE.md for trend tracking:**

- Read STATE.md
- Find or create `## Coverage Trend` section (insert before `## Session Continuity` if creating)
- Append row with: phase name, statement coverage %, branch coverage %, threshold, delta from previous entry (or "-" if first entry)
- Write updated STATE.md

~~~markdown
## Coverage Trend

| Phase | Statement | Branch | Threshold | Delta |
|-------|-----------|--------|-----------|-------|
| {phase_name} | {stmt}% | {branch}% | {threshold}% | {delta or "-"} |
~~~

**8. Include results in VERIFICATION.md:**

Use the "Test Execution" section format from the verification-report.md template. The section includes: Framework, Command, Result, Statement Coverage, Branch Coverage, Threshold, Status, Coverage Trend table, Uncovered Behaviors table (if BELOW_THRESHOLD), and Gap Summary (if BELOW_THRESHOLD).
</step>

<step name="identify_human_verification">
**Always needs human:** Visual appearance, user flow completion, real-time behavior (WebSocket/SSE), external service integration, performance feel, error message clarity.

**Needs human if uncertain:** Complex wiring grep can't trace, dynamic state-dependent behavior, edge cases.

Format each as: Test Name → What to do → Expected result → Why can't verify programmatically.
</step>

<step name="determine_status">
**passed:** All truths VERIFIED, all artifacts pass levels 1-3, all key links WIRED, no blocker anti-patterns.

**gaps_found:** Any truth FAILED, artifact MISSING/STUB, key link NOT_WIRED, or blocker found.

**human_needed:** All automated checks pass but human verification items remain.

**Score:** `verified_truths / total_truths`

**Gap type sub-classification (when status is `gaps_found`):**

When status is `gaps_found`, additionally determine `gap_type`:

- **coverage:** The "## Test Execution" section exists with Status: BELOW_THRESHOLD AND at least one Uncovered Behavior is classified as "untested behavior", "untested error path", or "untested branch". No structural gaps (MISSING/STUB/NOT_WIRED) found.
- **structural:** Any truth FAILED, artifact MISSING/STUB, or key link NOT_WIRED. No coverage gaps or Test Execution status is not BELOW_THRESHOLD.
- **both:** Coverage gaps AND structural gaps coexist.
- **none:** Status is `passed` or `human_needed` (no gaps to classify).

Include `gap_type` in the return to orchestrator alongside status and score.

The orchestrator uses gap_type for routing:
- `coverage` -> automated coverage_gap_closure_loop
- `structural` -> manual `/gsd:plan-phase --gaps`
- `both` -> run coverage loop first, then prompt for structural gap closure
- `none` -> proceed normally
</step>

<step name="generate_fix_plans">
If gaps_found:

1. **Cluster related gaps:** API stub + component unwired → "Wire frontend to backend". Multiple missing → "Complete core implementation". Wiring only → "Connect existing components".

2. **Generate plan per cluster:** Objective, 2-3 tasks (files/action/verify each), re-verify step. Keep focused: single concern per plan.

3. **Order by dependency:** Fix missing → fix stubs → fix wiring → verify.
</step>

<step name="create_report">
```bash
REPORT_PATH="$PHASE_DIR/${PHASE_NUM}-VERIFICATION.md"
```

Fill template sections: frontmatter (phase/timestamp/status/score), goal achievement, artifact table, wiring table, requirements coverage, anti-patterns, human verification, gaps summary, fix plans (if gaps_found), metadata.

See C:/Users/connessn/.claude/get-shit-done/templates/verification-report.md for complete template.
</step>

<step name="return_to_orchestrator">
Return status (`passed` | `gaps_found` | `human_needed`), score (N/M must-haves), report path, AND gap_type (`coverage` | `structural` | `both` | `none`).

If gaps_found: list gaps + recommended fix plan names. Include gap_type in gap summary. If gap_type is `coverage` or `both`, note that automated gap closure is available.
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
- [ ] Anti-patterns scanned and categorized
- [ ] Human verification items identified
- [ ] Overall status determined
- [ ] Fix plans generated (if gaps_found)
- [ ] VERIFICATION.md created with complete report
- [ ] Results returned to orchestrator
</success_criteria>
