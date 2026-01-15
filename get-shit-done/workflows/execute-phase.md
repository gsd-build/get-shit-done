<purpose>
Execute all plans in a phase using wave-based parallel execution. Orchestrator stays lean by delegating plan execution to subagents.
</purpose>

<core_principle>
The orchestrator's job is coordination, not execution. Each subagent loads the full execute-plan context itself. Orchestrator discovers plans, analyzes dependencies, groups into waves, spawns agents, handles checkpoints, collects results.
</core_principle>

<required_reading>
Read STATE.md before any operation to load project context.
</required_reading>

<process>

<step name="load_project_state" priority="first">
Before any operation, read project state:

```bash
cat .planning/STATE.md 2>/dev/null
```

**If file exists:** Parse and internalize:
- Current position (phase, plan, status)
- Accumulated decisions (constraints on this execution)
- Blockers/concerns (things to watch for)

**If file missing but .planning/ exists:**
```
STATE.md missing but planning artifacts exist.
Options:
1. Reconstruct from existing artifacts
2. Continue without project state (may lose accumulated context)
```

**If .planning/ doesn't exist:** Error - project not initialized.
</step>

<step name="validate_phase">
Confirm phase exists and has plans:

```bash
PHASE_DIR=$(ls -d .planning/phases/${PHASE_ARG}* 2>/dev/null | head -1)
if [ -z "$PHASE_DIR" ]; then
  echo "ERROR: No phase directory matching '${PHASE_ARG}'"
  exit 1
fi

PLAN_COUNT=$(ls -1 "$PHASE_DIR"/*-PLAN.md 2>/dev/null | wc -l | tr -d ' ')
if [ "$PLAN_COUNT" -eq 0 ]; then
  echo "ERROR: No plans found in $PHASE_DIR"
  exit 1
fi
```

Report: "Found {N} plans in {phase_dir}"
</step>

<step name="discover_plans">
List all plans and extract metadata:

```bash
# Get all plans
ls -1 "$PHASE_DIR"/*-PLAN.md 2>/dev/null | sort

# Get completed plans (have SUMMARY.md)
ls -1 "$PHASE_DIR"/*-SUMMARY.md 2>/dev/null | sort
```

For each plan, read frontmatter to extract:
- `wave: N` - Execution wave (pre-computed)
- `autonomous: true/false` - Whether plan has checkpoints

Build plan inventory:
- Plan path
- Plan ID (e.g., "03-01")
- Wave number
- Autonomous flag
- Completion status (SUMMARY exists = complete)

Skip completed plans. If all complete, report "Phase already executed" and exit.
</step>

<step name="ensure_metrics">
**Ensure metrics.json exists (backward compatibility):**

```bash
if [ ! -f ".planning/metrics.json" ]; then
    # Delegate to ensure-metrics workflow
    # This auto-generates metrics.json from ROADMAP.md for existing projects
fi
```

See `workflows/ensure-metrics.md` for full implementation.
</step>

<step name="update_current_phase_metrics">
**Update metrics.json for new phase:**

```bash
# Get phase info (PHASE_DIR already set in validate_phase step)
PHASE_NUM=$(echo "$PHASE_ARG" | grep -oE '^[0-9]+')
PHASE_NAME=$(grep "^## Phase $PHASE_NUM:" .planning/ROADMAP.md | sed 's/.*: //')
PHASE_NAME=${PHASE_NAME:-"Phase $PHASE_NUM"}
PHASES_COMPLETE=$(($PHASE_NUM - 1))

# Count plans in phase using PHASE_DIR
PLAN_COUNT=$(ls -1 "$PHASE_DIR"/*-PLAN.md 2>/dev/null | wc -l | xargs)

jq --arg num "$PHASE_NUM" \
   --arg name "$PHASE_NAME" \
   --arg complete "$PHASES_COMPLETE" \
   --arg plans "$PLAN_COUNT" \
   '.current_phase.number = ($num | tonumber) |
    .current_phase.name = $name |
    .current_phase.status = "in_progress" |
    .current_phase.plans_complete = 0 |
    .current_phase.plans_total = ($plans | tonumber) |
    .overall_progress.phases_complete = ($complete | tonumber) |
    .last_updated = now | todate |
    .overall_progress.percentage = (if .overall_progress.phases_total > 0 then ((.overall_progress.phases_complete / .overall_progress.phases_total) * 100 | floor) else 0 end)' \
   .planning/metrics.json > .planning/metrics.tmp && \
   mv .planning/metrics.tmp .planning/metrics.json
```
</step>

<step name="group_by_wave">
Read `wave` from each plan's frontmatter and group by wave number:

```bash
# For each plan, extract wave from frontmatter
for plan in $PHASE_DIR/*-PLAN.md; do
  wave=$(grep "^wave:" "$plan" | cut -d: -f2 | tr -d ' ')
  autonomous=$(grep "^autonomous:" "$plan" | cut -d: -f2 | tr -d ' ')
  echo "$plan:$wave:$autonomous"
done
```

**Group plans:**
```
waves = {
  1: [plan-01, plan-02],
  2: [plan-03, plan-04],
  3: [plan-05]
}
```

**No dependency analysis needed.** Wave numbers are pre-computed during `/gsd:plan-phase`.

Report wave structure with context:
```
## Execution Plan

**Phase {X}: {Name}** — {total_plans} plans across {wave_count} waves

| Wave | Plans | What it builds |
|------|-------|----------------|
| 1 | 01-01, 01-02 | {from plan objectives} |
| 2 | 01-03 | {from plan objectives} |
| 3 | 01-04 [checkpoint] | {from plan objectives} |

```

The "What it builds" column comes from skimming plan names/objectives. Keep it brief (3-8 words).
</step>

<step name="execute_waves">
Execute each wave in sequence. Autonomous plans within a wave run in parallel.

**For each wave:**

1. **Describe what's being built (BEFORE spawning):**

   Read each plan's `<objective>` section. Extract what's being built and why it matters.

   **Output:**
   ```
   ---

   ## Wave {N}

   **{Plan ID}: {Plan Name}**
   {2-3 sentences: what this builds, key technical approach, why it matters in context}

   **{Plan ID}: {Plan Name}** (if parallel)
   {same format}

   Spawning {count} agent(s)...

   ---
   ```

   **Examples:**
   - Bad: "Executing terrain generation plan"
   - Good: "Procedural terrain generator using Perlin noise — creates height maps, biome zones, and collision meshes. Required before vehicle physics can interact with ground."

2. **Spawn all autonomous agents in wave simultaneously:**

   Use Task tool with multiple parallel calls. Each agent gets prompt from subagent-task-prompt template:

   ```
   <objective>
   Execute plan {plan_number} of phase {phase_number}-{phase_name}.

   Commit each task atomically. Create SUMMARY.md. Update STATE.md.
   </objective>

   <execution_context>
   @~/.claude/get-shit-done/workflows/execute-plan.md
   @~/.claude/get-shit-done/templates/summary.md
   @~/.claude/get-shit-done/references/checkpoints.md
   @~/.claude/get-shit-done/references/tdd.md
   </execution_context>

   <context>
   Plan: @{plan_path}
   Project state: @.planning/STATE.md
   Config: @.planning/config.json (if exists)
   </context>

   <success_criteria>
   - [ ] All tasks executed
   - [ ] Each task committed individually
   - [ ] SUMMARY.md created in plan directory
   - [ ] STATE.md updated with position and decisions
   </success_criteria>
   ```

2. **Wait for all agents in wave to complete:**

   Task tool blocks until each agent finishes. All parallel agents return together.

3. **Report completion and what was built:**

   For each completed agent:
   - Verify SUMMARY.md exists at expected path
   - Read SUMMARY.md to extract what was built
   - Note any issues or deviations

   **Output:**
   ```
   ---

   ## Wave {N} Complete

   **{Plan ID}: {Plan Name}**
   {What was built — from SUMMARY.md deliverables}
   {Notable deviations or discoveries, if any}

   **{Plan ID}: {Plan Name}** (if parallel)
   {same format}

   {If more waves: brief note on what this enables for next wave}

   ---
   ```

   **Examples:**
   - Bad: "Wave 2 complete. Proceeding to Wave 3."
   - Good: "Terrain system complete — 3 biome types, height-based texturing, physics collision meshes. Vehicle physics (Wave 3) can now reference ground surfaces."

4. **Handle failures:**

   If any agent in wave fails:
   - Report which plan failed and why
   - Ask user: "Continue with remaining waves?" or "Stop execution?"
   - If continue: proceed to next wave (dependent plans may also fail)
   - If stop: exit with partial completion report

5. **Execute checkpoint plans between waves:**

   See `<checkpoint_handling>` for details.

6. **Update metrics with completed plans:**

   ```bash
   # Count completed plans in this phase using PHASE_DIR
   COMPLETED_PLANS=$(ls -1 "$PHASE_DIR"/*-SUMMARY.md 2>/dev/null | wc -l | xargs)

   jq --arg complete "$COMPLETED_PLANS" \
      '.current_phase.plans_complete = ($complete | tonumber) |
       .last_updated = now | todate |
       .current_phase.status = (if .current_phase.plans_complete == .current_phase.plans_total then "complete" else "in_progress" end)' \
      .planning/metrics.json > .planning/metrics.tmp && \
      mv .planning/metrics.tmp .planning/metrics.json
   ```

7. **Proceed to next wave**

</step>

<step name="checkpoint_handling">
Plans with `autonomous: false` require user interaction.

**Detection:** Check `autonomous` field in frontmatter.

**Execution flow for checkpoint plans:**

1. **Spawn agent for checkpoint plan:**
   ```
   Task(prompt="{subagent-task-prompt}", subagent_type="general-purpose")
   ```

2. **Agent runs until checkpoint:**
   - Executes auto tasks normally
   - Reaches checkpoint task (e.g., `type="checkpoint:human-verify"`) or auth gate
   - Agent returns with structured checkpoint (see checkpoint-return.md template)

3. **Agent return includes (structured format):**
   - Completed Tasks table with commit hashes and files
   - Current task name and blocker
   - Checkpoint type and details for user
   - What's awaited from user

4. **Orchestrator presents checkpoint to user:**

   Extract and display the "Checkpoint Details" and "Awaiting" sections from agent return:
   ```
   ## Checkpoint: [Type]

   **Plan:** 03-03 Dashboard Layout
   **Progress:** 2/3 tasks complete

   [Checkpoint Details section from agent return]

   [Awaiting section from agent return]
   ```

5. **User responds:**
   - "approved" / "done" → spawn continuation agent
   - Description of issues → spawn continuation agent with feedback
   - Decision selection → spawn continuation agent with choice

6. **Spawn continuation agent (NOT resume):**

   Use the continuation-prompt.md template:
   ```
   Task(
     prompt=filled_continuation_template,
     subagent_type="general-purpose"
   )
   ```

   Fill template with:
   - `{completed_tasks_table}`: From agent's checkpoint return
   - `{resume_task_number}`: Current task from checkpoint
   - `{resume_task_name}`: Current task name from checkpoint
   - `{user_response}`: What user provided
   - `{resume_instructions}`: Based on checkpoint type (see continuation-prompt.md)

7. **Continuation agent executes:**
   - Verifies previous commits exist
   - Continues from resume point
   - May hit another checkpoint (repeat from step 4)
   - Or completes plan

8. **Repeat until plan completes or user stops**

**Why fresh agent instead of resume:**
Resume relies on Claude Code's internal serialization which breaks with parallel tool calls.
Fresh agents with explicit state are more reliable and maintain full context.

**Checkpoint in parallel context:**
If a plan in a parallel wave has a checkpoint:
- Spawn as normal
- Agent pauses at checkpoint and returns with structured state
- Other parallel agents may complete while waiting
- Present checkpoint to user
- Spawn continuation agent with user response
- Wait for all agents to finish before next wave
</step>

<step name="aggregate_results">
After all waves complete, aggregate results:

```markdown
## Phase {X}: {Name} Execution Complete

**Waves executed:** {N}
**Plans completed:** {M} of {total}

### Wave Summary

| Wave | Plans | Status |
|------|-------|--------|
| 1 | plan-01, plan-02 | ✓ Complete |
| CP | plan-03 | ✓ Verified |
| 2 | plan-04 | ✓ Complete |
| 3 | plan-05 | ✓ Complete |

### Plan Details

1. **03-01**: [one-liner from SUMMARY.md]
2. **03-02**: [one-liner from SUMMARY.md]
...

### Issues Encountered
[Aggregate from all SUMMARYs, or "None"]
```
</step>

<step name="update_roadmap">
Update ROADMAP.md to reflect phase completion:

```bash
# Mark phase complete
# Update completion date
# Update status
```

Commit roadmap update:
```bash
git add .planning/ROADMAP.md
git commit -m "docs(phase-{X}): complete phase execution"
```
</step>

<step name="offer_next">
Present next steps based on milestone status:

**If more phases remain:**
```
## Next Up

**Phase {X+1}: {Name}** — {Goal}

`/gsd:plan-phase {X+1}`

<sub>`/clear` first for fresh context</sub>
```

**If milestone complete:**
```
MILESTONE COMPLETE!

All {N} phases executed.

`/gsd:complete-milestone`
```
</step>

</process>

<context_efficiency>
**Why this works:**

Orchestrator context usage: ~10-15%
- Read plan frontmatter (small)
- Analyze dependencies (logic, no heavy reads)
- Fill template strings
- Spawn Task calls
- Collect results

Each subagent: Fresh 200k context
- Loads full execute-plan workflow
- Loads templates, references
- Executes plan with full capacity
- Creates SUMMARY, commits

**No polling.** Task tool blocks until completion. No TaskOutput loops.

**No context bleed.** Orchestrator never reads workflow internals. Just paths and results.
</context_efficiency>

<failure_handling>
**Subagent fails mid-plan:**
- SUMMARY.md won't exist
- Orchestrator detects missing SUMMARY
- Reports failure, asks user how to proceed

**Dependency chain breaks:**
- Wave 1 plan fails
- Wave 2 plans depending on it will likely fail
- Orchestrator can still attempt them (user choice)
- Or skip dependent plans entirely

**All agents in wave fail:**
- Something systemic (git issues, permissions, etc.)
- Stop execution
- Report for manual investigation

**Checkpoint fails to resolve:**
- User can't approve or provides repeated issues
- Ask: "Skip this plan?" or "Abort phase execution?"
- Record partial progress in STATE.md
</failure_handling>

<resumption>
**Resuming interrupted execution:**

If phase execution was interrupted (context limit, user exit, error):

1. Run `/gsd:execute-phase {phase}` again
2. discover_plans finds completed SUMMARYs
3. Skips completed plans
4. Resumes from first incomplete plan
5. Continues wave-based execution

**STATE.md tracks:**
- Last completed plan
- Current wave
- Any pending checkpoints
</resumption>
