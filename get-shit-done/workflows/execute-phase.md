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

@~/.claude/get-shit-done/references/agent-contracts.md
@~/.claude/get-shit-done/references/context-budget.md
@~/.claude/get-shit-done/references/gates.md
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
- Optional `--cross-ai` → `CROSS_AI_FORCE=true` (force all plans through cross-AI execution)
- Optional `--no-cross-ai` → `CROSS_AI_DISABLED=true` (disable cross-AI for this run, overrides config and frontmatter)

If `--wave` is absent, preserve the current behavior of executing all incomplete waves in the phase.
</step>

<step name="initialize" priority="first">
Load all context in one call:

```bash
INIT=$(gsd-sdk query init.execute-phase "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS=$(gsd-sdk query agent-skills gsd-executor)
```

Parse JSON for: `executor_model`, `verifier_model`, `commit_docs`, `parallelization`, `branching_strategy`, `branch_name`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `plans`, `incomplete_plans`, `plan_count`, `incomplete_count`, `state_exists`, `roadmap_exists`, `phase_req_ids`, `response_language`.

**Model resolution:** If `executor_model` is `"inherit"`, omit the `model=` parameter from all `Task()` calls — do NOT pass `model="inherit"` to Task. Omitting the `model=` parameter causes Claude Code to inherit the current orchestrator model automatically. Only set `model=` when `executor_model` is an explicit model name (e.g., `"claude-sonnet-4-6"`, `"claude-opus-4-7"`).

**If `response_language` is set:** Include `response_language: {value}` in all spawned subagent prompts so any user-facing output stays in the configured language.

Read worktree config:

```bash
USE_WORKTREES=$(gsd-sdk query config-get workflow.use_worktrees 2>/dev/null || echo "true")
```

If the project uses git submodules, worktree isolation is skipped regardless of the `workflow.use_worktrees` config — the executor commit protocol cannot correctly handle submodule commits inside isolated worktrees. Sequential execution handles submodules transparently.

```bash
if [ -f .gitmodules ]; then
  echo "[worktree] Submodule project detected (.gitmodules exists) — falling back to sequential execution"
  USE_WORKTREES=false
fi
```

When `USE_WORKTREES` is `false`, all executor agents run without `isolation="worktree"` — they execute sequentially on the main working tree instead of in parallel worktrees.

Read context window size for adaptive prompt enrichment:

```bash
CONTEXT_WINDOW=$(gsd-sdk query config-get context_window 2>/dev/null || echo "200000")
```

When `CONTEXT_WINDOW >= 500000` (1M-class models), subagent prompts include richer context:
- Executor agents receive prior wave SUMMARY.md files and the phase CONTEXT.md/RESEARCH.md
- Verifier agents receive all PLAN.md, SUMMARY.md, CONTEXT.md files plus REQUIREMENTS.md
- This enables cross-phase awareness and history-aware verification

When `CONTEXT_WINDOW < 200000` (sub-200K models), subagent prompts are thinned to reduce static overhead:
- Executor agents omit extended deviation rule examples and checkpoint examples from inline prompt — load on-demand via @~/.claude/get-shit-done/references/executor-examples.md
- Planner agents omit extended anti-pattern lists and specificity examples from inline prompt — load on-demand via @~/.claude/get-shit-done/references/planner-antipatterns.md
- Core rules and decision logic remain inline; only verbose examples and edge-case lists are extracted
- This reduces executor static overhead by ~40% while preserving behavioral correctness

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
  gsd-sdk query config-set workflow._auto_chain_active false || true
fi
```
</step>

<step name="check_blocking_antipatterns" priority="first">
**MANDATORY — Check for blocking anti-patterns before any other work.**

Look for a `.continue-here.md` in the current phase directory:

```bash
ls ${phase_dir}/.continue-here.md 2>/dev/null || true
```

If `.continue-here.md` exists, parse its "Critical Anti-Patterns" table for rows with `severity` = `blocking`.

**If one or more `blocking` anti-patterns are found:**

This step cannot be skipped. Before proceeding to `check_interactive_mode` or any other step, the agent must demonstrate understanding of each blocking anti-pattern by answering all three questions for each one:

1. **What is this anti-pattern?** — Describe it in your own words, not by quoting the handoff.
2. **How did it manifest?** — Explain the specific failure that caused it to be recorded.
3. **What structural mechanism (not acknowledgment) prevents it?** — Name the concrete step, checklist item, or enforcement mechanism that stops recurrence.

Write these answers inline before continuing. If a blocking anti-pattern cannot be answered from the context in `.continue-here.md`, stop and ask the user for clarification.

**If no `.continue-here.md` exists, or no `blocking` rows are found:** Proceed directly to `check_interactive_mode`.
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
gsd-sdk query state.begin-phase --phase "${PHASE_NUMBER}" --name "${PHASE_NAME}" --plans "${PLAN_COUNT}"
```
This updates Status, Last Activity, Current focus, Current Position, and plan counts in STATE.md so frontmatter and body text reflect the active phase immediately.
</step>

<step name="discover_and_group_plans">
Load plan inventory with wave grouping in one call:

```bash
PLAN_INDEX=$(gsd-sdk query phase-plan-index "${PHASE_NUMBER}")
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

<step name="cross_ai_delegation">
**Optional step 2.5 — Delegate plans to an external AI runtime.**

This step runs after plan discovery and before normal wave execution. It identifies plans
that should be delegated to an external AI command and executes them via stdin-based prompt
delivery. Plans handled here are removed from the execute_waves plan list so the normal
executor skips them.

**Activation logic:**

1. If `CROSS_AI_DISABLED` is true (`--no-cross-ai` flag): skip this step entirely.
2. If `CROSS_AI_FORCE` is true (`--cross-ai` flag): mark ALL incomplete plans for cross-AI execution.
3. Otherwise: check each plan's frontmatter for `cross_ai: true` AND verify config
   `workflow.cross_ai_execution` is `true`. Plans matching both conditions are marked for cross-AI.

```bash
CROSS_AI_ENABLED=$(gsd-sdk query config-get workflow.cross_ai_execution 2>/dev/null || echo "false")
CROSS_AI_CMD=$(gsd-sdk query config-get workflow.cross_ai_command 2>/dev/null || echo "")
CROSS_AI_TIMEOUT=$(gsd-sdk query config-get workflow.cross_ai_timeout 2>/dev/null || echo "300")
```

**If no plans are marked for cross-AI:** Skip to execute_waves.

**If plans are marked but `cross_ai_command` is empty:** Error — tell user to set
`workflow.cross_ai_command` via `gsd-sdk query config-set workflow.cross_ai_command "<command>"`.

**For each cross-AI plan (sequentially):**

1. **Construct the task prompt** from the plan file:
   - Extract `<objective>` and `<tasks>` sections from the PLAN.md
   - Append PROJECT.md context (project name, description, tech stack)
   - Format as a self-contained execution prompt

2. **Check for dirty working tree before execution:**
   ```bash
   if ! git diff --quiet HEAD 2>/dev/null; then
     echo "WARNING: dirty working tree detected — the external AI command may produce uncommitted changes that conflict with existing modifications"
   fi
   ```

3. **Run the external command** from the project root, writing the prompt to stdin.
   Never shell-interpolate the prompt — always pipe via stdin to prevent injection:
   ```bash
   echo "$TASK_PROMPT" | timeout "${CROSS_AI_TIMEOUT}s" ${CROSS_AI_CMD} > "$CANDIDATE_SUMMARY" 2>"$ERROR_LOG"
   EXIT_CODE=$?
   ```

4. **Evaluate the result:**

   **Success (exit 0 + valid summary):**
   - Read `$CANDIDATE_SUMMARY` and validate it contains meaningful content
     (not empty, has at least a heading and description — a valid SUMMARY.md structure)
   - Write it as the plan's SUMMARY.md file
   - Update STATE.md plan status to complete
   - Update ROADMAP.md progress
   - Mark plan as handled — skip it in execute_waves

   **Failure (non-zero exit or invalid summary):**
   - Display the error output and exit code
   - Warn: "The external command may have left uncommitted changes or partial edits
     in the working tree. Review `git status` and `git diff` before proceeding."
   - Offer three choices:
     - **retry** — run the same plan through cross-AI again
     - **skip** — fall back to normal executor for this plan (re-add to execute_waves list)
     - **abort** — stop execution entirely, preserve state for resume

5. **After all cross-AI plans processed:** Remove successfully handled plans from the
   incomplete plan list so execute_waves skips them. Any skipped-to-fallback plans remain
   in the list for normal executor processing.
</step>

<step name="execute_waves">
Execute each selected wave in sequence. Within a wave: parallel if `PARALLELIZATION=true`, sequential if `false`.

**Stream-idle-timeout prevention — checkpoint heartbeats (#2410):**

Multi-plan phases can accumulate enough subagent context that the Claude API
SSE layer terminates with `Stream idle timeout - partial response received`
between a large tool_result and the next assistant turn (seen on Claude Code
+ Opus 4.7 at ~200K+ cache_read). To keep the stream warm, emit short
assistant-text heartbeats — **no tool call, just a literal line** — at every
wave and plan boundary. Each heartbeat MUST start with `[checkpoint]` so
tooling and `/gsd-manager`'s background-completion handler can grep partial
transcripts. `{P}/{Q}` is the phase-wide completed/total plans counter and
increases monotonically across waves. `{status}` is `complete` (success),
`failed` (executor error), or `checkpoint` (human-gate returned).

```
[checkpoint] phase {PHASE_NUMBER} wave {N}/{M} starting, {wave_plan_count} plan(s), {P}/{Q} plans done
[checkpoint] phase {PHASE_NUMBER} wave {N}/{M} plan {plan_id} starting ({P}/{Q} plans done)
[checkpoint] phase {PHASE_NUMBER} wave {N}/{M} plan {plan_id} {status} ({P}/{Q} plans done)
[checkpoint] phase {PHASE_NUMBER} wave {N}/{M} complete, {P}/{Q} plans done ({wave_success}/{wave_plan_count} ok)
```

**For each wave:**

1. **Intra-wave files_modified overlap check (BEFORE spawning):**

   Before spawning any agents for this wave, inspect the `files_modified` list of all plans
   in the wave. Check every pair of plans in the wave — if any two plans share even one file
   in their `files_modified` lists, those plans have an implicit dependency and MUST NOT run
   in parallel.

   **Detection algorithm (pseudocode):**
   ```
   seen_files = {}
   overlapping_plans = []
   for each plan in wave_plans:
     for each file in plan.files_modified:
       if file in seen_files:
         overlapping_plans.add(plan, seen_files[file])  # both plans overlap on this file
       else:
         seen_files[file] = plan
   ```

   **If overlap is detected:**
   - Warn the user:
     ```
     ⚠ Intra-wave files_modified overlap detected in Wave {N}:
       Plan {A} and Plan {B} both modify {file}
       Running these plans sequentially to avoid parallel worktree conflicts.
     ```
   - Override `PARALLELIZATION` to `false` for this wave only — run all plans in the wave
     sequentially regardless of the global parallelization setting.
   - This is a safety net for plans that were incorrectly assigned to the same wave.
     The planner should have caught this; flag it as a planning defect so the user can
     replan the phase if desired.

   **If no overlap:** proceed normally (parallel if `PARALLELIZATION=true`).

2. **Describe what's being built (BEFORE spawning):**

   **First, emit the wave-start checkpoint heartbeat as a literal assistant-text
   line — no tool call (#2410). Do NOT skip this even for single-plan waves; it
   is required before any further reasoning or spawning:**

   ```
   [checkpoint] phase {PHASE_NUMBER} wave {N}/{M} starting, {wave_plan_count} plan(s), {P}/{Q} plans done
   ```

   Then read each plan's `<objective>`. Extract what's being built and why.

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

3. **Spawn executor agents:**

   **Emit a plan-start heartbeat (literal line, no tool call) immediately before
   each `Task()` dispatch (#2410):**

   ```
   [checkpoint] phase {PHASE_NUMBER} wave {N}/{M} plan {plan_id} starting ({P}/{Q} plans done)
   ```

   Pass paths only — executors read files themselves with their fresh context window.
   For 200k models, this keeps orchestrator context lean (~10-15%).
   For 1M+ models (Opus 4.6, Sonnet 4.6), richer context can be passed directly.

   **Worktree mode** (`USE_WORKTREES` is not `false`):

   Before spawning, capture the current HEAD:
   ```bash
   EXPECTED_BASE=$(git rev-parse HEAD)
   ```

   **Sequential dispatch for parallel execution (waves with 2+ agents):**
   When spawning multiple agents in a wave, dispatch each `Task()` call **one at a time
   with `run_in_background: true`** — do NOT send all Task calls in a single message.
   `git worktree add` acquires an exclusive lock on `.git/config.lock`, so simultaneous
   calls race for this lock and fail. Sequential dispatch ensures each worktree finishes
   creation before the next begins (the round-trip latency of each tool call provides
   natural spacing), while all agents still **run in parallel** once created.

   ```
   # CORRECT: dispatch one Task() per message, each with run_in_background: true
   # → worktrees created sequentially, agents execute in parallel
   #
   # WRONG: multiple Task() calls in a single message
   # → simultaneous git worktree add → .git/config.lock contention → failures
   ```

   ```
   Task(
     subagent_type="gsd-executor",
     description="Execute plan {plan_number} of phase {phase_number}",
     # Only include model= when executor_model is an explicit model name.
     # When executor_model is "inherit", omit this parameter entirely so
     # Claude Code inherits the orchestrator model automatically.
     model="{executor_model}",  # omit this line when executor_model == "inherit"
     isolation="worktree",
     prompt="
       <objective>
       Execute plan {plan_number} of phase {phase_number}-{phase_name}.
       Commit each task atomically. Create SUMMARY.md.
       Do NOT update STATE.md or ROADMAP.md — the orchestrator owns those writes after all worktree agents in the wave complete.
       </objective>

       <worktree_branch_check>
       FIRST ACTION before any other work: verify this worktree's branch is based on the correct commit.

       Run:
       ```bash
       ACTUAL_BASE=$(git merge-base HEAD {EXPECTED_BASE})
       ```

       If `ACTUAL_BASE` != `{EXPECTED_BASE}` (i.e. the worktree branch was created from an older
       base such as `main` instead of the feature branch HEAD), hard-reset to the correct base:
       ```bash
       # Safe: this runs before any agent work, so no uncommitted changes to lose
       git reset --hard {EXPECTED_BASE}
       # Verify correction succeeded
       if [ "$(git rev-parse HEAD)" != "{EXPECTED_BASE}" ]; then
         echo "ERROR: Could not correct worktree base — aborting to prevent data loss"
         exit 1
       fi
       ```

       `reset --hard` is safe here because this is a fresh worktree with no user changes. It
       resets both the HEAD pointer AND the working tree to the correct base commit (#2015).

       If `ACTUAL_BASE` == `{EXPECTED_BASE}`: the branch base is correct, proceed immediately.

       This check fixes a known issue where `EnterWorktree` creates branches from
       `main` instead of the current feature branch HEAD (affects all platforms).
       </worktree_branch_check>

       <parallel_execution>
       You are running as a PARALLEL executor agent in a git worktree.
       Use --no-verify on all git commits to avoid pre-commit hook contention
       with other agents. The orchestrator validates hooks once after all agents complete.
       For `gsd-sdk query commit` (or legacy `gsd-tools.cjs` commit): add --no-verify flag when needed.
       For direct git commits: use git commit --no-verify -m "..."

       IMPORTANT: Do NOT modify STATE.md or ROADMAP.md. execute-plan.md
       auto-detects worktree mode (`.git` is a file, not a directory) and skips
       shared file updates automatically. The orchestrator updates them centrally
       after merge.

       REQUIRED: SUMMARY.md MUST be committed before you return. In worktree mode the
       git_commit_metadata step in execute-plan.md commits SUMMARY.md and REQUIREMENTS.md
       only (STATE.md and ROADMAP.md are excluded automatically). Do NOT skip or defer
       this commit — the orchestrator force-removes the worktree after you return, and
       any uncommitted SUMMARY.md will be permanently lost (#2070).
       </parallel_execution>

       <execution_context>
       @~/.claude/get-shit-done/workflows/execute-plan.md
       @~/.claude/get-shit-done/templates/summary.md
       @~/.claude/get-shit-done/references/checkpoints.md
       @~/.claude/get-shit-done/references/tdd.md
       ${CONTEXT_WINDOW < 200000 ? '' : '@~/.claude/get-shit-done/references/executor-examples.md'}
       </execution_context>

       <files_to_read>
       Read these files at execution start using the Read tool:
       - {phase_dir}/{plan_file} (Plan)
       - .planning/PROJECT.md (Project context — core value, requirements, evolution rules)
       - .planning/STATE.md (State)
       - .planning/config.json (Config, if exists)
       ${CONTEXT_WINDOW >= 500000 ? `
       - ${phase_dir}/*-CONTEXT.md (User decisions from discuss-phase — honors locked choices)
       - ${phase_dir}/*-RESEARCH.md (Technical research — pitfalls and patterns to follow)
       - ${prior_wave_summaries} (SUMMARY.md files from earlier waves in this phase — what was already built)
       ` : ''}
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
       - [ ] No modifications to shared orchestrator artifacts (the orchestrator handles all post-wave shared-file writes)
       </success_criteria>
     "
   )
   ```

   **Sequential mode** (`USE_WORKTREES` is `false`):

   Omit `isolation="worktree"` from the Task call. Replace the `<parallel_execution>` block with:

   ```
       <sequential_execution>
       You are running as a SEQUENTIAL executor agent on the main working tree.
       Use normal git commits (with hooks). Do NOT use --no-verify.
       </sequential_execution>
   ```

   The sequential mode Task prompt uses the same structure as worktree mode but with these differences in success_criteria — since there is only one agent writing at a time, there are no shared-file conflicts:

   ```
       <success_criteria>
       - [ ] All tasks executed
       - [ ] Each task committed individually
       - [ ] SUMMARY.md created in plan directory
       - [ ] STATE.md updated with position and decisions
       - [ ] ROADMAP.md updated with plan progress (via `roadmap update-plan-progress`)
       </success_criteria>
   ```

   When worktrees are disabled, execute plans **one at a time within each wave** (sequential) regardless of the `PARALLELIZATION` setting — multiple agents writing to the same working tree concurrently would cause conflicts.

4. **Wait for all agents in wave to complete.**

   **Plan-complete heartbeat (#2410):** as each executor returns (or is verified
   via spot-check below), emit one line — `complete` advances `{P}`, `failed`
   and `checkpoint` do not but still warm the stream:

   ```
   [checkpoint] phase {PHASE_NUMBER} wave {N}/{M} plan {plan_id} complete ({P}/{Q} plans done)
   [checkpoint] phase {PHASE_NUMBER} wave {N}/{M} plan {plan_id} failed ({P}/{Q} plans done)
   [checkpoint] phase {PHASE_NUMBER} wave {N}/{M} plan {plan_id} checkpoint ({P}/{Q} plans done)
   ```

   **Completion signal fallback (Copilot and runtimes where Task() may not return):**

   If a spawned agent does not return a completion signal but appears to have finished
   its work, do NOT block indefinitely. Instead, verify completion via spot-checks:

   ```bash
   # For each plan in this wave, check if the executor finished:
   SUMMARY_EXISTS=$(test -f "{phase_dir}/{plan_number}-{plan_padded}-SUMMARY.md" && echo "true" || echo "false")
   COMMITS_FOUND=$(git log --oneline --all --grep="{phase_number}-{plan_padded}" --since="1 hour ago" | head -1)
   ```

   **If SUMMARY.md exists AND commits are found:** The agent completed successfully —
   treat as done and proceed to step 5. Log: `"✓ {Plan ID} completed (verified via spot-check — completion signal not received)"`

   **If SUMMARY.md does NOT exist after a reasonable wait:** The agent may still be
   running or may have failed silently. Check `git log --oneline -5` for recent
   activity. If commits are still appearing, wait longer. If no activity, report
   the plan as failed and route to the failure handler in step 6.

   **This fallback applies automatically to all runtimes.** Claude Code's Task() normally
   returns synchronously, but the fallback ensures resilience if it doesn't.

5. **Post-wave hook validation (parallel mode only):**

   When agents committed with `--no-verify`, run pre-commit hooks once after the wave:
   ```bash
   # Run project's pre-commit hooks on the current state
   git diff --cached --quiet || git stash  # stash any unstaged changes
   git hook run pre-commit 2>&1 || echo "⚠ Pre-commit hooks failed — review before continuing"
   ```
   If hooks fail: report the failure and ask "Fix hook issues now?" or "Continue to next wave?"

5.5. **Worktree cleanup (when `isolation="worktree"` was used):**

   When executor agents ran in worktree isolation, their commits land on temporary branches in separate working trees. After the wave completes, merge these changes back and clean up:

   ```bash
   # List worktrees created by this wave's agents
   WORKTREES=$(git worktree list --porcelain | grep "^worktree " | grep -v "$(pwd)$" | sed 's/^worktree //')

   for WT in $WORKTREES; do
     # Get the branch name for this worktree
     WT_BRANCH=$(git -C "$WT" rev-parse --abbrev-ref HEAD 2>/dev/null)
     if [ -n "$WT_BRANCH" ] && [ "$WT_BRANCH" != "HEAD" ]; then
       CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

       # --- Orchestrator file protection (#1756) ---
       # Snapshot orchestrator-owned files BEFORE merge. If the worktree
       # branch outlived a milestone transition, its versions of STATE.md
       # and ROADMAP.md are stale. Main always wins for these files.
       STATE_BACKUP=$(mktemp)
       ROADMAP_BACKUP=$(mktemp)
       [ -f .planning/STATE.md ] && cp .planning/STATE.md "$STATE_BACKUP" || true
       [ -f .planning/ROADMAP.md ] && cp .planning/ROADMAP.md "$ROADMAP_BACKUP" || true

       # Snapshot list of files on main BEFORE merge to detect resurrections
       PRE_MERGE_FILES=$(git ls-files .planning/)

       # Pre-merge deletion check: warn if the worktree branch deletes tracked files
       DELETIONS=$(git diff --diff-filter=D --name-only HEAD..."$WT_BRANCH" 2>/dev/null || true)
       if [ -n "$DELETIONS" ]; then
         echo "BLOCKED: Worktree branch $WT_BRANCH contains file deletions: $DELETIONS"
         echo "Review these deletions before merging. If intentional, remove this guard and re-run."
         rm -f "$STATE_BACKUP" "$ROADMAP_BACKUP"
         continue
       fi

       # Merge the worktree branch into the current branch (--no-ff ensures a merge commit so HEAD~1 is reliable)
       git merge "$WT_BRANCH" --no-ff --no-edit -m "chore: merge executor worktree ($WT_BRANCH)" 2>&1 || {
         echo "⚠ Merge conflict from worktree $WT_BRANCH — resolve manually"
         echo "  STATE.md backup:   $STATE_BACKUP"
         echo "  ROADMAP.md backup: $ROADMAP_BACKUP"
         echo "  Restore with: cp \$STATE_BACKUP .planning/STATE.md && cp \$ROADMAP_BACKUP .planning/ROADMAP.md"
         break
       }

       # Post-merge deletion audit: detect bulk file deletions in merge commit (#2384)
       # --diff-filter=D HEAD~1 HEAD shows files deleted by the merge commit itself.
       # Exclude .planning/ — orchestrator-owned deletions there are expected (resurrections
       # are handled below). Require ALLOW_BULK_DELETE=1 to bypass for intentional large refactors.
       MERGE_DEL_COUNT=$(git diff --diff-filter=D --name-only HEAD~1 HEAD 2>/dev/null | grep -vc '^\.planning/' || true)
       if [ "$MERGE_DEL_COUNT" -gt 5 ] && [ "${ALLOW_BULK_DELETE:-0}" != "1" ]; then
         MERGE_DELETIONS=$(git diff --diff-filter=D --name-only HEAD~1 HEAD 2>/dev/null | grep -v '^\.planning/' || true)
         echo "⚠ BLOCKED: Merge of $WT_BRANCH deleted $MERGE_DEL_COUNT files outside .planning/ — reverting to protect repository integrity (#2384)"
         echo "$MERGE_DELETIONS"
         echo "  If these deletions are intentional, re-run with ALLOW_BULK_DELETE=1"
         git reset --hard HEAD~1 2>/dev/null || true
         rm -f "$STATE_BACKUP" "$ROADMAP_BACKUP"
         continue
       fi

       # Restore orchestrator-owned files (main always wins)
       if [ -s "$STATE_BACKUP" ]; then
         cp "$STATE_BACKUP" .planning/STATE.md
       fi
       if [ -s "$ROADMAP_BACKUP" ]; then
         cp "$ROADMAP_BACKUP" .planning/ROADMAP.md
       fi
       rm -f "$STATE_BACKUP" "$ROADMAP_BACKUP"

       # Detect files deleted on main but re-added by worktree merge
       # (e.g., archived phase directories that were intentionally removed)
       # A "resurrected" file must have a deletion event in main's ancestry —
       # brand-new files (e.g. SUMMARY.md just created by the executor) have no
       # such history and must NOT be removed (#2501).
       DELETED_FILES=$(git diff --diff-filter=A --name-only HEAD~1 -- .planning/ 2>/dev/null || true)
       for RESURRECTED in $DELETED_FILES; do
         # Only delete if this file was previously tracked on main and then
         # deliberately removed (has a deletion event in git history).
         WAS_DELETED=$(git log --follow --diff-filter=D --name-only --format="" HEAD~1 -- "$RESURRECTED" 2>/dev/null | grep -c . || true)
         if [ "${WAS_DELETED:-0}" -gt 0 ]; then
           git rm -f "$RESURRECTED" 2>/dev/null || true
         fi
       done

       # Amend merge commit with restored files if any changed
       if ! git diff --quiet .planning/STATE.md .planning/ROADMAP.md 2>/dev/null || \
          [ -n "$DELETED_FILES" ]; then
         # Only amend the commit with .planning/ files if commit_docs is enabled (#1783)
         COMMIT_DOCS=$(gsd-sdk query config-get commit_docs 2>/dev/null || echo "true")
         if [ "$COMMIT_DOCS" != "false" ]; then
           git add .planning/STATE.md .planning/ROADMAP.md 2>/dev/null || true
           git commit --amend --no-edit 2>/dev/null || true
         fi
       fi

       # Safety net: commit any uncommitted SUMMARY.md before force-removing the worktree.
       # This guards against executors that skipped the git_commit_metadata step (#2070).
       UNCOMMITTED_SUMMARY=$(git -C "$WT" ls-files --modified --others --exclude-standard -- "*SUMMARY.md" 2>/dev/null || true)
       if [ -n "$UNCOMMITTED_SUMMARY" ]; then
         echo "⚠ SUMMARY.md was not committed by executor — committing now to prevent data loss"
         git -C "$WT" add -- "*SUMMARY.md" 2>/dev/null || true
         git -C "$WT" commit --no-verify -m "docs(recovery): rescue uncommitted SUMMARY.md before worktree removal (#2070)" 2>/dev/null || true
         # Re-merge the recovery commit
         git merge "$WT_BRANCH" --no-edit -m "chore: merge rescued SUMMARY.md from executor worktree ($WT_BRANCH)" 2>/dev/null || true
       fi

       # Remove the worktree
       if ! git worktree remove "$WT" --force; then
         WT_NAME=$(basename "$WT")
         if [ -f ".git/worktrees/${WT_NAME}/locked" ]; then
           echo "⚠ Worktree $WT is locked — attempting to unlock and retry"
           git worktree unlock "$WT" 2>/dev/null || true
           if ! git worktree remove "$WT" --force; then
             echo "⚠ Residual worktree at $WT — manual cleanup required after session exits:"
             echo "    git worktree unlock \"$WT\" && git worktree remove \"$WT\" --force && git branch -D \"$WT_BRANCH\""
           fi
         else
           echo "⚠ Residual worktree at $WT (remove failed) — investigate manually"
         fi
       fi

       # Delete the temporary branch
       git branch -D "$WT_BRANCH" 2>/dev/null || true
     fi
   done
   ```

   **If `workflow.use_worktrees` is `false`:** Agents ran on the main working tree — skip this step entirely.

   **If no worktrees found:** Skip silently — agents may have been spawned without worktree isolation.

5.6. **Post-merge test gate (parallel mode only):**

   After merging all worktrees in a wave, run the project's test suite to catch
   cross-plan integration issues that individual worktree self-checks cannot detect
   (e.g., conflicting type definitions, removed exports, import changes).

   This addresses the Generator self-evaluation blind spot identified in Anthropic's
   harness engineering research: agents reliably report Self-Check: PASSED even when
   merging their work creates failures.

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
       TEST_CMD="python -m pytest -x -q --tb=short 2>&1 || uv run python -m pytest -x -q --tb=short"
     else
       TEST_CMD="true"
       echo "⚠ No test runner detected — skipping post-merge test gate"
     fi
   fi
   # Detect test runner and run quick smoke test (timeout: 5 minutes)
   TEST_EXIT=0
   timeout 300 bash -c "$TEST_CMD" 2>&1
   TEST_EXIT=$?
   if [ "${TEST_EXIT}" -eq 0 ]; then
     echo "✓ Post-merge test gate passed — no cross-plan conflicts"
   elif [ "${TEST_EXIT}" -eq 124 ]; then
     echo "⚠ Post-merge test gate timed out after 5 minutes"
   else
     echo "✗ Post-merge test gate failed (exit code ${TEST_EXIT})"
     WAVE_FAILURE_COUNT=$((WAVE_FAILURE_COUNT + 1))
   fi
   ```

   **If `TEST_EXIT` is 0 (pass):** `✓ Post-merge test gate: {N} tests passed — no cross-plan conflicts` → continue to orchestrator tracking update.

   **If `TEST_EXIT` is 124 (timeout):** Log warning, treat as non-blocking, continue. Tests may need a longer budget or manual run.

   **If `TEST_EXIT` is non-zero (test failure):** Increment `WAVE_FAILURE_COUNT` to track
   cumulative failures across waves. Subsequent waves should report:
   `⚠ Note: ${WAVE_FAILURE_COUNT} prior wave(s) had test failures`

5.7. **Post-wave shared artifact update (worktree mode only, skip if tests failed):**

   When executor agents ran with `isolation="worktree"`, they skipped STATE.md and ROADMAP.md updates to avoid last-merge-wins overwrites. The orchestrator is the single writer for these files. After worktrees are merged back, update shared artifacts once.

   **Only update tracking when tests passed (TEST_EXIT=0).**
   If tests failed or timed out, skip the tracking update — plans should
   not be marked as complete when integration tests are failing or inconclusive.

   ```bash
   # Guard: only update tracking if post-merge tests passed
   # Timeout (124) is treated as inconclusive — do NOT mark plans complete
   if [ "${TEST_EXIT}" -eq 0 ]; then
     # Update ROADMAP plan progress for each completed plan in this wave
     for plan_id in {completed_plan_ids}; do
       gsd-sdk query roadmap.update-plan-progress "${PHASE_NUMBER}" "${plan_id}" "complete"
     done

     # Only commit tracking files if they actually changed
     if ! git diff --quiet .planning/ROADMAP.md .planning/STATE.md 2>/dev/null; then
       gsd-sdk query commit "docs(phase-${PHASE_NUMBER}): update tracking after wave ${N}" .planning/ROADMAP.md .planning/STATE.md
     fi
   elif [ "${TEST_EXIT}" -eq 124 ]; then
     echo "⚠ Skipping tracking update — test suite timed out. Plans remain in-progress. Run tests manually to confirm."
   else
     echo "⚠ Skipping tracking update — post-merge tests failed (exit ${TEST_EXIT}). Plans remain in-progress until tests pass."
   fi
   ```

   Where `WAVE_PLAN_IDS` is the space-separated list of plan IDs that completed in this wave.

   **If `workflow.use_worktrees` is `false`:** Sequential agents already updated STATE.md and ROADMAP.md themselves — skip this step.

5.8. **Handle test gate failures (when `WAVE_FAILURE_COUNT > 0`):**

   ```
   ## ⚠ Post-Merge Test Failure (cumulative failures: ${WAVE_FAILURE_COUNT})

   Wave {N} worktrees merged successfully, but {M} tests fail after merge.
   This typically indicates conflicting changes across parallel plans
   (e.g., type definitions, shared imports, API contracts).

   Failed tests:
   {first 10 lines of failure output}

   Options:
   1. Fix now (recommended) — resolve conflicts before next wave
   2. Continue — failures may compound in subsequent waves
   ```

   Note: If `WAVE_FAILURE_COUNT > 1`, strongly recommend "Fix now" — compounding
   failures across multiple waves become exponentially harder to diagnose.

   If "Fix now": diagnose failures (typically import conflicts, missing types,
   or changed function signatures from parallel plans modifying the same module).
   Fix, commit as `fix: resolve post-merge conflicts from wave {N}`, re-run tests.

   **Why this matters:** Worktree isolation means each agent's Self-Check passes
   in isolation. But when merged, add/add conflicts in shared files (models, registries,
   CLI entry points) can silently drop code. The post-merge gate catches this before
   the next wave builds on a broken foundation.

6. **Report completion — spot-check claims first:**

   **Wave-close heartbeat (#2410):** after spot-checks finish (pass or fail),
   before the `## Wave {N} Complete` summary, emit as a literal line:

   ```
   [checkpoint] phase {PHASE_NUMBER} wave {N}/{M} complete, {P}/{Q} plans done ({wave_success}/{wave_plan_count} ok)
   ```



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

7. **Handle failures:**

   **Known Claude Code bug (classifyHandoffIfNeeded):** If an agent reports "failed" with error containing `classifyHandoffIfNeeded is not defined`, this is a Claude Code runtime bug — not a GSD or agent issue. The error fires in the completion handler AFTER all tool calls finish. In this case: run the same spot-checks as step 5 (SUMMARY.md exists, git commits present, no Self-Check: FAILED). If spot-checks PASS → treat as **successful**. If spot-checks FAIL → treat as real failure below.

   For real failures: report which plan failed → ask "Continue?" or "Stop?" → if continue, dependent plans may also fail. If stop, partial completion report.

7b. **Pre-wave dependency check (waves 2+ only):**

    Before spawning wave N+1, for each plan in the upcoming wave:
    ```bash
    gsd-sdk query verify.key-links {phase_dir}/{plan}-PLAN.md
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

8. **Execute checkpoint plans between waves** — see `<checkpoint_handling>`.

9. **Proceed to next wave.**
</step>

<step name="checkpoint_handling">
Plans with `autonomous: false` require user interaction.

**Auto-mode checkpoint handling:**

Read auto-advance config (chain flag OR user preference — same boolean as `check.auto-mode`):
```bash
AUTO_MODE=$(gsd-sdk query check auto-mode --pick active 2>/dev/null || echo "false")
```

When executor returns a checkpoint AND `AUTO_MODE` is `true`:
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

**Security gate check:**
```bash
SECURITY_CFG=$(gsd-sdk query config-get workflow.security_enforcement --raw 2>/dev/null || echo "true")
SECURITY_FILE=$(ls "${PHASE_DIR}"/*-SECURITY.md 2>/dev/null | head -1)
```

If `SECURITY_CFG` is `false`: skip.

If `SECURITY_CFG` is `true` AND `SECURITY_FILE` is empty (no SECURITY.md yet):
Include in the next-steps routing output:
```
⚠ Security enforcement enabled — run before advancing:
  /gsd-secure-phase {PHASE} ${GSD_WS}
```

If `SECURITY_CFG` is `true` AND SECURITY.md exists: check frontmatter `threats_open`. If > 0:
```
⚠ Security gate: {threats_open} threats open
  /gsd-secure-phase {PHASE} — resolve before advancing
```
</step>

<step name="tdd_review_checkpoint">
**Optional step — TDD collaborative review.**

```bash
TDD_MODE=$(gsd-sdk query config-get workflow.tdd_mode 2>/dev/null || echo "false")
```

**Skip if `TDD_MODE` is `false`.**

When `TDD_MODE` is `true`, check whether any completed plans in this phase have `type: tdd` in their frontmatter:

```bash
TDD_PLANS=$(grep -rl "^type: tdd" "${PHASE_DIR}"/*-PLAN.md 2>/dev/null | wc -l | tr -d ' ')
```

**If `TDD_PLANS` > 0:** Insert end-of-phase collaborative review checkpoint.

1. Collect all SUMMARY.md files for TDD plans
2. For each TDD plan summary, verify the RED/GREEN/REFACTOR gate sequence:
   - RED gate: A failing test commit exists (`test(...)` commit with MUST-fail evidence)
   - GREEN gate: An implementation commit exists (`feat(...)` commit making tests pass)
   - REFACTOR gate: Optional cleanup commit (`refactor(...)` commit, tests still pass)
3. If any TDD plan is missing the RED or GREEN gate commits, flag it:
   ```
   ⚠ TDD gate violation: Plan {plan_id} missing {RED|GREEN} phase commit.
     Expected commit pattern: test({phase}-{plan}): ... → feat({phase}-{plan}): ...
   ```
4. Present collaborative review summary:
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    TDD REVIEW — Phase {X}
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   TDD Plans: {TDD_PLANS} | Gate violations: {count}

   | Plan | RED | GREEN | REFACTOR | Status |
   |------|-----|-------|----------|--------|
   | {id} |  ✓  |   ✓   |    ✓     | Pass   |
   | {id} |  ✓  |   ✗   |    —     | FAIL   |
   ```

**Gate violations are advisory** — they do not block execution but are surfaced to the user for review. The verifier agent (step `verify_phase_goal`) will also check TDD discipline as part of its quality assessment.
</step>

<step name="handle_partial_wave_execution">
If `WAVE_FILTER` was used, re-run plan discovery after execution:

```bash
POST_PLAN_INDEX=$(gsd-sdk query phase-plan-index "${PHASE_NUMBER}")
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

/gsd-execute-phase {phase} ${GSD_WS}                # Continue remaining waves
/gsd-execute-phase {phase} --wave {next} ${GSD_WS}  # Run the next wave explicitly
```

**If no incomplete plans remain after the selected wave finishes:**
- continue with the normal phase-level verification and completion flow below
- this means the selected wave happened to be the last remaining work in the phase
</step>

<step name="code_review_gate" required="true">
**This step is REQUIRED and must not be skipped.** Auto-invoke code review on the phase's source changes. Advisory only — never blocks execution flow.

**Config gate:**
```bash
CODE_REVIEW_ENABLED=$(gsd-sdk query config-get workflow.code_review 2>/dev/null || echo "true")
```

If `CODE_REVIEW_ENABLED` is `"false"`: display "Code review skipped (workflow.code_review=false)" and proceed to next step.

**Invoke review:**
```
Skill(skill="gsd:code-review", args="${PHASE_NUMBER}")
```

**Check results using deterministic path (not glob):**
```bash
PADDED=$(printf "%02d" "${PHASE_NUMBER}")
REVIEW_FILE="${PHASE_DIR}/${PADDED}-REVIEW.md"
REVIEW_STATUS=$(sed -n '/^---$/,/^---$/p' "$REVIEW_FILE" | grep "^status:" | head -1 | cut -d: -f2 | tr -d ' ')
```

If REVIEW_STATUS is not "clean" and not "skipped" and not empty, display:
```
Code review found issues. Consider running:
/gsd-code-review-fix ${PHASE_NUMBER}
```

**Error handling:** If the Skill invocation fails or throws, catch the error, display "Code review encountered an error (non-blocking): {error}" and proceed to next step. Review failures must never block execution.

Regardless of review result, ALWAYS proceed to close_parent_artifacts → regression_gate → verify_phase_goal.
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
PARENT_INFO=$(gsd-sdk query find-phase "${PARENT_PHASE}" --raw)
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
gsd-sdk query commit "docs(phase-${PARENT_PHASE}): resolve UAT gaps and debug sessions after ${PHASE_NUMBER} gap closure" .planning/phases/*${PARENT_PHASE}*/*-UAT.md .planning/debug/resolved/*.md
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
# Resolve test command: project config > Makefile > language sniff
REG_TEST_CMD=$(gsd-sdk query config-get workflow.test_command --default "" 2>/dev/null || true)
if [ -z "$REG_TEST_CMD" ]; then
  if [ -f "Makefile" ] && grep -q "^test:" Makefile; then
    REG_TEST_CMD="make test"
  elif [ -f "Justfile" ] || [ -f "justfile" ]; then
    REG_TEST_CMD="just test"
  elif [ -f "package.json" ]; then
    REG_TEST_CMD="npm test"
  elif [ -f "Cargo.toml" ]; then
    REG_TEST_CMD="cargo test"
  elif [ -f "go.mod" ]; then
    REG_TEST_CMD="go test ./..."
  elif [ -f "requirements.txt" ] || [ -f "pyproject.toml" ]; then
    REG_TEST_CMD="python -m pytest ${REGRESSION_FILES} -q --tb=short"
  else
    REG_TEST_CMD="true"
  fi
fi
# Detect test runner and run prior phase tests
eval "$REG_TEST_CMD" 2>&1
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

<step name="schema_drift_gate">
Post-execution schema drift detection. Catches false-positive verification where
build/types pass because TypeScript types come from config, not the live database.

**Run after execution completes but BEFORE verification marks success.**

```bash
SCHEMA_DRIFT=$(gsd-sdk query verify.schema-drift "${PHASE_NUMBER}" 2>/dev/null)
```

Parse JSON result for: `drift_detected`, `blocking`, `schema_files`, `orms`, `unpushed_orms`, `message`.

**If `drift_detected` is false:** Skip to verify_phase_goal.

**If `drift_detected` is true AND `blocking` is true:**

Check for override:
```bash
SKIP_SCHEMA=$(echo "${GSD_SKIP_SCHEMA_CHECK:-false}")
```

**If `SKIP_SCHEMA` is `true`:**

Display:
```
⚠ Schema drift detected but GSD_SKIP_SCHEMA_CHECK=true — bypassing gate.

Schema files changed: {schema_files}
ORMs requiring push: {unpushed_orms}

Proceeding to verification (database may be out of sync).
```
→ Continue to verify_phase_goal.

**If `SKIP_SCHEMA` is not `true`:**

BLOCK verification. Display:

```
## BLOCKED: Schema Drift Detected

Schema-relevant files changed during this phase but no database push command
was executed. Build and type checks pass because TypeScript types come from
config, not the live database — verification would produce a false positive.

Schema files changed: {schema_files}
ORMs requiring push: {unpushed_orms}

Required push commands:
{For each unpushed ORM, show the push command from the message}

Options:
1. Run push command now (recommended) — execute the push, then re-verify
2. Skip schema check (GSD_SKIP_SCHEMA_CHECK=true) — bypass this gate
3. Abort — stop execution and investigate
```

If `TEXT_MODE` is true, present as a plain-text numbered list. Otherwise use AskUserQuestion.

**If user selects option 1:** Present the specific push command(s) to run. After user confirms execution, re-run the schema drift check. If it passes, continue to verify_phase_goal.

**If user selects option 2:** Set override and continue to verify_phase_goal.

**If user selects option 3:** Stop execution. Report partial completion.
</step>

<step name="codebase_drift_gate">
Post-execution structural drift detection (#2003). Non-blocking by contract:
any internal error here MUST fall through to `verify_phase_goal`. The phase
is never failed by this gate.

Load and follow the full step spec from
`get-shit-done/workflows/execute-phase/steps/codebase-drift-gate.md` —
covers the SDK call, JSON contract, `warn` vs `auto-remap` branches, mapper
spawn template, and the two `workflow.drift_*` config keys.
</step>

<step name="verify_phase_goal">
Verify phase achieved its GOAL, not just completed tasks.

```bash
VERIFIER_SKILLS=$(gsd-sdk query agent-skills gsd-verifier)
```

```
Task(
  description="Verify phase {phase_number} goal achievement",
  prompt="Verify phase {phase_number} goal achievement.
Phase directory: {phase_dir}
Phase goal: {goal from ROADMAP.md}
Phase requirement IDs: {phase_req_ids}
Check must_haves against actual codebase.
Cross-reference requirement IDs from PLAN frontmatter against REQUIREMENTS.md — every ID MUST be accounted for.
Create VERIFICATION.md.

<files_to_read>
Read these files before verification:
- {phase_dir}/*-PLAN.md (All plans — understand intent, check must_haves)
- {phase_dir}/*-SUMMARY.md (All summaries — cross-reference claimed vs actual)
- .planning/REQUIREMENTS.md (Requirement traceability)
${CONTEXT_WINDOW >= 500000 ? `- {phase_dir}/*-CONTEXT.md (User decisions — verify they were honored)
- {phase_dir}/*-RESEARCH.md (Known pitfalls — check for traps)
- Prior VERIFICATION.md files from earlier phases (regression check)
` : ''}
</files_to_read>

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
| `gaps_found` | Present gap summary, offer `/gsd-plan-phase {phase} --gaps ${GSD_WS}` |

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
gsd-sdk query commit "test({phase_num}): persist human verification items as UAT" "{phase_dir}/{phase_num}-HUMAN-UAT.md"
```

**Step B: Present to user:**

```
## ✓ Phase {X}: {Name} — Human Verification Required

All automated checks passed. {N} items need human testing:

{From VERIFICATION.md human_verification section}

Items saved to `{phase_num}-HUMAN-UAT.md` — they will appear in `/gsd-progress` and `/gsd-audit-uat`.

"approved" → continue | Report issues → gap closure
```

**If user says "approved":** Proceed to `update_roadmap`. The HUMAN-UAT.md file persists with `status: partial` and will surface in future progress checks until the user runs `/gsd-verify-work` on it.

**If user reports issues:** Proceed to gap closure as currently implemented.

**If gaps_found:**
```
## ⚠ Phase {X}: {Name} — Gaps Found

**Score:** {N}/{M} must-haves verified
**Report:** {phase_dir}/{phase_num}-VERIFICATION.md

### What's Missing
{Gap summaries from VERIFICATION.md}

---
## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

`/clear` then:

`/gsd-plan-phase {X} --gaps ${GSD_WS}`

Also: `cat {phase_dir}/{phase_num}-VERIFICATION.md` — full report
Also: `/gsd-verify-work {X} ${GSD_WS}` — manual testing first
```

Gap closure cycle: `/gsd-plan-phase {X} --gaps ${GSD_WS}` reads VERIFICATION.md → creates gap plans with `gap_closure: true` → user runs `/gsd-execute-phase {X} --gaps-only ${GSD_WS}` → verifier re-runs.
</step>

<step name="update_roadmap">
**Mark phase complete and update all tracking files:**

```bash
COMPLETION=$(gsd-sdk query phase.complete "${PHASE_NUMBER}")
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

These items are tracked and will appear in `/gsd-progress` and `/gsd-audit-uat`.
```

```bash
gsd-sdk query commit "docs(phase-{X}): complete phase execution" .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md {phase_dir}/*-VERIFICATION.md
```
</step>

<step name="auto_copy_learnings">
**Auto-copy phase learnings to global store (when enabled).**

This step runs AFTER phase completion and SUMMARY.md is written. It copies any LEARNINGS.md
entries from the completed phase to the global learnings store at `~/.gsd/knowledge/`.

**Check config gate:**
```bash
GL_ENABLED=$(gsd-sdk query config-get features.global_learnings --raw 2>/dev/null || echo "false")
```

**If `GL_ENABLED` is not `true`:** Skip this step entirely (feature disabled by default).

**If enabled:**

1. Check if LEARNINGS.md exists in the phase directory (use the `phase_dir` value from init context)
2. If found, copy to global store:
```bash
gsd-sdk query learnings.copy 2>/dev/null || echo "⚠ Learnings copy failed — continuing"
```
Copy failure must NOT block phase completion.
</step>

<step name="close_phase_todos">
**Auto-close pending todos tagged for this phase (#2433).**

This step runs AFTER `update_roadmap` marks the phase complete. It moves any pending todos that carry `resolves_phase: <current-phase-number>` to the completed directory.

```bash
PHASE_NUM="${PHASE_NUMBER}"
PENDING_DIR=".planning/todos/pending"
COMPLETED_DIR=".planning/todos/completed"
mkdir -p "$COMPLETED_DIR"

CLOSED=()
for TODO_FILE in "$PENDING_DIR"/*.md; do
  [ -f "$TODO_FILE" ] || continue
  # Extract resolves_phase from YAML frontmatter (first --- block only)
  RP=$(awk '/^---/{c++;next} c==1 && /^resolves_phase:/{print $2;exit} c==2{exit}' "$TODO_FILE" 2>/dev/null || true)
  if [ "$RP" = "$PHASE_NUM" ] || [ "$RP" = "\"$PHASE_NUM\"" ]; then
    mv "$TODO_FILE" "$COMPLETED_DIR/"
    CLOSED+=("$(basename "$TODO_FILE")")
  fi
done

if [ ${#CLOSED[@]} -gt 0 ]; then
  gsd-sdk query commit "docs(phase-${PHASE_NUMBER}): auto-close ${#CLOSED[@]} todo(s) resolved by this phase" .planning/todos/completed/ .planning/STATE.md || true
  echo "◆ Closed ${#CLOSED[@]} todo(s) resolved by Phase ${PHASE_NUMBER}:"
  for f in "${CLOSED[@]}"; do echo "  ✓ $f"; done
fi
```

**If no todos have `resolves_phase: <this-phase>`:** Skip silently — this step is always additive and never blocks phase completion.
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
gsd-sdk query commit "docs(phase-{X}): evolve PROJECT.md after phase completion" .planning/PROJECT.md
```

**Skip this step if** `.planning/PROJECT.md` does not exist.
</step>

<step name="offer_next">

**Exception:** If `gaps_found`, the `verify_phase_goal` step already presents the gap-closure path (`/gsd-plan-phase {X} --gaps`). No additional routing needed — skip auto-advance.

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
2. Read consolidated auto-mode (`active` = chain flag OR user preference; chain flag already synced in init step):
   ```bash
   AUTO_MODE=$(gsd-sdk query check auto-mode --pick active 2>/dev/null || echo "false")
   ```

**If `--auto` flag present OR `AUTO_MODE` is true (AND verification passed with no gaps):**

```
╔══════════════════════════════════════════╗
║  AUTO-ADVANCING → TRANSITION             ║
║  Phase {X} verified, continuing chain    ║
╚══════════════════════════════════════════╝
```

Execute the transition workflow inline (do NOT use Task — orchestrator context is ~10-15%, transition needs phase completion data already in context):

Read and follow `~/.claude/get-shit-done/workflows/transition.md`, passing through the `--auto` flag so it propagates to the next phase invocation.

**If neither `--auto` nor `AUTO_MODE` is true:**

**STOP. Do not auto-advance. Do not execute transition. Do not plan next phase. Present options to the user and wait.**

**IMPORTANT: There is NO `/gsd-transition` command. Never suggest it. The transition workflow is internal only.**

Check whether CONTEXT.md already exists for the next phase:

```bash
ls .planning/phases/*{next}*/{next}-CONTEXT.md 2>/dev/null || echo "no-context"
```

If CONTEXT.md does **not** exist for the next phase, present:

```
## ✓ Phase {X}: {Name} Complete

/gsd-progress ${GSD_WS} — see updated roadmap
/gsd-discuss-phase {next} ${GSD_WS} — start here: discuss next phase before planning  ← recommended
/gsd-plan-phase {next} ${GSD_WS} — plan next phase (skip discuss)
/gsd-execute-phase {next} ${GSD_WS} — execute next phase (skip discuss and plan)
```

If CONTEXT.md **exists** for the next phase, present:

```
## ✓ Phase {X}: {Name} Complete

/gsd-progress ${GSD_WS} — see updated roadmap
/gsd-plan-phase {next} ${GSD_WS} — start here: plan next phase (CONTEXT.md already present)  ← recommended
/gsd-discuss-phase {next} ${GSD_WS} — re-discuss next phase
/gsd-execute-phase {next} ${GSD_WS} — execute next phase (skip planning)
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
Re-run `/gsd-execute-phase {phase}` → discover_plans finds completed SUMMARYs → skips them → resumes from first incomplete plan → continues wave execution.

STATE.md tracks: last completed plan, current wave, pending checkpoints.
</resumption>
