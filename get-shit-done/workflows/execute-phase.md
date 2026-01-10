<purpose>
Execute a phase prompt (PLAN.md) and create the outcome summary (SUMMARY.md).
</purpose>

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
- Brief alignment status

**If file missing but .planning/ exists:**

```
STATE.md missing but planning artifacts exist.
Options:
1. Reconstruct from existing artifacts
2. Continue without project state (may lose accumulated context)
```

**If .planning/ doesn't exist:** Error - project not initialized.

This ensures every execution has full project context.
</step>

<step name="identify_plan">
Find the next plan to execute:
- Check roadmap for "In progress" phase
- Find plans in that phase directory
- Identify first plan without corresponding SUMMARY

```bash
cat .planning/ROADMAP.md
# Look for phase with "In progress" status
# Then find plans in that phase
ls .planning/phases/XX-name/*-PLAN.md 2>/dev/null | sort
ls .planning/phases/XX-name/*-SUMMARY.md 2>/dev/null | sort
```

**Logic:**

- If `01-01-PLAN.md` exists but `01-01-SUMMARY.md` doesn't → execute 01-01
- If `01-01-SUMMARY.md` exists but `01-02-SUMMARY.md` doesn't → execute 01-02
- Pattern: Find first PLAN file without matching SUMMARY file

**Decimal phase handling:**

Phase directories can be integer or decimal format:

- Integer: `.planning/phases/01-foundation/01-01-PLAN.md`
- Decimal: `.planning/phases/01.1-hotfix/01.1-01-PLAN.md`

Parse phase number from path (handles both formats):

```bash
# Extract phase number (handles XX or XX.Y format)
PHASE=$(echo "$PLAN_PATH" | grep -oE '[0-9]+(\.[0-9]+)?-[0-9]+')
```

SUMMARY naming follows same pattern:

- Integer: `01-01-SUMMARY.md`
- Decimal: `01.1-01-SUMMARY.md`

Confirm with user if ambiguous.

<config-check>
```bash
cat .planning/config.json 2>/dev/null
```
</config-check>

<if mode="yolo">
```
⚡ Auto-approved: Execute {phase}-{plan}-PLAN.md
[Plan X of Y for Phase Z]

Starting execution...
```

Proceed directly to parse_segments step.
</if>

<if mode="interactive" OR="custom with gates.execute_next_plan true">
Present:

```
Found plan to execute: {phase}-{plan}-PLAN.md
[Plan X of Y for Phase Z]

Proceed with execution?
```

Wait for confirmation before proceeding.
</if>
</step>

<step name="analyze_plan_dependencies">
**Parallel execution analysis for multi-plan phases.**

This step triggers when `/gsd:execute-plan` is run WITHOUT a path argument, or after completing a plan when multiple remain.

**Entry point behavior:**

When `/gsd:execute-plan` is run WITHOUT a path argument:
1. Detect current phase from STATE.md
2. Find all unexecuted plans in phase (PLAN without SUMMARY)
3. If multiple unexecuted plans exist, trigger parallelization analysis
4. If only one plan, proceed to normal execution

When `/gsd:execute-plan <path>` is run WITH a specific path:
1. Execute that specific plan (current behavior)
2. After completion, check if remaining plans can be parallelized

**Skip conditions:**
- Config has `parallelization.plan_level: false` → execute sequentially
- Only 1 unexecuted plan → no parallelization needed
- Plan frontmatter has `parallel: false` → that plan runs sequentially

**1. Discover unexecuted plans:**

```bash
# Find all plans without matching summaries
for plan in .planning/phases/XX-name/*-PLAN.md; do
  summary="${plan//-PLAN.md/-SUMMARY.md}"
  [ ! -f "$summary" ] && echo "$plan"
done
```

**2. For each plan, extract dependency info:**

```bash
# Extract from frontmatter
grep -A5 "^---" "$plan" | grep "requires:"

# Extract files modified (from <files> elements)
grep -oP '(?<=<files>)[^<]+' "$plan"

# Check for checkpoint tasks
grep -c 'type="checkpoint' "$plan"
```

**3. Build dependency graph:**

For each plan, determine:
- `requires`: Prior phases/plans this depends on (from frontmatter)
- `files_modified`: Files this plan will modify (from `<files>` elements)
- `has_checkpoints`: Contains human interaction points
- `checkpoint_count`: Number of checkpoints

**4. Detect conflicts:**

```
File conflict rules:
- If Plan A and Plan B both modify same file → sequential
- If Plan B reads file created by Plan A → B depends on A
- If Plan B references Plan A's SUMMARY → B depends on A
```

**5. Categorize plans:**

| Category | Criteria | Action |
|----------|----------|--------|
| independent | No inter-plan dependencies, no file conflicts | Can run in parallel |
| dependent | Requires another plan in this phase | Wait for dependency |
| has_checkpoints | Contains checkpoint tasks | Special handling |

**6. Checkpoint handling in background mode:**

By default, plans with checkpoints ARE included in parallelization.

In background mode, checkpoints are handled as:
- `checkpoint:human-verify`: Skip and log "skipped - background mode"
- `checkpoint:decision`: Use first option and log choice
- `checkpoint:human-action`: Skip and log warning

User can disable checkpoint skipping via config: `skip_checkpoints: false`
If `skip_checkpoints: false`, plans with checkpoints run sequentially in foreground.

**7. Decision logic:**

```
if config.parallelization.plan_level === false:
  → Execute all plans sequentially

if unexecuted_plans.count === 1:
  → Execute single plan normally

if all plans are independent:
  → Spawn all in parallel (up to max_concurrent)

if some plans are independent:
  → Spawn independents, queue dependents

if all plans are dependent (chain):
  → Execute sequentially (current behavior)
```

**8. Present analysis:**

<if mode="yolo">
```
⚡ Auto-approved: Parallel execution

Phase [X] has [N] plans:
  Parallel: [list] (no conflicts)
  Sequential: [list] (dependencies)

Spawning [N] parallel agents...
```

Proceed to spawn_parallel_agents step.
</if>

<if mode="interactive">
```
Phase [X] has [N] plans

Parallelizable: [N] plans (no conflicts)
  - 11-01, 11-03, 11-04
  - 11-03 has 2 checkpoints (will be skipped in background)

Sequential: [N] plan(s) (dependencies)
  - 11-02 (needs 11-01 output)

Spawn [N] parallel agents? (yes / sequential / review)
```

Wait for user confirmation.
</if>

**9. Route to execution:**

| Analysis Result | Next Step |
|-----------------|-----------|
| Multiple independent plans | spawn_parallel_agents |
| Single plan only | record_start_time (normal flow) |
| All sequential | record_start_time (normal flow) |
| User chose "sequential" | record_start_time (normal flow) |
</step>

<parallelization_config>
## Parallelization Configuration

Control parallel execution behavior through config.json and plan frontmatter.

**Config schema (in .planning/config.json):**
```json
{
  "mode": "yolo",
  "parallelization": {
    "plan_level": true,
    "task_level": true,
    "skip_checkpoints": true,
    "max_concurrent_agents": 3,
    "min_plans_for_parallel": 2
  }
}
```

**Config options:**

| Option | Default | Description |
|--------|---------|-------------|
| `plan_level` | true | Enable plan-level parallelization |
| `task_level` | true | Enable task-level parallelization within plans |
| `skip_checkpoints` | true | Allow checkpoint plans to run in background with skipping |
| `max_concurrent_agents` | 3 | Global limit on concurrent background agents |
| `min_plans_for_parallel` | 2 | Minimum plans needed to trigger parallelization |

**Per-plan override in PLAN.md frontmatter:**
```yaml
---
phase: 11
plan: 01
parallel: false  # Force this plan to run sequentially
skip_checkpoints: false  # Force foreground execution for checkpoints
---
```

**Decision tree:**

```
1. Config says plan_level: false
   → All plans execute sequentially

2. Only 1 unexecuted plan
   → Execute normally (no parallelization needed)

3. Fewer than min_plans_for_parallel unexecuted
   → Execute sequentially

4. Plan frontmatter says parallel: false
   → That specific plan runs sequentially

5. Plan has checkpoints AND skip_checkpoints: false
   → That plan runs in foreground sequentially

6. Running agents >= max_concurrent_agents
   → Queue additional plans until slot opens

7. Otherwise
   → Analyze dependencies and parallelize where safe
```

**Reading config:**
```bash
# Check if config exists and read parallelization settings
CONFIG=$(cat .planning/config.json 2>/dev/null || echo '{}')

# Extract parallelization settings (defaults if not present)
PLAN_LEVEL=$(echo "$CONFIG" | jq -r '.parallelization.plan_level // true')
MAX_CONCURRENT=$(echo "$CONFIG" | jq -r '.parallelization.max_concurrent_agents // 3')
SKIP_CHECKPOINTS=$(echo "$CONFIG" | jq -r '.parallelization.skip_checkpoints // true')
MIN_PLANS=$(echo "$CONFIG" | jq -r '.parallelization.min_plans_for_parallel // 2')
```

**Checking plan-level override:**
```bash
# Extract frontmatter from plan
PARALLEL=$(grep -A10 "^---" "$PLAN_PATH" | grep "^parallel:" | awk '{print $2}')
[ "$PARALLEL" = "false" ] && echo "Plan opts out of parallelization"
```
</parallelization_config>

<step name="spawn_parallel_agents">
**Spawn multiple background agents for independent plans.**

Triggered when analyze_plan_dependencies finds multiple independent plans.

**1. Pre-spawn git state:**

```bash
# Record current HEAD commit hash
PARALLEL_START_COMMIT=$(git rev-parse HEAD)
echo "All parallel agents starting from commit: $PARALLEL_START_COMMIT"

# Ensure working directory is clean
git status --porcelain
# If dirty, warn user and ask to commit/stash first
```

All parallel agents start from the same git state. Changes are held until all complete.

**2. Generate parallel group ID:**

```bash
# Unique identifier for this batch of parallel agents
PARALLEL_GROUP="phase-${PHASE}-batch-$(date +%s)"
echo "Parallel group: $PARALLEL_GROUP"
```

This enables batch resume if session is interrupted.

**3. Initialize tracking:**

```bash
# Create/verify agent-history.json
if [ ! -f .planning/agent-history.json ]; then
  echo '{"version":"1.1","max_entries":50,"entries":[]}' > .planning/agent-history.json
fi
```

**4. Spawn each independent plan:**

For each independent plan (up to max_concurrent_agents):

```
Task(
  description: "Execute plan {phase}-{plan}",
  prompt: "Execute plan at {plan_path}.

    **Execution context:**
    - You are running as a PARALLEL agent in group {parallel_group}
    - Other plans from this phase are executing simultaneously
    - Starting from git commit: {start_commit}

    **Your responsibilities:**
    - Read the full plan for objective, context, and deviation rules
    - Execute all tasks in the plan
    - Create SUMMARY.md in the phase directory
    - DO NOT commit changes - orchestrator will handle commits after all complete
    - Track all files you create or modify

    **Checkpoint handling (background mode):**
    - checkpoint:human-verify → Skip and log 'skipped - background mode'
    - checkpoint:decision → Use first option and log choice
    - checkpoint:human-action → Skip and log warning

    **Report when complete:**
    - Tasks completed (count)
    - Files modified (list with paths)
    - Deviations encountered
    - Checkpoints skipped (count and types)
    - Any errors or blockers",
  subagent_type: "general-purpose",
  run_in_background: true
)
```

**5. Record each spawn:**

After Task tool returns with agent_id and output_file:

```json
{
  "agent_id": "[from response]",
  "task_description": "Execute plan {phase}-{plan} (parallel)",
  "phase": "{phase}",
  "plan": "{plan}",
  "segment": null,
  "timestamp": "[ISO timestamp]",
  "status": "spawned",
  "completion_timestamp": null,
  "execution_mode": "parallel",
  "output_file": "[from response]",
  "background_status": "running",
  "parallel_group": "{parallel_group}",
  "depends_on": null,
  "checkpoints_skipped": null,
  "files_modified": null
}
```

**6. Queue dependent plans:**

For plans that depend on others in this phase:

```json
{
  "agent_id": null,
  "task_description": "Execute plan {phase}-{plan} (queued)",
  "phase": "{phase}",
  "plan": "{plan}",
  "status": "queued",
  "execution_mode": "parallel",
  "parallel_group": "{parallel_group}",
  "depends_on": ["11-01", "11-03"]
}
```

**7. Report spawn status:**

```
Parallel Execution Started
════════════════════════════════════════

Group: {parallel_group}
Git state: {start_commit}

Spawned ({N} agents):
  → {phase}-{plan}: agent_{id} (output: {file})
  → {phase}-{plan}: agent_{id} (output: {file})
  → {phase}-{plan}: agent_{id} (output: {file})

Queued (waiting for dependencies):
  ⏳ {phase}-{plan}: needs {dependency}

════════════════════════════════════════
Commits will be created after all plans complete.

Monitoring progress...
```

**8. Continue to completion monitoring:**

Do not return control to user yet. Continue to monitor_parallel_completion step.
</step>

<step name="monitor_parallel_completion">
**Monitor parallel agents and handle completion with orchestrator commits.**

After spawning parallel agents, orchestrator monitors until all complete.

**1. Polling loop:**

```
Initialize:
  running_agents = [agents with background_status === "running"]
  queued_agents = [agents with status === "queued"]
  completed_results = []

while (running_agents.length > 0 OR queued_agents.length > 0):

  # Check each running agent
  for agent in running_agents:
    result = TaskOutput(
      task_id: agent.agent_id,
      block: false,
      timeout: 5000
    )

    if result.completed:
      process_completion(agent, result)
      running_agents.remove(agent)

    elif result.failed:
      process_failure(agent, result)
      running_agents.remove(agent)

  # Check if dependents can now start
  for queued in queued_agents:
    if dependencies_satisfied(queued) AND running_count < max_concurrent:
      new_agent = spawn_agent(queued.plan_path)
      queued_agents.remove(queued)
      running_agents.add(new_agent)

  # Progress update
  show_progress(running_agents, completed_results, queued_agents)

  # Brief pause between checks (10 seconds)
  sleep(10)
```

**2. Process completion:**

When TaskOutput indicates agent completed:

```bash
# Read agent's output for results
cat [agent.output_file]

# Check if SUMMARY.md was created
ls .planning/phases/XX-name/{phase}-{plan}-SUMMARY.md

# Parse results from agent output:
# - Files modified (list)
# - Deviations encountered
# - Checkpoints skipped (count)
# - Task completion count
```

Update agent-history.json:
```json
{
  "status": "completed",
  "completion_timestamp": "[ISO timestamp]",
  "background_status": "completed",
  "checkpoints_skipped": [count from output],
  "files_modified": [list from output]
}
```

Add to completed_results for final aggregation.

**3. Process failure:**

When TaskOutput indicates agent failed:

```json
{
  "status": "failed",
  "completion_timestamp": "[ISO timestamp]",
  "background_status": "failed"
}
```

Do NOT kill other running agents on single failure.
Continue monitoring others.

**4. Spawn dependents when ready:**

For each queued plan, check if dependencies are satisfied:

```
dependencies_satisfied(queued):
  for dep in queued.depends_on:
    if not completed_results.has(dep):
      return false
  return true
```

If satisfied AND running_count < max_concurrent:
- Spawn the dependent plan (same as step 4 in spawn_parallel_agents)
- Move from queued_agents to running_agents

**5. Orchestrator commit handling (after ALL plans complete):**

When running_agents and queued_agents are both empty:

```bash
# All agents complete - now create commits
echo "All parallel agents complete. Creating commits..."

# For each completed plan in execution order:
for plan in completed_plans_ordered:

  # Get files modified by this plan
  FILES=$(cat agent-history.json | jq -r ".entries[] | select(.plan == \"$plan\") | .files_modified[]")

  # Stage files from this plan
  for file in $FILES; do
    git add "$file"
  done

  # Check if SUMMARY exists and stage it
  git add ".planning/phases/XX-name/${plan}-SUMMARY.md" 2>/dev/null

  # Commit with standard format
  git commit -m "feat(${plan}): execute plan via parallel orchestrator

- Tasks completed: [count]
- Files modified: [count]
- Checkpoints skipped: [count if any]
- Part of parallel group: [parallel_group]"

done

# Final metadata commit for phase completion
git add .planning/STATE.md .planning/ROADMAP.md
git commit -m "docs(${PHASE}): complete phase via parallel execution

Parallel group: ${parallel_group}
Plans completed: ${plan_count}
Total time: ${total_duration} (parallel)
Sequential estimate: ${sequential_estimate}"
```

**6. Final aggregation and report:**

```
Parallel Execution Complete
════════════════════════════════════════

All {N} plans completed:

| Plan | Duration | Files | Checkpoints |
|------|----------|-------|-------------|
| 11-01 | 2m 34s | 3 | 0 |
| 11-02 | 1m 45s | 2 | 0 |
| 11-03 | 3m 12s | 4 | 2 skipped |
| 11-04 | 2m 01s | 1 | 0 |

Commits created:
  abc123f feat(11-01): execute plan via parallel orchestrator
  def456g feat(11-02): execute plan via parallel orchestrator
  ghi789h feat(11-03): execute plan via parallel orchestrator
  jkl012i feat(11-04): execute plan via parallel orchestrator
  mno345j docs(11): complete phase via parallel execution

════════════════════════════════════════
Phase 11 complete!

Total time: 3m 45s (parallel execution)
Sequential estimate: 9m 32s
Time saved: 5m 47s (60%)
════════════════════════════════════════
```

**7. Error handling:**

If any agent failed:

```
Parallel Execution Partial Complete
════════════════════════════════════════

✓ Completed ({N}):
  - 11-01: 2m 34s
  - 11-03: 3m 12s

✗ Failed ({N}):
  - 11-02: Build error in task 2

⏳ Not started (blocked by failure):
  - 11-04: depends on 11-02

════════════════════════════════════════
Options:
1. /gsd:status 11-02 - View error details
2. /gsd:execute-plan 11-02 - Retry in foreground
3. /gsd:resume-task [agent-id] - Resume from failure
4. Continue - Commit successful plans only
════════════════════════════════════════
```

Commits are only created for successful plans.
Failed plans can be retried individually.
</step>

<step name="record_start_time">
Record execution start time for performance tracking:

```bash
PLAN_START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PLAN_START_EPOCH=$(date +%s)
```

Store in shell variables for duration calculation at completion.
</step>

<step name="analyze_task_dependencies">
**Task-level parallelization analysis for single plan execution.**

This step analyzes tasks within a single plan to identify independent task groups that can be parallelized.

**Entry point:**
After parse_segments determines execution pattern, if the plan:
- Has multiple tasks (3+ by default)
- Does NOT have decision/human-action checkpoints that affect subsequent tasks
- Has config `parallelization.task_level: true` (default)
- Does NOT have plan frontmatter `parallel_tasks: false`

**Skip conditions:**
- Config has `parallelization.task_level: false` → execute sequentially
- Plan frontmatter has `parallel_tasks: false` → execute sequentially
- Fewer than `min_tasks_for_parallel` tasks (default: 3) → execute sequentially
- Plan has decision checkpoints that affect following tasks → execute sequentially

**1. Parse all tasks from PLAN.md:**

```bash
# Extract task elements
grep -n '<task' "$PLAN_PATH"

# For each task, extract:
# - Task name/number
# - Files modified (from <files> element)
# - Type (auto, checkpoint:*, etc.)
# - depends_on attribute if present
# - parallel="false" attribute if present
```

**2. Build task dependency graph:**

```
Task dependencies detected by:
a) Explicit depends_on attribute: <task depends_on="task-1">
b) File conflicts: Tasks modifying same files must be sequential
c) Output references: Task B references output of Task A
d) Sequential logic: Task describes "after X is done" or "using output from"
e) Checkpoint position: Checkpoint tasks break parallelization flow
```

Example analysis:
```
Task 1: <files>src/auth.ts</files>
Task 2: <files>src/auth.ts, src/types.ts</files>  ← depends on Task 1 (file conflict)
Task 3: <files>src/utils.ts</files>               ← independent
Task 4: <files>src/config.ts</files> type="checkpoint:human-verify"
Task 5: <files>src/api.ts</files>                 ← depends on Task 4 (checkpoint barrier)
Task 6: <files>src/api.ts</files>                 ← depends on Task 5 (file conflict)
```

**3. Categorize tasks:**

| Category | Criteria | Action |
|----------|----------|--------|
| independent | No shared files, no dependencies | Can run in parallel |
| dependent | Requires another task to complete first | Wait for dependency |
| checkpoint | Contains human interaction | Special handling per config |

**4. Checkpoint handling at task level:**

By default, checkpoint tasks ARE included in parallelization groups.

In background task agents, checkpoints are handled as:
- `checkpoint:human-verify`: Skip and log "skipped - background mode"
- `checkpoint:decision`: Use first option and log choice
- `checkpoint:human-action`: Skip and log warning

**Per-task override:**
```xml
<task type="checkpoint" skip_in_background="false">
  <!-- This checkpoint MUST run in foreground even if skip_checkpoints: true -->
</task>
```

If config `skip_checkpoints: false`, tasks containing checkpoints run in main context.
If task has `skip_in_background="false"` attribute, that task runs in foreground.

Checkpoint tasks create dependency barriers: tasks after a checkpoint depend on it.

**5. Group independent tasks (respecting checkpoints):**

```
Example for a 6-task plan with checkpoint at Task 4:

If skip_checkpoints: true (default):
  Group 1: [Task 1, Task 3] - no dependencies, no file conflicts
  Sequential: Task 2 (depends on Task 1 output)
  Group 2: [Task 4-checkpoint, Task 5] - can parallelize (checkpoint skipped)
  Sequential: Task 6 (depends on Task 5)

If skip_checkpoints: false:
  Group 1: [Task 1, Task 3] - parallel
  Sequential: Task 2 (depends on Task 1)
  Main Context: Task 4 (checkpoint - must run in foreground)
  Group 2: [Task 5] - after checkpoint
  Sequential: Task 6
```

**6. Decision logic:**

```
if config.parallelization.task_level === false:
  → Execute all tasks sequentially

if plan.frontmatter.parallel_tasks === false:
  → Execute all tasks sequentially

if task_count < min_tasks_for_parallel (default: 3):
  → Execute sequentially (overhead not worth it)

if no independent groups found after analysis:
  → Execute sequentially

otherwise:
  → Spawn parallel agents per group
```

**7. Present analysis:**

<if mode="yolo">
```
⚡ Auto-approved: Task-level parallelization

Plan has [N] tasks:
  Parallel Group 1: [Task 1, Task 3] (no conflicts)
  Sequential: Task 2 (depends on Task 1)
  Parallel Group 2: [Task 4, Task 5] (checkpoint skipped)
  Sequential: Task 6 (depends on Task 5)

Spawning parallel task agents...
```

Proceed to spawn_task_agents step.
</if>

<if mode="interactive">
```
Plan has [N] tasks

Task dependency analysis:
  Parallel Group 1: Tasks 1, 3 (no conflicts)
  Sequential: Task 2 (depends on Task 1)
  Parallel Group 2: Tasks 4, 5 (Task 4 checkpoint will be skipped)
  Sequential: Task 6 (depends on Task 5)

Concurrency: [X] slots available (of [max] max)

Parallelize tasks? (yes / sequential / review)
```

Wait for user confirmation.
</if>

**8. Route to execution:**

| Analysis Result | Next Step |
|-----------------|-----------|
| Independent groups found | spawn_task_agents |
| All sequential after analysis | execute (normal flow) |
| User chose "sequential" | execute (normal flow) |
</step>

<step name="spawn_task_agents">
**Spawn parallel agents for independent task groups within a single plan.**

Triggered when analyze_task_dependencies finds independent task groups.

**Concurrency management:**
Task agents share the global `max_concurrent_agents` limit from config.
- If plan-level parallelization is also active, task agents count toward the same pool
- Example: max_concurrent=3, 2 plan agents running → only 1 task agent slot available
- Check available slots before spawning: `available = max_concurrent - currently_running`

**1. Check available concurrency:**

```bash
# Count currently running agents from agent-history.json
RUNNING=$(jq '[.entries[] | select(.background_status == "running")] | length' .planning/agent-history.json 2>/dev/null || echo 0)

# Get max from config (default: 3)
MAX_CONCURRENT=$(jq -r '.parallelization.max_concurrent_agents // 3' .planning/config.json 2>/dev/null || echo 3)

# Available slots
AVAILABLE=$((MAX_CONCURRENT - RUNNING))
```

**2. Generate task parallel group ID:**

```bash
# Unique identifier for this batch of task agents
TASK_PARALLEL_GROUP="plan-${PHASE}-${PLAN}-tasks-batch-$(date +%s)"
echo "Task parallel group: $TASK_PARALLEL_GROUP"
```

**3. For each independent task group (respecting concurrency):**

```
Task(
  description: "Execute tasks {task-ids} from plan {plan}",
  prompt: "Execute ONLY these tasks from plan at {path}: [task list with names]

           **Context:**
           - Read the full plan for objective, context files, and deviation rules
           - You are executing a SUBSET of tasks (not the full plan)
           - Other tasks will be executed by other agents or sequentially

           **Your responsibilities:**
           - Execute ONLY the assigned tasks: [task numbers/names]
           - Follow all deviation rules and authentication gate protocols
           - Track deviations for later aggregation
           - DO NOT create SUMMARY.md (orchestrator will merge results)
           - DO NOT commit changes (orchestrator handles commits)

           **Checkpoint handling (background mode):**
           - checkpoint:human-verify → Skip and log 'skipped - background mode'
           - checkpoint:decision → Use first option and log choice
           - checkpoint:human-action → Skip and log 'skipped - background mode'

           **Report back:**
           - Tasks completed (list each with status)
           - Files modified (list full paths)
           - Deviations encountered (if any)
           - Checkpoints skipped (count and types)
           - Any errors or blockers",
  subagent_type: "general-purpose",
  run_in_background: true
)
```

**4. Track task-level agents with unique identifiers:**

After Task tool returns with agent_id and output_file:

```json
{
  "agent_id": "[from response]",
  "task_description": "Execute tasks [1, 3] from plan 11-02",
  "phase": "{phase}",
  "plan": "{plan}",
  "segment": null,
  "timestamp": "[ISO timestamp]",
  "status": "spawned",
  "completion_timestamp": null,
  "execution_mode": "parallel",
  "output_file": "[from response]",
  "background_status": "running",
  "parallel_group": "{task_parallel_group}",
  "granularity": "task_group",
  "task_group": ["Task 1", "Task 3"],
  "depends_on": null,
  "checkpoints_skipped": null,
  "files_modified": null,
  "task_results": null
}
```

**5. Queue task groups that exceed concurrency:**

If spawned agents would exceed max_concurrent:
- First groups up to available slots: spawn immediately
- Remaining groups: queue with depends_on tracking

```json
{
  "agent_id": null,
  "task_description": "Execute tasks [4, 5] from plan 11-02 (queued)",
  "phase": "{phase}",
  "plan": "{plan}",
  "status": "queued",
  "execution_mode": "parallel",
  "parallel_group": "{task_parallel_group}",
  "granularity": "task_group",
  "task_group": ["Task 4", "Task 5"],
  "depends_on": ["task-group-1"]
}
```

**6. Report spawn status:**

```
Plan 11-02 Task Parallel Execution
════════════════════════════════════════

Group: {task_parallel_group}
Concurrency: {available}/{max} slots

Spawned (Group 1):
  → Tasks 1, 3: agent_{id}

Sequential (after Group 1):
  ⏳ Task 2: waiting for Task 1 (file conflict)

Queued (Group 2):
  ⏳ Tasks 4, 5: waiting for concurrency slot
  ⚠️ Task 4 has checkpoint (will be skipped)

Sequential (after Group 2):
  ⏳ Task 6: waiting for Task 5 (file conflict)

════════════════════════════════════════
Monitoring task completion...
```

**7. Handle slot exhaustion:**

If no concurrent slots available (all used by plan-level agents):
- Queue all task groups
- Poll for available slots during completion monitoring
- Spawn queued groups as slots become available

**8. Continue to task completion monitoring:**

Do not return control yet. Continue to monitor_task_completion step.
</step>

<step name="monitor_task_completion">
**Monitor task-level parallel agents and handle completion.**

After spawning task agents, orchestrator monitors until all complete.

**1. Polling loop (similar to plan-level but for tasks):**

```
Initialize:
  running_task_agents = [agents with granularity === "task_group" AND background_status === "running"]
  queued_task_groups = [entries with granularity === "task_group" AND status === "queued"]
  sequential_tasks = [tasks that must run in main context]
  completed_task_results = []

while (running_task_agents.length > 0 OR queued_task_groups.length > 0):

  # Check each running agent
  for agent in running_task_agents:
    result = TaskOutput(
      task_id: agent.agent_id,
      block: false,
      timeout: 5000
    )

    if result.completed:
      process_task_completion(agent, result)
      running_task_agents.remove(agent)

    elif result.failed:
      process_task_failure(agent, result)
      running_task_agents.remove(agent)

  # Check if queued groups can now start
  for queued in queued_task_groups:
    if dependencies_satisfied(queued) AND running_count < max_concurrent:
      new_agent = spawn_task_agent(queued.task_group)
      queued_task_groups.remove(queued)
      running_task_agents.add(new_agent)

  # Progress update
  show_task_progress(running_task_agents, completed_task_results, queued_task_groups)

  # Brief pause between checks (5 seconds for tasks, faster than plan-level)
  sleep(5)
```

**2. Process task completion:**

When TaskOutput indicates agent completed:

```bash
# Read agent's output for task results
cat [agent.output_file]

# Parse task-level results:
# - Per-task status (success/failure)
# - Files modified per task
# - Checkpoints skipped (count)
# - Deviations per task
```

Update agent-history.json with task_results:
```json
{
  "status": "completed",
  "completion_timestamp": "[ISO timestamp]",
  "background_status": "completed",
  "checkpoints_skipped": [count from output],
  "files_modified": [aggregated list from output],
  "task_results": {
    "Task 1": {
      "status": "completed",
      "files": ["src/auth.ts"],
      "deviations": []
    },
    "Task 3": {
      "status": "completed",
      "files": ["src/utils.ts"],
      "deviations": []
    }
  }
}
```

**3. Execute sequential tasks in order:**

After parallel group completes, run any dependent sequential tasks in main context:

```
# Task 2 depends on Task 1 (now complete)
Execute Task 2 in main context
Track results for aggregation

# Continue with next parallel group or sequential task
```

**4. After all tasks complete:**

When all task agents, queued groups, and sequential tasks are done:
- Proceed to merge_task_results step
</step>

<step name="merge_task_results">
**Aggregate results from parallel task execution for SUMMARY generation.**

After all task agents complete, merge results into unified execution record.

**1. Collect results from each agent:**

For each completed task agent in agent-history.json with matching parallel_group:

```bash
# Get all task results for this plan
jq '.entries[] | select(.parallel_group | startswith("plan-{PHASE}-{PLAN}")) | select(.granularity == "task_group")' .planning/agent-history.json
```

Extract from each:
- Files created/modified (from files_modified field)
- Task outcomes (from task_results field)
- Deviations encountered
- Checkpoints skipped (from checkpoints_skipped field)

**2. Merge into unified execution record:**

```
Task Execution Results (Plan 11-02):
═══════════════════════════════════════════════════

| Task | Agent | Status | Files | Deviations | Checkpoint |
|------|-------|--------|-------|------------|------------|
| 1 | agent_01HXXX (parallel) | ✓ Complete | 2 | 0 | - |
| 2 | main context (sequential) | ✓ Complete | 1 | 1 | - |
| 3 | agent_01HXXX (parallel) | ✓ Complete | 2 | 0 | - |
| 4 | agent_01HYYY (parallel) | ✓ Complete | 1 | 0 | skipped |
| 5 | agent_01HYYY (parallel) | ✓ Complete | 2 | 0 | - |
| 6 | main context (sequential) | ✓ Complete | 1 | 0 | - |

═══════════════════════════════════════════════════
```

**3. Handle merge conflicts (file-level):**

If two agents unexpectedly modified the same file (should not happen if dependency analysis is correct, but as a safeguard):

```
⚠️ File conflict detected: src/config.ts

Modified by:
- Task 1 (agent_01HXXX)
- Task 3 (agent_01HXXX)

This shouldn't happen with proper dependency analysis.
Review required.

Options:
1. Review diff and merge manually
2. Keep Task 1 changes only
3. Keep Task 3 changes only
4. Keep both (may have issues)
```

Use AskUserQuestion to get resolution:
- header: "File Conflict"
- question: "[file] was modified by multiple tasks. How to resolve?"
- options: Review diff, Keep first, Keep second, Keep both

**4. Aggregate for SUMMARY.md:**

After conflict resolution (if any):

```markdown
## Task Execution Summary

**Execution mode:** Parallel task groups
**Total tasks:** 6
**Parallel groups:** 2 (4 tasks parallelized)
**Sequential tasks:** 2 (dependency chain)
**Checkpoints skipped:** 1 (Task 4: human-verify)

### Task Results

| Task | Execution | Status | Duration |
|------|-----------|--------|----------|
| Task 1 | Parallel (Group 1) | Complete | 45s |
| Task 2 | Sequential | Complete | 30s |
| Task 3 | Parallel (Group 1) | Complete | 40s |
| Task 4 | Parallel (Group 2) | Complete | 20s |
| Task 5 | Parallel (Group 2) | Complete | 35s |
| Task 6 | Sequential | Complete | 25s |

### Files Modified

Aggregated from all tasks (deduplicated):
- `src/auth.ts` - Task 1
- `src/utils.ts` - Task 3
- `src/types.ts` - Task 2
- `src/config.ts` - Task 4
- `src/api.ts` - Tasks 5, 6

### Deviations

Combined from all tasks:
- [Rule 2 - Missing Critical] Task 2: Added input validation (deviation from task agent report)

### Performance

- **Total duration:** 4m 12s
- **Sequential estimate:** 8m 30s (sum of all task durations)
- **Speedup:** 2.0x
- **Time saved:** 4m 18s
```

**5. Commit handling (deferred to orchestrator):**

Task agents do NOT commit. After SUMMARY generated:

```bash
# Stage all files from all tasks
for task in completed_tasks:
  for file in task.files_modified:
    git add "$file"

# Stage SUMMARY.md
git add .planning/phases/XX-name/{phase}-{plan}-SUMMARY.md

# Single plan commit
git commit -m "feat({phase}-{plan}): {description}

- Tasks completed: {total}
- Parallel groups: {group_count}
- Checkpoints skipped: {skip_count}
- Total duration: {duration} (parallel)
- Sequential estimate: {estimate}"
```

**6. Route to next step:**

After merging complete:
- If more plans in phase: offer_next
- If last plan: update_roadmap → git_commit_metadata
</step>

<step name="parse_segments">
**Intelligent segmentation: Parse plan into execution segments.**

Plans are divided into segments by checkpoints. Each segment is routed to optimal execution context (subagent or main).

**1. Check for checkpoints:**

```bash
# Find all checkpoints and their types
grep -n "type=\"checkpoint" .planning/phases/XX-name/{phase}-{plan}-PLAN.md
```

**2. Analyze execution strategy:**

**If NO checkpoints found:**

- **Fully autonomous plan** - spawn single subagent for entire plan
- Subagent gets fresh 200k context, executes all tasks, creates SUMMARY, commits
- Main context: Just orchestration (~5% usage)

**If checkpoints found, parse into segments:**

Segment = tasks between checkpoints (or start→first checkpoint, or last checkpoint→end)

**For each segment, determine routing:**

```
Segment routing rules:

IF segment has no prior checkpoint:
  → SUBAGENT (first segment, nothing to depend on)

IF segment follows checkpoint:human-verify:
  → SUBAGENT (verification is just confirmation, doesn't affect next work)

IF segment follows checkpoint:decision OR checkpoint:human-action:
  → MAIN CONTEXT (next tasks need the decision/result)
```

**3. Execution pattern:**

**Pattern A: Fully autonomous (no checkpoints)**

```
Spawn subagent → execute all tasks → SUMMARY → commit → report back
```

**Pattern B: Segmented with verify-only checkpoints**

```
Segment 1 (tasks 1-3): Spawn subagent → execute → report back
Checkpoint 4 (human-verify): Main context → you verify → continue
Segment 2 (tasks 5-6): Spawn NEW subagent → execute → report back
Checkpoint 7 (human-verify): Main context → you verify → continue
Aggregate results → SUMMARY → commit
```

**Pattern C: Decision-dependent (must stay in main)**

```
Checkpoint 1 (decision): Main context → you decide → continue in main
Tasks 2-5: Main context (need decision from checkpoint 1)
No segmentation benefit - execute entirely in main
```

**4. Why this works:**

**Segmentation benefits:**

- Fresh context for each autonomous segment (0% start every time)
- Main context only for checkpoints (~10-20% total)
- Can handle 10+ task plans if properly segmented
- Quality impossible to degrade in autonomous segments

**When segmentation provides no benefit:**

- Checkpoint is decision/human-action and following tasks depend on outcome
- Better to execute sequentially in main than break flow

**5. Implementation:**

**For fully autonomous plans:**

```
1. Run init_agent_tracking step first (see step below)

2. Use Task tool with subagent_type="general-purpose":

   Prompt: "Execute plan at .planning/phases/{phase}-{plan}-PLAN.md

   This is an autonomous plan (no checkpoints). Execute all tasks, create SUMMARY.md in phase directory, commit with message following plan's commit guidance.

   Follow all deviation rules and authentication gate protocols from the plan.

   When complete, report: plan name, tasks completed, SUMMARY path, commit hash."

3. After Task tool returns with agent_id:

   a. Write agent_id to current-agent-id.txt:
      echo "[agent_id]" > .planning/current-agent-id.txt

   b. Append spawn entry to agent-history.json:
      {
        "agent_id": "[agent_id from Task response]",
        "task_description": "Execute full plan {phase}-{plan} (autonomous)",
        "phase": "{phase}",
        "plan": "{plan}",
        "segment": null,
        "timestamp": "[ISO timestamp]",
        "status": "spawned",
        "completion_timestamp": null
      }

4. Wait for subagent to complete

5. After subagent completes successfully:

   a. Update agent-history.json entry:
      - Find entry with matching agent_id
      - Set status: "completed"
      - Set completion_timestamp: "[ISO timestamp]"

   b. Clear current-agent-id.txt:
      rm .planning/current-agent-id.txt

6. Report completion to user
```

**For segmented plans (has verify-only checkpoints):**

```
Execute segment-by-segment:

For each autonomous segment:
  Spawn subagent with prompt: "Execute tasks [X-Y] from plan at .planning/phases/{phase}-{plan}-PLAN.md. Read the plan for full context and deviation rules. Do NOT create SUMMARY or commit - just execute these tasks and report results."

  Wait for subagent completion

For each checkpoint:
  Execute in main context
  Wait for user interaction
  Continue to next segment

After all segments complete:
  Aggregate all results
  Create SUMMARY.md
  Commit with all changes
```

**For decision-dependent plans:**

```
Execute in main context (standard flow below)
No subagent routing
Quality maintained through small scope (2-3 tasks per plan)
```

See step name="segment_execution" for detailed segment execution loop.
</step>

<step name="init_agent_tracking">
**Initialize agent tracking for subagent resume capability.**

Before spawning any subagents, set up tracking infrastructure:

**1. Create/verify tracking files:**

```bash
# Create agent history file if doesn't exist
if [ ! -f .planning/agent-history.json ]; then
  echo '{"version":"1.0","max_entries":50,"entries":[]}' > .planning/agent-history.json
fi

# Clear any stale current-agent-id (from interrupted sessions)
# Will be populated when subagent spawns
rm -f .planning/current-agent-id.txt
```

**2. Check for interrupted agents (resume detection):**

```bash
# Check if current-agent-id.txt exists from previous interrupted session
if [ -f .planning/current-agent-id.txt ]; then
  INTERRUPTED_ID=$(cat .planning/current-agent-id.txt)
  echo "Found interrupted agent: $INTERRUPTED_ID"
fi
```

**If interrupted agent found:**
- The agent ID file exists from a previous session that didn't complete
- This agent can potentially be resumed using Task tool's `resume` parameter
- Present to user: "Previous session was interrupted. Resume agent [ID] or start fresh?"
- If resume: Use Task tool with `resume` parameter set to the interrupted ID
- If fresh: Clear the file and proceed normally

**3. Prune old entries (housekeeping):**

If agent-history.json has more than `max_entries`:
- Remove oldest entries with status "completed"
- Never remove entries with status "spawned" (may need resume)
- Keep file under size limit for fast reads

**When to run this step:**
- Pattern A (fully autonomous): Before spawning the single subagent
- Pattern B (segmented): Before the segment execution loop
- Pattern C (main context): Skip - no subagents spawned
</step>

<step name="segment_execution">
**Detailed segment execution loop for segmented plans.**

**This step applies ONLY to segmented plans (Pattern B: has checkpoints, but they're verify-only).**

For Pattern A (fully autonomous) and Pattern C (decision-dependent), skip this step.

**Execution flow:**

````
1. Parse plan to identify segments:
   - Read plan file
   - Find checkpoint locations: grep -n "type=\"checkpoint" PLAN.md
   - Identify checkpoint types: grep "type=\"checkpoint" PLAN.md | grep -o 'checkpoint:[^"]*'
   - Build segment map:
     * Segment 1: Start → first checkpoint (tasks 1-X)
     * Checkpoint 1: Type and location
     * Segment 2: After checkpoint 1 → next checkpoint (tasks X+1 to Y)
     * Checkpoint 2: Type and location
     * ... continue for all segments

2. For each segment in order:

   A. Determine routing (apply rules from parse_segments):
      - No prior checkpoint? → Subagent
      - Prior checkpoint was human-verify? → Subagent
      - Prior checkpoint was decision/human-action? → Main context

   B. If routing = Subagent:
      ```
      Spawn Task tool with subagent_type="general-purpose":

      Prompt: "Execute tasks [task numbers/names] from plan at [plan path].

      **Context:**
      - Read the full plan for objective, context files, and deviation rules
      - You are executing a SEGMENT of this plan (not the full plan)
      - Other segments will be executed separately

      **Your responsibilities:**
      - Execute only the tasks assigned to you
      - Follow all deviation rules and authentication gate protocols
      - Track deviations for later Summary
      - DO NOT create SUMMARY.md (will be created after all segments complete)
      - DO NOT commit (will be done after all segments complete)

      **Report back:**
      - Tasks completed
      - Files created/modified
      - Deviations encountered
      - Any issues or blockers"

      **After Task tool returns with agent_id:**

      1. Write agent_id to current-agent-id.txt:
         echo "[agent_id]" > .planning/current-agent-id.txt

      2. Append spawn entry to agent-history.json:
         {
           "agent_id": "[agent_id from Task response]",
           "task_description": "Execute tasks [X-Y] from plan {phase}-{plan}",
           "phase": "{phase}",
           "plan": "{plan}",
           "segment": [segment_number],
           "timestamp": "[ISO timestamp]",
           "status": "spawned",
           "completion_timestamp": null
         }

      Wait for subagent to complete
      Capture results (files changed, deviations, etc.)

      **After subagent completes successfully:**

      1. Update agent-history.json entry:
         - Find entry with matching agent_id
         - Set status: "completed"
         - Set completion_timestamp: "[ISO timestamp]"

      2. Clear current-agent-id.txt:
         rm .planning/current-agent-id.txt

      ```

   C. If routing = Main context:
      Execute tasks in main using standard execution flow (step name="execute")
      Track results locally

   D. After segment completes (whether subagent or main):
      Continue to next checkpoint/segment

3. After ALL segments complete:

   A. Aggregate results from all segments:
      - Collect files created/modified from all segments
      - Collect deviations from all segments
      - Collect decisions from all checkpoints
      - Merge into complete picture

   B. Create SUMMARY.md:
      - Use aggregated results
      - Document all work from all segments
      - Include deviations from all segments
      - Note which segments were subagented

   C. Commit:
      - Stage all files from all segments
      - Stage SUMMARY.md
      - Commit with message following plan guidance
      - Include note about segmented execution if relevant

   D. Report completion

**Example execution trace:**

````

Plan: 01-02-PLAN.md (8 tasks, 2 verify checkpoints)

Parsing segments...

- Segment 1: Tasks 1-3 (autonomous)
- Checkpoint 4: human-verify
- Segment 2: Tasks 5-6 (autonomous)
- Checkpoint 7: human-verify
- Segment 3: Task 8 (autonomous)

Routing analysis:

- Segment 1: No prior checkpoint → SUBAGENT ✓
- Checkpoint 4: Verify only → MAIN (required)
- Segment 2: After verify → SUBAGENT ✓
- Checkpoint 7: Verify only → MAIN (required)
- Segment 3: After verify → SUBAGENT ✓

Execution:
[1] Spawning subagent for tasks 1-3...
→ Subagent completes: 3 files modified, 0 deviations
[2] Executing checkpoint 4 (human-verify)...
════════════════════════════════════════
CHECKPOINT: Verification Required
Task 4 of 8: Verify database schema
I built: User and Session tables with relations
How to verify: Check src/db/schema.ts for correct types
════════════════════════════════════════
User: "approved"
[3] Spawning subagent for tasks 5-6...
→ Subagent completes: 2 files modified, 1 deviation (added error handling)
[4] Executing checkpoint 7 (human-verify)...
User: "approved"
[5] Spawning subagent for task 8...
→ Subagent completes: 1 file modified, 0 deviations

Aggregating results...

- Total files: 6 modified
- Total deviations: 1
- Segmented execution: 3 subagents, 2 checkpoints

Creating SUMMARY.md...
Committing...
✓ Complete

````

**Benefits of this pattern:**
- Main context usage: ~20% (just orchestration + checkpoints)
- Subagent 1: Fresh 0-30% (tasks 1-3)
- Subagent 2: Fresh 0-30% (tasks 5-6)
- Subagent 3: Fresh 0-20% (task 8)
- All autonomous work: Peak quality
- Can handle large plans with many tasks if properly segmented

**When NOT to use segmentation:**
- Plan has decision/human-action checkpoints that affect following tasks
- Following tasks depend on checkpoint outcome
- Better to execute in main sequentially in those cases
</step>

<step name="load_prompt">
Read the plan prompt:
```bash
cat .planning/phases/XX-name/{phase}-{plan}-PLAN.md
````

This IS the execution instructions. Follow it exactly.

**If plan references CONTEXT.md:**
The CONTEXT.md file provides the user's vision for this phase — how they imagine it working, what's essential, and what's out of scope. Honor this context throughout execution.
</step>

<step name="previous_phase_check">
Before executing, check if previous phase had issues:

```bash
# Find previous phase summary
ls .planning/phases/*/SUMMARY.md 2>/dev/null | sort -r | head -2 | tail -1
```

If previous phase SUMMARY.md has "Issues Encountered" != "None" or "Next Phase Readiness" mentions blockers:

Use AskUserQuestion:

- header: "Previous Issues"
- question: "Previous phase had unresolved items: [summary]. How to proceed?"
- options:
  - "Proceed anyway" - Issues won't block this phase
  - "Address first" - Let's resolve before continuing
  - "Review previous" - Show me the full summary
    </step>

<step name="execute">
Execute each task in the prompt. **Deviations are normal** - handle them automatically using embedded rules below.

1. Read the @context files listed in the prompt

2. For each task:

   **If `type="auto"`:**

   **Before executing:** Check if task has `tdd="true"` attribute:
   - If yes: Follow TDD execution flow (see `<tdd_execution>`) - RED → GREEN → REFACTOR cycle with atomic commits per stage
   - If no: Standard implementation

   - Work toward task completion
   - **If CLI/API returns authentication error:** Handle as authentication gate (see below)
   - **When you discover additional work not in plan:** Apply deviation rules (see below) automatically
   - Continue implementing, applying rules as needed
   - Run the verification
   - Confirm done criteria met
   - **Commit the task** (see `<task_commit>` below)
   - Track task completion and commit hash for Summary documentation
   - Continue to next task

   **If `type="checkpoint:*"`:**

   - STOP immediately (do not continue to next task)
   - Execute checkpoint_protocol (see below)
   - Wait for user response
   - Verify if possible (check files, env vars, etc.)
   - Only after user confirmation: continue to next task

3. Run overall verification checks from `<verification>` section
4. Confirm all success criteria from `<success_criteria>` section met
5. Document all deviations in Summary (automatic - see deviation_documentation below)
   </step>

<authentication_gates>

## Handling Authentication Errors During Execution

**When you encounter authentication errors during `type="auto"` task execution:**

This is NOT a failure. Authentication gates are expected and normal. Handle them dynamically:

**Authentication error indicators:**

- CLI returns: "Error: Not authenticated", "Not logged in", "Unauthorized", "401", "403"
- API returns: "Authentication required", "Invalid API key", "Missing credentials"
- Command fails with: "Please run {tool} login" or "Set {ENV_VAR} environment variable"

**Authentication gate protocol:**

1. **Recognize it's an auth gate** - Not a bug, just needs credentials
2. **STOP current task execution** - Don't retry repeatedly
3. **Create dynamic checkpoint:human-action** - Present it to user immediately
4. **Provide exact authentication steps** - CLI commands, where to get keys
5. **Wait for user to authenticate** - Let them complete auth flow
6. **Verify authentication works** - Test that credentials are valid
7. **Retry the original task** - Resume automation where you left off
8. **Continue normally** - Don't treat this as an error in Summary

**Example: Vercel deployment hits auth error**

```
Task 3: Deploy to Vercel
Running: vercel --yes

Error: Not authenticated. Please run 'vercel login'

[Create checkpoint dynamically]

════════════════════════════════════════
CHECKPOINT: Authentication Required
════════════════════════════════════════

Task 3 of 8: Authenticate Vercel CLI

I tried to deploy but got authentication error.

What you need to do:
Run: vercel login

This will open your browser - complete the authentication flow.

I'll verify after: vercel whoami returns your account

Type "done" when authenticated
════════════════════════════════════════

[Wait for user response]

[User types "done"]

Verifying authentication...
Running: vercel whoami
✓ Authenticated as: user@example.com

Retrying deployment...
Running: vercel --yes
✓ Deployed to: https://myapp-abc123.vercel.app

Task 3 complete. Continuing to task 4...
```

**In Summary documentation:**

Document authentication gates as normal flow, not deviations:

```markdown
## Authentication Gates

During execution, I encountered authentication requirements:

1. Task 3: Vercel CLI required authentication
   - Paused for `vercel login`
   - Resumed after authentication
   - Deployed successfully

These are normal gates, not errors.
```

**Key principles:**

- Authentication gates are NOT failures or bugs
- They're expected interaction points during first-time setup
- Handle them gracefully and continue automation after unblocked
- Don't mark tasks as "failed" or "incomplete" due to auth gates
- Document them as normal flow, separate from deviations
  </authentication_gates>

<deviation_rules>

## Automatic Deviation Handling

**While executing tasks, you WILL discover work not in the plan.** This is normal.

Apply these rules automatically. Track all deviations for Summary documentation.

---

**RULE 1: Auto-fix bugs**

**Trigger:** Code doesn't work as intended (broken behavior, incorrect output, errors)

**Action:** Fix immediately, track for Summary

**Examples:**

- Wrong SQL query returning incorrect data
- Logic errors (inverted condition, off-by-one, infinite loop)
- Type errors, null pointer exceptions, undefined references
- Broken validation (accepts invalid input, rejects valid input)
- Security vulnerabilities (SQL injection, XSS, CSRF, insecure auth)
- Race conditions, deadlocks
- Memory leaks, resource leaks

**Process:**

1. Fix the bug inline
2. Add/update tests to prevent regression
3. Verify fix works
4. Continue task
5. Track in deviations list: `[Rule 1 - Bug] [description]`

**No user permission needed.** Bugs must be fixed for correct operation.

---

**RULE 2: Auto-add missing critical functionality**

**Trigger:** Code is missing essential features for correctness, security, or basic operation

**Action:** Add immediately, track for Summary

**Examples:**

- Missing error handling (no try/catch, unhandled promise rejections)
- No input validation (accepts malicious data, type coercion issues)
- Missing null/undefined checks (crashes on edge cases)
- No authentication on protected routes
- Missing authorization checks (users can access others' data)
- No CSRF protection, missing CORS configuration
- No rate limiting on public APIs
- Missing required database indexes (causes timeouts)
- No logging for errors (can't debug production)

**Process:**

1. Add the missing functionality inline
2. Add tests for the new functionality
3. Verify it works
4. Continue task
5. Track in deviations list: `[Rule 2 - Missing Critical] [description]`

**Critical = required for correct/secure/performant operation**
**No user permission needed.** These are not "features" - they're requirements for basic correctness.

---

**RULE 3: Auto-fix blocking issues**

**Trigger:** Something prevents you from completing current task

**Action:** Fix immediately to unblock, track for Summary

**Examples:**

- Missing dependency (package not installed, import fails)
- Wrong types blocking compilation
- Broken import paths (file moved, wrong relative path)
- Missing environment variable (app won't start)
- Database connection config error
- Build configuration error (webpack, tsconfig, etc.)
- Missing file referenced in code
- Circular dependency blocking module resolution

**Process:**

1. Fix the blocking issue
2. Verify task can now proceed
3. Continue task
4. Track in deviations list: `[Rule 3 - Blocking] [description]`

**No user permission needed.** Can't complete task without fixing blocker.

---

**RULE 4: Ask about architectural changes**

**Trigger:** Fix/addition requires significant structural modification

**Action:** STOP, present to user, wait for decision

**Examples:**

- Adding new database table (not just column)
- Major schema changes (changing primary key, splitting tables)
- Introducing new service layer or architectural pattern
- Switching libraries/frameworks (React → Vue, REST → GraphQL)
- Changing authentication approach (sessions → JWT)
- Adding new infrastructure (message queue, cache layer, CDN)
- Changing API contracts (breaking changes to endpoints)
- Adding new deployment environment

**Process:**

1. STOP current task
2. Present clearly:

```
⚠️ Architectural Decision Needed

Current task: [task name]
Discovery: [what you found that prompted this]
Proposed change: [architectural modification]
Why needed: [rationale]
Impact: [what this affects - APIs, deployment, dependencies, etc.]
Alternatives: [other approaches, or "none apparent"]

Proceed with proposed change? (yes / different approach / defer)
```

3. WAIT for user response
4. If approved: implement, track as `[Rule 4 - Architectural] [description]`
5. If different approach: discuss and implement
6. If deferred: log to ISSUES.md, continue without change

**User decision required.** These changes affect system design.

---

**RULE 5: Log non-critical enhancements**

**Trigger:** Improvement that would enhance code but isn't essential now

**Action:** Add to .planning/ISSUES.md automatically, continue task

**Examples:**

- Performance optimization (works correctly, just slower than ideal)
- Code refactoring (works, but could be cleaner/DRY-er)
- Better naming (works, but variables could be clearer)
- Organizational improvements (works, but file structure could be better)
- Nice-to-have UX improvements (works, but could be smoother)
- Additional test coverage beyond basics (basics exist, could be more thorough)
- Documentation improvements (code works, docs could be better)
- Accessibility enhancements beyond minimum

**Process:**

1. Create .planning/ISSUES.md if doesn't exist (use `~/.claude/get-shit-done/templates/issues.md`)
2. Add entry with ISS-XXX number (auto-increment)
3. Brief notification: `📋 Logged enhancement: [brief] (ISS-XXX)`
4. Continue task without implementing

**No user permission needed.** Logging for future consideration.

---

**RULE PRIORITY (when multiple could apply):**

1. **If Rule 4 applies** → STOP and ask (architectural decision)
2. **If Rules 1-3 apply** → Fix automatically, track for Summary
3. **If Rule 5 applies** → Log to ISSUES.md, continue
4. **If genuinely unsure which rule** → Apply Rule 4 (ask user)

**Edge case guidance:**

- "This validation is missing" → Rule 2 (critical for security)
- "This validation could be better" → Rule 5 (enhancement)
- "This crashes on null" → Rule 1 (bug)
- "This could be faster" → Rule 5 (enhancement) UNLESS actually timing out → Rule 2 (critical)
- "Need to add table" → Rule 4 (architectural)
- "Need to add column" → Rule 1 or 2 (depends: fixing bug or adding critical field)

**When in doubt:** Ask yourself "Does this affect correctness, security, or ability to complete task?"

- YES → Rules 1-3 (fix automatically)
- NO → Rule 5 (log it)
- MAYBE → Rule 4 (ask user)

</deviation_rules>

<deviation_documentation>

## Documenting Deviations in Summary

After all tasks complete, Summary MUST include deviations section.

**If no deviations:**

```markdown
## Deviations from Plan

None - plan executed exactly as written.
```

**If deviations occurred:**

```markdown
## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed case-sensitive email uniqueness constraint**

- **Found during:** Task 4 (Follow/unfollow API implementation)
- **Issue:** User.email unique constraint was case-sensitive - Test@example.com and test@example.com were both allowed, causing duplicate accounts
- **Fix:** Changed to `CREATE UNIQUE INDEX users_email_unique ON users (LOWER(email))`
- **Files modified:** src/models/User.ts, migrations/003_fix_email_unique.sql
- **Verification:** Unique constraint test passes - duplicate emails properly rejected
- **Commit:** abc123f

**2. [Rule 2 - Missing Critical] Added JWT expiry validation to auth middleware**

- **Found during:** Task 3 (Protected route implementation)
- **Issue:** Auth middleware wasn't checking token expiry - expired tokens were being accepted
- **Fix:** Added exp claim validation in middleware, reject with 401 if expired
- **Files modified:** src/middleware/auth.ts, src/middleware/auth.test.ts
- **Verification:** Expired token test passes - properly rejects with 401
- **Commit:** def456g

### Deferred Enhancements

Logged to .planning/ISSUES.md for future consideration:

- ISS-001: Refactor UserService into smaller modules (discovered in Task 3)
- ISS-002: Add connection pooling for Redis (discovered in Task 6)

---

**Total deviations:** 4 auto-fixed (1 bug, 1 missing critical, 1 blocking, 1 architectural with approval), 3 deferred
**Impact on plan:** All auto-fixes necessary for correctness/security/performance. No scope creep.
```

**This provides complete transparency:**

- Every deviation documented
- Why it was needed
- What rule applied
- What was done
- User can see exactly what happened beyond the plan

</deviation_documentation>

<tdd_plan_execution>
## TDD Plan Execution

When executing a plan with `type: tdd` in frontmatter, follow the RED-GREEN-REFACTOR cycle for the single feature defined in the plan.

**1. Check test infrastructure (if first TDD plan):**
If no test framework configured:
- Detect project type from package.json/requirements.txt/etc.
- Install minimal test framework (Jest, pytest, Go testing, etc.)
- Create test config file
- Verify: run empty test suite
- This is part of the RED phase, not a separate task

**2. RED - Write failing test:**
- Read `<behavior>` element for test specification
- Create test file if doesn't exist (follow project conventions)
- Write test(s) that describe expected behavior
- Run tests - MUST fail (if passes, test is wrong or feature exists)
- Commit: `test({phase}-{plan}): add failing test for [feature]`

**3. GREEN - Implement to pass:**
- Read `<implementation>` element for guidance
- Write minimal code to make test pass
- Run tests - MUST pass
- Commit: `feat({phase}-{plan}): implement [feature]`

**4. REFACTOR (if needed):**
- Clean up code if obvious improvements
- Run tests - MUST still pass
- Commit only if changes made: `refactor({phase}-{plan}): clean up [feature]`

**Commit pattern for TDD plans:**
Each TDD plan produces 2-3 atomic commits:
1. `test({phase}-{plan}): add failing test for X`
2. `feat({phase}-{plan}): implement X`
3. `refactor({phase}-{plan}): clean up X` (optional)

**Error handling:**
- If test doesn't fail in RED phase: Test is wrong or feature already exists. Investigate before proceeding.
- If test doesn't pass in GREEN phase: Debug implementation, keep iterating until green.
- If tests fail in REFACTOR phase: Undo refactor, commit was premature.

**Verification:**
After TDD plan completion, ensure:
- All tests pass
- Test coverage for the new behavior exists
- No unrelated tests broken

**Why TDD uses dedicated plans:** TDD requires 2-3 execution cycles (RED → GREEN → REFACTOR), each with file reads, test runs, and potential debugging. This consumes 40-50% of context for a single feature. Dedicated plans ensure full quality throughout the cycle.

**Comparison:**
- Standard plans: Multiple tasks, 1 commit per task, 2-4 commits total
- TDD plans: Single feature, 2-3 commits for RED/GREEN/REFACTOR cycle

See `~/.claude/get-shit-done/references/tdd.md` for TDD plan structure.
</tdd_plan_execution>

<task_commit>
## Task Commit Protocol

After each task completes (verification passed, done criteria met), commit immediately:

**1. Identify modified files:**

Track files changed during this specific task (not the entire plan):

```bash
git status --short
```

**2. Stage only task-related files:**

Stage each file individually (NEVER use `git add .` or `git add -A`):

```bash
# Example - adjust to actual files modified by this task
git add src/api/auth.ts
git add src/types/user.ts
```

**3. Determine commit type:**

| Type | When to Use | Example |
|------|-------------|---------|
| `feat` | New feature, endpoint, component, functionality | feat(08-02): create user registration endpoint |
| `fix` | Bug fix, error correction | fix(08-02): correct email validation regex |
| `test` | Test-only changes (TDD RED phase) | test(08-02): add failing test for password hashing |
| `refactor` | Code cleanup, no behavior change (TDD REFACTOR phase) | refactor(08-02): extract validation to helper |
| `perf` | Performance improvement | perf(08-02): add database index for user lookups |
| `docs` | Documentation changes | docs(08-02): add API endpoint documentation |
| `style` | Formatting, linting fixes | style(08-02): format auth module |
| `chore` | Config, tooling, dependencies | chore(08-02): add bcrypt dependency |

**4. Craft commit message:**

Format: `{type}({phase}-{plan}): {task-name-or-description}`

```bash
git commit -m "{type}({phase}-{plan}): {concise task description}

- {key change 1}
- {key change 2}
- {key change 3}
"
```

**Examples:**

```bash
# Standard plan task
git commit -m "feat(08-02): create user registration endpoint

- POST /auth/register validates email and password
- Checks for duplicate users
- Returns JWT token on success
"

# Another standard task
git commit -m "fix(08-02): correct email validation regex

- Fixed regex to accept plus-addressing
- Added tests for edge cases
"
```

**Note:** TDD plans have their own commit pattern (test/feat/refactor for RED/GREEN/REFACTOR phases). See `<tdd_plan_execution>` section above.

**5. Record commit hash:**

After committing, capture hash for SUMMARY.md:

```bash
TASK_COMMIT=$(git rev-parse --short HEAD)
echo "Task ${TASK_NUM} committed: ${TASK_COMMIT}"
```

Store in array or list for SUMMARY generation:
```bash
TASK_COMMITS+=("Task ${TASK_NUM}: ${TASK_COMMIT}")
```

**Atomic commit benefits:**
- Each task independently revertable
- Git bisect finds exact failing task
- Git blame traces line to specific task context
- Clear history for Claude in future sessions
- Better observability for AI-automated workflow

</task_commit>

<step name="checkpoint_protocol">
When encountering `type="checkpoint:*"`:

**Critical: Claude automates everything with CLI/API before checkpoints.** Checkpoints are for verification and decisions, not manual work.

**Display checkpoint clearly:**

```
════════════════════════════════════════
CHECKPOINT: [Type]
════════════════════════════════════════

Task [X] of [Y]: [Action/What-Built/Decision]

[Display task-specific content based on type]

[Resume signal instruction]
════════════════════════════════════════
```

**For checkpoint:human-verify (90% of checkpoints):**

```
I automated: [what was automated - deployed, built, configured]

How to verify:
1. [Step 1 - exact command/URL]
2. [Step 2 - what to check]
3. [Step 3 - expected behavior]

[Resume signal - e.g., "Type 'approved' or describe issues"]
```

**For checkpoint:decision (9% of checkpoints):**

```
Decision needed: [decision]

Context: [why this matters]

Options:
1. [option-id]: [name]
   Pros: [pros]
   Cons: [cons]

2. [option-id]: [name]
   Pros: [pros]
   Cons: [cons]

[Resume signal - e.g., "Select: option-id"]
```

**For checkpoint:human-action (1% - rare, only for truly unavoidable manual steps):**

```
I automated: [what Claude already did via CLI/API]

Need your help with: [the ONE thing with no CLI/API - email link, 2FA code]

Instructions:
[Single unavoidable step]

I'll verify after: [verification]

[Resume signal - e.g., "Type 'done' when complete"]
```

**After displaying:** WAIT for user response. Do NOT hallucinate completion. Do NOT continue to next task.

**After user responds:**

- Run verification if specified (file exists, env var set, tests pass, etc.)
- If verification passes or N/A: continue to next task
- If verification fails: inform user, wait for resolution

See ~/.claude/get-shit-done/references/checkpoints.md for complete checkpoint guidance.
</step>

<step name="verification_failure_gate">
If any task verification fails:

STOP. Do not continue to next task.

Present inline:
"Verification failed for Task [X]: [task name]

Expected: [verification criteria]
Actual: [what happened]

How to proceed?

1. Retry - Try the task again
2. Skip - Mark as incomplete, continue
3. Stop - Pause execution, investigate"

Wait for user decision.

If user chose "Skip", note it in SUMMARY.md under "Issues Encountered".
</step>

<step name="record_completion_time">
Record execution end time and calculate duration:

```bash
PLAN_END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PLAN_END_EPOCH=$(date +%s)

DURATION_SEC=$(( PLAN_END_EPOCH - PLAN_START_EPOCH ))
DURATION_MIN=$(( DURATION_SEC / 60 ))

if [[ $DURATION_MIN -ge 60 ]]; then
  HRS=$(( DURATION_MIN / 60 ))
  MIN=$(( DURATION_MIN % 60 ))
  DURATION="${HRS}h ${MIN}m"
else
  DURATION="${DURATION_MIN} min"
fi
```

Pass timing data to SUMMARY.md creation.
</step>

<step name="create_summary">
Create `{phase}-{plan}-SUMMARY.md` as specified in the prompt's `<output>` section.
Use ~/.claude/get-shit-done/templates/summary.md for structure.

**File location:** `.planning/phases/XX-name/{phase}-{plan}-SUMMARY.md`

**Frontmatter population:**

Before writing summary content, populate frontmatter fields from execution context:

1. **Basic identification:**
   - phase: From PLAN.md frontmatter
   - plan: From PLAN.md frontmatter
   - subsystem: Categorize based on phase focus (auth, payments, ui, api, database, infra, testing, etc.)
   - tags: Extract tech keywords (libraries, frameworks, tools used)

2. **Dependency graph:**
   - requires: List prior phases this built upon (check PLAN.md context section for referenced prior summaries)
   - provides: Extract from accomplishments - what was delivered
   - affects: Infer from phase description/goal what future phases might need this

3. **Tech tracking:**
   - tech-stack.added: New libraries from package.json changes or requirements
   - tech-stack.patterns: Architectural patterns established (from decisions/accomplishments)

4. **File tracking:**
   - key-files.created: From "Files Created/Modified" section
   - key-files.modified: From "Files Created/Modified" section

5. **Decisions:**
   - key-decisions: Extract from "Decisions Made" section

6. **Issues:**
   - issues-created: Check if ISSUES.md was updated during execution

7. **Metrics:**
   - duration: From $DURATION variable
   - completed: From $PLAN_END_TIME (date only, format YYYY-MM-DD)

Note: If subsystem/affects are unclear, use best judgment based on phase name and accomplishments. Can be refined later.

**Title format:** `# Phase [X] Plan [Y]: [Name] Summary`

The one-liner must be SUBSTANTIVE:

- Good: "JWT auth with refresh rotation using jose library"
- Bad: "Authentication implemented"

**Include performance data:**

- Duration: `$DURATION`
- Started: `$PLAN_START_TIME`
- Completed: `$PLAN_END_TIME`
- Tasks completed: (count from execution)
- Files modified: (count from execution)

**Next Step section:**

- If more plans exist in this phase: "Ready for {phase}-{next-plan}-PLAN.md"
- If this is the last plan: "Phase complete, ready for transition"
  </step>

<step name="update_current_position">
Update Current Position section in STATE.md to reflect plan completion.

**Format:**

```markdown
Phase: [current] of [total] ([phase name])
Plan: [just completed] of [total in phase]
Status: [In progress / Phase complete]
Last activity: [today] - Completed {phase}-{plan}-PLAN.md

Progress: [progress bar]
```

**Calculate progress bar:**

- Count total plans across all phases (from ROADMAP.md or ROADMAP.md)
- Count completed plans (count SUMMARY.md files that exist)
- Progress = (completed / total) × 100%
- Render: ░ for incomplete, █ for complete

**Example - completing 02-01-PLAN.md (plan 5 of 10 total):**

Before:

```markdown
## Current Position

Phase: 2 of 4 (Authentication)
Plan: Not started
Status: Ready to execute
Last activity: 2025-01-18 - Phase 1 complete

Progress: ██████░░░░ 40%
```

After:

```markdown
## Current Position

Phase: 2 of 4 (Authentication)
Plan: 1 of 2 in current phase
Status: In progress
Last activity: 2025-01-19 - Completed 02-01-PLAN.md

Progress: ███████░░░ 50%
```

**Step complete when:**

- [ ] Phase number shows current phase (X of total)
- [ ] Plan number shows plans complete in current phase (N of total-in-phase)
- [ ] Status reflects current state (In progress / Phase complete)
- [ ] Last activity shows today's date and the plan just completed
- [ ] Progress bar calculated correctly from total completed plans
      </step>

<step name="extract_decisions_and_issues">
Extract decisions, issues, and concerns from SUMMARY.md into STATE.md accumulated context.

**Decisions Made:**

- Read SUMMARY.md "## Decisions Made" section
- If content exists (not "None"):
  - Add each decision to STATE.md Decisions table
  - Format: `| [phase number] | [decision summary] | [rationale] |`

**Deferred Issues:**

- Read SUMMARY.md to check if new issues were logged to ISSUES.md
- If new ISS-XXX entries created:
  - Update STATE.md "Deferred Issues" section

**Blockers/Concerns:**

- Read SUMMARY.md "## Next Phase Readiness" section
- If contains blockers or concerns:
  - Add to STATE.md "Blockers/Concerns Carried Forward"
    </step>

<step name="update_session_continuity">
Update Session Continuity section in STATE.md to enable resumption in future sessions.

**Format:**

```markdown
Last session: [current date and time]
Stopped at: Completed {phase}-{plan}-PLAN.md
Resume file: [path to .continue-here if exists, else "None"]
```

**Size constraint note:** Keep STATE.md under 150 lines total.
</step>

<step name="issues_review_gate">
Before proceeding, check SUMMARY.md content.

If "Issues Encountered" is NOT "None":

<if mode="yolo">
```
⚡ Auto-approved: Issues acknowledgment
⚠️ Note: Issues were encountered during execution:
- [Issue 1]
- [Issue 2]
(Logged - continuing in yolo mode)
```

Continue without waiting.
</if>

<if mode="interactive" OR="custom with gates.issues_review true">
Present issues and wait for acknowledgment before proceeding.
</if>
</step>

<step name="update_roadmap">
Update the roadmap file:

```bash
ROADMAP_FILE=".planning/ROADMAP.md"
```

**If more plans remain in this phase:**

- Update plan count: "2/3 plans complete"
- Keep phase status as "In progress"

**If this was the last plan in the phase:**

- Mark phase complete: status → "Complete"
- Add completion date
  </step>

<step name="git_commit_metadata">
Commit execution metadata (SUMMARY + STATE + ROADMAP):

**Note:** All task code has already been committed during execution (one commit per task).
PLAN.md was already committed during plan-phase. This final commit captures execution results only.

**1. Stage execution artifacts:**

```bash
git add .planning/phases/XX-name/{phase}-{plan}-SUMMARY.md
git add .planning/STATE.md
```

**2. Stage roadmap file:**

```bash
git add .planning/ROADMAP.md
```

**3. Verify staging:**

```bash
git status
# Should show only execution artifacts (SUMMARY, STATE, ROADMAP), no code files
```

**4. Commit metadata:**

```bash
git commit -m "$(cat <<'EOF'
docs({phase}-{plan}): complete [plan-name] plan

Tasks completed: [N]/[N]
- [Task 1 name]
- [Task 2 name]
- [Task 3 name]

SUMMARY: .planning/phases/XX-name/{phase}-{plan}-SUMMARY.md
EOF
)"
```

**Example:**

```bash
git commit -m "$(cat <<'EOF'
docs(08-02): complete user registration plan

Tasks completed: 3/3
- User registration endpoint
- Password hashing with bcrypt
- Email confirmation flow

SUMMARY: .planning/phases/08-user-auth/08-02-registration-SUMMARY.md
EOF
)"
```

**Git log after plan execution:**

```
abc123f docs(08-02): complete user registration plan
def456g feat(08-02): add email confirmation flow
hij789k feat(08-02): implement password hashing with bcrypt
lmn012o feat(08-02): create user registration endpoint
```

Each task has its own commit, followed by one metadata commit documenting plan completion.

For commit message conventions, see ~/.claude/get-shit-done/references/git-integration.md
</step>

<step name="update_codebase_map">
**If .planning/codebase/ exists:**

Check what changed across all task commits in this plan:

```bash
# Find first task commit (right after previous plan's docs commit)
FIRST_TASK=$(git log --oneline --grep="feat({phase}-{plan}):" --grep="fix({phase}-{plan}):" --grep="test({phase}-{plan}):" --reverse | head -1 | cut -d' ' -f1)

# Get all changes from first task through now
git diff --name-only ${FIRST_TASK}^..HEAD 2>/dev/null
```

**Update only if structural changes occurred:**

| Change Detected | Update Action |
|-----------------|---------------|
| New directory in src/ | STRUCTURE.md: Add to directory layout |
| package.json deps changed | STACK.md: Add/remove from dependencies list |
| New file pattern (e.g., first .test.ts) | CONVENTIONS.md: Note new pattern |
| New external API client | INTEGRATIONS.md: Add service entry with file path |
| Config file added/changed | STACK.md: Update configuration section |
| File renamed/moved | Update paths in relevant docs |

**Skip update if only:**
- Code changes within existing files
- Bug fixes
- Content changes (no structural impact)

**Update format:**
Make single targeted edits - add a bullet point, update a path, or remove a stale entry. Don't rewrite sections.

```bash
git add .planning/codebase/*.md
git commit --amend --no-edit  # Include in metadata commit
```

**If .planning/codebase/ doesn't exist:**
Skip this step.
</step>

<step name="check_phase_issues">
**Check if issues were created during this phase:**

```bash
# Check if ISSUES.md exists and has issues from current phase
if [ -f .planning/ISSUES.md ]; then
  grep -E "Phase ${PHASE}.*Task" .planning/ISSUES.md | grep -v "^#" || echo "NO_ISSUES_THIS_PHASE"
fi
```

**If issues were created during this phase:**

```
📋 Issues logged during this phase:
- ISS-XXX: [brief description]
- ISS-YYY: [brief description]

Review these now?
```

Use AskUserQuestion:
- header: "Phase Issues"
- question: "[N] issues were logged during this phase. Review now?"
- options:
  - "Review issues" - Analyze with /gsd:consider-issues
  - "Continue" - Address later, proceed to next work

**If "Review issues" selected:**
- Invoke: `SlashCommand("/gsd:consider-issues")`
- After consider-issues completes, return to offer_next

**If "Continue" selected or no issues found:**
- Proceed to offer_next step

**In YOLO mode:**
- Note issues were logged but don't prompt: `📋 [N] issues logged this phase (review later with /gsd:consider-issues)`
- Continue to offer_next automatically
</step>

<step name="offer_next">
**MANDATORY: Verify remaining work before presenting next steps.**

Do NOT skip this verification. Do NOT assume phase or milestone completion without checking.

**Step 1: Count plans and summaries in current phase**

List files in the phase directory:

```bash
ls -1 .planning/phases/[current-phase-dir]/*-PLAN.md 2>/dev/null | wc -l
ls -1 .planning/phases/[current-phase-dir]/*-SUMMARY.md 2>/dev/null | wc -l
```

State the counts: "This phase has [X] plans and [Y] summaries."

**Step 2: Route based on plan completion**

Compare the counts from Step 1:

| Condition | Meaning | Action |
|-----------|---------|--------|
| summaries < plans | More plans remain | Go to **Route A** |
| summaries = plans | Phase complete | Go to Step 3 |

---

**Route A: More plans remain in this phase**

Identify the next unexecuted plan:
- Find the first PLAN.md file that has no matching SUMMARY.md
- Read its `<objective>` section

<if mode="yolo">
```
Plan {phase}-{plan} complete.
Summary: .planning/phases/{phase-dir}/{phase}-{plan}-SUMMARY.md

{Y} of {X} plans complete for Phase {Z}.

⚡ Auto-continuing: Execute next plan ({phase}-{next-plan})
```

Loop back to identify_plan step automatically.
</if>

<if mode="interactive" OR="custom with gates.execute_next_plan true">
```
Plan {phase}-{plan} complete.
Summary: .planning/phases/{phase-dir}/{phase}-{plan}-SUMMARY.md

{Y} of {X} plans complete for Phase {Z}.

---

## ▶ Next Up

**{phase}-{next-plan}: [Plan Name]** — [objective from next PLAN.md]

`/gsd:execute-plan .planning/phases/{phase-dir}/{phase}-{next-plan}-PLAN.md`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/gsd:verify-work {phase}-{plan}` — manual acceptance testing before continuing
- Review what was built before continuing

---
```

Wait for user to clear and run next command.
</if>

**STOP here if Route A applies. Do not continue to Step 3.**

---

**Step 3: Check milestone status (only when all plans in phase are complete)**

Read ROADMAP.md and extract:
1. Current phase number (from the plan just completed)
2. All phase numbers listed in the current milestone section

To find phases in the current milestone, look for:
- Phase headers: lines starting with `### Phase` or `#### Phase`
- Phase list items: lines like `- [ ] **Phase X:` or `- [x] **Phase X:`

Count total phases in the current milestone and identify the highest phase number.

State: "Current phase is {X}. Milestone has {N} phases (highest: {Y})."

**Step 4: Route based on milestone status**

| Condition | Meaning | Action |
|-----------|---------|--------|
| current phase < highest phase | More phases remain | Go to **Route B** |
| current phase = highest phase | Milestone complete | Go to **Route C** |

---

**Route B: Phase complete, more phases remain in milestone**

Read ROADMAP.md to get the next phase's name and goal.

```
Plan {phase}-{plan} complete.
Summary: .planning/phases/{phase-dir}/{phase}-{plan}-SUMMARY.md

## ✓ Phase {Z}: {Phase Name} Complete

All {Y} plans finished.

---

## ▶ Next Up

**Phase {Z+1}: {Next Phase Name}** — {Goal from ROADMAP.md}

`/gsd:plan-phase {Z+1}`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/gsd:verify-work {Z}` — manual acceptance testing before continuing
- `/gsd:discuss-phase {Z+1}` — gather context first
- `/gsd:research-phase {Z+1}` — investigate unknowns
- Review phase accomplishments before continuing

---
```

---

**Route C: Milestone complete (all phases done)**

```
🎉 MILESTONE COMPLETE!

Plan {phase}-{plan} complete.
Summary: .planning/phases/{phase-dir}/{phase}-{plan}-SUMMARY.md

## ✓ Phase {Z}: {Phase Name} Complete

All {Y} plans finished.

════════════════════════════════════════
All {N} phases complete!
Milestone is 100% done.
════════════════════════════════════════

---

## ▶ Next Up

**Complete Milestone** — archive and prepare for next

`/gsd:complete-milestone`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/gsd:verify-work` — manual acceptance testing before completing milestone
- `/gsd:add-phase <description>` — add another phase before completing
- Review accomplishments before archiving

---
```

</step>

</process>

<success_criteria>

- All tasks from PLAN.md completed
- All verifications pass
- SUMMARY.md created with substantive content
- STATE.md updated (position, decisions, issues, session)
- ROADMAP.md updated
- If codebase map exists: map updated with execution changes (or skipped if no significant changes)
  </success_criteria>
