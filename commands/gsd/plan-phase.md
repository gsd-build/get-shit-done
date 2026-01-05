---
description: Create detailed execution plan for a phase (PLAN.md)
argument-hint: "[phase]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Glob
  - Grep
  - Task
  - TodoWrite
  - AskUserQuestion
  - WebFetch
  - mcp__context7__*
---

<objective>
Create executable PLAN.md files for a phase.

Purpose: Break down roadmap phases into concrete, executable plans that Claude can run.
Output: One or more PLAN.md files in .planning/phases/XX-name/
</objective>

<context>
Phase number: $ARGUMENTS (optional - auto-detects next unplanned phase if not provided)

**Load minimal state for orchestration:**
@.planning/STATE.md
@.planning/config.json
</context>

<delegate_execution>
**IMPORTANT: Delegate to sub-agent for context efficiency.**

**Step 1: Validate project exists**
```bash
[ -d .planning ] || { echo "ERROR: No .planning/ directory. Run /gsd:new-project first."; exit 1; }
```

**Step 2: Determine phase number**
If $ARGUMENTS provided, use it. Otherwise, detect next unplanned phase from ROADMAP.md.

**Step 3: Delegate planning to sub-agent**

Use Task tool with subagent_type="general-purpose":

```
Create execution plan(s) for phase: [PHASE_NUMBER]

**Read and follow the workflow:**
~/.claude/get-shit-done/workflows/plan-phase.md

**Reference files (read as needed):**
- ~/.claude/get-shit-done/templates/phase-prompt.md (PLAN.md structure)
- ~/.claude/get-shit-done/references/plan-format.md (task format rules)
- ~/.claude/get-shit-done/references/scope-estimation.md (when to split plans)
- ~/.claude/get-shit-done/references/checkpoints.md (checkpoint types)
- ~/.claude/get-shit-done/references/tdd.md (test-driven guidance)

**Project context to read:**
- .planning/ROADMAP.md (phase goals and dependencies)
- .planning/PROJECT.md (project vision and constraints)
- .planning/STATE.md (decisions, issues, context)
- .planning/config.json (depth setting, mode)
- .planning/phases/XX-name/*-CONTEXT.md (if exists - from discuss-phase)
- .planning/phases/XX-name/*-RESEARCH.md (if exists - from research-phase)
- .planning/codebase/ (if exists - codebase context)

**Your task:**
1. Load all project context
2. Perform discovery (Level 0-3 per workflow)
3. Break phase into 2-3 task plans
4. Estimate scope, split if needed (max 3 tasks per plan)
5. Create PLAN.md file(s) with executable structure
6. Each plan must have: objective, context, tasks, verification, success_criteria

**Return to parent:**
- Number of plans created
- Plan file paths
- Brief description of each plan
- Suggested next command (/gsd:execute-plan [path])
```

</delegate_execution>

<success_criteria>
- One or more PLAN.md files created in .planning/phases/XX-name/
- Each plan has executable structure
- Tasks are specific enough for Claude to execute
- User knows next steps
</success_criteria>
