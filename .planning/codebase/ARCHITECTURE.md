# Architecture

**Analysis Date:** 2026-02-20

## Pattern Overview

**Overall:** Meta-Prompting / Context Engineering System

A markdown-based orchestration framework that extends AI coding assistants (Claude Code, OpenCode, Gemini CLI) with structured planning, execution, and verification workflows. The system uses markdown files as both configuration and executable prompts.

**Key Characteristics:**
- **Prompt-as-Code:** Commands, workflows, and agents are markdown files with YAML frontmatter
- **Subagent Orchestration:** Thin orchestrators spawn specialized agents via the `Task()` tool
- **File-Based State:** All state persists in `.planning/` directory as markdown/JSON
- **Runtime Agnostic:** Single codebase targets multiple AI runtimes with format conversion

## Layers

**Commands Layer:**
- Purpose: Entry points for user-invoked slash commands
- Location: `commands/gsd/*.md`
- Contains: Lightweight command definitions with YAML frontmatter, argument hints, tool permissions
- Depends on: Workflows layer (via `@` references)
- Used by: AI runtime command systems (Claude Code `/gsd:*`, OpenCode `/gsd-*`)

**Workflows Layer:**
- Purpose: Multi-step orchestration logic
- Location: `get-shit-done/workflows/*.md`
- Contains: Full workflow implementations with step-by-step processes, decision gates, state management
- Depends on: Templates, References, Agents, `gsd-tools.cjs`
- Used by: Commands layer

**Agents Layer:**
- Purpose: Specialized subagent prompts spawned by orchestrators
- Location: `agents/gsd-*.md`
- Contains: Full agent system prompts with roles, processes, deviation rules, output formats
- Depends on: Workflows, Templates, References
- Used by: Orchestrators via `Task()` tool

**Templates Layer:**
- Purpose: Document structure definitions
- Location: `get-shit-done/templates/*.md`
- Contains: Markdown templates for project artifacts (PLAN.md, SUMMARY.md, STATE.md, etc.)
- Depends on: Nothing
- Used by: Agents during document creation

**References Layer:**
- Purpose: Shared knowledge and patterns
- Location: `get-shit-done/references/*.md`
- Contains: Implementation patterns (checkpoints, TDD, git integration), configuration schemas, verification patterns
- Depends on: Nothing
- Used by: Agents, Workflows

**Tools Layer:**
- Purpose: JavaScript utilities for state manipulation and runtime operations
- Location: `get-shit-done/bin/gsd-tools.cjs`
- Contains: Bundled CommonJS module (~190KB) with state management, parsing, git operations
- Depends on: Node.js runtime
- Used by: Agents via bash calls

**Hooks Layer:**
- Purpose: Runtime integration (statusline, update checks)
- Location: `hooks/*.js`
- Contains: Node.js scripts triggered by AI runtime lifecycle events
- Depends on: Node.js runtime
- Used by: AI runtime hook system

**Installer Layer:**
- Purpose: Cross-runtime installation and configuration
- Location: `bin/install.js`
- Contains: Node.js installer that copies/converts files for target runtime
- Depends on: Node.js runtime
- Used by: `npx get-shit-done-cc`

## Data Flow

**Project Initialization Flow:**

1. User invokes `/gsd:new-project`
2. Command loads `workflows/new-project.md` via `@` reference
3. Workflow calls `gsd-tools.cjs init new-project` for state
4. Orchestrator spawns `gsd-project-researcher` agents (parallel)
5. Orchestrator spawns `gsd-research-synthesizer` for synthesis
6. Orchestrator spawns `gsd-roadmapper` for roadmap
7. Results written to `.planning/` directory
8. Git commit via `gsd-tools.cjs commit`

**Phase Execution Flow:**

1. User invokes `/gsd:execute-phase N`
2. Command loads `workflows/execute-phase.md`
3. Orchestrator calls `gsd-tools.cjs init execute-phase` and `phase-plan-index`
4. Plans grouped into execution waves based on dependencies
5. For each wave: spawn `gsd-executor` agents (parallel or sequential)
6. Executors create commits per task, write SUMMARY.md
7. Orchestrator spawns `gsd-verifier` for post-execution verification
8. State updates via `gsd-tools.cjs state *` commands

**State Management:**
- `.planning/STATE.md`: Project position, decisions, blockers, metrics
- `.planning/config.json`: Workflow preferences, model profiles
- `.planning/ROADMAP.md`: Phase structure and progress
- State mutations via `gsd-tools.cjs` to ensure consistency

## Key Abstractions

**Plan:**
- Purpose: Executable task specification optimized for AI implementation
- Examples: `.planning/phases/01-setup/01-01-PLAN.md`
- Pattern: Markdown with YAML frontmatter, XML task blocks, `@` file references

**Wave:**
- Purpose: Dependency-ordered grouping for parallel execution
- Examples: Wave 1 (no deps) -> Wave 2 (depends on Wave 1) -> Wave 3
- Pattern: Pre-computed at plan time, stored in `wave:` frontmatter

**Checkpoint:**
- Purpose: Controlled pause points requiring human interaction
- Examples: `checkpoint:human-verify`, `checkpoint:decision`, `checkpoint:human-action`
- Pattern: XML task type attribute, structured return format

**Deviation:**
- Purpose: Automatic handling of discovered work during execution
- Examples: Rule 1 (bugs), Rule 2 (missing functionality), Rule 3 (blockers), Rule 4 (architectural)
- Pattern: Rules 1-3 auto-fix, Rule 4 requires user decision

## Entry Points

**User Entry (Runtime Commands):**
- Location: `commands/gsd/*.md`
- Triggers: User types `/gsd:command-name` in AI runtime
- Responsibilities: Parse arguments, load workflow, present results

**Installer Entry:**
- Location: `bin/install.js`
- Triggers: `npx get-shit-done-cc` or `node bin/install.js`
- Responsibilities: Detect runtime, copy files, configure settings

**Hook Entry (Statusline):**
- Location: `hooks/gsd-statusline.js`
- Triggers: AI runtime polls for statusline content
- Responsibilities: Display model, task, context usage

**Hook Entry (Update Check):**
- Location: `hooks/gsd-check-update.js`
- Triggers: AI runtime session start
- Responsibilities: Check npm for newer version

## Error Handling

**Strategy:** Fail-fast with structured error messages at orchestrator level

**Patterns:**
- Init validation: `gsd-tools.cjs init` returns structured JSON with error states
- Phase validation: Check `phase_found`, `plan_count` before proceeding
- Self-check: Agents verify claims (files exist, commits exist) before completing
- Deviation rules: Auto-fix up to 3 attempts, then document and continue

## Cross-Cutting Concerns

**Logging:** Console output with branded formatting (see `references/ui-brand.md`)

**Validation:** Frontmatter parsing via `gsd-tools.cjs`, JSON schema for config

**Authentication:** Not applicable (system runs within authenticated AI runtime)

**State Persistence:** All state in `.planning/` directory, optionally git-tracked

**Model Selection:** Profile-based (`quality`, `balanced`, `budget`) with per-agent overrides

---

*Architecture analysis: 2026-02-20*
