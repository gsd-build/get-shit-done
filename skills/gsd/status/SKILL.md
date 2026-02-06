---
name: status
description: Check status of background agents from parallel execution
license: MIT
metadata:
  author: get-shit-done
  version: "1.0"
  category: project-management
allowed-tools: 
---

# status Skill

## Objective

Monitor background agent status from /gsd:execute-phase parallel execution.
Shows running/completed agents from agent-history.json.
Uses TaskOutput to check status of background tasks.
With --wait flag, blocks until all agents complete.
Arguments: $ARGUMENTS

## When to Use



## Process

**Load agent history:**
```bash
cat .planning/agent-history.json 2>/dev/null || echo '{"entries":[]}'
```
If file doesn't exist or has no entries:
```
No background agents tracked.
Run /gsd:execute-phase to spawn parallel agents.
```
Exit.
**Find background agents:**
Filter entries where:
- `execution_mode` is "parallel" or "background"
- `status` is "spawned" (still running) or recently completed
Group by `parallel_group` if present.
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

## Success Criteria

- [ ] Reads agent-history.json for background agents
- [ ] Uses TaskOutput to check running agent status
- [ ] Updates history with current status
- [ ] Shows simple status table
- [ ] --wait flag blocks until all complete
- [ ] Reports time savings vs sequential

## Anti-Patterns



## Examples

### Example Usage
\[TBD: Add specific examples of when and how to use this skill\]

## Error Handling

- If required files are missing: Display clear error messages with setup instructions
- If arguments are invalid: Show usage examples and exit gracefully
- If operations fail: Provide detailed error information and suggest remedies
