# Codebase Structure

**Analysis Date:** 2026-02-01

## Directory Layout

```bash
get-shit-done/
├── bin/                        # Installation bootstrap
│   └── install.js             # Multi-runtime installer (1,446 lines)
├── agents/                     # Specialized workflow agents (11 files)
│   ├── gsd-planner.md         # Creates executable phase plans
│   ├── gsd-executor.md        # Executes plans atomically
│   ├── gsd-debugger.md        # Systematic debugging
│   ├── gsd-codebase-mapper.md # Maps existing codebases
│   ├── gsd-verifier.md        # Validates completed work
│   └── gsd-*.md               # (6 more agents)
├── commands/                   # CLI command definitions (28 commands)
│   └── gsd/
│       ├── help.md            # Command reference
│       ├── plan-phase.md      # Phase planning entry point
│       ├── execute-phase.md   # Phase execution entry point
│       ├── new-project.md     # Project initialization
│       └── gsd-*.md           # (24 more commands)
├── hooks/                      # Runtime integration hooks
│   ├── gsd-statusline.js      # Status bar display (Node.js)
│   ├── gsd-check-update.js    # Update checker hook
│   └── dist/                  # Pre-built hooks for distribution
├── scripts/                    # Build scripts
│   └── build-hooks.js         # Copy hooks to dist/
├── get-shit-done/             # Reference material & templates
│   ├── references/            # Shared knowledge (10 files)
│   │   ├── git-integration.md
│   │   ├── checkpoints.md
│   │   ├── tdd.md
│   │   └── *.md               # (7 more)
│   ├── templates/             # Artifact templates (23 files)
│   │   ├── phase-prompt.md    # PLAN.md structure template
│   │   ├── summary.md         # SUMMARY.md template
│   │   ├── context.md         # CONTEXT.md template
│   │   └── *.md               # (20 more)
│   └── workflows/             # Reusable process definitions (14 files)
│       ├── execute-phase.md   # Phase execution workflow
│       ├── execute-plan.md    # Single plan execution
│       ├── map-codebase.md    # Codebase analysis workflow
│       └── *.md               # (11 more)
├── .planning/                 # Project artifacts (generated during use)
│   └── codebase/              # Codebase analysis output (generated)
├── package.json               # NPM metadata + build scripts
├── bin/install.js             # CLI entry point
└── README.md                   # User documentation
```

## Directory Purposes

**`bin/`:**
- Purpose: Package CLI entry point and installer
- Contains: Single Node.js script that handles installation/uninstall
- Key files: `install.js` - Multi-runtime installer supporting Claude Code, OpenCode, Gemini

**`agents/`:**
- Purpose: Specialized agents for distinct lifecycle phases
- Contains: 11 .md files with YAML frontmatter + role definition + process steps
- Files represent: Planner, executor, debugger, verifier, researchers, checkers
- Pattern: Each agent is self-contained with role + philosophy + discovery + process steps

**`commands/`:**
- Purpose: User-facing command definitions
- Contains: 28 .md files representing 28 CLI commands
- Pattern: Each command has YAML frontmatter (name, description, tools) + objective + reference content
- Naming: Files use hyphenated names matching command names (e.g., `plan-phase.md` → `/gsd:plan-phase`)
- Subdirectories: `commands/gsd/` groups all GSD commands (flat structure, not nested)

**`hooks/`:**
- Purpose: Runtime integration points for Claude Code / OpenCode / Gemini
- Contains: 2 Node.js hook implementations
- Key files:
  - `gsd-statusline.js` - Reads Claude Code context, renders status bar
  - `gsd-check-update.js` - Checks for new GSD versions
- Build output: `dist/` directory copied to runtime config during installation

**`scripts/`:**
- Purpose: Build and maintenance scripts
- Contains: `build-hooks.js` - Copies hooks to `dist/` for npm distribution
- Run via: `npm run build:hooks` (called by prepublishOnly)

**`get-shit-done/references/`:**
- Purpose: Shared knowledge and best practices
- Contains: 10 markdown files covering patterns, methodology, integration
- Key files:
  - `git-integration.md` - Git commit patterns and atomic commits
  - `checkpoints.md` - Checkpoint task patterns (decision, human-verify)
  - `tdd.md` - Testing methodology
  - `model-profiles.md` - Model selection guidance
  - `skill-integration.md` - Custom skill configuration
  - `questioning.md` - Discovery questioning patterns
  - `ui-brand.md` - UI design system guidelines
  - `verification-patterns.md` - Verification strategies
  - `planning-config.md` - Config.json options
  - `continuation-format.md` - Session continuation format

**`get-shit-done/templates/`:**
- Purpose: Artifact templates for project lifecycle
- Contains: 23 markdown files defining output structure
- Key files:
  - `phase-prompt.md` - Template for PLAN.md files (executable prompts)
  - `summary.md` - Template for SUMMARY.md (outcome reports)
  - `context.md` - Template for CONTEXT.md (phase vision)
  - `requirements.md` - Template for REQUIREMENTS.md (scoped work)
  - `debug-subagent-prompt.md` - Debug session structure
  - `UAT.md` - User acceptance testing template
  - `user-setup.md` - Human-required setup checklist
  - Additional codebase analysis templates (STACK.md, ARCHITECTURE.md, etc.)

**`get-shit-done/workflows/`:**
- Purpose: Reusable workflow definitions for complex operations
- Contains: 14 markdown files defining step-by-step processes
- Key files:
  - `execute-phase.md` - Orchestration of phase execution (wave management, branching, progress)
  - `execute-plan.md` - Single plan execution with checkpoints
  - `map-codebase.md` - Codebase analysis workflow
  - `discover-phase.md` - Phase discovery and planning
  - `verify-phase.md` - Verification workflow
  - `diagnose-issues.md` - Debugging workflow
  - Others: resume, transition, complete-milestone workflows

**`.planning/`:**
- Purpose: Project runtime state and artifacts
- Generated by: `/gsd:new-project`, `/gsd:plan-phase`, `/gsd:execute-phase`
- Contains: PROJECT.md, ROADMAP.md, STATE.md, config.json, phases/, codebase/, debug/, todos/
- Committed to git: By default (controlled by `config.json`)
- Ignored by git: Optional (when `commit_docs: false`)

## Key File Locations

**Entry Points:**
- `bin/install.js` - CLI installation bootstrap (invoked via `npx get-shit-done-cc`)
- `commands/gsd/help.md` - User reference (invoked via `/gsd:help`)
- `agents/gsd-*.md` - Specialized agents spawned by orchestrators

**Configuration:**
- `package.json` - NPM metadata, build scripts, bin declaration
- `.planning/config.json` - Runtime configuration (model profiles, workflow mode, branching strategy)
- `get-shit-done/references/planning-config.md` - Configuration option documentation

**Core Logic:**
- `agents/gsd-planner.md` - Phase decomposition and planning logic (2,000+ lines)
- `agents/gsd-executor.md` - Task execution and atomic commits (2,000+ lines)
- `agents/gsd-project-researcher.md` - Project discovery (2,000+ lines)
- `get-shit-done/workflows/execute-phase.md` - Phase orchestration (400+ lines)

**Testing & Verification:**
- `get-shit-done/references/tdd.md` - Testing approach and patterns
- `get-shit-done/references/verification-patterns.md` - Verification strategies
- `agents/gsd-verifier.md` - Work validation agent

**Documentation & Reference:**
- `README.md` - User-facing project overview
- `CHANGELOG.md` - Version history
- `CONTRIBUTING.md` - Development guide
- `GSD-STYLE.md` - Writing and methodology style guide
- `get-shit-done/references/` - Internal knowledge base

## Naming Conventions

**Files:**
- Commands: `hyphen-separated.md` (e.g., `plan-phase.md` → `/gsd:plan-phase`)
- Agents: `gsd-role-name.md` (e.g., `gsd-planner.md`)
- Workflows: `workflow-name.md` (e.g., `execute-phase.md`)
- Planning artifacts: `NN-name/NN-YY-TYPE.md` (e.g., `01-foundation/01-01-PLAN.md`)

**Directories:**
- Phase directories: `NN-phase-name` (zero-padded, e.g., `01-foundation`, `02-core-features`)
- Workflow directories: kebab-case (e.g., `get-shit-done/`, `.planning/`)
- Agent role files: `gsd-` prefix + role name (e.g., `gsd-planner`, `gsd-executor`)

**Variable Naming (in scripts/workflows):**
- Constants: `UPPERCASE` (e.g., `PHASE_DIR`, `PLAN_START_TIME`)
- Functions: `snake_case` (e.g., `build_plan()`, `execute_task()`)
- Config keys: `snake_case_json` (e.g., `model_profile`, `commit_docs`)

## Where to Add New Code

**New Command:**
- Primary code: `commands/gsd/new-command-name.md`
- Pattern: Copy structure from existing command (e.g., `help.md`)
- Frontmatter: `name`, `description`, `tools` list
- Content: `<objective>`, `<reference>` sections
- Reference: Use `@`-style includes for `.planning/` and `get-shit-done/` files

**New Agent:**
- Primary code: `agents/gsd-role-name.md`
- Pattern: Copy structure from `gsd-planner.md` or `gsd-executor.md`
- Frontmatter: `name`, `description`, `tools` list, `color`
- Content: `<role>`, `<philosophy>`, process `<step>` blocks
- Spawning: Invoked by orchestrator via Task tool with appropriate model

**New Workflow:**
- Primary code: `get-shit-done/workflows/workflow-name.md`
- Pattern: Sequential `<step>` blocks with conditionals
- Reference: Link to relevant agents and templates
- Publishing: Reference in orchestrator agents that use it

**New Reference/Template:**
- Reference: `get-shit-done/references/topic-name.md` (for shared knowledge)
- Template: `get-shit-done/templates/artifact-type.md` (for output structure)
- Usage: Referenced via `@`-includes from agents and commands

**New Hook:**
- Primary code: `hooks/new-hook-name.js`
- Build: Add to `HOOKS_TO_COPY` array in `scripts/build-hooks.js`
- Build command: `npm run build:hooks`
- Distribution: Copied to `hooks/dist/` and installed to runtime config

## Special Directories

**`.planning/` (Project Runtime State):**
- Purpose: Persistent project context and artifacts
- Generated: By commands and orchestrators during execution
- Committed: To git by default (configurable)
- Key subdirectories:
  - `phases/` - Phase plans and summaries
  - `codebase/` - Brownfield codebase analysis
  - `debug/` - Persistent debug session state
  - `todos/` - Captured ideas and tasks
  - `research/` - Domain research artifacts
- Files: PROJECT.md, ROADMAP.md, STATE.md, config.json, REQUIREMENTS.md

**`hooks/dist/` (Built Hooks):**
- Purpose: Distribution bundle for installation
- Generated: By `npm run build:hooks`
- Contents: Compiled/copied hooks ready for npm package
- Installed to: Runtime config directories (`~/.claude/hooks`, `~/.config/opencode/hooks`, etc.)

**`get-shit-done/` (Reference Knowledge):**
- Purpose: Shared knowledge, patterns, templates
- Not generated: Committed to repo
- Contents: Reusable definitions referenced by agents/commands
- Updated: As methodology evolves

## Integration Points

**Runtime Installation:**
- Entry: `bin/install.js` (NPM script `get-shit-done-cc`)
- Output: Copies agents, commands, hooks to runtime config directories
- Targets: `~/.claude`, `~/.config/opencode`, `~/.gemini`
- Multi-runtime: Supports Claude Code, OpenCode, Gemini with format conversion

**Project Initialization:**
- Entry: `/gsd:new-project` command
- Spawns: `gsd-project-researcher` and `gsd-planner` agents
- Output: Creates `.planning/` directory with PROJECT.md, ROADMAP.md, STATE.md, config.json

**Phase Execution:**
- Entry: `/gsd:execute-phase N` command
- Orchestrator: `gsd-executor` agent loads and runs plans
- Wave management: Groups plans by dependency, executes sequentially by wave
- Output: SUMMARY.md per plan, STATE.md updated

**Git Integration:**
- Commits: Per-task atomic commits via executor
- Reference: `get-shit-done/references/git-integration.md`
- Config: Branching strategy in `config.json` (none, phase, milestone)

---

*Structure analysis: 2026-02-01*
