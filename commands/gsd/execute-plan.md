---
description: Execute a PLAN.md file
argument-hint: "[path-to-PLAN.md]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
  - TodoWrite
  - AskUserQuestion
---

<objective>
Execute a PLAN.md file, create SUMMARY.md, update project state, commit.

Uses intelligent segmentation based on checkpoints in the plan.
</objective>

<context>
Plan path: $ARGUMENTS

**Load minimal state for orchestration:**
@.planning/STATE.md
@.planning/config.json
</context>

<delegate_execution>
**IMPORTANT: Delegate to sub-agent for context efficiency.**

This command orchestrates plan execution. The heavy workflow logic runs in a sub-agent's fresh context.

**Step 1: Validate inputs**
```bash
[ -d .planning ] || { echo "ERROR: No .planning/ directory. Run /gsd:new-project first."; exit 1; }
[ -f "$ARGUMENTS" ] || { echo "ERROR: Plan not found at $ARGUMENTS"; exit 1; }
```

**Step 2: Quick-check for existing summary**
```bash
SUMMARY_PATH="${ARGUMENTS/PLAN.md/SUMMARY.md}"
[ -f "$SUMMARY_PATH" ] && echo "WARNING: SUMMARY.md exists - plan may already be executed"
```

**Step 3: Scan plan for checkpoint type**
Read the PLAN.md briefly to determine execution strategy:
- No checkpoints → Strategy A (fully autonomous sub-agent)
- Verify-only checkpoints → Strategy B (segmented sub-agent)
- Decision checkpoints → Strategy C (main context execution)

**Step 4: Execute based on strategy**

<if strategy="A or B">
Use Task tool with subagent_type="general-purpose":

```
Execute the plan at: [PLAN_PATH]

**Read and follow the workflow:**
~/.claude/get-shit-done/workflows/execute-phase.md

**Reference files (read as needed):**
- ~/.claude/get-shit-done/templates/summary.md
- ~/.claude/get-shit-done/references/checkpoints.md
- ~/.claude/get-shit-done/references/tdd.md

**Project context:**
- .planning/STATE.md
- .planning/config.json

**Your task:**
1. Read the PLAN.md file
2. Execute all tasks following the workflow
3. Create SUMMARY.md in the same directory as PLAN.md
4. Update STATE.md with progress
5. Update ROADMAP.md plan status
6. Commit with message: feat({phase}-{plan}): [summary]

**Critical rules:**
- Stage files individually (never git add . or git add -A)
- Handle deviations per workflow rules
- Document everything in SUMMARY.md

**Return to parent:**
- Execution status (success/partial/blocked)
- Tasks completed count
- SUMMARY.md path
- Commit hash
- Any blockers or decisions needed
- Suggested next command
```
</if>

<if strategy="C">
Execute in main context since decisions affect subsequent tasks.
Read the workflow at ~/.claude/get-shit-done/workflows/execute-phase.md and follow it.
</if>

</delegate_execution>

<success_criteria>
- All tasks executed
- SUMMARY.md created
- STATE.md updated
- ROADMAP.md updated
- Changes committed
- User informed of next steps
</success_criteria>
