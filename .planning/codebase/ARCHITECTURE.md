# Architecture

**Analysis Date:** 2026-02-01

## Pattern Overview

**Overall:** Multi-agent orchestration system for AI-driven project development

**Key Characteristics:**
- Agent-based architecture where specialized agents handle distinct lifecycle phases
- Orchestrator-pattern workflow delegation with task spawning via Claude Code Task tool
- State-machine-driven project progression with persistent `.planning/` artifact management
- Prompt-as-code paradigm where execution plans (PLAN.md) are directly executable prompts
- CLI command interface with installation bootstrap (`bin/install.js`)

## Layers

**Presentation Layer (Commands):**
- Purpose: User-facing entry points mapped to specific workflows
- Location: `commands/gsd/` contains 28 command files (.md format)
- Contains: YAML frontmatter with tool declarations + objective + reference content
- Depends on: Agent spawning system, State management
- Used by: Claude Code slash commands (`/gsd:*`)
- Examples: `help.md`, `plan-phase.md`, `execute-phase.md`, `progress.md`

**Orchestration Layer (Agents):**
- Purpose: High-level workflow coordination and delegation
- Location: `agents/gsd-*.md` - 11 agent implementations
- Contains: Role definition, phase-specific logic, subagent spawning
- Depends on: State artifacts, reference docs, project files
- Used by: Commands, other agents
- Key agents:
  - `gsd-planner.md` - Creates executable PLAN.md files with task breakdown
  - `gsd-executor.md` - Executes plans atomically with checkpoint handling
  - `gsd-project-researcher.md` - Deep discovery for new projects
  - `gsd-debugger.md` - Systematic debugging with persistent state
  - `gsd-codebase-mapper.md` - Maps existing codebases to `.planning/codebase/`
  - `gsd-verifier.md` - Validates completed work against requirements

**Workflow Layer:**
- Purpose: Reusable workflow definitions with process steps
- Location: `get-shit-done/workflows/` - 14 workflow files
- Contains: Step-by-step procedures for major operations
- Examples: `execute-phase.md`, `map-codebase.md`, `discover-phase.md`
- Pattern: Each step is a named process block with conditionals

**Reference/Template Layer:**
- Purpose: Shared knowledge, patterns, and artifact templates
- Location: `get-shit-done/references/` (10 files) and `get-shit-done/templates/` (23 files)
- Contains: Best practices, example structures, tool integration guides
- Used by: Agents, workflows, planners
- Key files:
  - `references/git-integration.md` - Git commit patterns
  - `references/checkpoints.md` - Checkpoint task patterns
  - `references/tdd.md` - Testing methodology
  - `templates/phase-prompt.md` - PLAN.md template structure

**Infrastructure Layer:**
- Purpose: Installation and runtime hooks
- Location: `bin/install.js` (1,446 lines), `hooks/` (2 hook files)
- Contains: Multi-runtime installer, statusline hook, update checker
- Responsible for: Copying agents/commands to runtime configs (.claude, .config/opencode, .gemini)
- Runtime targets: Claude Code, OpenCode, Gemini

**State Management Layer:**
- Purpose: Project memory and progress tracking
- Location: `.planning/` directory (created during project init)
- Contains: PROJECT.md, ROADMAP.md, STATE.md, config.json, phases/, codebase/
- Persisted across: Sessions, context resets, multiple agent invocations

## Data Flow

**New Project Flow:**
1. `/gsd:new-project` command invokes `gsd-project-researcher` agent
2. Researchers conduct parallel discovery → outputs research artifacts
3. Planner reads research, creates PROJECT.md + REQUIREMENTS.md + ROADMAP.md
4. User can then `/gsd:plan-phase 1` for detailed planning

**Phase Planning Flow:**
1. `/gsd:plan-phase N` triggers orchestrator
2. Orchestrator reads ROADMAP.md, phase context, prior decisions from STATE.md
3. `gsd-planner` agent decomposes phase into parallel-optimized tasks
4. Planner creates `.planning/phases/NN-name/NN-YY-PLAN.md` with:
   - Task dependencies and execution waves
   - Goal-backward verification criteria (must_haves)
   - Checkpoint definitions where user input needed
5. PLAN.md returned to orchestrator (printed to user)

**Phase Execution Flow:**
1. `/gsd:execute-phase N` invokes orchestrator
2. Orchestrator discovers all PLAN.md files in phase directory
3. Analyzes dependency graph, groups plans into sequential waves
4. Spawns `gsd-executor` agent for each wave via Task tool (parallel within wave)
5. Each executor:
   - Loads PLAN.md as direct execution prompt
   - Executes tasks atomically
   - Creates git commits per task
   - Produces SUMMARY.md output
6. Orchestrator collects results, updates STATE.md, ROADMAP.md progress

**State Update Flow:**
1. After each execution, executor produces SUMMARY.md with deliverables
2. Orchestrator reads SUMMARY, updates `.planning/STATE.md`:
   - Current position (phase, plan)
   - Accumulated decisions
   - Progress tracking
   - Key artifacts created
3. ROADMAP.md updated with completion percentage
4. STATE.md persists across context windows (enables `/gsd:resume-work`)

**State Management:**
- `.planning/STATE.md` - Single source of truth for project context
- `.planning/config.json` - Toggles (researcher enabled/disabled, model profiles)
- `.planning/phases/XX-name/` - Per-phase artifacts (PLAN.md, SUMMARY.md, verification)
- `.planning/codebase/` - Brownfield project context (ARCHITECTURE.md, STRUCTURE.md, etc.)
- `.planning/debug/` - Persistent debug sessions across context resets
- `.planning/todos/` - Captured ideas and tasks with lifecycle tracking

## Key Abstractions

**PLAN.md (Executable Prompt):**
- Purpose: Atomic, executable specification for phase work
- Examples: `.planning/phases/01-foundation/01-01-PLAN.md`
- Pattern: YAML frontmatter (phase, plan, type, wave, dependencies) + objective + context references (@-files) + tasks + verification
- Not a document that becomes a prompt—IS the prompt executed by `gsd-executor`

**SUMMARY.md (Outcome Report):**
- Purpose: Record what was built, what was verified
- Examples: `.planning/phases/01-foundation/01-01-SUMMARY.md`
- Contents: Deliverables, verification results, decisions made, issues encountered
- Produced by: `gsd-executor` after plan completion
- Consumed by: Orchestrators, verifiers, phase reviewers

**STATE.md (Project Memory):**
- Purpose: Persistent context across context windows
- Structure: Markdown with sections for current position, decisions, progress, continuity
- Enables: `/gsd:resume-work`, `/gsd:progress`, continuation after `/clear`
- Updated by: All executors after task completion
- Read by: All orchestrators before operations

**Wave-based Parallelism:**
- Plans grouped by wave (1, 2, 3...)
- Plans in same wave execute in parallel via Task tool
- Wave ordering enforced sequentially
- Enables: High parallelism without coordination overhead
- Example: UI component creation (wave 1) parallel, then API integration (wave 2) sequential

**Checkpoint Tasks:**
- Pattern: Tasks requiring user input (decisions, verification)
- Types: `checkpoint:decision` (choose option), `checkpoint:human-verify` (visual testing)
- Handled by: Executor pauses, awaits user input via resume-signal
- Blocking: Prevent dependent tasks from starting until resolved

## Entry Points

**CLI Commands (`commands/gsd/`):**
- Location: Each .md file is a command (e.g., `plan-phase.md` = `/gsd:plan-phase`)
- Triggers: User invokes `/gsd:command-name` in Claude Code slash menu
- Responsibilities: Parse user input, invoke appropriate orchestrator agent
- Pattern: Minimal YAML frontmatter + objective + reference content

**Installation Bootstrap (`bin/install.js`):**
- Location: `bin/install.js` (1,446 lines, Node.js)
- Triggers: `npx get-shit-done-cc` during project setup
- Responsibilities:
  - Interactive runtime selection (Claude Code / OpenCode / Gemini)
  - Global vs. local installation
  - Path conversion (Claude → OpenCode tool names, Gemini TOML format)
  - Settings.json configuration (hooks, statusline, permissions)
  - Multi-runtime support with config directory hierarchy

**Agents as Entry Points:**
- Location: `agents/gsd-*.md`
- Triggers: Spawned by orchestrators via Task tool or direct invocation
- Responsibilities: Specialized lifecycle work (planning, execution, research)
- Pattern: Role + philosophy + process steps (named <step> blocks)

## Error Handling

**Strategy:** Checkpoint gates + deviation handling

**Patterns:**
- Executors detect deviations from expected behavior
- Non-blocking deviations logged, execution continues with notification
- Blocking deviations trigger checkpoint (require user decision)
- Exceptions in tasks captured in SUMMARY.md
- Unresolved errors prevent plan completion, require manual intervention

**Recovery Mechanisms:**
- STATE.md captures last known position
- `/gsd:resume-work` reconstructs context from STATE.md
- Plans can be re-executed (idempotent design preferred)
- Debug sessions (`/gsd:debug`) survive context resets via `.planning/debug/` persistent state

## Cross-Cutting Concerns

**Logging:**
- Approach: Markdown output to stdout + file-based SUMMARY.md
- Status markers: `✓` (done), `→` (in progress), `⚠` (warning)
- Verbosity controlled by workflow mode (interactive vs. YOLO)

**Validation:**
- Approach: Goal-backward verification (must_haves in PLAN.md)
- Pattern: Observable truths + artifacts + key connections verified post-execution
- Executor validates against acceptance criteria in task definitions

**State Persistence:**
- Approach: Disk-based (`.planning/` directory)
- Format: Markdown for human readability + JSON for config/metadata
- Committed to git by default (configurable via `config.json`)
- Survives: Context resets, editor restarts, long sessions

**Model Profile System:**
- Approach: Configurable per-role model assignment
- Location: `.planning/config.json` → `model_profile` field
- Profiles: `quality` (Opus), `balanced` (Opus planning + Sonnet execution), `budget` (Sonnet/Haiku)
- Usage: Orchestrators read config, inject model into Task tool calls

**Wave Execution & Dependency Management:**
- Approach: Analyzed during planning, enforced during execution
- Pattern: Plans declare `wave: N` and `depends_on: [list]`
- Execution: Orchestrator groups by wave, runs sequentially; within-wave runs parallel
- Guarantees: No circular dependencies, dependency completion before dependent plan

---

*Architecture analysis: 2026-02-01*
