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
</execution_context>

<context>
Phase: $ARGUMENTS

**Flags:**
- `--gaps-only` — Execute only gap closure plans (plans with `gap_closure: true` in frontmatter). Use after verify-work creates fix plans.

@.planning/ROADMAP.md
@.planning/STATE.md
</context>

<process>
0. **Resolve Model Profile**

   Read model profile for agent spawning:
   ```bash
   # Try jq first (robust), fallback to grep (compatible)
   if command -v jq >/dev/null 2>&1; then
     MODEL_PROFILE=$(jq -r '.model_profile // "balanced"' .planning/config.json 2>/dev/null || echo "balanced")
   else
     MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
   fi
   ```

   Default to "balanced" if not set.

   **Model lookup table:**

   | Agent | quality | balanced | budget |
   |-------|---------|----------|--------|
   | gsd-executor | opus | sonnet | sonnet |
   | gsd-executor-core | opus | sonnet | sonnet |
   | gsd-verifier | sonnet | sonnet | haiku |
   | gsd-verifier-core | sonnet | sonnet | haiku |

   Store resolved models for use in Task calls below.

   **Read optimization flags:**
   ```bash
   # Try jq first (robust), fallback to grep (compatible)
   if command -v jq >/dev/null 2>&1; then
     COMPACT_WORKFLOWS=$(jq -r '.optimization.compact_workflows // false' .planning/config.json 2>/dev/null || echo "false")
     LAZY_REFERENCES=$(jq -r '.optimization.lazy_references // false' .planning/config.json 2>/dev/null || echo "false")
     TIERED_INSTRUCTIONS=$(jq -r '.optimization.tiered_instructions // false' .planning/config.json 2>/dev/null || echo "false")
     DELTA_CONTEXT=$(jq -r '.optimization.delta_context // false' .planning/config.json 2>/dev/null || echo "false")
   else
     COMPACT_WORKFLOWS=$(cat .planning/config.json 2>/dev/null | grep -o '"compact_workflows"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "false")
     LAZY_REFERENCES=$(cat .planning/config.json 2>/dev/null | grep -o '"lazy_references"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "false")
     TIERED_INSTRUCTIONS=$(cat .planning/config.json 2>/dev/null | grep -o '"tiered_instructions"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "false")
     DELTA_CONTEXT=$(cat .planning/config.json 2>/dev/null | grep -o '"delta_context"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "false")
   fi
   ```

   Default all to "false" for backward compatibility. Store for use in subagent spawning.

   **Delta context reference:** When `delta_context: true`, load selective context per agent.
   See `@~/.claude/get-shit-done/references/delta-context-helpers.md` for extraction functions.

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

   **If changes exist:** Orchestrator made corrections between executor completions. Stage and commit them individually:
   ```bash
   # Stage each modified file individually (never use git add -u, git add ., or git add -A)
   git status --porcelain | grep '^ M' | cut -c4- | while read file; do
     git add "$file"
   done
   git commit -m "fix({phase}): orchestrator corrections"
   ```

   **If clean:** Continue to verification.

7. **Verify phase goal**
   Check config:
   ```bash
   # Try jq first (robust), fallback to grep (compatible)
   if command -v jq >/dev/null 2>&1; then
     WORKFLOW_VERIFIER=$(jq -r '.workflow.verifier // true' .planning/config.json 2>/dev/null || echo "true")
   else
     WORKFLOW_VERIFIER=$(cat .planning/config.json 2>/dev/null | grep -o '"verifier"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
   fi
   ```

   **If `workflow.verifier` is `false`:** Skip to step 8 (treat as passed).

   **Determine verifier type:**
   ```bash
   if [ "$TIERED_INSTRUCTIONS" = "true" ]; then
     VERIFIER_TYPE="gsd-verifier-core"
   else
     VERIFIER_TYPE="gsd-verifier"
   fi
   ```

   **Otherwise:**
   - Spawn `{VERIFIER_TYPE}` subagent with phase directory and goal
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
# Read each plan
PLAN_01_CONTENT=$(cat "{plan_01_path}")
PLAN_02_CONTENT=$(cat "{plan_02_path}")
PLAN_03_CONTENT=$(cat "{plan_03_path}")

# Determine executor type based on optimization flags and plan content
# TDD tasks require full executor for detailed RED-GREEN-REFACTOR guidance
HAS_TDD_TASKS=$(grep -l 'tdd="true"' "{plan_01_path}" "{plan_02_path}" "{plan_03_path}" 2>/dev/null | head -1)

if [ "$TIERED_INSTRUCTIONS" = "true" ] && [ -z "$HAS_TDD_TASKS" ]; then
  EXECUTOR_TYPE="gsd-executor-core"
else
  EXECUTOR_TYPE="gsd-executor"
fi

# TDD tasks require full context (not just delta) to access:
# - Existing test patterns in the project
# - Testing conventions and setup
# - Global decisions that affect TDD approach
if [ -n "$HAS_TDD_TASKS" ] && [ "$DELTA_CONTEXT" = "true" ]; then
  echo "ℹ️  TDD tasks detected, using full context mode (overriding delta_context)"
  DELTA_CONTEXT="false"
fi

# Determine workflow file based on optimization flags
if [ "$COMPACT_WORKFLOWS" = "true" ]; then
  WORKFLOW_FILE="execute-plan-compact.md"
else
  WORKFLOW_FILE="execute-plan.md"
fi

# Check if plan is autonomous (for lazy references)
PLAN_01_AUTONOMOUS=$(grep "^autonomous:" "{plan_01_path}" | grep -o 'true\|false' || echo "true")
```

**Build context based on delta_context flag:**

```bash
# === DELTA CONTEXT LOADING ===
# When delta_context=true, load only relevant portions of context files

if [ "$DELTA_CONTEXT" = "true" ]; then
  # Extract phase section from ROADMAP (not full file)
  # Use sed -E for cross-platform regex, sed '$d' instead of head -n -1 for macOS compatibility
  PHASE_SECTION=$(sed -En "/^## Phase ${PHASE_NUM}:/,/^## Phase [0-9]|^---/p" .planning/ROADMAP.md | sed '$d')

  # Extract relevant decisions from STATE (global + phase-specific only)
  CURRENT_POS=$(sed -En '/^## Current Position/,/^## /p' .planning/STATE.md | sed '$d')
  GLOBAL_DECISIONS=$(grep -E "^- \[Global\]" .planning/STATE.md 2>/dev/null || true)
  PHASE_DECISIONS=$(grep -E "^- \[Phase ${PHASE_NUM}\]" .planning/STATE.md 2>/dev/null || true)

  # Build minimal context for executor
  CONTEXT_FOR_EXECUTOR="## Phase Context
${PHASE_SECTION}

## Current Position
${CURRENT_POS}

## Relevant Decisions
${GLOBAL_DECISIONS}
${PHASE_DECISIONS}"

  # Extract task-mapped requirements if plan specifies them
  TASK_REQS=$(grep "^requirements:" "{plan_path}" 2>/dev/null | sed 's/requirements:[[:space:]]*//' || true)
  if [ -n "$TASK_REQS" ] && [ -f .planning/REQUIREMENTS.md ]; then
    REQ_HEADER=$(head -3 .planning/REQUIREMENTS.md)
    REQ_ROWS=""
    for ID in $(echo "$TASK_REQS" | tr ',' '\n' | tr -d ' '); do
      REQ_ROWS="${REQ_ROWS}$(grep "| ${ID} |" .planning/REQUIREMENTS.md 2>/dev/null || true)\n"
    done
    CONTEXT_FOR_EXECUTOR="${CONTEXT_FOR_EXECUTOR}

## Task Requirements
${REQ_HEADER}
${REQ_ROWS}"
  fi

  # === VALIDATION: Verify delta extraction succeeded ===
  # If critical sections are empty, fall back to full context for safety
  if [ -z "$PHASE_SECTION" ] || [ -z "$CURRENT_POS" ]; then
    echo "⚠️  Delta context extraction failed (empty PHASE_SECTION or CURRENT_POS)"
    echo "    Falling back to full context mode for safety"
    DELTA_CONTEXT="false"
    STATE_CONTENT=$(cat .planning/STATE.md)
    CONTEXT_FOR_EXECUTOR="## Project State
${STATE_CONTENT}"
  fi

else
  # === FULL CONTEXT MODE (backward compatible) ===
  STATE_CONTENT=$(cat .planning/STATE.md)
  CONTEXT_FOR_EXECUTOR="## Project State
${STATE_CONTENT}"
fi
```

**Build subagent prompt with conditional references:**

```
# Base prompt template (uses CONTEXT_FOR_EXECUTOR instead of raw STATE)
# NOTE: @-references do NOT work across Task() boundaries - the gsd-executor agent
# has built-in instructions and doesn't need external workflow references
EXECUTOR_PROMPT="Execute plan at {plan_path}

Plan:
{plan_content}

{context_for_executor}"
```

Spawn all plans in a wave with a single message containing multiple Task calls:

```
Task(prompt="{executor_prompt_01}", subagent_type="{EXECUTOR_TYPE}", model="{executor_model}")
Task(prompt="{executor_prompt_02}", subagent_type="{EXECUTOR_TYPE}", model="{executor_model}")
Task(prompt="{executor_prompt_03}", subagent_type="{EXECUTOR_TYPE}", model="{executor_model}")
```

All three run in parallel. Task tool blocks until all complete.

**No polling.** No background agents. No TaskOutput loops.

**Token savings with optimizations enabled:**
- `compact_workflows: true` → ~12,500 tokens saved per executor (execute-plan-compact.md vs full)
- `lazy_references: true` + autonomous → ~8,700 tokens saved per executor (no checkpoints.md)
- `tiered_instructions: true` → ~2,200 tokens saved per executor (gsd-executor-core vs full)
- `delta_context: true` → ~1,000-2,600 tokens saved per executor (selective context loading)
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
