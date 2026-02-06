---
name: execute-plan
description: Execute a PLAN.md file
license: MIT
metadata:
  author: get-shit-done
  version: "1.0"
  category: project-management
allowed-tools: 
---

# execute-plan Skill

## Objective

Execute a single PLAN.md file by spawning a subagent.
Orchestrator stays lean: validate plan, spawn subagent, handle checkpoints, report completion. Subagent loads full execute-plan workflow and handles all execution details.
Context budget: ~15% orchestrator, 100% fresh for subagent.
@~/.claude/get-shit-done/templates/subagent-task-prompt.md
--
   - objective: First sentence or line from `` element
   - task_count: Count of `<task` elements
   - files: Collect unique file paths from `` elements within tasks
   Display friendly summary before spawning:
   ```
   ════════════════════════════════════════
   EXECUTING: {phase_number}-{plan_number} {phase_name}
   ════════════════════════════════════════
   Building: {objective one-liner}

## When to Use



## Process

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
   - objective: First sentence or line from `` element
   - task_count: Count of `<task` elements
   - files: Collect unique file paths from `` elements within tasks
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

## Success Criteria

- [ ] Plan executed (SUMMARY.md created)
- [ ] All checkpoints handled
- [ ] User informed of completion and next steps

## Anti-Patterns



## Examples

### Example Usage
\[TBD: Add specific examples of when and how to use this skill\]

## Error Handling

- If required files are missing: Display clear error messages with setup instructions
- If arguments are invalid: Show usage examples and exit gracefully
- If operations fail: Provide detailed error information and suggest remedies
