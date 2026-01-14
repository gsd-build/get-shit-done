---

description: Check status of background agents from parallel execution

---

<objective>
Monitor background agent status from /gsd/execute-phase parallel execution.

Shows running/completed agents from agent-history.json.
Uses TaskOutput to check status of background tasks.
With --wait flag, blocks until all agents complete.
</objective>

<context>
Arguments: $ARGUMENTS
</context>

<process>

<step name="load_history">
**Load agent history:**

```bash
cat .planning/agent-history.json 2>/dev/null || echo '{"entries":[]}'
```

If file doesn't exist or has no entries:
```
No background agents tracked.

Run /gsd/execute-phase to spawn parallel agents.
```
Exit.
</step>

<step name="filter_agents">
**Find background agents:**

Filter entries where:
- `execution_mode` is "parallel" or "background"
- `status` is "spawned" (still running) or recently completed

Group by `parallel_group` if present.
</step>

<step name="check_running">
**Check status of running agents:**

For each agent with `status === "spawned"`:

Use TaskOutput tool:
```
task_id: [agent_id]
block: false
timeout: 1000
```

**If TaskOutput returns completed result:**
- Update agent-history.json: status → "completed"
- Set completion_timestamp
- Parse files_modified from output if present

**If TaskOutput returns "still running":**
- Keep as spawned (running)

**If TaskOutput returns error:**
- Update agent-history.json: status → "failed"
</step>

<step name="display">
**Show status table:**

```
Background Agents
════════════════════════════════════════

| Plan   | Status      | Elapsed  | Agent ID      |
|--------|-------------|----------|---------------|
| 10-01  | ✓ Complete  | 2m 15s   | agent_01H...  |
| 10-02  | ⏳ Running   | 1m 30s   | agent_01H...  |
| 10-04  | ✓ Complete  | 1m 45s   | agent_01H...  |

Progress: 2/3 complete

════════════════════════════════════════
Wait for all: /gsd/status --wait
```

**Status icons:**
- ✓ Complete
- ⏳ Running
- ✗ Failed
- ⏸ Queued (waiting for dependency)
</step>

<step name="wait_mode">
**If --wait flag provided:**

For each agent with status "spawned":

Use TaskOutput with blocking:
```
task_id: [agent_id]
block: true
timeout: 600000
```

Report as each completes:
```
⏳ Waiting for 3 agents...

✓ [1/3] 10-01 complete (2m 15s)
✓ [2/3] 10-04 complete (1m 45s)
✓ [3/3] 10-02 complete (3m 30s)

════════════════════════════════════════
All agents complete!

Total time: 3m 30s (parallel)
Sequential estimate: 7m 30s
Time saved: ~4m (53%)
════════════════════════════════════════
```

Update agent-history.json with completion status for each.
</step>

<step name="next_steps">
**After all complete (or if already complete):**

```
---

## ▶ Next Up

All parallel agents finished. Review results:

`/gsd/progress`

<sub>`/clear` first → fresh context window</sub>

---
```
</step>

</process>

<success_criteria>
- [ ] Reads agent-history.json for background agents
- [ ] Uses TaskOutput to check running agent status
- [ ] Updates history with current status
- [ ] Shows simple status table
- [ ] --wait flag blocks until all complete
- [ ] Reports time savings vs sequential
</success_criteria>
