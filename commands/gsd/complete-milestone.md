---
description: Archive completed milestone and prepare for next version
argument-hint: "[version]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - TodoWrite
  - AskUserQuestion
  - Glob
---

<objective>
Mark a milestone complete, archive to milestones/, and update ROADMAP.md.

Purpose: Create historical record of shipped version, collapse completed work in roadmap, and prepare for next milestone.
</objective>

<context>
Version: $ARGUMENTS (e.g., "1.0", "1.1", "2.0")

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

**Step 2: Delegate milestone completion to sub-agent**

Use Task tool with subagent_type="general-purpose":

```
Complete milestone: $ARGUMENTS

**Read and follow the workflow:**
~/.claude/get-shit-done/workflows/complete-milestone.md

**Templates to use:**
- ~/.claude/get-shit-done/templates/milestone-archive.md (archive format)

**Project context to read:**
- .planning/ROADMAP.md (milestone phases and status)
- .planning/STATE.md (current position, accumulated decisions)
- .planning/PROJECT.md (project context)
- .planning/MILESTONES.md (if exists - milestone history)
- .planning/phases/*/SUMMARY.md (phase summaries for milestone)
- .planning/config.json (mode settings)

**Your task:**
1. Verify all phases in milestone have completed plans (SUMMARY.md exists)
2. If incomplete phases exist, report and ask user how to proceed
3. Gather stats (phases, plans, tasks, git range, timeline)
4. Extract 4-6 key accomplishments from phase summaries
5. Create milestone archive at .planning/milestones/v[VERSION]-ROADMAP.md
6. Update MILESTONES.md with completed milestone
7. Collapse milestone in ROADMAP.md to one-line summary with link
8. Update PROJECT.md with current state
9. Update STATE.md (clear phase position, keep decisions)
10. Commit and create git tag v[VERSION]

**Return to parent:**
- Milestone completed (version)
- Phases/plans/tasks stats
- Archive path
- Any incomplete phases (if applicable)
- Git commit hash
- Git tag created
- Suggested next command (/gsd:new-milestone or /gsd:discuss-milestone)
```

</delegate_execution>

<success_criteria>
- All phases validated as complete
- Milestone archived to .planning/milestones/
- ROADMAP.md collapsed to one-line entry
- PROJECT.md updated with current state
- Git tag created
- Commit successful
- User knows next steps
</success_criteria>
