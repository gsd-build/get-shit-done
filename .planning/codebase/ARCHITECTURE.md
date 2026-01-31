# Architecture

**Analysis Date:** 2026-01-31

## Pattern Overview

**Overall:** Orchestrator-Agent Multi-Layered System

Get Shit Done Together implements a specialized meta-prompting architecture where commands orchestrate parallel specialized agents to manage context efficiently. The system solves "context rot" through atomic execution, state-driven workflows, and dedicated subagents with fresh context windows.

**Key Characteristics:**
- **Orchestrator-Agent Pattern**: Commands spawn subagents via Task tool for isolated, parallel execution
- **Context Minimization**: Heavy use of `@path` syntax for external file references to avoid duplicating content
- **Parallel Execution**: Multiple agents run simultaneously (gsd-codebase-mapper×4, research+planning+verification)
- **State-Driven Workflows**: Project memory in `.planning/STATE.md` bridges sessions and phases
- **Frontmatter Configuration**: Tools declared in YAML frontmatter; converted across runtimes at install time
- **Atomic Commits**: Each task produces a git commit; execution pauses at checkpoints

## Layers

**User-Facing Layer (Commands):**
- Location: `commands/gsd/`
- Purpose: Entry points for user-triggered workflows (e.g., `/gsd:map-codebase`, `/gsd:plan-phase`)
- Responsibilities:
  - Parse user arguments and flags
  - Load project state and configuration
  - Spawn specialized subagents with appropriate models
  - Collect agent results (confirmations, not full outputs)
  - Handle interactive user prompts (AskUserQuestion)
  - Commit planning artifacts
- Pattern: Commands are relatively thin orchestrators; complexity lives in agents

**Orchestration Layer (Workflows):**
- Location: `get-shit-done/workflows/`
- Purpose: Define procedural flows for commands (structured decision trees)
- Responsibilities:
  - Step-by-step process logic for complex commands
  - Branching logic (if file exists, offer refresh or skip)
  - Model profile resolution based on config
  - Parallel agent spawning and result collection
  - Transition logic between phases
- Consumed by: Commands include workflows via `@path` syntax

**Subagent Layer (Agents):**
- Location: `agents/`
- Purpose: Specialized, context-isolated workers spawned by commands
- Types of agents:
  - **Planners**: `gsd-planner`, `gsd-phase-researcher`, `gsd-project-researcher` — Create PLAN.md, research documents
  - **Executors**: `gsd-executor` — Implement plans with atomic commits
  - **Verifiers**: `gsd-verifier`, `gsd-plan-checker` — Validate work and plans
  - **Analyzers**: `gsd-codebase-mapper`, `gsd-debugger` — Deep domain analysis
  - **Infrastructure**: `gsd-roadmapper`, `gsd-integration-checker` — Setup and validation
- Pattern: Each agent has fresh context, explores one domain thoroughly, returns structured output
- Used by: Commands spawn agents via Task tool with `subagent_type="gsd-{name}"`

**Infrastructure Layer (Hooks):**
- Location: `hooks/gsd-*.js`
- Built to: `hooks/dist/` (distributed with npm package)
- Purpose: Claude Code session enhancements
- Hooks:
  - `gsd-statusline.js` — Real-time UI showing model, task progress, context usage
  - `gsd-check-update.js` — Version check on session start, notifies if update available
- Interaction: Registered in Claude Code `settings.json` during install; run via `before_reply` hook

**Reference Layer (Guidelines & Templates):**
- Location: `get-shit-done/references/` and `get-shit-done/templates/`
- Purpose: Shared knowledge for planning, execution, and verification
- Contents:
  - `references/questioning.md` — Deep questioning patterns for requirements gathering
  - `references/git-integration.md` — Git workflows and commit strategies
  - `references/tdd.md` — Test-driven development patterns
  - `references/model-profiles.md` — Agent model selection (quality/balanced/budget)
  - `templates/project.md` — PROJECT.md structure for initialized projects
  - `templates/milestone.md` — MILESTONE.md template for roadmap phases
  - `templates/state.md` — STATE.md template for project memory
- Consumed by: Agents and commands include via `@path` syntax

**Installer/Package Layer:**
- Location: `bin/install.js`
- Purpose: Multi-runtime installation and configuration
- Responsibilities:
  - Detect runtime (Claude Code, OpenCode, Gemini CLI)
  - Convert frontmatter formats (Claude YAML → OpenCode JSON → Gemini TOML)
  - Replace canonical paths (`~/.claude/`) with actual installation paths
  - Register hooks in runtime configuration
  - Clean up orphaned files from previous versions
- Interaction: Invoked via `npx get-shit-done-together` at user's machine

## Data Flow

### Typical Phase Execution Flow

**Initialization:**
1. User runs `/gsd:new-project` command
2. Command orchestrates deep questioning → writes PROJECT.md, ROADMAP.md, STATE.md
3. Project initialized in `.planning/` with structure:
   ```
   .planning/
   ├── PROJECT.md (vision, requirements, decisions)
   ├── ROADMAP.md (phase structure)
   ├── STATE.md (current position, metrics)
   ├── config.json (workflow preferences)
   ├── codebase/ (ARCHITECTURE.md, STACK.md, etc.)
   └── phases/ (per-phase execution artifacts)
   ```

**Per-Phase Planning:**
1. User runs `/gsd:plan-phase 1`
2. Command (via workflow) checks for research needs → spawns `gsd-phase-researcher` if needed
3. Research agent produces `.planning/phases/01-name/RESEARCH.md` (domain knowledge)
4. Command spawns `gsd-planner` agent
5. Planner reads PROJECT.md + codebase docs + RESEARCH.md → writes PLAN.md
6. Command spawns `gsd-plan-checker` agent
7. Checker verifies PLAN.md quality; if fails, loops back to planner with feedback
8. Command commits PLAN.md when verification passes

**Per-Plan Execution:**
1. User runs `/gsd:execute-phase 1` (or single-plan mode)
2. Command loads STATE.md → current position
3. Command spawns `gsd-executor` agent
4. Executor reads PLAN.md → executes each task:
   - Read task context (@path references)
   - Implement task
   - Commit atomically (one commit per task)
   - If checkpoint, pause and wait for user approval
5. Executor creates SUMMARY.md and updates STATE.md
6. Command offers next action (plan next phase, verify work, etc.)

**Codebase Mapping (Before Planning):**
1. User runs `/gsd:map-codebase` or accepts offer in `/gsd:new-project`
2. Command creates `.planning/codebase/` directory
3. Command spawns 4 parallel `gsd-codebase-mapper` agents:
   - Agent 1 (tech focus) → STACK.md + INTEGRATIONS.md
   - Agent 2 (arch focus) → ARCHITECTURE.md + STRUCTURE.md
   - Agent 3 (quality focus) → CONVENTIONS.md + TESTING.md
   - Agent 4 (concerns focus) → CONCERNS.md
4. Each agent writes documents directly (not returned to orchestrator)
5. Command collects confirmations, verifies output, commits map

### Session Continuity Flow

**Pausing Work:**
1. User runs `/gsd:pause-work` mid-phase
2. Command gathers current state (which task, what's done, what's blocked)
3. Command writes `.planning/phases/XX-name/.continue-here.md` with complete state
4. Command commits as WIP

**Resuming Work:**
1. User runs `/gsd:resume-work`
2. Command reads `.continue-here.md` → extracts state
3. Command provides full context to fresh Claude
4. Execution resumes from exact checkpoint

## Key Abstractions

**Project State (`.planning/STATE.md`):**
- Purpose: Project memory bridging sessions and phases
- Sections: Current position, performance metrics, accumulated decisions, blockers, session continuity
- Lifecycle: Created at init, read at start of every workflow, written after significant actions
- Consumed by: All workflows read this first; understanding project position

**Phase Directories (`.planning/phases/XX-name/`):**
- Purpose: Organize artifacts per phase
- Contains: RESEARCH.md, PLAN.md, SUMMARY.md, `.continue-here.md` (if paused)
- Pattern: Numbered prefix for ordering (01-setup, 02-backend, 03-frontend, etc.)

**Frontmatter Configuration:**
- Purpose: Declare command/agent capabilities in machine-readable way
- For commands: `allowed-tools:` lists available tools
- For agents: `tools:` lists available tools, `color:` for UI, `name:` for identity
- Conversion: Installer transforms between runtimes (Claude YAML → OpenCode JSON → Gemini TOML)

**Model Profile Resolution:**
- Purpose: Scale agents up/down based on user preference
- Profiles: `quality` (Opus for everything) → `balanced` (Sonnet for planning) → `budget` (Haiku for simple tasks)
- Mapping: `.planning/config.json` stores preference; workflows look up agent models from `references/model-profiles.md`
- Example: In "balanced" profile, planner uses Opus, checker uses Sonnet, mapper uses Haiku

**Codebase Reference Documents:**
- Purpose: Provide static context to planners/executors without re-analyzing
- Documents: STACK.md, INTEGRATIONS.md, ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md
- Pattern: Written once by mapper agents, then included via `@path` syntax in planning workflows
- Consumed by: Planners reference to understand constraints; executors reference to follow conventions

## Entry Points

**CLI Entry Point:**
- Location: `bin/install.js`
- Triggers: `npx get-shit-done-together` (from user's shell)
- Responsibilities:
  - Interactive runtime selection
  - Multi-runtime installation
  - Frontmatter conversion
  - Hook registration
  - Orphaned file cleanup

**Command Entry Points (within Claude Code/OpenCode/Gemini):**
- Location: `commands/gsd/*.md`
- Triggers: `/gsd:{command}` (user types in Claude Code)
- Format: YAML frontmatter + XML prompt structure
- Examples:
  - `/gsd:new-project` — Initialize PROJECT.md and roadmap
  - `/gsd:plan-phase 1` — Create PLAN.md for phase 1
  - `/gsd:execute-phase 1` — Execute phase 1 with atomic commits
  - `/gsd:map-codebase` — Analyze and document codebase

**Task-Based Agent Spawning:**
- Location: Commands use `Task` tool to spawn agents
- Pattern: Command → `Task` → `gsd-{agent-name}` (fresh context)
- Flow: Command provides agent name, model, description; agent runs in isolation; orchestrator collects results

## Error Handling

**Strategy:** Explicit error states with clear user guidance

**Patterns:**
- **Validation errors**: Commands validate preconditions (PROJECT.md exists, git repo exists, phase number valid) before spawning agents
- **Agent failures**: Commands catch agent output; if agent fails, note failure but continue with successful agents
- **Checkpoint pauses**: Executor pauses at checkpoints, waits for user approval before continuing
- **Blocker detection**: Executor detects blockers during execution, adds to STATE.md, offers `/gsd:debug` for investigation
- **Verification failures**: Plan checker returns specific feedback; planner iterates based on feedback (max 3 iterations)

**Retry Logic:**
- Plan creation: Max 3 iterations of plan → check → feedback loop
- Agent spawning: No retry; if agent fails, command handles gracefully
- Git operations: No retry; errors propagate to user

## Cross-Cutting Concerns

**Logging:**
- Approach: Stdout via CLI output in commands; state tracked in STATE.md and SUMMARY.md files
- What gets logged: Major milestones (plan created, execution complete), task completion, decisions
- Git messages: Conventional commits (feat, fix, docs, refactor)

**Validation:**
- Frontmatter: Installer validates YAML/JSON/TOML before runtime setup
- Project state: Commands validate PROJECT.md structure before spawning agents
- Plans: Plan checker agent validates PLAN.md structure and decomposition
- Git: Commands check git status before committing; enforce clean working tree for commits

**Authentication:**
- Approach: Not applicable; single-user system (user + Claude)
- Installation: Installer uses environment variables for multi-runtime config paths

**State Management:**
- Single source of truth: `.planning/STATE.md` for project state
- Per-phase state: `.planning/phases/XX-name/` contains all phase artifacts
- Session state: `.planning/phases/XX-name/.continue-here.md` for mid-phase pauses
- Configuration: `.planning/config.json` for workflow settings

---

*Architecture analysis: 2026-01-31*
