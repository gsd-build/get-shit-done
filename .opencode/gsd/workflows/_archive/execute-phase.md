<purpose>
Execute all plans in a phase with intelligent parallelization.
Analyzes plan dependencies to identify independent plans that can run in parallel.

**Critical constraint:** One subagent per plan, always. This is for context isolation, not parallelization. Even strictly sequential plans spawn separate subagents so each starts with fresh 200k context at 0%. Quality degrades above 50% context - executing multiple plans in one subagent defeats the entire segmentation model.
</purpose>

<when_to_use>
Use /gsd/execute-phase when:
- Phase has multiple unexecuted plans (2+)
- Want "walk away, come back to completed work" execution
- Plans have clear dependency boundaries

Use /gsd/execute-plan when:
- Executing a single specific plan
- Want sequential, interactive execution
- Need checkpoint interactions
</when_to_use>

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
- Deferred issues (context for deviations)
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

<step name="identify_phase">
**Identify the phase to execute from argument or roadmap.**

**1. Parse phase argument:**
```bash
# From command argument: /gsd/execute-phase 10
# Or: /gsd/execute-phase .planning/phases/10-parallel-execution/
PHASE_ARG="$1"
```

**2. Find phase directory:**
```bash
# If numeric: find matching directory
if [[ "$PHASE_ARG" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
  PHASE_DIR=$(ls -d .planning/phases/${PHASE_ARG}-* 2>/dev/null | head -1)
else
  PHASE_DIR="$PHASE_ARG"
fi

# Verify exists
if [ ! -d "$PHASE_DIR" ]; then
  echo "Error: Phase directory not found: $PHASE_DIR"
  exit 1
fi
```

**3. List all PLAN.md files:**
```bash
PLANS=($(ls "$PHASE_DIR"/*-PLAN.md 2>/dev/null | sort))
echo "Found ${#PLANS[@]} plans in phase"
```

**4. Identify unexecuted plans:**
```bash
UNEXECUTED=()
for plan in "${PLANS[@]}"; do
  summary="${plan//-PLAN.md/-SUMMARY.md}"
  if [ ! -f "$summary" ]; then
    UNEXECUTED+=("$plan")
  fi
done
echo "Unexecuted: ${#UNEXECUTED[@]} plans"
```

**5. Check if parallelization is appropriate:**

| Condition | Action |
|-----------|--------|
| 0 unexecuted plans | "All plans complete. Nothing to execute." |
| 1 unexecuted plan | "Single plan - use /gsd/execute-plan instead" |
| 2+ unexecuted plans | Proceed to dependency analysis |

</step>

<step name="analyze_plan_dependencies">
**Analyze plan dependencies to determine parallelization.**

**1. Find all unexecuted plans:**

```bash
UNEXECUTED=()
for plan in .planning/phases/${PHASE}-*/*-PLAN.md; do
  summary="${plan//-PLAN.md/-SUMMARY.md}"
  [ ! -f "$summary" ] && UNEXECUTED+=("$plan")
done
echo "Found ${#UNEXECUTED[@]} unexecuted plans"
```

**2. For each plan, extract dependency info:**

```bash
# Initialize associative arrays for tracking
declare -A PLAN_REQUIRES      # plan -> required plans (from depends_on or inferred)
declare -A PLAN_FILES         # plan -> files modified
declare -A PLAN_CHECKPOINTS   # plan -> has checkpoints

for plan in "${UNEXECUTED[@]}"; do
  plan_id=$(basename "$plan" -PLAN.md)

  # Check for depends_on frontmatter
  DEPENDS_ON=$(awk '/^---$/,/^---$/' "$plan" | grep "^depends_on:" | sed 's/depends_on: \[//' | sed 's/\]//' | tr -d ' "')

  # Check for files_modified frontmatter
  FILES_MODIFIED=$(awk '/^---$/,/^---$/' "$plan" | grep "^files_modified:" | sed 's/files_modified: \[//' | sed 's/\]//' | tr -d ' "')

  # Use frontmatter if present
  if [ -n "$DEPENDS_ON" ]; then
    PLAN_REQUIRES["$plan_id"]="$DEPENDS_ON"
  else
    # Fall back to inference from old frontmatter format
    REQUIRES=$(awk '/^---$/,/^---$/' "$plan" | grep -E "^\s*-\s*phase:" | grep -oP '\d+' | tr '\n' ',')
    PLAN_REQUIRES["$plan_id"]="${REQUIRES%,}"

    # Check for SUMMARY references in @context (implies dependency)
    SUMMARY_REFS=$(grep -oP '@[^@]*\d+-\d+-SUMMARY\.md' "$plan" | grep -oP '\d+-\d+' | tr '\n' ',')
    if [ -n "$SUMMARY_REFS" ]; then
      PLAN_REQUIRES["$plan_id"]="${PLAN_REQUIRES[$plan_id]},${SUMMARY_REFS%,}"
    fi
  fi

  # Use files_modified frontmatter if present, else extract from <files> elements
  if [ -n "$FILES_MODIFIED" ]; then
    PLAN_FILES["$plan_id"]="$FILES_MODIFIED"
  else
    FILES=$(grep -oP '(?<=<files>)[^<]+(?=</files>)' "$plan" | tr '\n' ',' | tr -d ' ')
    PLAN_FILES["$plan_id"]="${FILES%,}"
  fi

  # Check for checkpoint tasks
  if grep -q 'type="checkpoint' "$plan"; then
    PLAN_CHECKPOINTS["$plan_id"]="true"
  else
    PLAN_CHECKPOINTS["$plan_id"]="false"
  fi
done
```

**Dependency detection:**

1. **If `depends_on` frontmatter exists:** Use it directly
2. **If no frontmatter:** Fall back to inference:
   - Parse `requires` from old frontmatter format
   - Check for SUMMARY references in @context
3. **File conflicts:** Detected separately in step 4

**3. Build dependency graph:**

For each plan, determine:
- `requires`: Prior phases/plans this depends on
- `files_modified`: Files from `<files>` elements
- `has_checkpoints`: Contains checkpoint tasks

```
Example dependency graph:
┌─────────┬───────────────────────┬─────────────────────────────┬──────────────┐
│ Plan    │ Requires              │ Files Modified              │ Checkpoints  │
├─────────┼───────────────────────┼─────────────────────────────┼──────────────┤
│ 10-01   │ []                    │ [workflows/execute-plan.md] │ false        │
│ 10-02   │ [10-01]               │ [workflows/execute-phase.md]│ false        │
│ 10-03   │ [10-02]               │ [commands/execute-phase.md] │ false        │
│ 10-04   │ []                    │ [templates/agent-history.md]│ false        │
└─────────┴───────────────────────┴─────────────────────────────┴──────────────┘
```

**4. Detect file conflicts:**

```bash
# Build file-to-plan mapping
declare -A FILE_TO_PLANS

for plan_id in "${!PLAN_FILES[@]}"; do
  IFS=',' read -ra files <<< "${PLAN_FILES[$plan_id]}"
  for file in "${files[@]}"; do
    [ -n "$file" ] && FILE_TO_PLANS["$file"]="${FILE_TO_PLANS[$file]},$plan_id"
  done
done

# Detect conflicts (same file modified by multiple plans)
declare -A CONFLICTS
for file in "${!FILE_TO_PLANS[@]}"; do
  plans="${FILE_TO_PLANS[$file]}"
  plan_count=$(echo "$plans" | tr ',' '\n' | grep -c .)
  if [ "$plan_count" -gt 1 ]; then
    CONFLICTS["$file"]="${plans#,}"
  fi
done

# Add conflict dependencies (later plan depends on earlier)
for file in "${!CONFLICTS[@]}"; do
  IFS=',' read -ra conflict_plans <<< "${CONFLICTS[$file]}"
  for ((i=1; i<${#conflict_plans[@]}; i++)); do
    # Each plan depends on previous one in conflict set
    prev="${conflict_plans[$((i-1))]}"
    curr="${conflict_plans[$i]}"
    PLAN_REQUIRES["$curr"]="${PLAN_REQUIRES[$curr]},${prev}"
  done
done
```

**File conflict rules:**
- If Plan A and Plan B both modify same file → B depends on A (ordered by plan number)
- If Plan B reads file created by Plan A → B depends on A
- If Plan B references Plan A's SUMMARY in @context → B depends on A

**5. Categorize plans:**

| Category | Criteria | Action |
|----------|----------|--------|
| independent | Empty `depends_on` AND no file conflicts | Can run in parallel (Wave 1) |
| dependent | Has `depends_on` OR file conflicts with earlier plan | Wait for dependency |
| has_checkpoints | Contains checkpoint tasks | Foreground or skip checkpoints |

**6. Build execution waves (topological sort):**

```bash
# Calculate wave for each plan
declare -A PLAN_WAVE

calculate_wave() {
  local plan="$1"
  [ -n "${PLAN_WAVE[$plan]}" ] && echo "${PLAN_WAVE[$plan]}" && return

  local max_dep_wave=0

  # Check depends_on (from frontmatter or inferred)
  if [ -n "${PLAN_REQUIRES[$plan]}" ]; then
    IFS=',' read -ra dep_array <<< "${PLAN_REQUIRES[$plan]}"
    for dep in "${dep_array[@]}"; do
      [ -z "$dep" ] && continue
      # Only consider deps in current phase (unexecuted)
      if [[ " ${!PLAN_FILES[*]} " =~ " $dep " ]]; then
        dep_wave=$(calculate_wave "$dep")
        [ "$dep_wave" -gt "$max_dep_wave" ] && max_dep_wave="$dep_wave"
      fi
    done
  fi

  PLAN_WAVE[$plan]=$((max_dep_wave + 1))
  echo "${PLAN_WAVE[$plan]}"
}

# Calculate waves for all plans
for plan_id in "${!PLAN_FILES[@]}"; do
  calculate_wave "$plan_id" > /dev/null
done

# Group by wave
declare -A WAVES
for plan_id in "${!PLAN_WAVE[@]}"; do
  wave="${PLAN_WAVE[$plan_id]}"
  WAVES[$wave]="${WAVES[$wave]} $plan_id"
done

# Output wave structure
echo "Execution waves:"
for wave in $(echo "${!WAVES[@]}" | tr ' ' '\n' | sort -n); do
  plans="${WAVES[$wave]}"
  checkpoint_note=""
  frontmatter_note=""
  for p in $plans; do
    [ "${PLAN_CHECKPOINTS[$p]}" = "true" ] && checkpoint_note=" (has checkpoints)"
    [ "${PLAN_HAS_FRONTMATTER[$p]}" = "true" ] && frontmatter_note=" [frontmatter]"
  done
  echo "  Wave $wave:$plans$checkpoint_note$frontmatter_note"
done
```

**Example output:**
```
Execution waves:
  Wave 1: 10-01 10-04
  Wave 2: 10-02
  Wave 3: 10-03
```

**7. Handle checkpoints in parallel context:**

Plans with checkpoints require special handling:
- `checkpoint_handling: "foreground"` → Run in main context (not parallel)
- `checkpoint_handling: "skip"` → Skip checkpoints during parallel (not recommended)

```bash
# Separate checkpoint plans
PARALLEL_PLANS=()
FOREGROUND_PLANS=()

for plan_id in "${!PLAN_CHECKPOINTS[@]}"; do
  if [ "${PLAN_CHECKPOINTS[$plan_id]}" = "true" ]; then
    FOREGROUND_PLANS+=("$plan_id")
  else
    PARALLEL_PLANS+=("$plan_id")
  fi
done

if [ ${#FOREGROUND_PLANS[@]} -gt 0 ]; then
  echo "Plans requiring foreground execution: ${FOREGROUND_PLANS[*]}"
fi
```

**8. Safety rule:**
If dependency detection is uncertain (e.g., complex file patterns, unclear requires), default to sequential execution within that wave.
</step>

<step name="parallelization_config">
**Read parallelization configuration.**

```bash
cat .planning/config.json 2>/dev/null
```

**Config schema (parallelization section):**

```json
{
  "parallelization": {
    "enabled": true,
    "max_concurrent_agents": 3,
    "checkpoint_handling": "foreground",
    "commit_strategy": "orchestrator"
  }
}
```

**Config options:**

| Option | Values | Default | Description |
|--------|--------|---------|-------------|
| enabled | true/false | true | Enable parallel execution |
| max_concurrent_agents | 1-5 | 3 | Max simultaneous background agents |
| checkpoint_handling | "foreground"/"skip" | "foreground" | How to handle plans with checkpoints |
| commit_strategy | "orchestrator"/"agent" | "orchestrator" | Who commits changes |

**If parallelization.enabled is false:**
- Fall back to sequential execution
- Use /gsd/execute-plan for each plan in order

**Checkpoint handling modes:**
- `foreground`: Plans with checkpoints run in foreground (not parallel)
- `skip`: Skip checkpoints during parallel execution (not recommended)

**Commit strategy:**
- `orchestrator`: Agents don't commit. Orchestrator collects all changes and commits.
- `agent`: Each agent commits its own changes (may cause conflicts)
</step>

<step name="spawn_parallel_agents">
**Spawn independent plans as parallel background agents.**

**1. Record pre-spawn git state:**
```bash
PRE_SPAWN_COMMIT=$(git rev-parse HEAD)
echo "All agents start from commit: $PRE_SPAWN_COMMIT"
```

**2. Generate parallel group ID:**
```bash
PARALLEL_GROUP="pg-$(date +%Y%m%d%H%M%S)-$(openssl rand -hex 4)"
```

**3. Initialize tracking:**
```bash
# Ensure agent-history.json exists
if [ ! -f .planning/agent-history.json ]; then
  echo '{"version":"1.2","max_entries":50,"entries":[]}' > .planning/agent-history.json
fi

# Initialize tracking arrays
declare -a RUNNING_AGENTS=()
declare -a QUEUED_PLANS=()
declare -A AGENT_TO_PLAN=()
```

**4. Spawn Wave 1 plans (no dependencies):**

```
For each plan in Wave 1:
  # Check concurrent agent limit
  if len(RUNNING_AGENTS) >= max_concurrent_agents:
    QUEUED_PLANS.append(plan)
    continue

  # Use Task tool to spawn background agent
  Task(
    description="Execute {plan_id} (parallel)",
    prompt="[Agent prompt below]",
    subagent_type="general-purpose",
    run_in_background=true
  )

  # After Task returns, capture agent_id
  RUNNING_AGENTS.append(agent_id)
  AGENT_TO_PLAN[agent_id] = plan_id

  # Record to agent-history.json
  add_entry_to_history(...)
```

**Agent spawn prompt (for plans WITHOUT checkpoints):**

```xml
<parallel_agent_instructions>
You are executing plan: {plan_path} as part of a PARALLEL phase execution.

<critical_rules>
1. Execute ALL tasks in the plan following deviation rules from execute-plan.md
2. Commit each task atomically (standard task_commit protocol)
3. Create SUMMARY.md in the phase directory when complete
4. Report files modified and commit hashes when done
</critical_rules>

<plan_context>
@{plan_path}
Read the plan for full context, tasks, and deviation rules.
</plan_context>

<execution_protocol>
1. Read plan file and context files
2. Execute each task in order
3. For each task:
   - Implement the action
   - Run verification
   - Track files modified
   - Track any deviations
4. After all tasks: create SUMMARY.md
</execution_protocol>

<report_format>
When complete, output this exact format:

PARALLEL_AGENT_COMPLETE
plan_id: {phase}-{plan}
tasks_completed: [count]/[total]
task_commits:
  - task_1: abc123f
  - task_2: def456g
files_modified:
  - path/to/file1.ts
  - path/to/file2.md
deviations:
  - [Rule X] description
summary_path: .planning/phases/{phase-dir}/{phase}-{plan}-SUMMARY.md
issues: [none or list]
END_REPORT
</report_format>

<forbidden_actions>
- git push (orchestrator may push after all complete)
- Modifying files outside plan scope
- Running long-blocking network operations
</forbidden_actions>
</parallel_agent_instructions>
```

**5. Record spawn in agent-history.json:**

```bash
# Read current entries
ENTRIES=$(jq '.entries' .planning/agent-history.json)

# Create new entry
NEW_ENTRY=$(cat <<EOF
{
  "agent_id": "$AGENT_ID",
  "task_description": "Parallel: Execute ${PHASE}-${PLAN}-PLAN.md",
  "phase": "$PHASE",
  "plan": "$PLAN",
  "parallel_group": "$PARALLEL_GROUP",
  "granularity": "plan",
  "wave": $WAVE_NUM,
  "depends_on": $(echo "${PLAN_REQUIRES[$PLAN]}" | jq -R 'split(",") | map(select(. != ""))'),
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "status": "spawned",
  "files_modified": [],
  "completion_timestamp": null,
  "deviations": []
}
EOF
)

# Append and write back
echo "$ENTRIES" | jq ". += [$NEW_ENTRY]" > /tmp/entries.json
jq --argjson entries "$(cat /tmp/entries.json)" '.entries = $entries' .planning/agent-history.json > /tmp/history.json
mv /tmp/history.json .planning/agent-history.json
```

**6. Queue remaining plans:**

```bash
# Queue Wave 2+ plans
for wave in $(seq 2 $MAX_WAVE); do
  for plan in ${WAVES[$wave]}; do
    QUEUED_PLANS+=("$plan:$wave")
  done
done

echo "Spawned: ${#RUNNING_AGENTS[@]} agents"
echo "Queued: ${#QUEUED_PLANS[@]} plans"
```
</step>

<step name="monitor_parallel_completion">
**Poll for agent completion and spawn dependents.**

**1. Polling loop implementation:**

```
declare -A COMPLETED_AGENTS=()
declare -A FAILED_AGENTS=()

while [ ${#RUNNING_AGENTS[@]} -gt 0 ] || [ ${#QUEUED_PLANS[@]} -gt 0 ]; do

  # Check each running agent
  for agent_id in "${RUNNING_AGENTS[@]}"; do

    # Use TaskOutput to check status (non-blocking)
    TaskOutput(
      task_id=agent_id,
      block=false,
      timeout=5000
    )

    if result.status == "completed":
      # Parse agent's completion report
      files_modified = parse_report_files(result.output)
      deviations = parse_report_deviations(result.output)
      plan_id = AGENT_TO_PLAN[agent_id]

      # Update agent-history.json
      update_history_entry(
        agent_id,
        status="completed",
        files_modified=files_modified,
        deviations=deviations,
        completion_timestamp=now()
      )

      # Track completion
      COMPLETED_AGENTS[agent_id] = plan_id
      RUNNING_AGENTS.remove(agent_id)

      echo "✓ Agent $agent_id completed plan $plan_id"
      echo "  Files: ${#files_modified[@]}"
      echo "  Deviations: ${#deviations[@]}"

      # Check if dependents can now spawn
      check_and_spawn_dependents()

    elif result.status == "failed":
      plan_id = AGENT_TO_PLAN[agent_id]

      # Log failure
      update_history_entry(
        agent_id,
        status="failed",
        error=result.error,
        completion_timestamp=now()
      )

      FAILED_AGENTS[agent_id] = plan_id
      RUNNING_AGENTS.remove(agent_id)

      echo "✗ Agent $agent_id FAILED on plan $plan_id"
      echo "  Error: ${result.error}"

      # Continue monitoring - don't abort batch

    # else: still running, check next agent
  done

  # Brief pause between polls
  sleep 10

done
```

**2. Parse agent completion report:**

```bash
parse_report_files() {
  local output="$1"
  # Extract files from PARALLEL_AGENT_COMPLETE block
  echo "$output" | \
    sed -n '/^files_modified:/,/^[a-z_]*:/p' | \
    grep '^\s*-' | \
    sed 's/^\s*-\s*//'
}

parse_report_deviations() {
  local output="$1"
  echo "$output" | \
    sed -n '/^deviations:/,/^[a-z_]*:/p' | \
    grep '^\s*-' | \
    sed 's/^\s*-\s*//'
}
```

**3. Spawn ready dependents:**

```bash
check_and_spawn_dependents() {
  # Get completed plan IDs
  local completed_plans=$(printf '%s\n' "${COMPLETED_AGENTS[@]}")

  for i in "${!QUEUED_PLANS[@]}"; do
    local queued="${QUEUED_PLANS[$i]}"
    local plan_id="${queued%%:*}"
    local wave="${queued##*:}"

    # Get this plan's dependencies
    local deps="${PLAN_REQUIRES[$plan_id]}"

    # Check if all dependencies are in completed list
    local all_deps_met=true
    IFS=',' read -ra dep_array <<< "$deps"
    for dep in "${dep_array[@]}"; do
      [ -z "$dep" ] && continue
      if ! echo "$completed_plans" | grep -q "^$dep$"; then
        all_deps_met=false
        break
      fi
    done

    if [ "$all_deps_met" = true ]; then
      # Check concurrent limit
      if [ ${#RUNNING_AGENTS[@]} -lt $MAX_CONCURRENT ]; then
        # Remove from queue
        unset 'QUEUED_PLANS[$i]'

        # Spawn agent
        spawn_plan_agent "$plan_id" "$wave"

        echo "→ Spawned dependent: $plan_id (wave $wave)"
      fi
    fi
  done

  # Rebuild array to remove gaps
  QUEUED_PLANS=("${QUEUED_PLANS[@]}")
}
```

**4. Handle failures:**

| Failure Type | Action |
|--------------|--------|
| Agent crash | Log status="failed", continue batch |
| Plan error | Same as crash - logged, batch continues |
| All dependents | Plans depending on failed agent also fail |

```bash
# When agent fails, mark its dependents as blocked
mark_dependents_blocked() {
  local failed_plan="$1"

  for i in "${!QUEUED_PLANS[@]}"; do
    local queued="${QUEUED_PLANS[$i]}"
    local plan_id="${queued%%:*}"
    local deps="${PLAN_REQUIRES[$plan_id]}"

    if echo "$deps" | grep -q "$failed_plan"; then
      echo "⚠ Plan $plan_id blocked (depends on failed $failed_plan)"
      # Mark in history as blocked
      update_history_entry("queued-$plan_id", status="blocked", blocked_by="$failed_plan")
    fi
  done
}
```

**5. Completion conditions:**

```
while true:
  if RUNNING_AGENTS is empty AND QUEUED_PLANS is empty:
    break  # All done

  if RUNNING_AGENTS is empty AND QUEUED_PLANS is not empty:
    # All queued plans are blocked by failed dependencies
    echo "All remaining plans blocked by failures"
    break

  poll_and_check()
```

**6. Progress display:**

```
During execution, show:

═══════════════════════════════════════════════════
Parallel Execution Status
═══════════════════════════════════════════════════
Running:  [agent-1: 10-01] [agent-2: 10-04]
Queued:   10-02, 10-03
Complete: 0
Failed:   0
═══════════════════════════════════════════════════

[Update periodically as agents complete]
```
</step>

<step name="orchestrator_commit">
**Commit metadata after all agents complete.**

Agents commit their own task code (per-task atomic commits). The orchestrator only commits metadata.

**1. Verify all agents committed successfully:**
```bash
# Check git log for expected commits from each agent
for agent in $(jq -r ".entries[] | select(.parallel_group==\"$PARALLEL_GROUP\" and .status==\"completed\") | .agent_id" .planning/agent-history.json); do
  PLAN=$(jq -r ".entries[] | select(.agent_id==\"$agent\") | .plan" .planning/agent-history.json)
  # Verify commits exist for this plan
  git log --oneline --grep="(${PHASE}-${PLAN}):" | head -5
done
```

**2. Stage and commit metadata:**
```bash
# Stage all SUMMARY.md files created by agents
git add .planning/phases/${PHASE_DIR}/*-SUMMARY.md

# Stage STATE.md and ROADMAP.md
git add .planning/STATE.md
git add .planning/ROADMAP.md

# Commit metadata
git commit -m "docs(${PHASE}): complete phase via parallel execution

Plans executed: ${#COMPLETED[@]}
Parallel group: $PARALLEL_GROUP

Agents:
$(for a in "${COMPLETED[@]}"; do echo "- $a"; done)"
```

**3. Generate timing stats:**
```bash
START_TIME=$(jq -r ".entries[] | select(.parallel_group==\"$PARALLEL_GROUP\") | .timestamp" .planning/agent-history.json | sort | head -1)
END_TIME=$(jq -r ".entries[] | select(.parallel_group==\"$PARALLEL_GROUP\") | .completion_timestamp" .planning/agent-history.json | sort -r | head -1)

echo "Parallel execution stats:"
echo "- Plans executed: ${#COMPLETED[@]}"
echo "- Wall clock time: $(time_diff $START_TIME $END_TIME)"
echo "- Sequential estimate: $(sum of individual plan durations)"
echo "- Time saved: ~X%"
```

**Note on merge conflicts:**
Since agents commit independently, git will catch conflicts at commit time if they occur.
The dependency analysis step should prevent this, but if an agent fails to commit due to conflict:
- That agent's status will be "failed"
- Other agents continue normally
- User can resolve and retry the failed plan with /gsd/execute-plan
</step>

<step name="create_phase_summary">
**Aggregate results into phase-level summary.**

After all plans complete, create a phase summary that aggregates:

**1. Collect individual SUMMARY.md files:**
```bash
SUMMARIES=($(ls "$PHASE_DIR"/*-SUMMARY.md | sort))
```

**2. Update STATE.md:**
- Update Current Position
- Add any decisions from individual summaries
- Update session continuity

**3. Update ROADMAP.md:**
- Mark phase as complete
- Add completion date
- Update progress table

**4. Report completion:**
```
═══════════════════════════════════════════════════
Phase {X}: {Phase Name} Complete (Parallel Execution)
═══════════════════════════════════════════════════

Plans executed: {N}
- {phase}-01: [name] - {duration}
- {phase}-02: [name] - {duration}
- {phase}-03: [name] - {duration}

Execution mode: Parallel ({max_concurrent} agents)
Wall clock time: {total_duration}
Estimated sequential time: {sum_of_durations}
Time saved: ~{percent}%

Files modified: {total_count}
Commits created: {commit_count}
```
</step>

<step name="offer_next">
**Present next steps after phase completion.**

Read ROADMAP.md to determine milestone status.

**If more phases remain in milestone:**
```
## ✓ Phase {X}: {Phase Name} Complete

All {N} plans finished via parallel execution.

---

## ▶ Next Up

**Phase {X+1}: {Next Phase Name}** — {Goal from ROADMAP.md}

`/gsd/plan-phase {X+1}`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/gsd/verify-work {X}` — manual acceptance testing
- `/gsd/discuss-phase {X+1}` — gather context first
```

**If milestone complete:**
```
🎉 MILESTONE COMPLETE!

All {N} phases finished.

`/gsd/complete-milestone`
```
</step>

</process>

<error_handling>

**Agent failure during parallel execution:**
- Log failure but continue with other agents
- Failed plans can be retried individually with /gsd/execute-plan
- Do not automatically retry (may cause cascade failures)

**Merge conflict detected:**
- Stop orchestrator_commit
- Present conflicting files to user
- Options:
  1. Manual resolution
  2. Re-run sequential with /gsd/execute-plan

**Max concurrent limit reached:**
- Queue excess plans
- Spawn as agents complete
- First-in-first-out ordering within each wave

**Config.json missing:**
- Use defaults: enabled=true, max_concurrent=3, orchestrator commits

</error_handling>

<success_criteria>
- All plans in phase executed
- All agents completed (no failures)
- Commits created for all plans
- STATE.md updated
- ROADMAP.md updated
- No merge conflicts
</success_criteria>
