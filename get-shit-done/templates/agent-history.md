# Agent History Template

Template for `.planning/agent-history.json` - tracks subagent spawns during plan execution for resume capability.

---

## File Template

```json
{
  "version": "1.0",
  "max_entries": 50,
  "entries": []
}
```

## Entry Schema

Each entry tracks a subagent spawn or status change:

```json
{
  "agent_id": "agent_01HXXXX...",
  "task_description": "Execute tasks 1-3 from plan 02-01",
  "phase": "02",
  "plan": "01",
  "segment": 1,
  "timestamp": "2026-01-15T14:22:10Z",
  "status": "spawned",
  "completion_timestamp": null,
  "execution_mode": "foreground",
  "output_file": null,
  "background_status": null,
  "parallel_group": null,
  "granularity": "plan",
  "task_group": null,
  "depends_on": null,
  "checkpoints_skipped": null,
  "files_modified": null,
  "task_results": null
}
```

### Field Definitions

| Field | Type | Description |
|-------|------|-------------|
| agent_id | string | Unique ID returned by Task tool |
| task_description | string | Brief description of what agent is executing |
| phase | string | Phase number (e.g., "02", "02.1") |
| plan | string | Plan number within phase |
| segment | number | Segment number (1-based) for segmented plans, null for Pattern A |
| timestamp | string | ISO 8601 timestamp when agent was spawned |
| status | string | Current status: spawned, completed, interrupted, resumed, queued, failed |
| completion_timestamp | string/null | ISO 8601 timestamp when completed, null if pending |
| execution_mode | string | "foreground" (blocking), "background" (async), or "parallel" |
| output_file | string/null | Path to output file for background agents (from Task tool response) |
| background_status | string/null | For background: "running", "completed", "failed", null if not yet checked |
| parallel_group | string/null | Identifier linking agents in same parallel batch (e.g., "phase-11-batch-1736502345" or "plan-11-02-tasks-batch-1736502345") |
| granularity | string | "plan" (full plan execution) or "task_group" (subset of tasks within plan) |
| task_group | string[]/null | Array of task names/numbers this agent executed (e.g., ["Task 1", "Task 3"]) - only for granularity: "task_group" |
| depends_on | string[]/null | Array of plan IDs or task-group IDs this agent waits for |
| checkpoints_skipped | number/null | Count of checkpoints skipped in background/parallel mode |
| files_modified | string[]/null | List of files created/modified by this agent |
| task_results | object/null | Per-task outcomes when granularity is "task_group" (see Task Results Schema below) |

### Task Results Schema

When `granularity` is "task_group", the `task_results` field contains per-task outcomes:

```json
{
  "task_results": {
    "Task 1": {
      "status": "completed",
      "files": ["src/auth.ts"],
      "deviations": []
    },
    "Task 3": {
      "status": "completed",
      "files": ["src/utils.ts", "src/types.ts"],
      "deviations": ["Added input validation (Rule 2)"]
    }
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| status | string | Task outcome: "completed", "failed", "skipped" |
| files | string[] | Files modified by this specific task |
| deviations | string[] | Deviations encountered during task execution |

### Status Lifecycle

```
spawned ──────────────────────────> completed
    │                                   ^
    │                                   │
    └──> interrupted ──> resumed ───────┘
```

- **spawned**: Agent created via Task tool, execution in progress
- **completed**: Agent finished successfully, results received
- **interrupted**: Session ended before agent completed (detected on resume)
- **resumed**: Previously interrupted agent resumed via resume parameter

## Usage

### When to Create File

Create `.planning/agent-history.json` from this template when:
- First subagent spawn in execute-phase workflow
- File doesn't exist yet

### When to Add Entry

Add new entry immediately after Task tool returns with agent_id:

```
1. Task tool spawns subagent
2. Response includes agent_id
3. Write agent_id to .planning/current-agent-id.txt
4. Append entry to agent-history.json with status "spawned"
```

### When to Update Entry

Update existing entry when:

**On successful completion:**
```json
{
  "status": "completed",
  "completion_timestamp": "2026-01-15T14:45:33Z"
}
```

**On resume detection (interrupted agent found):**
```json
{
  "status": "interrupted"
}
```

Then add new entry with resumed status:
```json
{
  "agent_id": "agent_01HXXXX...",
  "status": "resumed",
  "timestamp": "2026-01-15T15:00:00Z"
}
```

### Entry Retention

- Keep maximum 50 entries (configurable via max_entries)
- On exceeding limit, remove oldest completed entries first
- Never remove entries with status "spawned" (may need resume)
- Prune during init_agent_tracking step

## Example File

```json
{
  "version": "1.2",
  "max_entries": 50,
  "entries": [
    {
      "agent_id": "agent_01HXY123ABC",
      "task_description": "Execute full plan 02-01 (autonomous)",
      "phase": "02",
      "plan": "01",
      "segment": null,
      "timestamp": "2026-01-15T14:22:10Z",
      "status": "completed",
      "completion_timestamp": "2026-01-15T14:45:33Z",
      "execution_mode": "foreground",
      "output_file": null,
      "background_status": null,
      "parallel_group": null,
      "granularity": "plan",
      "task_group": null,
      "depends_on": null,
      "checkpoints_skipped": null,
      "files_modified": ["src/auth.ts", "src/types.ts"],
      "task_results": null
    },
    {
      "agent_id": "agent_01HXY456DEF",
      "task_description": "Execute plan 11-01 (parallel)",
      "phase": "11",
      "plan": "01",
      "segment": null,
      "timestamp": "2026-01-15T16:00:00Z",
      "status": "completed",
      "completion_timestamp": "2026-01-15T16:02:34Z",
      "execution_mode": "parallel",
      "output_file": "/tmp/claude-task-agent_01HXY456DEF.txt",
      "background_status": "completed",
      "parallel_group": "phase-11-batch-1736952000",
      "granularity": "plan",
      "task_group": null,
      "depends_on": null,
      "checkpoints_skipped": 0,
      "files_modified": ["workflows/execute-phase.md", "templates/agent-history.md"],
      "task_results": null
    },
    {
      "agent_id": "agent_01HXYTASK01",
      "task_description": "Execute tasks [1, 3] from plan 11-02 (task-level parallel)",
      "phase": "11",
      "plan": "02",
      "segment": null,
      "timestamp": "2026-01-15T17:00:00Z",
      "status": "completed",
      "completion_timestamp": "2026-01-15T17:00:45Z",
      "execution_mode": "parallel",
      "output_file": "/tmp/claude-task-agent_01HXYTASK01.txt",
      "background_status": "completed",
      "parallel_group": "plan-11-02-tasks-batch-1736955600",
      "granularity": "task_group",
      "task_group": ["Task 1", "Task 3"],
      "depends_on": null,
      "checkpoints_skipped": 0,
      "files_modified": ["src/auth.ts", "src/utils.ts", "src/types.ts"],
      "task_results": {
        "Task 1": {
          "status": "completed",
          "files": ["src/auth.ts"],
          "deviations": []
        },
        "Task 3": {
          "status": "completed",
          "files": ["src/utils.ts", "src/types.ts"],
          "deviations": []
        }
      }
    },
    {
      "agent_id": "agent_01HXYTASK02",
      "task_description": "Execute tasks [4, 5] from plan 11-02 (task-level parallel)",
      "phase": "11",
      "plan": "02",
      "segment": null,
      "timestamp": "2026-01-15T17:00:50Z",
      "status": "completed",
      "completion_timestamp": "2026-01-15T17:01:25Z",
      "execution_mode": "parallel",
      "output_file": "/tmp/claude-task-agent_01HXYTASK02.txt",
      "background_status": "completed",
      "parallel_group": "plan-11-02-tasks-batch-1736955600",
      "granularity": "task_group",
      "task_group": ["Task 4", "Task 5"],
      "depends_on": ["task-group-1"],
      "checkpoints_skipped": 1,
      "files_modified": ["src/config.ts", "src/api.ts"],
      "task_results": {
        "Task 4": {
          "status": "completed",
          "files": ["src/config.ts"],
          "deviations": ["Checkpoint skipped (human-verify)"]
        },
        "Task 5": {
          "status": "completed",
          "files": ["src/api.ts"],
          "deviations": []
        }
      }
    },
    {
      "agent_id": null,
      "task_description": "Execute tasks [6] from plan 11-02 (queued)",
      "phase": "11",
      "plan": "02",
      "segment": null,
      "timestamp": "2026-01-15T17:00:00Z",
      "status": "queued",
      "completion_timestamp": null,
      "execution_mode": "parallel",
      "output_file": null,
      "background_status": null,
      "parallel_group": "plan-11-02-tasks-batch-1736955600",
      "granularity": "task_group",
      "task_group": ["Task 6"],
      "depends_on": ["task-group-2"],
      "checkpoints_skipped": null,
      "files_modified": null,
      "task_results": null
    }
  ]
}
```

## Parallel Execution Support

### Granularity: Plan vs Task Level

The `granularity` field distinguishes between plan-level and task-level parallel execution:

| Granularity | Description | parallel_group format | task_group |
|-------------|-------------|----------------------|------------|
| `plan` | Agent executes full plan | `phase-{phase}-batch-{timestamp}` | null |
| `task_group` | Agent executes subset of tasks within one plan | `plan-{phase}-{plan}-tasks-batch-{timestamp}` | Array of task names |

**Identifying task-level entries:**
```bash
# Find all task-level agents for plan 11-02
jq '.entries[] | select(.plan == "02" and .granularity == "task_group")' agent-history.json
```

### Parallel Group

The `parallel_group` field links agents spawned together as part of parallel execution.

**Formats:**
- Plan-level: `phase-{phase}-batch-{unix_timestamp}`
- Task-level: `plan-{phase}-{plan}-tasks-batch-{unix_timestamp}`

**Usage:**
- All agents spawned in the same parallel batch share the same group ID
- Enables batch resume: when resuming, can find all interrupted agents in group
- Enables status display: show all related agents together
- Task-level groups are nested within plan execution

### Resume Support

When resuming with `/gsd:resume-task`:
- If agent has `parallel_group`, offer to resume entire batch
- Check all agents in same `parallel_group`
- Resume any that are not "completed"

```bash
# Find agents in same group
jq '.entries[] | select(.parallel_group == "phase-11-batch-1736952000")' agent-history.json
```

### Queued Agents

Agents can be queued when:
- They depend on other plans in the same phase
- Max concurrent agents limit is reached

Queued entries have:
- `agent_id`: null (no agent spawned yet)
- `status`: "queued"
- `depends_on`: Array of plan IDs to wait for

## Related Files

- `.planning/current-agent-id.txt`: Single line with currently active agent ID (for quick resume lookup)
- `.planning/STATE.md`: Project state including session continuity info

---

## Template Notes

**When to create:** First subagent spawn during execute-phase workflow.

**Location:** `.planning/agent-history.json`

**Companion file:** `.planning/current-agent-id.txt` (single agent ID, overwritten on each spawn)

**Purpose:** Enable resume capability for interrupted subagent executions via Task tool's resume parameter.
