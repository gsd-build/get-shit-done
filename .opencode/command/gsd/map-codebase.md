---

description: Analyze codebase with parallel Explore agents to produce .planning/codebase/ documents

---

<objective>
Analyze existing codebase using parallel Explore agents to produce structured codebase documents.

This command spawns multiple Explore agents to analyze different aspects of the codebase in parallel, each with fresh context.

Output: .planning/codebase/ folder with 7 structured documents about the codebase state.
</objective>

<execution_context>
@~/.config/opencode/gsd/workflows/map-codebase.md
@~/.config/opencode/gsd/templates/codebase/stack.md
@~/.config/opencode/gsd/templates/codebase/architecture.md
@~/.config/opencode/gsd/templates/codebase/structure.md
@~/.config/opencode/gsd/templates/codebase/conventions.md
@~/.config/opencode/gsd/templates/codebase/testing.md
@~/.config/opencode/gsd/templates/codebase/integrations.md
@~/.config/opencode/gsd/templates/codebase/concerns.md
</execution_context>

<context>
Focus area: $ARGUMENTS (optional - if provided, tells agents to focus on specific subsystem)

**Load project state if exists:**
Check for .planning/STATE.md - loads context if project already initialized

**This command can run:**
- Before /gsd/new-project (brownfield codebases) - creates codebase map first
- After /gsd/new-project (greenfield codebases) - updates codebase map as code evolves
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
3. Spawn 4 parallel Explore agents to analyze codebase:
   - Agent 1: Stack + Integrations (technology focus)
   - Agent 2: Architecture + Structure (organization focus)
   - Agent 3: Conventions + Testing (quality focus)
   - Agent 4: Concerns (issues focus)
4. Wait for all agents to complete, collect findings
5. Write 7 codebase documents using templates:
   - STACK.md - Languages, frameworks, key dependencies
   - ARCHITECTURE.md - System design, patterns, data flow
   - STRUCTURE.md - Directory layout, module organization
   - CONVENTIONS.md - Code style, naming, patterns
   - TESTING.md - Test structure, coverage, practices
   - INTEGRATIONS.md - APIs, databases, external services
   - CONCERNS.md - Technical debt, risks, issues
6. Offer next steps (typically: /gsd/new-project or /gsd/plan-phase)
</process>

<success_criteria>
- [ ] .planning/codebase/ directory created
- [ ] All 7 codebase documents written
- [ ] Documents follow template structure
- [ ] Parallel agents completed without errors
- [ ] User knows next steps
</success_criteria>
