# Architecture

**Analysis Date:** 2025-01-27

## Pattern Overview

**Overall:** Multi-runtime meta-prompting system with CLI tools, markdown-driven workflows, and agent orchestration

**Key Characteristics:**
- **Prompt-as-code:** Workflows, commands, agents, and templates are all Markdown files with embedded XML and bash — consumed by AI coding assistants at runtime
- **CLI tooling layer:** A Node.js CLI (`gsd-tools.cjs`) provides atomic operations (state management, phase CRUD, verification, git commits) that workflows invoke via `node gsd-tools.cjs <command>`
- **Multi-runtime support:** Identical content ships to Claude Code (`~/.claude/`), GitHub Copilot (`.github/`), OpenCode (`.opencode/`), Gemini (`.gemini/`), and Codex (`.codex/`) via an installer
- **Markdown-as-state:** All project state lives in `.planning/` directory as Markdown files with YAML frontmatter — no database, no server
- **Orchestrator → Subagent delegation:** Complex commands (e.g., execute-phase) run as orchestrators that spawn specialized subagents via the AI assistant's `Task` tool

## Layers

**1. Installer Layer:**
- Purpose: Installs GSD files into target AI assistant's config directories
- Location: `bin/install.js`
- Contains: Runtime detection, file copying, hook registration, uninstall logic
- Depends on: `package.json` for version, `get-shit-done/` for source files, `agents/` for agent definitions, `hooks/` for hook scripts
- Used by: npm (`npx get-shit-done-cc@latest`)

**2. Command Definitions Layer:**
- Purpose: Define slash commands that users invoke in their AI assistant (e.g., `/gsd:execute-phase 3`)
- Location: `commands/gsd/*.md` (Claude Code format), `.github/skills/gsd-*/*.md` (GitHub Copilot format)
- Contains: Command metadata (name, description, allowed-tools), objective, execution_context references, process delegation to workflows
- Depends on: Workflow files (via `@` file references)
- Used by: AI assistants at runtime when user invokes a command

**3. Workflow Layer:**
- Purpose: Define multi-step orchestration procedures that commands execute
- Location: `get-shit-done/workflows/*.md`
- Contains: Step-by-step processes with bash snippets calling `gsd-tools.cjs`, subagent spawning patterns, decision gates, state updates
- Depends on: `gsd-tools.cjs` CLI, agent definitions, template files, reference documents
- Used by: Command definitions (linked via `@~/.claude/get-shit-done/workflows/...`)

**4. Agent Definitions Layer:**
- Purpose: Define specialized AI agent roles with system prompts, tools, and execution patterns
- Location: `agents/*.md` (Claude Code format), `.github/agents/*.agent.md` (GitHub Copilot format)
- Contains: Role descriptions, tool permissions, execution flows, context loading patterns
- Depends on: `gsd-tools.cjs` for initialization, `.planning/` state files
- Used by: Workflow orchestrators that spawn agents via `Task` tool

**5. CLI Tools Layer (gsd-tools):**
- Purpose: Provide deterministic, atomic operations for workflow steps — eliminates fragile bash+regex patterns from AI prompts
- Location: `get-shit-done/bin/gsd-tools.cjs` (entry), `get-shit-done/bin/lib/*.cjs` (modules)
- Contains: CLI router, 11 library modules (core, state, phase, roadmap, verify, config, template, milestone, commands, init, frontmatter)
- Depends on: Node.js ≥16.7, filesystem (`fs`), `child_process` for git
- Used by: Workflows and agents via `node gsd-tools.cjs <command> [args]`

**6. Reference Documents Layer:**
- Purpose: Provide static reference material that workflows and agents load for context
- Location: `get-shit-done/references/*.md`
- Contains: Git integration patterns, model profiles, UI branding rules, verification patterns, TDD patterns, phase calculation rules
- Depends on: Nothing (static)
- Used by: Workflows and agents via `@~/.claude/get-shit-done/references/...`

**7. Templates Layer:**
- Purpose: Define file structures for planning documents created during workflows
- Location: `get-shit-done/templates/*.md`, `get-shit-done/templates/codebase/*.md`
- Contains: Templates for PROJECT.md, ROADMAP.md, STATE.md, PLAN.md, SUMMARY.md, REQUIREMENTS.md, etc.
- Depends on: Nothing (static)
- Used by: Workflows (new-project, plan-phase), `gsd-tools template fill` command

**8. Hooks Layer:**
- Purpose: Provide runtime hooks for Claude Code (statusline, context monitoring, update checking)
- Location: `hooks/*.js`, built to `hooks/dist/*.js`
- Contains: PostToolUse hook (context monitor), Notification hook (statusline), SessionStart hook (update checker)
- Depends on: Claude Code hook system, `/tmp/` for IPC between hooks
- Used by: Claude Code runtime (registered during install)

## Data Flow

**Project Initialization (`/gsd:new-project`):**

1. User invokes `/gsd:new-project` → command definition loads workflow
2. Workflow calls `gsd-tools init new-project` → JSON with environment state
3. Orchestrator asks user questions → creates `.planning/PROJECT.md`
4. Spawns research subagent (optional) → creates `.planning/research/`
5. Creates `.planning/REQUIREMENTS.md` from research + user input
6. Spawns roadmapper subagent → creates `.planning/ROADMAP.md`
7. Creates `.planning/STATE.md` and `.planning/config.json`
8. Commits to git via `gsd-tools commit`

**Phase Planning (`/gsd:plan-phase N`):**

1. Workflow calls `gsd-tools init plan-phase N` → JSON with phase context
2. Optionally spawns `gsd-phase-researcher` subagent → creates `NN-RESEARCH.md`
3. Spawns `gsd-planner` subagent → creates `NN-MM-PLAN.md` files with XML task definitions
4. Optionally spawns `gsd-plan-checker` subagent → validates plans, may trigger revision loop (max 3 iterations)
5. Updates STATE.md via `gsd-tools state patch`
6. Commits to git

**Phase Execution (`/gsd:execute-phase N`):**

1. Workflow calls `gsd-tools init execute-phase N` → JSON with plans, models, config
2. Calls `gsd-tools phase-plan-index N` → wave grouping of plans
3. For each wave (sequential): spawns `gsd-executor` subagents (parallel within wave)
4. Each executor: reads PLAN.md → executes tasks → commits per task → creates SUMMARY.md
5. Orchestrator collects results, updates STATE.md, advances to next wave
6. Optionally spawns `gsd-verifier` subagent for end-of-phase verification

**State Management:**
- All state lives in `.planning/STATE.md` with YAML frontmatter (machine-readable) and Markdown body (human-readable)
- `gsd-tools state` commands read/write STATE.md with automatic frontmatter sync
- `writeStateMd()` always rebuilds YAML frontmatter from Markdown body fields before writing
- Config stored in `.planning/config.json` with defaults, loaded via `loadConfig(cwd)`

## Key Abstractions

**Phase:**
- Purpose: A milestone-scoped unit of work (e.g., "Setup authentication")
- Examples: `.planning/phases/01-setup/`, `.planning/phases/02-auth/`
- Pattern: Directory named `NN-slug` containing PLAN.md, SUMMARY.md, RESEARCH.md, CONTEXT.md, VERIFICATION.md files
- Operations: find, add, insert (decimal), remove (with renumber), complete → all in `get-shit-done/bin/lib/phase.cjs`

**Plan:**
- Purpose: An executable unit within a phase — a single-session task for a subagent
- Examples: `.planning/phases/01-setup/01-01-PLAN.md`, `.planning/phases/01-setup/01-02-PLAN.md`
- Pattern: YAML frontmatter (phase, plan, wave, depends_on, files_modified, autonomous, must_haves) + XML `<task>` elements in body
- Grouping: Plans group into waves (frontmatter `wave` field). Wave 1 runs first, wave 2 after all wave 1 complete

**Summary:**
- Purpose: Execution record for a completed plan — evidence that work was done
- Examples: `.planning/phases/01-setup/01-01-SUMMARY.md`
- Pattern: YAML frontmatter (one-liner, key-files, tech-stack, patterns-established, key-decisions) + Markdown body with commits, files, decisions

**Milestone:**
- Purpose: A versioned release boundary grouping multiple phases
- Pattern: Version info extracted from ROADMAP.md headings (e.g., `## v1.0: MVP`)
- Operations: `milestone complete` archives ROADMAP.md, REQUIREMENTS.md, optionally phase directories to `.planning/milestones/`

**Init Commands:**
- Purpose: Compound context-loading operations that gather all needed state for a workflow in a single CLI call
- Examples: `gsd-tools init execute-phase 3`, `gsd-tools init plan-phase 2`
- Pattern: Each returns a JSON object with models, config flags, phase info, file paths, computed values (branch names, slugs, etc.)
- Rationale: Replaces multiple sequential tool calls in AI context with one atomic call

## Entry Points

**npm install entry (`bin/install.js`):**
- Location: `bin/install.js`
- Triggers: `npx get-shit-done-cc@latest` or `npm install -g get-shit-done-cc`
- Responsibilities: Interactive runtime selection, file copy to `~/.claude/`, `~/.opencode/`, `~/.gemini/`, `~/.codex/`, `.github/` (local), hook registration, agent registration

**CLI tools entry (`get-shit-done/bin/gsd-tools.cjs`):**
- Location: `get-shit-done/bin/gsd-tools.cjs`
- Triggers: `node gsd-tools.cjs <command> [args] [--raw] [--cwd <path>]`
- Responsibilities: Parse CLI args, route to module commands, output JSON or raw values, handle `--cwd` for subagent sandboxing

**Command definitions (per-runtime):**
- Location: `commands/gsd/*.md` (Claude Code), `.github/skills/gsd-*/*.md` (GitHub Copilot)
- Triggers: User types `/gsd:<command>` in AI assistant
- Responsibilities: Load execution_context files, delegate to workflow

## Error Handling

**Strategy:** Fail-fast with descriptive errors, output JSON for programmatic consumers

**Patterns:**
- `error(message)` in `core.cjs`: writes to stderr, exits with code 1
- `output(result, raw, rawValue)` in `core.cjs`: writes JSON to stdout (or raw string if `--raw`), exits with code 0
- Large JSON output (>50KB): writes to tmpfile, outputs `@file:<path>` prefix for callers to detect
- Workflows check init JSON fields (`phase_found`, `state_exists`, etc.) and provide user-facing error messages
- `validate health --repair` can auto-fix common issues (missing config.json, corrupt STATE.md)

## Cross-Cutting Concerns

**Git Integration:**
- `gsd-tools commit` stages `.planning/` and commits with configurable messages
- Respects `commit_docs` config flag (skip commits if false)
- Checks if `.planning` is gitignored before attempting commit
- Branching strategies: `none` (default), `phase` (branch per phase), `milestone` (branch per milestone)

**Model Resolution:**
- `core.cjs` contains `MODEL_PROFILES` table mapping agent types × profiles (quality/balanced/budget) to model names (opus/sonnet/haiku)
- Per-agent overrides available via `config.json` `model_overrides`
- `resolveModelInternal()` checks override → profile lookup → default to sonnet

**State Frontmatter Sync:**
- Every STATE.md write goes through `writeStateMd()` in `state.cjs`
- Rebuilds YAML frontmatter from Markdown body fields (current_phase, status, progress, etc.)
- Ensures machine-readable state is always in sync with human-readable content

**Context Budget Management:**
- Hooks layer: statusline shows context usage, context monitor injects warnings when remaining < 35%
- Architectural: orchestrators stay lean (~15% context), subagents get fresh 100% context
- Init commands: minimize tool calls by batching all context into one JSON response

---

*Architecture analysis: 2025-01-27*
