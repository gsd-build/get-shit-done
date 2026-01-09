---
name: gsd:resume-task
description: Resume an interrupted subagent execution
argument-hint: "[agent-id]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Task
  - AskUserQuestion
---

<objective>
Resume an interrupted subagent execution using the Task tool's resume parameter.

When a session ends mid-execution, subagents may be left in an incomplete state. This command allows users to continue that work without starting over.

Uses the agent ID tracking infrastructure from execute-phase to identify and resume agents.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/resume-task.md
</execution_context>

<context>
Agent ID: $ARGUMENTS (optional - defaults to most recent)

**Load project state:**
@.planning/STATE.md

**Load agent tracking:**
@.planning/current-agent-id.txt
@.planning/agent-history.json
</context>

<process>
1. Check .planning/ directory exists (error if not)
2. Parse agent ID from arguments or current-agent-id.txt
3. Validate agent exists in history and is resumable
4. Check for file conflicts since spawn
5. Follow resume-task.md workflow:
   - Update agent status to "interrupted"
   - Resume via Task tool resume parameter
   - Update history on completion
   - Clear current-agent-id.txt
</process>

<usage>
**Resume most recent interrupted agent:**
```
/gsd:resume-task
```

**Resume specific agent by ID:**
```
/gsd:resume-task agent_01HXYZ123
```

**Find available agents to resume:**
Check `.planning/agent-history.json` for entries with status "spawned" or "interrupted".
</usage>

<error_handling>
**No agent to resume:**
- current-agent-id.txt empty or missing
- Solution: Run /gsd:progress to check project status

**Agent already completed:**
- Agent finished successfully, nothing to resume
- Solution: Continue with next plan

**Agent not found:**
- Provided ID not in history
- Solution: Check agent-history.json for valid IDs

**Resume failed:**
- Agent context expired or invalidated
- Solution: Start fresh with /gsd:execute-plan
</error_handling>

<success_criteria>
- [ ] Agent resumed via Task tool resume parameter
- [ ] Agent-history.json updated with completion
- [ ] current-agent-id.txt cleared
- [ ] User informed of result
</success_criteria>
