<purpose>
Execute all plans in a phase using wave-based parallel execution. Orchestrator stays lean — delegates plan execution to subagents.
</purpose>

<core_principle>
Orchestrator coordinates, not executes. Each subagent loads the full execute-plan context. Orchestrator: discover plans → analyze deps → group waves → spawn agents → handle checkpoints → collect results.
</core_principle>

<runtime_compatibility>
**Subagent spawning is runtime-specific:**
- **Claude Code:** Uses `Task(subagent_type="gsd-executor", ...)` — blocks until complete, returns result
- **Copilot:** Subagent spawning does not reliably return completion signals. **Default to
  sequential inline execution**: read and follow execute-plan.md directly for each plan
  instead of spawning parallel agents. Only attempt parallel spawning if the user
  explicitly requests it — and in that case, rely on the spot-check fallback in step 3
  to detect completion.
- **Other runtimes:** If `Task`/`task` tool is unavailable, use sequential inline execution as the
  fallback. Check for tool availability at runtime rather than assuming based on runtime name.

**Fallback rule:** If a spawned agent completes its work (commits visible, SUMMARY.md exists) but
the orchestrator never receives the completion signal, treat it as successful based on spot-checks
and continue to the next wave/plan. Never block indefinitely waiting for a signal — always verify
via filesystem and git state.
</runtime_compatibility>

<required_reading>
Read STATE.md before any operation to load project context.
</required_reading>

<available_agent_types>
These are the valid GSD subagent types registered in .claude/agents/ (or equivalent for your runtime).
Always use the exact name from this list — do not fall back to 'general-purpose' or other built-in types:

- gsd-executor — Executes plan tasks, commits, creates SUMMARY.md
- gsd-verifier — Verifies phase completion, checks quality gates
- gsd-planner — Creates detailed plans from phase scope
- gsd-phase-researcher — Researches technical approaches for a phase
- gsd-plan-checker — Reviews plan quality before execution
- gsd-debugger — Diagnoses and fixes issues
- gsd-codebase-mapper — Maps project structure and dependencies
- gsd-integration-checker — Checks cross-phase integration
- gsd-nyquist-auditor — Validates verification coverage
- gsd-ui-researcher — Researches UI/UX approaches
- gsd-ui-checker — Reviews UI implementation quality
- gsd-ui-auditor — Audits UI against design requirements
</available_agent_types>

<process>

<step name="parse_args" priority="first">
Parse `$ARGUMENTS` before loading any context:

- First positional token → `PHASE_ARG`
- Optional `--wave N` → `WAVE_FILTER`
- Optional `--gaps-only` keeps its current meaning

If `--wave` is absent, preserve the current behavior of executing all incomplete waves in the phase.
</step>

<step name="initialize" priority="first">
Load all context in one call:

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init execute-phase "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" agent-skills gsd-executor 2>/dev/null)
```

Parse JSON for: `executor_model`, `verifier_model`, `commit_docs`, `parallelization`, `branching_strategy`, `branch_name`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `plans`, `incomplete_plans`, `plan_count`, `incomplete_count`, `state_exists`, `roadmap_exists`, `phase_req_ids`.

**If `phase_found` is false:** Error — phase directory not found.
**If `plan_count` is 0:** Error — no plans found in phase.
**If `state_exists` is false but `.planning/` exists:** Offer reconstruct or continue.

When `parallelization` is false, plans within a wave execute sequentially.

**Runtime detection for Copilot:**
Check if the current runtime is Copilot by testing for the `@gsd-executor` agent pattern
or absence of the `Task()` subagent API. If running under Copilot, force sequential inline
execution regardless of the `parallelization` setting — Copilot's subagent completion
signals are unreliable (see `<runtime_compatibility>`). Set `COPILOT_SEQUENTIAL=true`
internally and skip the `execute_waves` step in favor of `check_interactive_mode`'s
inline path for each plan.

**REQUIRED — Sync chain flag with intent.** If user invoked manually (no `--auto`), clear the ephemeral chain flag from any previous interrupted `--auto` chain. This prevents stale `_auto_chain_active: true` from causing unwanted auto-advance. This does NOT touch `workflow.auto_advance` (the user's persistent settings preference). You MUST execute this bash block before any config reads:
```bash
# REQUIRED: prevents stale auto-chain from previous --auto runs
if [[ ! "$ARGUMENTS" =~ --auto ]]; then
  node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-set workflow._auto_chain_active false 2>/dev/null
fi
```
</step>

<step name="check_interactive_mode">
**Parse `--interactive` flag from $ARGUMENTS.**

**If `--interactive` flag present:** Switch to interactive execution mode.

Interactive mode executes plans sequentially **inline** (no subagent spawning) with user
checkpoints between tasks. The user can review, modify, or redirect work at any point.

**Interactive execution flow:**

1. Load plan inventory as normal (discover_and_group_plans)
2. For each plan (sequentially, ignoring wave grouping):

   a. **Present the plan to the user:**
      ```
      ## Plan {plan_id}: {plan_name}

      Objective: {from plan file}
      Tasks: {task_count}

      Options:
      - Execute (proceed with all tasks)
      - Review first (show task breakdown before starting)
      - Skip (move to next plan)
      - Stop (end execution, save progress)
      ```

   b. **If "Review first":** Read and display the full plan file. Ask again: Execute, Modify, Skip.

   c. **If "Execute":** Read and follow `~/.claude/get-shit-done/workflows/execute-plan.md` **inline**
      (do NOT spawn a subagent). Execute tasks one at a time.

   d. **After each task:** Pause briefly. If the user intervenes (types anything), stop and address
      their feedback before continuing. Otherwise proceed to next task.

   e. **After plan complete:** Show results, commit, create SUMMARY.md, then present next plan.

3. After all plans: proceed to verification (same as normal mode).

**Benefits of interactive mode:**
- No subagent overhead — dramatically lower token usage
- User catches mistakes early — saves costly verification cycles
- Maintains GSD's planning/tracking structure
- Best for: small phases, bug fixes, verification gaps, learning GSD

**Skip to handle_branching step** (interactive plans execute inline after grouping).
</step>

<step name="handle_branching">
Check `branching_strategy` from init:

**"none":** Skip, continue on current branch.

**"phase" or "milestone":** Use pre-computed `branch_name` from init:
```bash
git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
```

All subsequent commits go to this branch. User handles merging.
</step>

<step name="validate_phase">
From init JSON: `phase_dir`, `plan_count`, `incomplete_count`.

Report: "Found {plan_count} plans in {phase_dir} ({incomplete_count} incomplete)"

**Update STATE.md for phase start:**
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state begin-phase --phase "${PHASE_NUMBER}" --name "${PHASE_NAME}" --plans "${PLAN_COUNT}"
```
This updates Status, Last Activity, Current focus, Current Position, and plan counts in STATE.md so frontmatter and body text reflect the active phase immediately.
</step>

<step name="discover_and_group_plans">
Load plan inventory with wave grouping in one call:

```bash
PLAN_INDEX=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" phase-plan-index "${PHASE_NUMBER}")
```

Parse JSON for: `phase`, `plans[]` (each with `id`, `wave`, `autonomous`, `objective`, `files_modified`, `task_count`, `has_summary`), `waves` (map of wave number → plan IDs), `incomplete`, `has_checkpoints`.

**Filtering:** Skip plans where `has_summary: true`. If `--gaps-only`: also skip non-gap_closure plans. If `WAVE_FILTER` is set: also skip plans whose `wave` does not equal `WAVE_FILTER`.

**Wave safety check:** If `WAVE_FILTER` is set and there are still incomplete plans in any lower wave that match the current execution mode, STOP and tell the user to finish earlier waves first. Do not let Wave 2+ execute while prerequisite earlier-wave plans remain incomplete.

If all filtered: "No matching incomplete plans" → exit.

Report:
```
## Execution Plan

**Phase {X}: {Name}** — {total_plans} matching plans across {wave_count} wave(s)

{If WAVE_FILTER is set: `Wave filter active: executing only Wave {WAVE_FILTER}`.}

| Wave | Plans | What it builds |
|------|-------|----------------|
| 1 | 01-01, 01-02 | {from plan objectives, 3-8 words} |
| 2 | 01-03 | ... |
```
</step>

<step name="execute_waves">
Execute each selected wave in sequence. Within a wave: parallel if `PARALLELIZATION=true`, sequential if `false`.

**For each wave:**

1. **Describe what's being built (BEFORE spawning):**

   Read each plan's `<objective>`. Extract what's being built and why.

   ```
   ---
   ## Wave {N}

   **{Plan ID}: {Plan Name}**
   {2-3 sentences: what this builds, technical approach, why it matters}

   Spawning {count} agent(s)...
   ---
   ```

   - Bad: "Executing terrain generation plan"
   - Good: "Procedural terrain generator using Perlin noise — creates height maps, biome zones, and collision meshes. Required before vehicle physics can interact with ground."

2. **Spawn executor agents:**

   Pass paths only — executors read files themselves with their fresh context window.
   For 200k models, this keeps orchestrator context lean (~10-15%).
   For 1M+ models (Opus 4.6, Sonnet 4.6), richer context can be passed directly.

   ```
   Task(
     subagent_type="gsd-executor",
     model="{executor_model}",
     isolation="worktree",
     prompt="
       <objective>
       Execute plan {plan_number} of phase {phase_number}-{phase_name}.
       Commit each task atomically. Create SUMMARY.md. Update STATE.md and ROADMAP.md.
       </objective>

       <parallel_execution>
       You are running as a PARALLEL executor agent. Use --no-verify on all git
       commits to avoid pre-commit hook contention with other agents. The
       orchestrator validates hooks once after all agents complete.
       For gsd-tools commits: add --no-verify flag.
       For direct git commits: use git commit --no-verify -m "..."
       </parallel_execution>

       <execution_context>
       @~/.claude/get-shit-done/workflows/execute-plan.md
       @~/.claude/get-shit-done/templates/summary.md
       @~/.claude/get-shit-done/references/checkpoints.md
       @~/.claude/get-shit-done/references/tdd.md
       </execution_context>

       <files_to_read>
       Read these files at execution start using the Read tool:
       - {phase_dir}/{plan_file} (Plan)
       - .planning/PROJECT.md (Project context — core value, requirements, evolution rules)
       - .planning/STATE.md (State)
       - .planning/config.json (Config, if exists)
       - ./CLAUDE.md (Project instructions, if exists — follow project-specific guidelines and coding conventions)
       - .claude/skills/ or .agents/skills/ (Project skills, if either exists — list skills, read SKILL.md for each, follow relevant rules during implementation)
       </files_to_read>

       ${AGENT_SKILLS}

       <mcp_tools>
       If CLAUDE.md or project instructions reference MCP tools (e.g. jCodeMunch, context7,
       or other MCP servers), prefer those tools over Grep/Glob for code navigation when available.
       MCP tools often save significant tokens by providing structured code indexes.
       Check tool availability first — if MCP tools are not accessible, fall back to Grep/Glob.
       </mcp_tools>

       <success_criteria>
       - [ ] All tasks executed
       - [ ] Each task committed individually
       - [ ] SUMMARY.md created in plan directory
       - [ ] STATE.md updated with position and decisions
       - [ ] ROADMAP.md updated with plan progress (via `roadmap update-plan-progress`)
       </success_criteria>
     "
   )
   ```

3. **Wait for all agents in wave to complete.**

   **Completion signal fallback (Copilot and runtimes where Task() may not return):**

   If a spawned agent does not return a completion signal but appears to have finished
   its work, do NOT block indefinitely. Instead, verify completion via spot-checks:

   ```bash
   # For each plan in this wave, check if the executor finished:
   SUMMARY_EXISTS=$(test -f "{phase_dir}/{plan_number}-{plan_padded}-SUMMARY.md" && echo "true" || echo "false")
   COMMITS_FOUND=$(git log --oneline --all --grep="{phase_number}-{plan_padded}" --since="1 hour ago" | head -1)
   ```

   **If SUMMARY.md exists AND commits are found:** The agent completed successfully —
   treat as done and proceed to step 4. Log: `"✓ {Plan ID} completed (verified via spot-check — completion signal not received)"`

   **If SUMMARY.md does NOT exist after a reasonable wait:** The agent may still be
   running or may have failed silently. Check `git log --oneline -5` for recent
   activity. If commits are still appearing, wait longer. If no activity, report
   the plan as failed and route to the failure handler in step 5.

   **This fallback applies automatically to all runtimes.** Claude Code's Task() normally
   returns synchronously, but the fallback ensures resilience if it doesn't.

4. **Post-wave hook validation (parallel mode only):**

   When agents committed with `--no-verify`, run pre-commit hooks once after the wave:
   ```bash
   # Run project's pre-commit hooks on the current state
   git diff --cached --quiet || git stash  # stash any unstaged changes
   git hook run pre-commit 2>&1 || echo "⚠ Pre-commit hooks failed — review before continuing"
   ```
   If hooks fail: report the failure and ask "Fix hook issues now?" or "Continue to next wave?"

5. **Report completion — spot-check claims first:**

   For each SUMMARY.md:
   - Verify first 2 files from `key-files.created` exist on disk
   - Check `git log --oneline --all --grep="{phase}-{plan}"` returns ≥1 commit
   - Check for `## Self-Check: FAILED` marker

   If ANY spot-check fails: report which plan failed, route to failure handler — ask "Retry plan?" or "Continue with remaining waves?"

   If pass:
   ```
   ---
   ## Wave {N} Complete

   **{Plan ID}: {Plan Name}**
   {What was built — from SUMMARY.md}
   {Notable deviations, if any}

   {If more waves: what this enables for next wave}
   ---
   ```

   - Bad: "Wave 2 complete. Proceeding to Wave 3."
   - Good: "Terrain system complete — 3 biome types, height-based texturing, physics collision meshes. Vehicle physics (Wave 3) can now reference ground surfaces."

5. **Handle failures:**

   **Known Claude Code bug (classifyHandoffIfNeeded):** If an agent reports "failed" with error containing `classifyHandoffIfNeeded is not defined`, this is a Claude Code runtime bug — not a GSD or agent issue. The error fires in the completion handler AFTER all tool calls finish. In this case: run the same spot-checks as step 4 (SUMMARY.md exists, git commits present, no Self-Check: FAILED). If spot-checks PASS → treat as **successful**. If spot-checks FAIL → treat as real failure below.

   For real failures: report which plan failed → ask "Continue?" or "Stop?" → if continue, dependent plans may also fail. If stop, partial completion report.

5b. **Pre-wave dependency check (waves 2+ only):**

    Before spawning wave N+1, for each plan in the upcoming wave:
    ```bash
    node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" verify key-links {phase_dir}/{plan}-PLAN.md
    ```

    If any key-link from a PRIOR wave's artifact fails verification:

    ## Cross-Plan Wiring Gap

    | Plan | Link | From | Expected Pattern | Status |
    |------|------|------|-----------------|--------|
    | {plan} | {via} | {from} | {pattern} | NOT FOUND |

    Wave {N} artifacts may not be properly wired. Options:
    1. Investigate and fix before continuing
    2. Continue (may cause cascading failures in wave {N+1})

    Key-links referencing files in the CURRENT (upcoming) wave are skipped.

6. **Execute checkpoint plans between waves** — see `<checkpoint_handling>`.

7. **Proceed to next wave.**
</step>

<step name="checkpoint_handling">
Plans with `autonomous: false` require user interaction.

**Auto-mode checkpoint handling:**

Read auto-advance config (chain flag + user preference):
```bash
AUTO_CHAIN=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow._auto_chain_active 2>/dev/null || echo "false")
AUTO_CFG=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow.auto_advance 2>/dev/null || echo "false")
```

When executor returns a checkpoint AND (`AUTO_CHAIN` is `"true"` OR `AUTO_CFG` is `"true"`):
- **human-verify** → Auto-spawn continuation agent with `{user_response}` = `"approved"`. Log `⚡ Auto-approved checkpoint`.
- **decision** → Auto-spawn continuation agent with `{user_response}` = first option from checkpoint details. Log `⚡ Auto-selected: [option]`.
- **human-action** → Present to user (existing behavior below). Auth gates cannot be automated.

**Standard flow (not auto-mode, or human-action type):**

1. Spawn agent for checkpoint plan
2. Agent runs until checkpoint task or auth gate → returns structured state
3. Agent return includes: completed tasks table, current task + blocker, checkpoint type/details, what's awaited
4. **Present to user:**
   ```
   ## Checkpoint: [Type]

   **Plan:** 03-03 Dashboard Layout
   **Progress:** 2/3 tasks complete

   [Checkpoint Details from agent return]
   [Awaiting section from agent return]
   ```
5. User responds: "approved"/"done" | issue description | decision selection
6. **Spawn continuation agent (NOT resume)** using continuation-prompt.md template:
   - `{completed_tasks_table}`: From checkpoint return
   - `{resume_task_number}` + `{resume_task_name}`: Current task
   - `{user_response}`: What user provided
   - `{resume_instructions}`: Based on checkpoint type
7. Continuation agent verifies previous commits, continues from resume point
8. Repeat until plan completes or user stops

**Why fresh agent, not resume:** Resume relies on internal serialization that breaks with parallel tool calls. Fresh agents with explicit state are more reliable.

**Checkpoints in parallel waves:** Agent pauses and returns while other parallel agents may complete. Present checkpoint, spawn continuation, wait for all before next wave.
</step>

<step name="aggregate_results">
After all waves:

```markdown
## Phase {X}: {Name} Execution Complete

**Waves:** {N} | **Plans:** {M}/{total} complete

| Wave | Plans | Status |
|------|-------|--------|
| 1 | plan-01, plan-02 | ✓ Complete |
| CP | plan-03 | ✓ Verified |
| 2 | plan-04 | ✓ Complete |

### Plan Details
1. **03-01**: [one-liner from SUMMARY.md]
2. **03-02**: [one-liner from SUMMARY.md]

### Issues Encountered
[Aggregate from SUMMARYs, or "None"]
```
</step>

<step name="handle_partial_wave_execution">
If `WAVE_FILTER` was used, re-run plan discovery after execution:

```bash
POST_PLAN_INDEX=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" phase-plan-index "${PHASE_NUMBER}")
```

Apply the same "incomplete" filtering rules as earlier:
- ignore plans with `has_summary: true`
- if `--gaps-only`, only consider `gap_closure: true` plans

**If incomplete plans still remain anywhere in the phase:**
- STOP here
- Do NOT run phase verification
- Do NOT mark the phase complete in ROADMAP/STATE
- Present:

```markdown
## Wave {WAVE_FILTER} Complete

Selected wave finished successfully. This phase still has incomplete plans, so phase-level verification and completion were intentionally skipped.

/gsd:execute-phase {phase} ${GSD_WS}                # Continue remaining waves
/gsd:execute-phase {phase} --wave {next} ${GSD_WS}  # Run the next wave explicitly
```

**If no incomplete plans remain after the selected wave finishes:**
- continue with the normal phase-level verification and completion flow below
- this means the selected wave happened to be the last remaining work in the phase
</step>

<step name="close_parent_artifacts">
**For decimal/polish phases only (X.Y pattern):** Close the feedback loop by resolving parent UAT and debug artifacts.

**Skip if** phase number has no decimal (e.g., `3`, `04`) — only applies to gap-closure phases like `4.1`, `03.1`.

**1. Detect decimal phase and derive parent:**
```bash
# Check if phase_number contains a decimal
if [[ "$PHASE_NUMBER" == *.* ]]; then
  PARENT_PHASE="${PHASE_NUMBER%%.*}"
fi
```

**2. Find parent UAT file:**
```bash
PARENT_INFO=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" find-phase "${PARENT_PHASE}" --raw)
# Extract directory from PARENT_INFO JSON, then find UAT file in that directory
```

**If no parent UAT found:** Skip this step (gap-closure may have been triggered by VERIFICATION.md instead).

**3. Update UAT gap statuses:**

Read the parent UAT file's `## Gaps` section. For each gap entry with `status: failed`:
- Update to `status: resolved`

**4. Update UAT frontmatter:**

If all gaps now have `status: resolved`:
- Update frontmatter `status: diagnosed` → `status: resolved`
- Update frontmatter `updated:` timestamp

**5. Resolve referenced debug sessions:**

For each gap that has a `debug_session:` field:
- Read the debug session file
- Update frontmatter `status:` → `resolved`
- Update frontmatter `updated:` timestamp
- Move to resolved directory:
```bash
mkdir -p .planning/debug/resolved
mv .planning/debug/{slug}.md .planning/debug/resolved/
```

**6. Commit updated artifacts:**
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(phase-${PARENT_PHASE}): resolve UAT gaps and debug sessions after ${PHASE_NUMBER} gap closure" --files .planning/phases/*${PARENT_PHASE}*/*-UAT.md .planning/debug/resolved/*.md
```
</step>

<step name="regression_gate">
Run prior phases' test suites to catch cross-phase regressions BEFORE verification.

**Skip if:** This is the first phase (no prior phases), or no prior VERIFICATION.md files exist.

**Step 1: Discover prior phases' test files**
```bash
# Find all VERIFICATION.md files from prior phases in current milestone
PRIOR_VERIFICATIONS=$(find .planning/phases/ -name "*-VERIFICATION.md" ! -path "*${PHASE_NUMBER}*" 2>/dev/null)
```

**Step 2: Extract test file lists from prior verifications**

For each VERIFICATION.md found, look for test file references:
- Lines containing `test`, `spec`, or `__tests__` paths
- The "Test Suite" or "Automated Checks" section
- File patterns from `key-files.created` in corresponding SUMMARY.md files that match `*.test.*` or `*.spec.*`

Collect all unique test file paths into `REGRESSION_FILES`.

**Step 3: Run regression tests (if any found)**

```bash
# Detect test runner and run prior phase tests
if [ -f "package.json" ]; then
  # Node.js — use project's test runner
  npx jest ${REGRESSION_FILES} --passWithNoTests --no-coverage -q 2>&1 || npx vitest run ${REGRESSION_FILES} 2>&1
elif [ -f "Cargo.toml" ]; then
  cargo test 2>&1
elif [ -f "requirements.txt" ] || [ -f "pyproject.toml" ]; then
  python -m pytest ${REGRESSION_FILES} -q --tb=short 2>&1
fi
```

**Step 4: Report results**

If all tests pass:
```
✓ Regression gate: {N} prior-phase test files passed — no regressions detected
```
→ Proceed to verify_phase_goal

If any tests fail:
```
## ⚠ Cross-Phase Regression Detected

Phase {X} execution may have broken functionality from prior phases.

| Test File | Phase | Status | Detail |
|-----------|-------|--------|--------|
| {file} | {origin_phase} | FAILED | {first_failure_line} |

Options:
1. Fix regressions before verification (recommended)
2. Continue to verification anyway (regressions will compound)
3. Abort phase — roll back and re-plan
```

Use AskUserQuestion to present the options.
</step>

<step name="verify_phase_goal">
Verify phase achieved its GOAL, not just completed tasks.

```bash
VERIFIER_SKILLS=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" agent-skills gsd-verifier 2>/dev/null)
```

```
Task(
  prompt="Verify phase {phase_number} goal achievement.
Phase directory: {phase_dir}
Phase goal: {goal from ROADMAP.md}
Phase requirement IDs: {phase_req_ids}
Check must_haves against actual codebase.
Cross-reference requirement IDs from PLAN frontmatter against REQUIREMENTS.md — every ID MUST be accounted for.
Create VERIFICATION.md.
${VERIFIER_SKILLS}",
  subagent_type="gsd-verifier",
  model="{verifier_model}"
)
```

Read status:
```bash
grep "^status:" "$PHASE_DIR"/*-VERIFICATION.md | cut -d: -f2 | tr -d ' '
```

| Status | Action |
|--------|--------|
| `passed` | → update_roadmap |
| `human_needed` | Present items for human testing, get approval or feedback |
| `gaps_found` | Present gap summary, offer `/gsd:plan-phase {phase} --gaps ${GSD_WS}` |

**If human_needed:**

**Step A: Persist human verification items as UAT file.**

Create `{phase_dir}/{phase_num}-HUMAN-UAT.md` using UAT template format:

```markdown
---
status: partial
phase: {phase_num}-{phase_name}
source: [{phase_num}-VERIFICATION.md]
started: [now ISO]
updated: [now ISO]
---

## Current Test

[awaiting human testing]

## Tests

{For each human_verification item from VERIFICATION.md:}

### {N}. {item description}
expected: {expected behavior from VERIFICATION.md}
result: [pending]

## Summary

total: {count}
passed: 0
issues: 0
pending: {count}
skipped: 0
blocked: 0

## Gaps
```

Commit the file:
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "test({phase_num}): persist human verification items as UAT" --files "{phase_dir}/{phase_num}-HUMAN-UAT.md"
```

**Step B: Present to user:**

```
## ✓ Phase {X}: {Name} — Human Verification Required

All automated checks passed. {N} items need human testing:

{From VERIFICATION.md human_verification section}

Items saved to `{phase_num}-HUMAN-UAT.md` — they will appear in `/gsd:progress` and `/gsd:audit-uat`.

"approved" → continue | Report issues → gap closure
```

**If user says "approved":** Proceed to `update_roadmap`. The HUMAN-UAT.md file persists with `status: partial` and will surface in future progress checks until the user runs `/gsd:verify-work` on it.

**If user reports issues:** Proceed to gap closure as currently implemented.

**If gaps_found:**
```
## ⚠ Phase {X}: {Name} — Gaps Found

**Score:** {N}/{M} must-haves verified
**Report:** {phase_dir}/{phase_num}-VERIFICATION.md

### What's Missing
{Gap summaries from VERIFICATION.md}

---
## ▶ Next Up

`/gsd:plan-phase {X} --gaps ${GSD_WS}`

<sub>`/clear` first → fresh context window</sub>

Also: `cat {phase_dir}/{phase_num}-VERIFICATION.md` — full report
Also: `/gsd:verify-work {X} ${GSD_WS}` — manual testing first
```

Gap closure cycle: `/gsd:plan-phase {X} --gaps ${GSD_WS}` reads VERIFICATION.md → creates gap plans with `gap_closure: true` → user runs `/gsd:execute-phase {X} --gaps-only ${GSD_WS}` → verifier re-runs.
</step>

<step name="update_roadmap">
**Mark phase complete and update all tracking files:**

```bash
COMPLETION=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" phase complete "${PHASE_NUMBER}")
```

The CLI handles:
- Marking phase checkbox `[x]` with completion date
- Updating Progress table (Status → Complete, date)
- Updating plan count to final
- Advancing STATE.md to next phase
- Updating REQUIREMENTS.md traceability
- Scanning for verification debt (returns `warnings` array)

Extract from result: `next_phase`, `next_phase_name`, `is_last_phase`, `warnings`, `has_warnings`.

**If has_warnings is true:**
```
## Phase {X} marked complete with {N} warnings:

{list each warning}

These items are tracked and will appear in `/gsd:progress` and `/gsd:audit-uat`.
```

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(phase-{X}): complete phase execution" --files .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md {phase_dir}/*-VERIFICATION.md
```
</step>

<step name="update_project_md">
**Evolve PROJECT.md to reflect phase completion (prevents planning document drift — #956):**

PROJECT.md tracks validated requirements, decisions, and current state. Without this step,
PROJECT.md falls behind silently over multiple phases.

1. Read `.planning/PROJECT.md`
2. If the file exists and has a `## Validated Requirements` or `## Requirements` section:
   - Move any requirements validated by this phase from Active → Validated
   - Add a brief note: `Validated in Phase {X}: {Name}`
3. If the file has a `## Current State` or similar section:
   - Update it to reflect this phase's completion (e.g., "Phase {X} complete — {one-liner}")
4. Update the `Last updated:` footer to today's date
5. Commit the change:

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(phase-{X}): evolve PROJECT.md after phase completion" --files .planning/PROJECT.md
```

**Skip this step if** `.planning/PROJECT.md` does not exist.
</step>

<step name="offer_next">

**Exception:** If `gaps_found`, the `verify_phase_goal` step already presents the gap-closure path (`/gsd:plan-phase {X} --gaps`). No additional routing needed — skip auto-advance.

**No-transition check (spawned by auto-advance chain):**

Parse `--no-transition` flag from $ARGUMENTS.

**If `--no-transition` flag present:**

Execute-phase was spawned by plan-phase's auto-advance. Do NOT run transition.md.
After verification passes and roadmap is updated, return completion status to parent:

```
## PHASE COMPLETE

Phase: ${PHASE_NUMBER} - ${PHASE_NAME}
Plans: ${completed_count}/${total_count}
Verification: {Passed | Gaps Found}

[Include aggregate_results output]
```

STOP. Do not proceed to auto-advance or transition.

**If `--no-transition` flag is NOT present:**

**Auto-advance detection:**

1. Parse `--auto` flag from $ARGUMENTS
2. Read both the chain flag and user preference (chain flag already synced in init step):
   ```bash
   AUTO_CHAIN=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow._auto_chain_active 2>/dev/null || echo "false")
   AUTO_CFG=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow.auto_advance 2>/dev/null || echo "false")
   ```

**If `--auto` flag present OR `AUTO_CHAIN` is true OR `AUTO_CFG` is true (AND verification passed with no gaps):**

```
╔══════════════════════════════════════════╗
║  AUTO-ADVANCING → TRANSITION             ║
║  Phase {X} verified, continuing chain    ║
╚══════════════════════════════════════════╝
```

Execute the transition workflow inline (do NOT use Task — orchestrator context is ~10-15%, transition needs phase completion data already in context):

Read and follow `~/.claude/get-shit-done/workflows/transition.md`, passing through the `--auto` flag so it propagates to the next phase invocation.

**If none of `--auto`, `AUTO_CHAIN`, or `AUTO_CFG` is true:**

**STOP. Do not auto-advance. Do not execute transition. Do not plan next phase. Present options to the user and wait.**

**IMPORTANT: There is NO `/gsd:transition` command. Never suggest it. The transition workflow is internal only.**

```
## ✓ Phase {X}: {Name} Complete

/gsd:progress ${GSD_WS} — see updated roadmap
/gsd:discuss-phase {next} ${GSD_WS} — discuss next phase before planning
/gsd:plan-phase {next} ${GSD_WS} — plan next phase
/gsd:execute-phase {next} ${GSD_WS} — execute next phase
```

Only suggest the commands listed above. Do not invent or hallucinate command names.
</step>

</process>

<context_efficiency>
Orchestrator: ~10-15% context for 200k windows, can use more for 1M+ windows.
Subagents: fresh context each (200k-1M depending on model). No polling (Task blocks). No context bleed.

For 1M+ context models, consider:
- Passing richer context (code snippets, dependency outputs) directly to executors instead of just file paths
- Running small phases (≤3 plans, no dependencies) inline without subagent spawning overhead
- Relaxing /clear recommendations — context rot onset is much further out with 5x window
</context_efficiency>

<failure_handling>
- **classifyHandoffIfNeeded false failure:** Agent reports "failed" but error is `classifyHandoffIfNeeded is not defined` → Claude Code bug, not GSD. Spot-check (SUMMARY exists, commits present) → if pass, treat as success
- **Agent fails mid-plan:** Missing SUMMARY.md → report, ask user how to proceed
- **Dependency chain breaks:** Wave 1 fails → Wave 2 dependents likely fail → user chooses attempt or skip
- **All agents in wave fail:** Systemic issue → stop, report for investigation
- **Checkpoint unresolvable:** "Skip this plan?" or "Abort phase execution?" → record partial progress in STATE.md
</failure_handling>

<resumption>
Re-run `/gsd:execute-phase {phase}` → discover_plans finds completed SUMMARYs → skips them → resumes from first incomplete plan → continues wave execution.

STATE.md tracks: last completed plan, current wave, pending checkpoints.
</resumption>
