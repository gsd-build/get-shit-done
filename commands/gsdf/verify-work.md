---
name: gsdf:verify-work
description: Token-optimized user acceptance testing
argument-hint: "[phase number]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Edit
  - Write
  - Task
---

<objective>
Token-optimized version of `/gsd:verify-work`. Validates built features through conversational testing.

Output: {phase}-UAT.md tracking test results. If issues found: diagnosed gaps, fix plans ready.
</objective>

<context>
Phase: $ARGUMENTS (optional)
- If provided: Test specific phase
- If not provided: Check for active sessions or prompt for phase

@.planning/STATE.md
@.planning/ROADMAP.md
</context>

<process>

## Step 0: Resolve GSDF Model Profile

```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile_gsdf"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"')
[ -z "$MODEL_PROFILE" ] && MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| gsd-debugger-core | sonnet | sonnet | haiku |
| gsd-planner-core | opus | sonnet | sonnet |
| gsd-plan-checker | sonnet | sonnet | haiku |

## Step 1: Check for Active Sessions

```bash
ls .planning/phases/*-*/*-UAT.md 2>/dev/null | head -3
```

If active sessions exist, offer to resume or start new.

## Step 2: Find Phase SUMMARY Files

```bash
ls .planning/phases/${PHASE}-*/*-SUMMARY.md
```

Extract testable deliverables (user-observable outcomes) from SUMMARY.md files.

Also check REQUIREMENTS.md traceability:
```bash
# Find requirements mapped to this phase
grep "Phase ${PHASE}" .planning/REQUIREMENTS.md 2>/dev/null
```

Include requirement-based tests alongside feature-based tests.

## Step 3: Create UAT.md

Create `{phase}-UAT.md` with test list:
```markdown
---
phase: XX
status: in_progress
tests: N
passed: 0
failed: 0
---

# Phase {X} UAT

## Tests

- [ ] Test 1: [expected behavior]
- [ ] Test 2: [expected behavior]
```

## Step 4: Present Tests One at a Time

For each test:
1. Show expected behavior
2. Wait for plain text response
3. "yes/y/next" = pass, anything else = issue

**Do NOT use AskUserQuestion** — plain text conversation.

Infer severity from description:
- Broken functionality → critical
- Visual issue → minor
- Edge case → low

## Step 5: Update UAT.md After Each Response

Batch writes: on issue, every 5 passes, or completion.

## Step 6: On Completion

Check `COMMIT_PLANNING_DOCS` from config.json:
```bash
COMMIT_PLANNING_DOCS=$(cat .planning/config.json 2>/dev/null | grep -o '"commit_docs"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
git check-ignore -q .planning 2>/dev/null && COMMIT_PLANNING_DOCS=false
```

If `COMMIT_PLANNING_DOCS=true`: Commit UAT.md.

**If all pass:** Route based on status (see offer_next).

**If issues found:**

### 6a. Diagnose Issues

Spawn parallel debug agents:

```
Task(prompt="Diagnose root cause for: [issue description]

Symptoms: [from UAT]
Phase: [phase number]
Requirements: [mapped REQ-IDs from ROADMAP.md for this phase]

Return: ROOT CAUSE FOUND with evidence
", subagent_type="gsd-debugger-core", model="{debugger_model}", description="Diagnose: [issue]")
```

### 6b. Create Fix Plans

Spawn planner for fix plans:

```
Task(prompt="Create fix plans from diagnosed gaps.

Gaps: [from debug agents]
Phase directory: .planning/phases/{phase_dir}/

Write fix plans with gap_closure: true in frontmatter, return PLANNING COMPLETE.
", subagent_type="gsd-planner-core", model="{planner_model}", description="Plan fixes")
```

### 6c. Verify Fix Plans (Max 3 Iterations)

Spawn gsd-plan-checker to verify fix plans:

```
Task(prompt="Verify fix plans address the diagnosed gaps.

Plans: [fix plan content]
Gaps: [diagnosed gaps]

Return VERIFICATION PASSED or ISSUES FOUND.
", subagent_type="gsd-plan-checker", model="{checker_model}", description="Verify fix plans")
```

**If ISSUES FOUND and iteration < 3:** Re-spawn planner with checker feedback, then re-check.
**If ISSUES FOUND and iteration >= 3:** Present remaining issues, offer manual intervention.

## Step 7: Present Results

Route based on status (see offer_next).

</process>

<anti_patterns>
- Don't use AskUserQuestion for test responses
- Don't ask severity — infer from description
- Don't present full checklist upfront
- Don't run automated tests — manual user validation
- Don't fix issues during testing — log as gaps, diagnose after all tests complete
</anti_patterns>

<offer_next>
Output this markdown directly. Route based on UAT results:

| Status | Route |
|--------|-------|
| All tests pass + more phases | Route A (next phase) |
| All tests pass + last phase | Route B (milestone complete) |
| Issues found + fix plans ready | Route C (execute fixes) |
| Issues found + planning blocked | Route D (manual intervention) |

---

**Route A: All tests pass, more phases remain**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSDF ► PHASE {Z} VERIFIED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {Z}: {Name}**

{N}/{N} tests passed
UAT complete ✓

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Phase {Z+1}: {Name}** — {Goal from ROADMAP.md}

/gsd:discuss-phase {Z+1} — gather context and clarify approach

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────

**Also available:**
- /gsdf:plan-phase {Z+1} — skip discussion, plan directly
- /gsdf:execute-phase {Z+1} — skip to execution (if already planned)

───────────────────────────────────────────────────────────────

---

**Route B: All tests pass, milestone complete**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSDF ► PHASE {Z} VERIFIED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{N}/{N} tests passed
Final phase verified ✓

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Audit milestone** — verify requirements, cross-phase integration, E2E flows

/gsdf:audit-milestone

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────

**Also available:**
- /gsd:complete-milestone — skip audit, archive directly

───────────────────────────────────────────────────────────────

---

**Route C: Issues found, fix plans ready**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSDF ► PHASE {Z} ISSUES FOUND ⚠
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {Z}: {Name}**

{N}/{M} tests passed
{X} issues diagnosed
Fix plans verified ✓

### Issues Found

{List issues with severity from UAT.md}

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Execute fix plans** — run diagnosed fixes

/gsdf:execute-phase {Z} --gaps-only

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────

**Also available:**
- cat .planning/phases/{phase_dir}/*-PLAN.md — review fix plans
- /gsdf:plan-phase {Z} --gaps — regenerate fix plans

───────────────────────────────────────────────────────────────

---

**Route D: Issues found, planning blocked**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSDF ► PHASE {Z} BLOCKED ✗
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {Z}: {Name}**

{N}/{M} tests passed
Fix planning blocked after {X} iterations

### Unresolved Issues

{List blocking issues}

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Manual intervention required**

Review the issues above and either:
1. Provide guidance for fix planning
2. Manually address blockers
3. Accept current state and continue

───────────────────────────────────────────────────────────────

**Options:**
- /gsdf:plan-phase {Z} --gaps — retry fix planning with guidance
- /gsd:discuss-phase {Z} — gather more context before replanning

───────────────────────────────────────────────────────────────
</offer_next>

<success_criteria>
- [ ] UAT.md created with tests
- [ ] Tests presented one at a time
- [ ] Plain text responses
- [ ] Severity inferred
- [ ] Committed on completion
- [ ] Issues diagnosed if found
- [ ] Fix plans created if needed
- [ ] Fix plans verified by plan-checker (max 3 iterations)
- [ ] Ready for `/gsdf:execute-phase --gaps-only` when complete
</success_criteria>
