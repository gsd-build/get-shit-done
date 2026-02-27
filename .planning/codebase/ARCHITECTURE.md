# Architecture

**Analysis Date:** 2026-01-24

## Pattern Overview

**Overall:** Meta-prompting orchestration system with multi-agent coordination

**Key Characteristics:**
- Command-based entry points that spawn specialized agents
- Stateful workflow orchestration across multiple phases
- Context engineering to manage Claude's context window
- Specification-driven code generation with verification loops
- XML-based structured prompting for agent communication
- File-based state persistence with STATE.md as the project journal

## Layers

**Command Layer:**
- Purpose: User-facing entry points exposed as slash commands in Claude Code and OpenCode
- Location: `commands/gsd/*.md`
- Contains: 27 slash command definitions with argument hints and allowed tools
- Depends on: Workflows, templates, references (via @-file includes)
- Used by: Claude Code / OpenCode slash command interface

**Workflow Layer:**
- Purpose: Coordinating logic for multi-step operations and agent orchestration
- Location: `get-shit-done/workflows/*.md`
- Contains: 11 workflow files describing execution steps, dependencies, and decision trees
- Depends on: References, templates, project state
- Used by: Commands (via execution_context references)

**Agent Layer:**
- Purpose: Specialized subagents that execute isolated portions of work
- Location: `agents/gsd-*.md`
- Contains: 11 specialized agent definitions (executor, planner, verifier, mapper, researcher, etc.)
- Depends on: Project state (STATE.md), config, phase/plan files, codebase files
- Used by: Workflows and orchestrators (spawned via Task tool)

**Reference Layer:**
- Purpose: Static knowledge and guidance consumed by agents and workflows
- Location: `get-shit-done/references/*.md`
- Contains: 8 reference documents (planning-config.md, checkpoints.md, verification-patterns.md, etc.)
- Depends on: None (foundation layer)
- Used by: Agents (loaded via @-file includes in prompts)

**Template Layer:**
- Purpose: Structural templates and examples for generated artifacts
- Location: `get-shit-done/templates/*.md`
- Contains: 9 templates (phase-prompt.md, PLAN.md, requirements.md, context.md, etc.)
- Depends on: References for guidance on structure
- Used by: Agents when creating PLAN.md, CONTEXT.md, and other project artifacts

**Installation/Runtime Layer:**
- Purpose: Setup and lifecycle management
- Location: `bin/install.js`, `hooks/*.js`, `scripts/`
- Contains: Node.js installation, hook registration, statusline display, update checking
- Depends on: Node.js runtime, package.json configuration
- Used by: CLI, Claude Code settings

## Data Flow

**Initialization Flow (new-project):**

1. `/gsd:new-project` command
2. Workflow: `discovery-phase.md` runs gsd-project-researcher agent
3. Researcher explores codebase, gathers requirements, creates CONTEXT.md
4. Workflow creates milestone structure in `.planning/milestones/`
5. Workflow initializes STATE.md, config.json in `.planning/`
6. Return to user with project overview

**Phase Planning Flow (plan-phase):**

1. `/gsd:plan-phase` command with phase argument
2. Workflow: `plan-phase.md` or `plan-milestone-gaps.md`
3. Load STATE.md for accumulated context
4. Spawn gsd-planner agent with phase requirements
5. Planner reads codebase docs (ARCHITECTURE.md, CONVENTIONS.md, etc. from .planning/codebase/)
6. Planner creates PLAN.md with task breakdown
7. Optional: Spawn gsd-plan-checker agent for verification
8. Write PLAN.md to phase directory
9. Return plan summary to user

**Execution Flow (execute-phase):**

1. `/gsd:execute-phase` command with phase argument
2. Workflow: `execute-phase.md` orchestrator
3. Discover plans in phase directory, analyze dependencies
4. Group plans into execution waves based on dependencies
5. For each plan:
   - Spawn gsd-executor agent with plan
   - Executor runs tasks atomically with per-task commits
   - Handle checkpoint:human-verify tasks (pause for user input)
   - Collect SUMMARY.md output
6. Aggregate results, update STATE.md with progress
7. Return execution summary

**Verification Flow (verify-phase):**

1. `/gsd:execute-phase --verify` or automatic post-execution
2. Workflow: `verify-phase.md` orchestrator
3. Spawn gsd-verifier agent with phase context
4. Verifier runs success criteria tests from PLAN.md
5. Collect results: pass/fail per success criterion
6. If failures detected, optionally spawn gsd-debugger or suggest `/gsd:plan-phase --gaps`
7. Update STATE.md with verification results

**State Management Flow:**

1. STATE.md read on every major operation (first thing in every workflow/agent)
2. Agents read:
   - Current phase number and name
   - Current plan name
   - Accumulated decisions from previous phases
   - Blockers and concerns
   - Brief alignment notes
3. Agents write updates via `STATE.md` → sections describing completion, decisions, next steps
4. Each plan execution creates SUMMARY.md → merged into STATE.md via workflow

## Key Abstractions

**Phase:**
- Purpose: Represents a major milestone or feature area (e.g., "01-Authentication", "02-API Endpoints")
- Examples: `01-project-setup/`, `02-core-features/`
- Pattern: Decimal numbering (01-, 02-, etc.), human-readable slug names
- Contains: PLAN files, SUMMARY artifacts, phase-specific documentation

**Plan:**
- Purpose: Executable specification for a phase's work
- Examples: `01-project-setup-PLAN.md`, `02-core-features-PLAN-1.md`
- Pattern: Markdown file with YAML frontmatter + XML task structure
- Contains: Objective, context (@-file references), task list with verification, success criteria

**Task:**
- Purpose: Atomic unit of work with clear acceptance criteria
- Pattern: XML `<task>` element with type (auto, checkpoint:human-verify, checkpoint:async-wait, etc.)
- Contains: Name, files affected, action description, verification method, acceptance criteria
- Execution: Usually 2-3 tasks per plan (more = context pressure, less = loss of atomicity)

**Checkpoint:**
- Purpose: Formalization of interaction points requiring human or external input
- Types: checkpoint:human-verify (UI testing), checkpoint:human-input (secrets), checkpoint:async-wait (external service)
- Pattern: Task with specific structure + gate attribute (blocking/warning)
- Triggers: Pause workflow, wait for resume signal from user

**Agent:**
- Purpose: Specialized subagent handling isolated work scope
- Examples: gsd-executor (runs plans), gsd-planner (creates plans), gsd-verifier (tests)
- Pattern: Markdown prompt with role, responsibilities, context, execution flow
- Spawning: Via Task tool from workflows/commands with full prompt context

**State:**
- Purpose: Persistent record of project progress and accumulated context
- Location: `.planning/STATE.md`
- Pattern: Markdown with sections for phase history, decisions, blockers, next steps
- Mutation: Read at operation start, written at operation end

## Entry Points

**Slash Commands (Primary User Interface):**
- Location: `commands/gsd/*.md`
- Triggers: User types `/gsd:command-name` in Claude Code or `/gsd-command-name` in OpenCode
- Responsibilities: Argument parsing, workflow delegation, result summary
- Examples: `/gsd:new-project`, `/gsd:plan-phase`, `/gsd:execute-phase`

**Workflows (Orchestration Logic):**
- Location: `get-shit-done/workflows/*.md`
- Triggers: Called from commands via `<execution_context>`
- Responsibilities: Multi-step coordination, agent spawning, dependency resolution, state management
- Examples: `plan-phase.md` (orchestrates planning), `execute-phase.md` (orchestrates execution)

**Installation Entry Point:**
- Location: `bin/install.js`
- Triggers: `npx get-shit-done-cc`
- Responsibilities: Runtime detection, config directory setup, file copying, settings.json configuration
- Outputs: GSD files installed to Claude Code or OpenCode config directories

## Error Handling

**Strategy:** Fail-fast with informative error messages, preserve state for recovery

**Patterns:**
- **Command validation:** Check required arguments before spawning agents (see commands/gsd/*.md)
- **Workflow guards:** Each workflow checks prerequisites before proceeding (e.g., STATE.md must exist in execute-phase)
- **Agent error handling:** Agents use try-catch for file operations, return errors via return value (not process.exit)
- **State recovery:** STATE.md preserved even on errors, allows recovery via `/gsd:resume-work` or manual editing
- **User-facing errors:** Displayed as "ERROR: description" at command level, guides user to next action

## Cross-Cutting Concerns

**Logging:**
- Approach: CLI output via console.log (commands/agents), color-coded with ANSI codes
- Pattern: Progress updates shown in real-time, final summary includes key metrics
- Hook output: Silent by default, visible in statusline or on error

**Validation:**
- Approach: YAML/JSON schema validation for config.json, file existence checks before operations
- Pattern: Early validation in workflows before spawning agents
- File paths: Always checked before operations (e.g., phase dir exists before planning)

**Authentication:**
- Approach: None for local operations, external APIs use environment variables or Claude Code secrets
- Pattern: Agents receive secrets via environment or prompts, stored in settings.json or .env
- Secrets: User prompted to provide (never stored in prompts, never version controlled)

---

*Architecture analysis: 2026-01-24*
