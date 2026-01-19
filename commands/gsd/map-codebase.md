---
name: gsd:map-codebase
description: Analyze codebase with parallel mapper agents to produce .planning/codebase/ documents
argument-hint: "[optional: specific area to map, e.g., 'api' or 'auth']"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Write
  - Task
---

<objective>
Analyze existing codebase using parallel gsd-codebase-mapper agents to produce structured codebase documents. Optionally ingest user-provided documentation first.

Each mapper agent explores a focus area and **writes documents directly** to `.planning/codebase/`. The orchestrator only receives confirmations, keeping context usage minimal.

Output: .planning/codebase/ folder with 7 structured documents about the codebase state, plus optional USER-CONTEXT.md with user-provided documentation.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/map-codebase.md
</execution_context>

<context>
Focus area: $ARGUMENTS (optional - if provided, tells agents to focus on specific subsystem)

**Load project state if exists:**
Check for .planning/STATE.md - loads context if project already initialized

**This command can run:**
- Before /gsd:new-project (brownfield codebases) - creates codebase map first
- After /gsd:new-project (greenfield codebases) - updates codebase map as code evolves
- Anytime to refresh codebase understanding
</context>

<when_to_use>
**Use map-codebase for:**
- Brownfield projects before initialization (understand existing code first)
- Refreshing codebase map after significant changes
- Onboarding to an unfamiliar codebase
- Before major refactoring (understand current state)
- When STATE.md references outdated codebase info

**Skip map-codebase for:**
- Greenfield projects with no code yet (nothing to map)
- Trivial codebases (<5 files)
</when_to_use>

<process>
1. Prompt for existing documentation (file paths or directories)
2. If user provides docs: spawn gsd-doc-ingestor agent to process them
3. If user skips: continue normally
4. Validate document claims against codebase (if docs provided)
5. Check if .planning/codebase/ already exists (offer to refresh or skip)
6. Create .planning/codebase/ directory structure
7. Spawn 4 parallel gsd-codebase-mapper agents:
   - Agent 1: tech focus -> writes STACK.md, INTEGRATIONS.md
   - Agent 2: arch focus -> writes ARCHITECTURE.md, STRUCTURE.md
   - Agent 3: quality focus -> writes CONVENTIONS.md, TESTING.md
   - Agent 4: concerns focus -> writes CONCERNS.md
8. Wait for agents to complete, collect confirmations (NOT document contents)
9. Verify all 7 documents exist with line counts
10. Commit codebase map
11. Offer next steps (typically: /gsd:new-project or /gsd:plan-phase)
</process>

<success_criteria>
- [ ] User prompted for existing documentation
- [ ] User docs processed (if provided) or skipped gracefully
- [ ] User documentation validated against codebase (if provided)
- [ ] LOW confidence claims resolved with user (if any found)
- [ ] .planning/codebase/ directory created
- [ ] All 7 codebase documents written by mapper agents
- [ ] USER-CONTEXT.md written (if docs provided)
- [ ] Documents follow template structure
- [ ] Parallel agents completed without errors
- [ ] User knows next steps
</success_criteria>
