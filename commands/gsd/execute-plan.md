---
name: gsd:execute-plan
description: Execute a PLAN.md file
argument-hint: "[path-to-PLAN.md]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Task
  - TodoWrite
  - AskUserQuestion
---

<objective>
Execute a single PLAN.md file by spawning a subagent.

Orchestrator stays lean: validate plan, spawn subagent, handle checkpoints, report completion. Subagent loads full execute-plan workflow and handles all execution details.

Context budget: ~15% orchestrator, 100% fresh for subagent.
</objective>

<execution_context>
@~/.claude/get-shit-done/templates/subagent-task-prompt.md
</execution_context>

<context>
Plan path: $ARGUMENTS

@.planning/STATE.md
@.planning/config.json (if exists)
</context>

<process>
1. **Validate plan exists**
   - Confirm file at $ARGUMENTS exists
   - Error if not found: "Plan not found: {path}"

2. **Check if already executed**
   - Derive SUMMARY path from plan path (replace PLAN.md with SUMMARY.md)
   - If SUMMARY exists: "Plan already executed. SUMMARY: {path}"
   - Offer: re-execute or exit

3. **Parse plan identifiers**
   Extract from path like `.planning/phases/03-auth/03-02-PLAN.md`:
   - phase_number: `03`
   - phase_name: `auth`
   - plan_number: `02`
   - plan_path: full path

4. **Pre-execution summary (interactive mode only)**
   Check config.json for mode. Skip this step if mode=yolo.

   Parse PLAN.md to extract:
   - objective: First sentence or line from `<objective>` element
   - task_count: Count of `<task` elements
   - files: Collect unique file paths from `<files>` elements within tasks

   Display friendly summary before spawning:
   ```
   ════════════════════════════════════════
   EXECUTING: {phase_number}-{plan_number} {phase_name}
   ════════════════════════════════════════

   Building: {objective one-liner}
   Tasks: {task_count}
   Files: {comma-separated file list}

   Full plan: {plan_path}
   ════════════════════════════════════════
   ```

   No confirmation needed. Proceed to spawn after displaying.

   In yolo mode, display abbreviated version:
   ```
   ⚡ Executing {phase_number}-{plan_number}: {objective one-liner}
   ```

5. **Fill and spawn subagent**
   - Fill subagent-task-prompt template with extracted values
   - Spawn: `Task(prompt=filled_template, subagent_type="general-purpose")`

6. **Handle subagent return**
   - If contains "## CHECKPOINT REACHED": Execute checkpoint_handling
   - If contains "## PLAN COMPLETE": Verify SUMMARY exists, report success

7. **Report completion**
   - Show SUMMARY path
   - Show commits from subagent return
   - Offer next steps
</process>

<checkpoint_handling>
When subagent returns with checkpoint:

**1. Parse return:**
```
## CHECKPOINT REACHED

**Type:** [human-verify | decision | human-action]
**Plan:** {phase}-{plan}
**Progress:** {completed}/{total} tasks complete

[Checkpoint content]

**Awaiting:** [Resume signal]
```

**2. Present to user:**
Display the checkpoint content exactly as returned by subagent.

**3. Collect response:**
Wait for user input:
- human-verify: "approved" or description of issues
- decision: option selection
- human-action: "done" when complete

**4. Resume subagent:**
```
Task(resume="{agent_id}", prompt="User response: {user_input}")
```

**5. Repeat:**
Continue handling returns until "## PLAN COMPLETE" or user stops.
</checkpoint_handling>

<success_criteria>
- [ ] Plan executed (SUMMARY.md created)
- [ ] All checkpoints handled
- [ ] User informed of completion and next steps
</success_criteria>
