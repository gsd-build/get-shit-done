# Agent History Template

Template for `.planning/agent-history.json` - tracks subagent spawns during plan execution for resume capability.

---

## File Template

```json
{
  "version": "1.2",
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
  "execution_mode": "sequential",
  "parallel_group": null,
  "granularity": "plan",
  "depends_on": null,
  "files_modified": null,
  "checkpoints_skipped": null,
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
| segment | number/null | Segment number for segmented plans, null for full plan |
| timestamp | string | ISO 8601 timestamp when agent was spawned |
| status | string | spawned, completed, interrupted, resumed, queued, failed |
| completion_timestamp | string/null | ISO timestamp when completed |
| execution_mode | string | "sequential" or "parallel" |
| parallel_group | string/null | Batch ID linking agents in same parallel execution |
| granularity | string | "plan" or "task_group" |
| depends_on | array/null | Agent IDs or plan refs this depends on |
| files_modified | array/null | Files this agent created/modified |
| checkpoints_skipped | number/null | Count of checkpoints skipped in background |
| task_results | object/null | Per-task outcomes for task-level parallelization |

### Status Lifecycle

```
queued ──> spawned ──────────────────> completed
               │                           ^
               │                           │
               ├──> interrupted ──> resumed┘
               │
               └──> failed
```

- **queued**: Waiting for dependency (parallel execution only)
- **spawned**: Agent created via Task tool, execution in progress
- **completed**: Agent finished successfully, results received
- **interrupted**: Session ended before agent completed (detected on resume)
- **resumed**: Previously interrupted agent resumed via resume parameter
- **failed**: Agent execution failed (error during execution)

## Usage

### When to Create File

Create `.planning/agent-history.json` from this template when:
- First subagent spawn in execute-plan workflow
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

## Example Entries

### Sequential Execution (Default)

```json
{
  "agent_id": "agent_01HXY123ABC",
  "task_description": "Execute full plan 02-01 (autonomous)",
  "phase": "02",
  "plan": "01",
  "segment": null,
  "timestamp": "2026-01-15T14:22:10Z",
  "status": "completed",
  "completion_timestamp": "2026-01-15T14:45:33Z",
  "execution_mode": "sequential",
  "parallel_group": null,
  "granularity": "plan",
  "depends_on": null,
  "files_modified": ["src/api/auth.ts", "src/types/user.ts"],
  "checkpoints_skipped": null,
  "task_results": null
}
```

### Parallel Execution (Plan-Level)

Independent plans in a phase running in parallel:

```json
{
  "agent_id": "agent_01HXYZ123",
  "task_description": "Execute plan 05-01 (parallel)",
  "phase": "05",
  "plan": "01",
  "segment": null,
  "timestamp": "2026-01-12T10:00:00Z",
  "status": "completed",
  "completion_timestamp": "2026-01-12T10:15:00Z",
  "execution_mode": "parallel",
  "parallel_group": "phase-05-batch-1736676000",
  "granularity": "plan",
  "depends_on": null,
  "files_modified": ["src/auth/login.ts", "src/auth/types.ts"],
  "checkpoints_skipped": 1,
  "task_results": null
}
```

### Queued with Dependency

Agent waiting for another to complete:

```json
{
  "agent_id": "agent_01HXYZ456",
  "task_description": "Execute plan 05-03 (depends on 05-01)",
  "phase": "05",
  "plan": "03",
  "segment": null,
  "timestamp": "2026-01-12T10:15:00Z",
  "status": "spawned",
  "completion_timestamp": null,
  "execution_mode": "parallel",
  "parallel_group": "phase-05-batch-1736676000",
  "granularity": "plan",
  "depends_on": ["agent_01HXYZ123"],
  "files_modified": null,
  "checkpoints_skipped": null,
  "task_results": null
}
```

### Parallel Group Format

- **Plan-level parallel:** `phase-{phase}-batch-{timestamp}`
- **Task-level parallel:** `plan-{phase}-{plan}-tasks-batch-{timestamp}`

Example: `phase-05-batch-1736676000` groups all agents executing Phase 5 plans in parallel.

## Parallel Execution Resume

When a session is interrupted during parallel execution:

### Detection

Check for entries with `status: "spawned"` and `parallel_group` set. These are agents that were running when session ended.

```bash
# Find interrupted parallel agents
jq '.entries[] | select(.status == "spawned" and .parallel_group != null)' .planning/agent-history.json
```

### Resume Options

1. **Resume batch:** Resume all interrupted agents in the parallel group
2. **Resume single:** Resume a specific agent by ID
3. **Start fresh:** Abandon interrupted batch, start new execution

### Resume Command

`/gsd/resume-task` accepts:
- No argument: Resume most recent interrupted agent
- Agent ID: Resume specific agent
- `--batch`: Resume entire parallel group

### Conflict Detection

Before resuming, check for file modifications since spawn:

```bash
git diff --name-only ${SPAWN_COMMIT}..HEAD
```

If files modified by another agent conflict with files this agent modifies, warn user before proceeding. This prevents overwriting work done by other parallel agents that completed after the interruption.

## Related Files

- `.planning/current-agent-id.txt`: Single line with currently active agent ID (for quick resume lookup)
- `.planning/STATE.md`: Project state including session continuity info

---

## Template Notes

**When to create:** First subagent spawn during execute-plan workflow.

**Location:** `.planning/agent-history.json`

**Companion file:** `.planning/current-agent-id.txt` (single agent ID, overwritten on each spawn)

**Purpose:** Enable resume capability for interrupted subagent executions via Task tool's resume parameter.
