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
Analyze existing codebase using parallel gsd-codebase-mapper agents to produce structured codebase documents.

Each mapper agent explores a focus area and **writes documents directly** to `.planning/codebase/`. The orchestrator only receives confirmations, keeping context usage minimal.

Output: .planning/codebase/ folder with 7 structured documents about the codebase state.
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
1. Check if .planning/codebase/ already exists (offer to refresh or skip)
2. Create .planning/codebase/ directory structure
2.5. Match notes for codebase mapping
   ```bash
   # Use focus area if provided, otherwise use general project context
   if [ -n "$ARGUMENTS" ]; then
     FOCUS_AREA="$ARGUMENTS"
     MAPPING_CONTEXT="Codebase mapping focused on: $FOCUS_AREA"
   else
     FOCUS_AREA="full codebase"
     MAPPING_CONTEXT="Full codebase analysis"
   fi

   # Get project name if available
   PROJECT_NAME=$(grep -A2 "## What This Is" .planning/PROJECT.md 2>/dev/null | tail -1 | head -c 50)

   # Call match-notes
   MATCHED_OUTPUT=$(PHASE_NAME="$FOCUS_AREA codebase mapping" PHASE_GOAL="$MAPPING_CONTEXT $PROJECT_NAME" \
     bash commands/gsd/match-notes.md 2>/dev/null)

   # Build notes section if matches exist
   NOTES_SECTION=""
   if [ -n "$MATCHED_OUTPUT" ]; then
     NOTES_SECTION="<matched_notes>

Notes relevant to this codebase analysis:

"
     in_content=false
     while IFS= read -r line; do
       if [ "$line" = "CONTENT_START" ]; then
         in_content=true
       elif [ "$line" = "CONTENT_END" ]; then
         in_content=false
         NOTES_SECTION="$NOTES_SECTION
---
"
       elif [ "$in_content" = "true" ]; then
         NOTES_SECTION="$NOTES_SECTION$line
"
       fi
     done <<< "$MATCHED_OUTPUT"

     NOTES_SECTION="$NOTES_SECTION
</matched_notes>"
   fi
   ```
3. Spawn 4 parallel gsd-codebase-mapper agents (all receive `${NOTES_SECTION}`):
   - Agent 1: tech focus → writes STACK.md, INTEGRATIONS.md
   - Agent 2: arch focus → writes ARCHITECTURE.md, STRUCTURE.md
   - Agent 3: quality focus → writes CONVENTIONS.md, TESTING.md
   - Agent 4: concerns focus → writes CONCERNS.md

   Note: Include `${NOTES_SECTION}` in each mapper's prompt after focus area description
4. Wait for agents to complete, collect confirmations (NOT document contents)
5. Verify all 7 documents exist with line counts
6. Commit codebase map
7. Offer next steps (typically: /gsd:new-project or /gsd:plan-phase)
</process>

<success_criteria>
- [ ] .planning/codebase/ directory created
- [ ] All 7 codebase documents written by mapper agents
- [ ] Documents follow template structure
- [ ] Parallel agents completed without errors
- [ ] User knows next steps
</success_criteria>
