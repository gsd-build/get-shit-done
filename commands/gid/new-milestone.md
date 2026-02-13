---
name: gid:new-milestone
description: Start a new milestone cycle — update PROJECT.md and route to requirements
argument-hint: "[milestone name, e.g., 'v1.1 Notifications']"
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - AskUserQuestion
---
<objective>
Start a new milestone: questioning → research (optional) → requirements → roadmap.

Brownfield equivalent of new-project. Project exists, PROJECT.md has history. Gathers "what's next", updates PROJECT.md, then runs requirements → roadmap cycle.

**Creates/Updates:**
- `.planning/PROJECT.md` — updated with new milestone goals
- `.planning/research/` — domain research (optional, NEW features only)
- `.planning/REQUIREMENTS.md` — scoped requirements for this milestone
- `.planning/ROADMAP.md` — phase structure (continues numbering)
- `.planning/STATE.md` — reset for new milestone

**After:** `/gid:plan-phase [N]` to start execution.
</objective>

<execution_context>
@~/.claude/get-it-done/workflows/new-milestone.md
@~/.claude/get-it-done/references/questioning.md
@~/.claude/get-it-done/references/ui-brand.md
@~/.claude/get-it-done/templates/project.md
@~/.claude/get-it-done/templates/requirements.md
</execution_context>

<context>
Milestone name: $ARGUMENTS (optional - will prompt if not provided)

**Load project context:**
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/MILESTONES.md
@.planning/config.json

**Load milestone context (if exists, from /gid:discuss-milestone):**
@.planning/MILESTONE-CONTEXT.md
</context>

<process>
Execute the new-milestone workflow from @~/.claude/get-it-done/workflows/new-milestone.md end-to-end.
Preserve all workflow gates (validation, questioning, research, requirements, roadmap approval, commits).
</process>
