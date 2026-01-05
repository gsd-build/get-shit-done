---
description: Create roadmap with phases for the project
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
Create project roadmap with phase breakdown.

Roadmaps define what work happens in what order. Run after /gsd:new-project.
</objective>

<context>
**Load minimal state for orchestration:**
@.planning/config.json
</context>

<delegate_execution>
**IMPORTANT: Delegate to sub-agent for context efficiency.**

**Step 1: Validate project exists**
```bash
[ -f .planning/PROJECT.md ] || { echo "ERROR: No PROJECT.md found. Run /gsd:new-project first."; exit 1; }
```

**Step 2: Check for existing roadmap**
```bash
[ -f .planning/ROADMAP.md ] && echo "ROADMAP_EXISTS" || echo "NO_ROADMAP"
```

If ROADMAP_EXISTS, ask user:
- "View existing" - Show current roadmap and exit
- "Replace" - Continue with creation
- "Cancel" - Exit

**Step 3: Delegate roadmap creation to sub-agent**

Use Task tool with subagent_type="general-purpose":

```
Create a project roadmap.

**Read and follow the workflow:**
~/.claude/get-shit-done/workflows/create-roadmap.md

**Templates to use:**
- ~/.claude/get-shit-done/templates/roadmap.md (ROADMAP.md structure)
- ~/.claude/get-shit-done/templates/state.md (STATE.md structure)

**Project context to read:**
- .planning/PROJECT.md (project vision, requirements, constraints)
- .planning/config.json (depth setting for phase count)

**Your task:**
1. Read PROJECT.md to understand the project
2. Detect domain expertise level
3. Identify phases (quick: 3-5, standard: 5-8, comprehensive: 8-12)
4. Assign research flags to each phase
5. Create ROADMAP.md following template
6. Initialize STATE.md
7. Create phase directories
8. Commit changes

**Return to parent:**
- Number of phases created
- Phase names and goals (brief)
- Research flags summary
- Git commit hash
- Suggested next command (/gsd:plan-phase 1)
```

</delegate_execution>

<success_criteria>
- ROADMAP.md created with phases
- STATE.md initialized
- Phase directories created
- Changes committed
- User knows next steps
</success_criteria>
