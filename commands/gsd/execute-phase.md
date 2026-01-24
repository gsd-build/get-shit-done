---
name: gsd:execute-phase
description: Execute all plans in a phase with wave-based parallelization
argument-hint: "<phase-number> [--gaps-only]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - TodoWrite
  - AskUserQuestion
---

<objective>
Execute all plans in a phase using wave-based parallel execution.

Orchestrator stays lean: discover plans, analyze dependencies, group into waves, spawn subagents, collect results. Each subagent loads the full execute-plan context and handles its own plan.

Context budget: ~15% orchestrator, 100% fresh per subagent.
</objective>

<execution_context>
@~/.claude/get-shit-done/references/ui-brand.md
@~/.claude/get-shit-done/workflows/execute-phase.md
@~/.claude/get-shit-done/utilities/task-timeout.md
</execution_context>

<artifact_checking>
Helper function for verifying agent outputs:

```bash
check_artifacts() {
  local artifacts=("$@")
  local all_exist=true
  for artifact in "${artifacts[@]}"; do
    if [[ ! -f "$artifact" ]]; then
      echo "Missing: $artifact" >&2
      all_exist=false
    fi
  done
  echo "$all_exist"
}
```
</artifact_checking>

<context>
Phase: $ARGUMENTS

**Flags:**
- `--gaps-only` — Execute only gap closure plans (plans with `gap_closure: true` in frontmatter). Use after verify-work creates fix plans.

@.planning/ROADMAP.md
@.planning/STATE.md
@~/.claude/get-shit-done/references/state-derivation.md

**Parallel safety note:** Plan discovery uses state derivation (SUMMARY.md existence = complete). Two terminals can execute different phases simultaneously without race conditions.
</context>

<process>
0. **Resolve Model Profile and Timeouts**

   Read model profile and timeout configuration for agent spawning:
   ```bash
   MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")

   # Read timeout config (defaults from task-timeout.md)
   EXECUTOR_TIMEOUT=$(cat .planning/config.json 2>/dev/null | grep -o '"executor"[[:space:]]*:[[:space:]]*[0-9]*' | grep -o '[0-9]*' || echo "600000")
   VERIFIER_TIMEOUT=$(cat .planning/config.json 2>/dev/null | grep -o '"verifier"[[:space:]]*:[[:space:]]*[0-9]*' | grep -o '[0-9]*' || echo "180000")
   ```

   Default to "balanced" if not set.

   **Model lookup table:**

   | Agent | quality | balanced | budget |
   |-------|---------|----------|--------|
   | gsd-executor | opus | sonnet | sonnet |
   | gsd-verifier | sonnet | sonnet | haiku |

   Store resolved models and timeouts for use in Task calls below.

1. **Validate phase exists**
   - Find phase directory matching argument
   - Count PLAN.md files
   - Error if no plans found

2. **Discover plans**
   - List all *-PLAN.md files in phase directory
   - Check which have *-SUMMARY.md (already complete)
   - If `--gaps-only`: filter to only plans with `gap_closure: true`
   - Build list of incomplete plans

3. **Group by wave**
   - Read `wave` from each plan's frontmatter
   - Group plans by wave number
   - Report wave structure to user

4. **Execute waves**
   For each wave in order:
   - Spawn `gsd-executor` for each plan in wave (parallel Task calls)
   - Wait for completion (Task blocks)
   - Verify SUMMARYs created
   - Proceed to next wave

5. **Aggregate results**
   - Collect summaries from all plans
   - Report phase completion status

6. **Commit any orchestrator corrections**
   Check for uncommitted changes before verification:
   ```bash
   git status --porcelain
   ```

   **If changes exist:** Orchestrator made corrections between executor completions. Commit them:
   ```bash
   git add -u && git commit -m "fix({phase}): orchestrator corrections"
   ```

   **If clean:** Continue to verification.

7. **Verify phase goal**
   Check config: `WORKFLOW_VERIFIER=$(cat .planning/config.json 2>/dev/null | grep -o '"verifier"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")`

   **If `workflow.verifier` is `false`:** Skip to step 8 (treat as passed).

   **Otherwise:**

   ```bash
   # Define expected artifact
   EXPECTED_ARTIFACTS=("${PHASE_DIR}/${PHASE}-VERIFICATION.md")

   # Report to user
   EXPECTED_DURATION_MIN=$((VERIFIER_TIMEOUT / 60000))
   echo "Starting gsd-verifier agent..."
   echo "Expected duration: ${EXPECTED_DURATION_MIN} minutes"
   echo "Expected output: ${PHASE}-VERIFICATION.md"
   START_TIME=$(date +%s)
   ```

   - Spawn `gsd-verifier` subagent with phase directory and goal

   ```bash
   # After Task() returns
   END_TIME=$(date +%s)
   ACTUAL_DURATION_S=$((END_TIME - START_TIME))
   echo "Verifier completed in ${ACTUAL_DURATION_S}s"

   # Check artifact
   if [[ ! -f "${PHASE_DIR}/${PHASE}-VERIFICATION.md" ]]; then
     echo "Verifier did not produce VERIFICATION.md"
   fi
   ```
   - Verifier checks must_haves against actual codebase (not SUMMARY claims)
   - Creates VERIFICATION.md with detailed report
   - Route by status:
     - `passed` → continue to step 8
     - `human_needed` → present items, get approval or feedback
     - `gaps_found` → present gaps, offer `/gsd:plan-phase {X} --gaps`

8. **Update roadmap and state**
   - Update ROADMAP.md, STATE.md

9. **Update requirements**
   Mark phase requirements as Complete:
   - Read ROADMAP.md, find this phase's `Requirements:` line (e.g., "AUTH-01, AUTH-02")
   - Read REQUIREMENTS.md traceability table
   - For each REQ-ID in this phase: change Status from "Pending" to "Complete"
   - Write updated REQUIREMENTS.md
   - Skip if: REQUIREMENTS.md doesn't exist, or phase has no Requirements line

10. **Commit phase completion**
    Check `COMMIT_PLANNING_DOCS` from config.json (default: true).
    If false: Skip git operations for .planning/ files.
    If true: Bundle all phase metadata updates in one commit:
    - Stage: `git add .planning/ROADMAP.md .planning/STATE.md`
    - Stage REQUIREMENTS.md if updated: `git add .planning/REQUIREMENTS.md`
    - Commit: `docs({phase}): complete {phase-name} phase`

11. **Offer next steps**
    - Route to next action (see `<offer_next>`)
</process>

<offer_next>
Output this markdown directly (not as a code block). Route based on status:

| Status | Route |
|--------|-------|
| `gaps_found` | Route C (gap closure) |
| `human_needed` | Present checklist, then re-route based on approval |
| `passed` + more phases | Route A (next phase) |
| `passed` + last phase | Route B (milestone complete) |

---

**Route A: Phase verified, more phases remain**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PHASE {Z} COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {Z}: {Name}**

{Y} plans executed
Goal verified ✓

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Phase {Z+1}: {Name}** — {Goal from ROADMAP.md}

/gsd:discuss-phase {Z+1} — gather context and clarify approach

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────

**Also available:**
- /gsd:plan-phase {Z+1} — skip discussion, plan directly
- /gsd:verify-work {Z} — manual acceptance testing before continuing

───────────────────────────────────────────────────────────────

---

**Route B: Phase verified, milestone complete**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► MILESTONE COMPLETE 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**v1.0**

{N} phases completed
All phase goals verified ✓

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Audit milestone** — verify requirements, cross-phase integration, E2E flows

/gsd:audit-milestone

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────

**Also available:**
- /gsd:verify-work — manual acceptance testing
- /gsd:complete-milestone — skip audit, archive directly

───────────────────────────────────────────────────────────────

---

**Route C: Gaps found — need additional planning**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PHASE {Z} GAPS FOUND ⚠
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {Z}: {Name}**

Score: {N}/{M} must-haves verified
Report: .planning/phases/{phase_dir}/{phase}-VERIFICATION.md

### What's Missing

{Extract gap summaries from VERIFICATION.md}

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Plan gap closure** — create additional plans to complete the phase

/gsd:plan-phase {Z} --gaps

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────

**Also available:**
- cat .planning/phases/{phase_dir}/{phase}-VERIFICATION.md — see full report
- /gsd:verify-work {Z} — manual testing before planning

───────────────────────────────────────────────────────────────

---

After user runs /gsd:plan-phase {Z} --gaps:
1. Planner reads VERIFICATION.md gaps
2. Creates plans 04, 05, etc. to close gaps
3. User runs /gsd:execute-phase {Z} again
4. Execute-phase runs incomplete plans (04, 05...)
5. Verifier runs again → loop until passed
</offer_next>

<wave_execution>
**Parallel spawning:**

Before spawning, read file contents. The `@` syntax does not work across Task() boundaries.

```bash
# Read each plan and STATE.md
PLAN_01_CONTENT=$(cat "{plan_01_path}")
PLAN_02_CONTENT=$(cat "{plan_02_path}")
PLAN_03_CONTENT=$(cat "{plan_03_path}")
STATE_CONTENT=$(cat .planning/STATE.md)

# Expected: SUMMARY.md for each plan in this wave
EXPECTED_ARTIFACTS=()
for plan in ${WAVE_PLANS[@]}; do
  plan_id=$(basename "$plan" -PLAN.md)
  EXPECTED_ARTIFACTS+=("${PHASE_DIR}/${plan_id}-SUMMARY.md")
done
```

**Before spawning, report to user:**

```bash
EXPECTED_DURATION_MIN=$((EXECUTOR_TIMEOUT / 60000))
echo "Starting gsd-executor agent(s)..."
echo "Expected duration: ${EXPECTED_DURATION_MIN} minutes per agent"
echo "Expected outputs:"
for artifact in "${EXPECTED_ARTIFACTS[@]}"; do
  echo "  - $(basename "$artifact")"
done
START_TIME=$(date +%s)
```

Spawn all plans in a wave with a single message containing multiple Task calls, with inlined content:

```
Task(prompt="Execute plan at {plan_01_path}\n\nPlan:\n{plan_01_content}\n\nProject state:\n{state_content}", subagent_type="gsd-executor", model="{executor_model}")
Task(prompt="Execute plan at {plan_02_path}\n\nPlan:\n{plan_02_content}\n\nProject state:\n{state_content}", subagent_type="gsd-executor", model="{executor_model}")
Task(prompt="Execute plan at {plan_03_path}\n\nPlan:\n{plan_03_content}\n\nProject state:\n{state_content}", subagent_type="gsd-executor", model="{executor_model}")
```

All three run in parallel. Task tool blocks until all complete.

**After Task() returns, report timing and check artifacts:**

```bash
END_TIME=$(date +%s)
ACTUAL_DURATION_S=$((END_TIME - START_TIME))
EXPECTED_DURATION_S=$((EXECUTOR_TIMEOUT / 1000))

# Check artifacts
ARTIFACTS_EXIST=true
for artifact in "${EXPECTED_ARTIFACTS[@]}"; do
  if [[ ! -f "$artifact" ]]; then
    echo "Missing: $artifact" >&2
    ARTIFACTS_EXIST=false
  fi
done

# Report based on duration + artifacts
if [[ $ACTUAL_DURATION_S -gt $EXPECTED_DURATION_S ]]; then
  if [[ "$ARTIFACTS_EXIST" == "true" ]]; then
    echo "Wave completed in ${ACTUAL_DURATION_S}s (exceeded expected ${EXPECTED_DURATION_S}s) but all SUMMARYs present"
  else
    echo "Wave exceeded expected duration AND missing artifacts:"
    for artifact in "${EXPECTED_ARTIFACTS[@]}"; do
      [[ ! -f "$artifact" ]] && echo "  Missing: $artifact"
    done
  fi
else
  if [[ "$ARTIFACTS_EXIST" == "true" ]]; then
    echo "Wave completed in ${ACTUAL_DURATION_S}s"
  else
    echo "Wave completed but missing artifacts:"
    for artifact in "${EXPECTED_ARTIFACTS[@]}"; do
      [[ ! -f "$artifact" ]] && echo "  Missing: $artifact"
    done
  fi
fi
```

**No polling.** No background agents. No TaskOutput loops.
</wave_execution>

<checkpoint_handling>
Plans with `autonomous: false` have checkpoints. The execute-phase.md workflow handles the full checkpoint flow:
- Subagent pauses at checkpoint, returns structured state
- Orchestrator presents to user, collects response
- Spawns fresh continuation agent (not resume)

See `@~/.claude/get-shit-done/workflows/execute-phase.md` step `checkpoint_handling` for complete details.
</checkpoint_handling>

<deviation_rules>
During execution, handle discoveries automatically:

1. **Auto-fix bugs** - Fix immediately, document in Summary
2. **Auto-add critical** - Security/correctness gaps, add and document
3. **Auto-fix blockers** - Can't proceed without fix, do it and document
4. **Ask about architectural** - Major structural changes, stop and ask user

Only rule 4 requires user intervention.
</deviation_rules>

<commit_rules>
**Per-Task Commits:**

After each task completes:
1. Stage only files modified by that task
2. Commit with format: `{type}({phase}-{plan}): {task-name}`
3. Types: feat, fix, test, refactor, perf, chore
4. Record commit hash for SUMMARY.md

**Plan Metadata Commit:**

After all tasks in a plan complete:
1. Stage plan artifacts only: PLAN.md, SUMMARY.md
2. Commit with format: `docs({phase}-{plan}): complete [plan-name] plan`
3. NO code files (already committed per-task)

**Phase Completion Commit:**

After all plans in phase complete (step 7):
1. Stage: ROADMAP.md, STATE.md, REQUIREMENTS.md (if updated), VERIFICATION.md
2. Commit with format: `docs({phase}): complete {phase-name} phase`
3. Bundles all phase-level state updates in one commit

**NEVER use:**
- `git add .`
- `git add -A`
- `git add src/` or any broad directory

**Always stage files individually.**
</commit_rules>

<success_criteria>
- [ ] All incomplete plans in phase executed
- [ ] Each plan has SUMMARY.md
- [ ] Phase goal verified (must_haves checked against codebase)
- [ ] VERIFICATION.md created in phase directory
- [ ] STATE.md reflects phase completion
- [ ] ROADMAP.md updated
- [ ] REQUIREMENTS.md updated (phase requirements marked Complete)
- [ ] User informed of next steps
</success_criteria>
