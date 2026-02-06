# Architecture

**Analysis Date:** 2026-02-06

## Pattern Overview

**Overall:** Multi-agent orchestration system with specialized workflows and state management.

**Key Characteristics:**
- Spawned agent pattern: Orchestrators (commands) spawn specialized subagents (agents) with fresh context
- Markdown-driven prompts: All workflows, agents, and templates are markdown files that become prompts
- State-driven execution: Central `.planning/` directory maintains project state across sessions
- Wave-based parallelization: Plans group into dependency waves for parallel execution
- Direct document writing: Agents write directly to `.planning/` without context transfer

## Layers

**User Interface Layer (Commands):**
- Purpose: User-facing slash commands in Claude Code/OpenCode/Gemini
- Location: `commands/gsd/*.md`
- Contains: 28 command definitions with frontmatter metadata and execution steps
- Depends on: Reference materials, templates, workflows
- Used by: Installation system to register commands in IDE

**Orchestration Layer:**
- Purpose: Command execution - spawns specialized agents, collects results, manages state
- Location: `commands/gsd/*.md` (execution logic sections)
- Contains: Process steps that use Task tool to spawn subagents
- Depends on: Workflows, state files, project configuration
- Used by: Commands invoke orchestration patterns

**Workflow Layer:**
- Purpose: Reusable orchestration patterns and task breakdowns
- Location: `get-shit-done/workflows/*.md`
- Contains: 12 workflow definitions with step-by-step breakdowns
- Depends on: Templates, references, state management
- Used by: Orchestrators load and follow these patterns (e.g., execute-plan.md drives executor spawning)

**Agent Layer:**
- Purpose: Specialized workers spawned with fresh context for specific tasks
- Location: `agents/*.md` (11 agents)
- Contains: Role definitions, responsibilities, reasoning patterns
- Depends on: Templates, references, codebase understanding
- Used by: Orchestrators spawn agents via Task tool with `subagent_type`

**Template Layer:**
- Purpose: Reusable content patterns for generated artifacts
- Location: `get-shit-done/templates/*.md`
- Contains: Document structure, field definitions, expected sections
- Examples: `project.md` template, `summary.md` template, `requirements.md` template
- Used by: Agents use templates when creating project artifacts

**Reference Layer:**
- Purpose: Cross-cutting knowledge and decision guidelines
- Location: `get-shit-done/references/*.md`
- Contains: Patterns, practices, model profiles, questioning approaches
- Examples: `git-integration.md`, `verification-patterns.md`, `model-profiles.md`
- Used by: All agents and orchestrators reference these for consistency

**Knowledge/Memory Layer:**
- Purpose: Cross-project knowledge extraction and indexing
- Location: `gsd-memory/src/` (TypeScript, MCP server)
- Contains: Tools for searching, extracting decisions, finding patterns from other projects
- Tools available: `gsd_memory_search`, `gsd_memory_decisions`, `gsd_memory_patterns`, `gsd_memory_pitfalls`, `gsd_memory_stack`
- Used by: Agents can query this MCP server during research phases

**Installation/Distribution Layer:**
- Purpose: Installation and setup across runtimes
- Location: `bin/install.js`, `scripts/build-hooks.js`
- Contains: Multi-runtime installer (Claude Code, OpenCode, Gemini), hook builders
- Depends on: Commands, agents, workflows, templates
- Used by: `npx get-shit-done-cc` entry point

## Data Flow

**Project Initialization Flow:**

1. User runs `/gsd:new-project` command
2. Orchestrator spawns `gsd-project-researcher` (research phase - optional)
3. Orchestrator spawns `gsd-roadmapper` (create roadmap)
4. Artifacts written: `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`
5. Orchestrator returns confirmation

**Phase Planning Flow:**

1. User runs `/gsd:plan-phase N`
2. Orchestrator reads `.planning/ROADMAP.md` and `STATE.md`
3. Orchestrator spawns `gsd-phase-researcher` with `--context` (research guided by user decisions)
4. Orchestrator spawns `gsd-planner` with research results
5. Orchestrator spawns `gsd-plan-checker` to verify plans achieve goals
6. If checker rejects: loop back to planner with feedback
7. Artifacts written: `{phase}-RESEARCH.md`, `{phase}-{N}-PLAN.md` (multiple)
8. Orchestrator updates `STATE.md` with phase in-progress status

**Phase Execution Flow:**

1. User runs `/gsd:execute-phase N`
2. Orchestrator discovers all `*-PLAN.md` files in phase directory
3. Orchestrator reads `wave` from each plan's YAML frontmatter
4. Orchestrator groups plans by wave (dependency analysis)
5. For each wave: orchestrator spawns `gsd-executor` subagents in parallel
6. Each executor: loads plan, reads templates/references, implements tasks, writes `*-SUMMARY.md`
7. After all waves complete: orchestrator spawns `gsd-verifier` to check deliverables
8. Artifacts written: `{phase}-{N}-SUMMARY.md` per plan, git commits per task
9. `STATE.md` updated with phase completion or fix plans generated

**State Management:**

- `.planning/STATE.md` — Current position, decisions, blockers
- `.planning/ROADMAP.md` — Phase structure and completion status
- `.planning/PROJECT.md` — Vision, constraints, key decisions
- `.planning/REQUIREMENTS.md` — v1/v2 scoping with traceability
- `.planning/config.json` — Workflow settings (mode, depth, profiles, commit behavior)
- `.planning/codebase/` — Codebase analysis docs (STACK.md, ARCHITECTURE.md, CONVENTIONS.md, etc.)

## Key Abstractions

**Command Pattern:**
- Purpose: User-facing entry point with argument parsing
- Examples: `commands/gsd/new-project.md`, `commands/gsd/plan-phase.md`
- Pattern: YAML frontmatter → executable process steps → spawns orchestrator
- Metadata: name, description, allowed-tools, argument-hint

**Workflow Pattern:**
- Purpose: Reusable orchestration blueprint
- Examples: `get-shit-done/workflows/execute-phase.md`, `get-shit-done/workflows/map-codebase.md`
- Pattern: Purpose section → process steps → conditional branches
- Used by: Multiple commands may use same workflow

**Agent Pattern:**
- Purpose: Specialized executor with fresh context
- Examples: `agents/gsd-executor.md`, `agents/gsd-planner.md`
- Pattern: Role definition → responsibilities → context requirements → process steps
- Spawning: Via Task tool with `subagent_type="gsd-{name}"`

**Template Pattern:**
- Purpose: Document structure contracts
- Examples: `get-shit-done/templates/project.md`, `get-shit-done/templates/summary.md`
- Pattern: Sections with placeholder text, field descriptions
- Used by: Agents populate templates when creating artifacts

**Reference Pattern:**
- Purpose: Shared decision frameworks
- Examples: `get-shit-done/references/questioning.md`, `get-shit-done/references/verification-patterns.md`
- Pattern: Declarative patterns with examples and decision trees
- Used by: Agents load references with `@~/.claude/get-shit-done/references/X.md` syntax

## Entry Points

**Installation Entry Point:**
- Location: `bin/install.js`
- Triggers: `npx get-shit-done-cc [options]`
- Responsibilities: Interactive/non-interactive multi-runtime setup, file copying, command registration

**User Command Entry Points:**
- Location: `commands/gsd/*.md` (28 files)
- Triggers: `/gsd:command-name [args]` in IDE
- Examples:
  - `/gsd:new-project` — `commands/gsd/new-project.md`
  - `/gsd:plan-phase 1` — `commands/gsd/plan-phase.md`
  - `/gsd:execute-phase 1` — `commands/gsd/execute-phase.md`
  - `/gsd:map-codebase` — `commands/gsd/map-codebase.md`

**Subagent Entry Points:**
- Location: `agents/*.md` (11 files)
- Triggers: Task tool with `subagent_type="gsd-{name}"`
- Examples:
  - `gsd-executor` — Implements plans
  - `gsd-planner` — Creates task breakdowns
  - `gsd-verifier` — Checks deliverables
  - `gsd-codebase-mapper` — Analyzes existing codebases

**MCP Server Entry Point:**
- Location: `gsd-memory/src/index.ts`
- Triggers: CLI invocation or IDE MCP registration
- Responsibilities: Expose cross-project knowledge tools (search, decisions, patterns, stack)

## Error Handling

**Strategy:** Fail-fast with clear messages, provide recovery paths

**Patterns:**

- **Validation gates:** Commands check preconditions before proceeding (e.g., "Project already initialized" abort)
- **State verification:** Orchestrators read and validate `.planning/` state before operations
- **Loop-on-failure:** Plan checker loops with planner if verification fails (bounded iterations)
- **Gap closure:** Verifier creates fix plans for failed checks, executable by same system
- **User confirmation:** Interactive mode gates on user approval before major operations

## Cross-Cutting Concerns

**Logging:** Markdown-based status display with banner sections and process indicators

**Validation:**
- YAML frontmatter validation in commands/agents
- State file existence checks
- Plan dependency verification
- Git state checks before commits

**Authentication:** Not a concern (local CLI, no external auth required)

**Git Integration:**
- Atomic commits per task (defined in `execute-plan.md` workflow)
- State tracking via `.planning/` branch
- Optional branch strategies (per `planning-config.md`)
- Phase/milestone branch templates configurable

**Context Management:**
- Agents load context from `@file` references (files prefixed with `@`)
- Orchestrators stay lean (~15% context usage)
- Subagents get fresh context (100% budget per agent)
- Quality degradation curve guides planning granularity

**Markdown as Prompts:**
- All workflows, commands, agents, templates are markdown
- Never transformed to prompts — markdown IS the prompt
- YAML frontmatter carries metadata
- `@reference` syntax imports external files into context

---

*Architecture analysis: 2026-02-06*
