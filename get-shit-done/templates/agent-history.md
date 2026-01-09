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
  "completion_timestamp": null
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
| status | string | Current status: spawned, completed, interrupted, resumed |
| completion_timestamp | string/null | ISO 8601 timestamp when completed, null if pending |

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
  "version": "1.0",
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
      "completion_timestamp": "2026-01-15T14:45:33Z"
    },
    {
      "agent_id": "agent_01HXY456DEF",
      "task_description": "Execute tasks 1-3 from plan 02-02",
      "phase": "02",
      "plan": "02",
      "segment": 1,
      "timestamp": "2026-01-15T15:00:00Z",
      "status": "spawned",
      "completion_timestamp": null
    }
  ]
}
```

## Related Files

- `.planning/current-agent-id.txt`: Single line with currently active agent ID (for quick resume lookup)
- `.planning/STATE.md`: Project state including session continuity info

---

## Template Notes

**When to create:** First subagent spawn during execute-phase workflow.

**Location:** `.planning/agent-history.json`

**Companion file:** `.planning/current-agent-id.txt` (single agent ID, overwritten on each spawn)

**Purpose:** Enable resume capability for interrupted subagent executions via Task tool's resume parameter.
