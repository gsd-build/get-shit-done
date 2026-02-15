# Architecture

**Analysis Date:** 2026-02-05

## Pattern Overview

**Overall:** Meta-Prompting CLI System with Markdown-Defined Commands and Subagent Orchestration

**Key Characteristics:**
- Installer (`bin/install.js`) copies markdown resources to runtime config directories
- Commands, workflows, agents, and templates are all markdown-based (no compiled code)
- Subagent orchestration pattern — thin orchestrators spawn specialized agents
- File-based state management (`.planning/` directory in user projects)
- Multi-runtime support (Claude Code, OpenCode, Gemini CLI)

## Layers

**Install Layer:**
- Purpose: Deploy GSD resources to runtime config directories
- Location: `bin/install.js`
- Contains: File copying, path replacement, runtime detection, settings configuration
- Depends on: Node.js built-ins (fs, path, os, readline)
- Used by: npx invocation (`npx get-shit-done-cc`)

**Command Layer:**
- Purpose: Define slash commands that users invoke in Claude Code/OpenCode/Gemini
- Location: `commands/gsd/*.md`
- Contains: Command definitions with YAML frontmatter (name, description, allowed-tools) and execution instructions
- Depends on: Workflows layer, references layer
- Used by: AI runtime (Claude Code, OpenCode, Gemini CLI)

**Agent Layer:**
- Purpose: Specialized subagents with defined roles and tool permissions
- Location: `agents/*.md`
- Contains: Agent definitions (gsd-executor, gsd-planner, gsd-verifier, gsd-debugger, etc.)
- Depends on: Workflows layer, templates layer
- Used by: Command layer (spawned via Task tool)

**Workflow Layer:**
- Purpose: Reusable multi-step procedures called by commands
- Location: `get-shit-done/workflows/*.md`
- Contains: Detailed process steps, structured returns, success criteria
- Depends on: Templates layer, references layer
- Used by: Commands and agents via `@` file references

**Template Layer:**
- Purpose: File templates for planning artifacts created in user projects
- Location: `get-shit-done/templates/*.md`, `get-shit-done/templates/codebase/*.md`
- Contains: Document structures with placeholder variables
- Depends on: None
- Used by: Agents when creating `.planning/` files

**Reference Layer:**
- Purpose: Principle documents and configuration guides
- Location: `get-shit-done/references/*.md`
- Contains: Guidelines (checkpoints, model-profiles, verification-patterns, etc.)
- Depends on: None
- Used by: Commands, workflows, agents as context

**Hooks Layer:**
- Purpose: Runtime hooks for statusline and update checking
- Location: `hooks/*.js`
- Contains: gsd-statusline.js (context display), gsd-check-update.js (version checking)
- Depends on: Node.js, runtime session data
- Used by: Claude Code/Gemini settings.json hook configuration

## Data Flow

**Command Invocation Flow:**

1. User types `/gsd:command` in Claude Code (or `/gsd-command` in OpenCode)
2. Runtime loads command markdown from `~/.claude/commands/gsd/` (or equivalent)
3. Command markdown parsed, `@` file references resolved
4. Execution context established from `<execution_context>` section
5. Process follows `<process>` section steps
6. If orchestrator pattern: Task tool spawns subagent with agent definition
7. Subagent executes with fresh context window, returns structured result
8. Orchestrator collects results, updates state, routes to next step

**Installation Flow:**

1. User runs `npx get-shit-done-cc`
2. `bin/install.js` executes
3. Interactive prompts select runtime (Claude/OpenCode/Gemini) and location (global/local)
4. Files copied from source directories to target config directory
5. Path references replaced (`~/.claude/` → actual path)
6. Frontmatter converted for runtime compatibility (Claude → OpenCode/Gemini)
7. Settings.json updated with hooks and statusline
8. Success message with next steps

**Subagent Execution Pattern:**

1. Orchestrator (command) analyzes task requirements
2. Spawns specialized agent via Task tool with prompt containing:
   - Objective
   - Execution context (`@workflow.md`, `@template.md`)
   - Inlined file contents (plans, state)
   - Success criteria
3. Agent executes in fresh 200k context window
4. Agent returns structured result (PLAN COMPLETE, CHECKPOINT REACHED, etc.)
5. Orchestrator parses result, routes accordingly

**State Management:**
- All project state lives in `.planning/` directory (user's project)
- STATE.md tracks position, decisions, blockers, session continuity
- ROADMAP.md tracks phases and completion status
- REQUIREMENTS.md tracks requirement traceability
- Each command reads state, performs operations, updates state
- No persistent in-memory state between commands

## Key Abstractions

**Command:**
- Purpose: User-facing action triggered by slash command
- Examples: `commands/gsd/new-project.md`, `commands/gsd/execute-phase.md`, `commands/gsd/plan-phase.md`
- Pattern: Markdown file with YAML frontmatter defining name, description, allowed-tools

**Agent:**
- Purpose: Specialized subagent with defined role and tool permissions
- Examples: `agents/gsd-executor.md`, `agents/gsd-planner.md`, `agents/gsd-verifier.md`
- Pattern: Spawned by orchestrators via Task tool, returns structured results

**Workflow:**
- Purpose: Reusable multi-step procedure
- Examples: `get-shit-done/workflows/execute-phase.md`, `get-shit-done/workflows/verify-work.md`
- Pattern: Loaded via `@` reference, provides process steps and structured returns

**Template:**
- Purpose: Document structure for planning artifacts
- Examples: `get-shit-done/templates/project.md`, `get-shit-done/templates/summary.md`, `get-shit-done/templates/codebase/architecture.md`
- Pattern: Markdown with variable placeholders, guidelines section

**Planning Artifact:**
- Purpose: Project state files created in user's `.planning/` directory
- Examples: PROJECT.md, ROADMAP.md, STATE.md, *-PLAN.md, *-SUMMARY.md
- Pattern: Created from templates, tracked in git (by default)

## Entry Points

**NPX Installation:**
- Location: `bin/install.js`
- Triggers: `npx get-shit-done-cc` or `npx get-shit-done-cc@latest`
- Responsibilities: Interactive prompts, file deployment, settings configuration

**Slash Commands (post-install):**
- Location: `~/.claude/commands/gsd/*.md` (or equivalent for OpenCode/Gemini)
- Triggers: User types `/gsd:command` in AI runtime
- Responsibilities: Execute specific GSD workflow (new-project, plan-phase, execute-phase, etc.)

**Hooks:**
- Location: `~/.claude/hooks/gsd-statusline.js`, `~/.claude/hooks/gsd-check-update.js`
- Triggers: Claude Code session events (statusline refresh, session start)
- Responsibilities: Display context usage, check for updates

## Error Handling

**Strategy:** Errors propagate to user with actionable guidance; subagents return structured error states

**Patterns:**
- Installation errors: Console output with specific error and remediation steps
- Command execution errors: Present to user with options (retry, skip, manual intervention)
- Subagent failures: Orchestrator detects missing artifacts, offers recovery options
- Checkpoint blocking: User feedback loop until resolved or skipped
- Deviation rules: Auto-fix bugs/blockers, ask about architectural changes

## Cross-Cutting Concerns

**Git Integration:**
- Atomic commits per task (not per plan)
- Commit format: `{type}({phase}-{plan}): {description}`
- Never use `git add .` — stage files individually
- Branching strategy configurable (none/phase/milestone)

**Context Engineering:**
- Plans target ~50% context budget (stay in Claude's quality zone)
- Fresh context per subagent (200k tokens each)
- Orchestrator stays lean (~10-15% context)
- Wave-based parallel execution maximizes throughput

**Verification:**
- Must-haves derived via goal-backward methodology
- Automated verification checks codebase, not SUMMARY claims
- Human verification for visual/functional items
- Gap closure loop until all must-haves pass

**Model Profiles:**
- Three profiles: quality, balanced, budget
- Different models for planning vs execution vs verification
- Configurable in `.planning/config.json`

---

*Architecture analysis: 2026-02-05*
*Update when major patterns change*
