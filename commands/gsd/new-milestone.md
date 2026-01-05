---
description: Create a new milestone with phases for an existing project
argument-hint: "[milestone name, e.g., 'v2.0 Features']"
---

<objective>
Create a new milestone for an existing project with defined phases.

Purpose: After completing a milestone, creates the next milestone structure in ROADMAP.md with phases, updates STATE.md, and creates phase directories.
</objective>

<context>
Milestone name: $ARGUMENTS (optional - will prompt if not provided)

**Load minimal state for orchestration:**
@.planning/STATE.md
@.planning/config.json
</context>

<delegate_execution>
**IMPORTANT: Delegate to sub-agent for context efficiency.**

**Step 1: Validate project exists**
```bash
[ -d .planning ] || { echo "ERROR: No .planning/ directory. Run /gsd:new-project first."; exit 1; }
[ -f .planning/ROADMAP.md ] || { echo "ERROR: No ROADMAP.md found. Run /gsd:create-roadmap first."; exit 1; }
```

**Step 2: Delegate milestone creation to sub-agent**

Use Task tool with subagent_type="general-purpose":

```
Create a new milestone.

**Read and follow the workflow:**
~/.claude/get-shit-done/workflows/create-milestone.md

**Template to use:**
- ~/.claude/get-shit-done/templates/roadmap.md (milestone section format)

**Project context to read:**
- .planning/ROADMAP.md (previous milestones, phase numbering)
- .planning/STATE.md (current position, deferred issues)
- .planning/MILESTONES.md (if exists - milestone history)
- .planning/PROJECT.md (project vision)
- .planning/config.json (depth setting for phase count)

**Milestone name argument:** $ARGUMENTS (prompt user if empty)

**Your task:**
1. Calculate next milestone version and starting phase number
2. If no name provided, prompt user for milestone name
3. Gather phases per depth setting (quick: 3-5, standard: 5-8, comprehensive: 8-12)
4. Detect research needs for each phase
5. Update ROADMAP.md with new milestone section
6. Create phase directories
7. Update STATE.md for new milestone
8. Commit changes

**Return to parent:**
- Milestone version created
- Number of phases
- Phase directories created
- Git commit hash
- Suggested next command (/gsd:plan-phase [N])
```

</delegate_execution>

<success_criteria>
- Phases defined per depth setting
- ROADMAP.md updated with new milestone
- Phase directories created
- STATE.md reset for new milestone
- Git commit made
- User knows next steps
</success_criteria>
