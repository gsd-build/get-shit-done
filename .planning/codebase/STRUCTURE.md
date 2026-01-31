# Codebase Structure

**Analysis Date:** 2026-01-31

## Directory Layout

```
get-shit-done-together/
├── bin/                        # Installer and CLI entry point
│   └── install.js              # Main installer script
├── commands/
│   └── gsd/                    # Slash commands for Claude Code
│       ├── new-project.md      # Initialize PROJECT.md + ROADMAP.md
│       ├── plan-phase.md       # Create PLAN.md for a phase
│       ├── execute-phase.md    # Execute phase (spawn executor agent)
│       ├── map-codebase.md     # Analyze codebase (spawn mapper agents)
│       ├── research-phase.md   # Research domain (spawn researcher agents)
│       ├── verify-work.md      # Verify phase completion (spawn verifier)
│       ├── add-phase.md        # Add new phase to roadmap
│       ├── progress.md         # Show project progress
│       ├── pause-work.md       # Create .continue-here.md handoff
│       ├── resume-work.md      # Resume from .continue-here.md
│       ├── debug.md            # Debug issues (spawn debugger agent)
│       ├── check-todos.md      # View pending todos
│       ├── add-todo.md         # Add idea to pending todos
│       ├── settings.md         # Configure workflow settings
│       ├── set-profile.md      # Set model profile (quality/balanced/budget)
│       ├── help.md             # Show GSD help
│       └── [20+ other commands]
├── agents/                     # Subagents (specialized workers)
│   ├── gsd-planner.md          # Create PLAN.md from requirements + research
│   ├── gsd-executor.md         # Execute plans with atomic commits
│   ├── gsd-verifier.md         # Verify phase completion
│   ├── gsd-plan-checker.md     # Validate PLAN.md quality
│   ├── gsd-codebase-mapper.md  # Analyze codebase (parallel)
│   ├── gsd-phase-researcher.md # Research domain for phase
│   ├── gsd-project-researcher.md # Research project context
│   ├── gsd-debugger.md         # Systematic debugging with state
│   ├── gsd-integration-checker.md # Validate external integrations
│   ├── gsd-roadmapper.md       # Create ROADMAP.md structure
│   └── gsd-research-synthesizer.md # Synthesize research findings
├── hooks/                      # Claude Code session enhancements
│   ├── gsd-statusline.js       # Real-time status display in Claude Code UI
│   ├── gsd-check-update.js     # Check for GSD updates on session start
│   └── dist/                   # Built hooks (hooks/dist/ distributed with npm)
├── scripts/
│   └── build-hooks.js          # Copy hooks to dist/ for distribution
├── get-shit-done/              # Reference materials and templates
│   ├── references/             # Guidelines and patterns
│   │   ├── questioning.md      # Deep questioning techniques for requirements
│   │   ├── git-integration.md  # Git workflows and commit strategies
│   │   ├── tdd.md              # Test-driven development patterns
│   │   ├── model-profiles.md   # Agent model selection strategy
│   │   ├── planning-config.md  # Workflow configuration options
│   │   ├── continuation-format.md # Handoff file format (.continue-here.md)
│   │   ├── verification-patterns.md # How to verify work
│   │   ├── checkpoints.md      # Checkpoint protocol for pausing
│   │   └── ui-brand.md         # GSD UI/banner styles
│   ├── templates/              # Document templates
│   │   ├── project.md          # PROJECT.md template (vision + requirements)
│   │   ├── milestone.md        # MILESTONE.md template (roadmap phase)
│   │   ├── state.md            # STATE.md template (project memory)
│   │   ├── phase-prompt.md     # PHASE.md template (phase context)
│   │   ├── research.md         # RESEARCH.md template (domain research)
│   │   ├── roadmap.md          # ROADMAP.md template (phase structure)
│   │   ├── requirements.md     # REQUIREMENTS.md template (scoped needs)
│   │   ├── summary.md          # SUMMARY.md template (execution summary)
│   │   ├── verification-report.md # VERIFICATION.md template
│   │   ├── debug-subagent-prompt.md # DEBUG.md template
│   │   ├── continue-here.md    # .continue-here.md template
│   │   ├── config.json         # config.json template
│   │   ├── context.md          # CONTEXT.md template
│   │   ├── UAT.md              # User acceptance testing template
│   │   └── [more templates]
│   └── workflows/              # Procedural workflows
│       ├── map-codebase.md     # How to orchestrate parallel mappers
│       ├── execute-phase.md    # How to spawn executor agent
│       ├── execute-plan.md     # How executor handles task execution
│       ├── verify-phase.md     # How to verify phase completion
│       ├── discover-phase.md   # Phase discovery and research protocol
│       ├── transition.md       # How to move between phases
│       ├── resume-project.md   # Resume from .continue-here.md
│       └── [more workflows]
├── assets/                     # Images, logos, etc.
├── .github/
│   └── workflows/              # GitHub Actions CI/CD
├── package.json                # npm package metadata
├── pnpm-lock.yaml              # Dependency lock file
├── README.md                   # Project overview
├── CONTRIBUTING.md             # Contribution guidelines
├── CLAUDE.md                   # Developer guidance for this codebase
├── GSD-STYLE.md                # Style guide for GSD documents
├── CHANGELOG.md                # Version history
└── LICENSE                     # MIT license

```

## Directory Purposes

**`bin/`:**
- Purpose: Installer for multi-runtime deployment
- Contains: `install.js` (the main script invoked by `npx get-shit-done-together`)
- Key files: `bin/install.js` — Handles Claude Code, OpenCode, and Gemini CLI installation

**`commands/gsd/`:**
- Purpose: User-facing slash commands (entry points for workflows)
- Pattern: Each `.md` file is a command with YAML frontmatter declaring tools and description
- Organization: Named by function (new-project, plan-phase, execute-phase, etc.)
- Key files:
  - `commands/gsd/new-project.md` — Initialization entry point
  - `commands/gsd/plan-phase.md` — Planning orchestrator
  - `commands/gsd/execute-phase.md` — Execution orchestrator
  - `commands/gsd/map-codebase.md` — Codebase analysis orchestrator

**`agents/`:**
- Purpose: Specialized subagents spawned by commands (run in fresh context)
- Pattern: Each `.md` file is a subagent with YAML frontmatter and XML-structured prompt
- Organization: Named by specialty (gsd-planner, gsd-executor, gsd-debugger, etc.)
- Key files:
  - `agents/gsd-planner.md` — Creates PLAN.md files
  - `agents/gsd-executor.md` — Executes plans with atomic commits
  - `agents/gsd-codebase-mapper.md` — Analyzes codebase (4 parallel instances for different focuses)

**`hooks/`:**
- Purpose: Claude Code runtime enhancements
- Built to: `hooks/dist/` for distribution
- Contents:
  - `gsd-statusline.js` — Enhances Claude Code UI statusline with context usage + current task
  - `gsd-check-update.js` — Checks for GSD updates on session start
- Pattern: Hooks are Node.js scripts registered in Claude Code `settings.json` by installer

**`scripts/`:**
- Purpose: Build scripts
- Contents: `build-hooks.js` — Copies hooks from `hooks/` to `hooks/dist/` for npm packaging

**`get-shit-done/references/`:**
- Purpose: Shared knowledge and patterns
- Consumed by: All commands and agents include via `@path` syntax
- Key files:
  - `questioning.md` — Techniques for deep questioning
  - `model-profiles.md` — Agent model selection (Opus vs Sonnet vs Haiku)
  - `git-integration.md` — Git workflow patterns
  - `tdd.md` — Test-driven development approaches

**`get-shit-done/templates/`:**
- Purpose: Document templates for `.planning/` artifacts
- Pattern: Templates show structure + example content
- Key files:
  - `project.md` — PROJECT.md structure (vision, requirements, decisions)
  - `state.md` — STATE.md structure (project memory)
  - `milestone.md` — MILESTONE.md for roadmap phases
  - `config.json` — Configuration template

**`get-shit-done/workflows/`:**
- Purpose: Procedural decision trees for complex orchestration
- Consumed by: Commands include workflows and follow them step-by-step
- Key files:
  - `map-codebase.md` — Parallel mapper spawning logic
  - `execute-phase.md` — Executor agent spawning + result collection
  - `verify-phase.md` — Verification orchestration

## Key File Locations

**Entry Points:**
- `bin/install.js` — CLI entry point (invoked by `npx get-shit-done-together`)
- `commands/gsd/new-project.md` — Project initialization command
- `commands/gsd/plan-phase.md` — Phase planning command
- `commands/gsd/execute-phase.md` — Phase execution command

**Configuration:**
- `package.json` — Package metadata, entry point, build scripts
- `bin/install.js` — Multi-runtime installation logic
- `get-shit-done/templates/config.json` — Default workflow configuration template

**Core Logic:**
- `agents/gsd-planner.md` — Planning intelligence
- `agents/gsd-executor.md` — Execution logic with atomic commits
- `agents/gsd-codebase-mapper.md` — Codebase analysis
- `commands/gsd/new-project.md` — Project initialization orchestration
- `commands/gsd/plan-phase.md` — Planning orchestration

**Testing:**
- No dedicated test directory; testing patterns documented in `get-shit-done/references/tdd.md`
- Hooks tested manually in Claude Code runtime

## Naming Conventions

**Files:**
- Commands: `commands/gsd/{command-name}.md` (lowercase, hyphens)
  - Examples: `new-project.md`, `plan-phase.md`, `execute-phase.md`
- Agents: `agents/gsd-{agent-name}.md` (prefix `gsd-`, lowercase, hyphens)
  - Examples: `gsd-planner.md`, `gsd-executor.md`, `gsd-debugger.md`
- Hooks: `hooks/gsd-{hook-name}.js` (prefix `gsd-`, lowercase, hyphens)
  - Examples: `gsd-statusline.js`, `gsd-check-update.js`
- Templates: `get-shit-done/templates/{template-name}.md` (lowercase, descriptive)
  - Examples: `project.md`, `state.md`, `roadmap.md`
- References: `get-shit-done/references/{topic}.md` (lowercase, descriptive)
  - Examples: `questioning.md`, `git-integration.md`, `model-profiles.md`

**Directories:**
- Pattern: Lowercase, hyphens, descriptive purpose
- Examples:
  - `commands/gsd/` — All commands in one directory (organized by name)
  - `agents/` — All agents in one directory (organized by name)
  - `hooks/` — All hooks; `hooks/dist/` for distribution
  - `get-shit-done/references/` — Reference materials
  - `get-shit-done/templates/` — Reusable templates
  - `get-shit-done/workflows/` — Procedural workflows

## Where to Add New Code

**New Command:**
- Location: `commands/gsd/{command-name}.md`
- Pattern:
  1. Copy command template (e.g., `pause-work.md`)
  2. Update frontmatter: `name:`, `description:`, `allowed-tools:`
  3. Write `<objective>`, `<execution_context>`, `<process>`, `<success_criteria>` sections
  4. Include workflow via `@path` syntax if complex orchestration needed
- Example: New command `/gsd:my-command` → `commands/gsd/my-command.md`

**New Subagent:**
- Location: `agents/gsd-{agent-name}.md`
- Pattern:
  1. Copy agent template (e.g., `gsd-executor.md`)
  2. Update frontmatter: `name:`, `description:`, `tools:`, `color:`
  3. Write `<role>`, `<process>`, `<success_criteria>` sections using XML tags
  4. Agents are spawned by commands; don't call agents from agents
- Example: New agent to specialize in refactoring → `agents/gsd-refactorer.md`

**New Hook:**
- Location: `hooks/gsd-{hook-name}.js`
- Pattern:
  1. Write Node.js script that reads stdin (JSON context from Claude Code)
  2. Output to stdout (text displayed in UI)
  3. Register in installer: Modify `bin/install.js` to include hook registration
  4. Copy hook to dist: Modify `scripts/build-hooks.js` to copy new hook
- Example: New hook to show AI suggestions → `hooks/gsd-suggestions.js`

**New Workflow:**
- Location: `get-shit-done/workflows/{workflow-name}.md`
- Pattern:
  1. Follow XML structure: `<purpose>`, `<process>`, `<step>` tags
  2. Document each decision point and branching logic
  3. Reference templates and references via `@path` syntax
  4. Include bash commands that orchestrators will execute
- Example: New complex orchestration for "parallel phase execution" → `get-shit-done/workflows/parallel-phases.md`

**New Template:**
- Location: `get-shit-done/templates/{template-name}.md`
- Pattern:
  1. Show actual template structure with markdown formatting
  2. Include `<purpose>`, `<lifecycle>`, `<sections>` documentation
  3. Explain when and how to use the template
- Example: New template for "UAT checklist" → `get-shit-done/templates/uat-checklist.md`

**New Reference:**
- Location: `get-shit-done/references/{topic}.md`
- Pattern:
  1. Document patterns, techniques, or guidelines
  2. Include practical examples from actual codebase (with `file_path` context)
  3. Explain rationale and when to apply
- Example: New reference for "API design patterns" → `get-shit-done/references/api-patterns.md`

## Special Directories

**`.planning/` (User Projects):**
- Purpose: Project artifacts created by GSD commands in user's workspace
- Generated: Yes (created by `/gsd:new-project`)
- Committed: Yes (default; controlled by `config.json`)
- Structure:
  ```
  .planning/
  ├── PROJECT.md             # Vision, requirements, decisions
  ├── ROADMAP.md             # Phase structure
  ├── STATE.md               # Project memory (position, metrics)
  ├── REQUIREMENTS.md        # Scoped requirements
  ├── config.json            # Workflow configuration
  ├── codebase/              # Codebase analysis (from gsd-codebase-mapper)
  │   ├── STACK.md
  │   ├── INTEGRATIONS.md
  │   ├── ARCHITECTURE.md
  │   ├── STRUCTURE.md
  │   ├── CONVENTIONS.md
  │   ├── TESTING.md
  │   └── CONCERNS.md
  ├── research/              # Domain research artifacts
  │   └── {topic}-RESEARCH.md
  └── phases/                # Per-phase execution artifacts
      ├── 01-setup/
      │   ├── PLAN.md
      │   ├── SUMMARY.md
      │   └── .continue-here.md (if paused)
      ├── 02-backend/
      │   ├── PLAN.md
      │   └── SUMMARY.md
      └── [more phases]
  ```
- Not committed: `.planning/todos/` (user ideas captured during execution)

**`hooks/dist/` (Built Hooks):**
- Purpose: Distribution package for npm
- Generated: Yes (by `pnpm run build:hooks`)
- Committed: Yes
- Contents: Copies of hooks from `hooks/` directory

**`.github/workflows/` (CI/CD):**
- Purpose: Automated checks and deployment
- Contents: GitHub Actions workflows
- Not part of runtime; used for development

---

*Structure analysis: 2026-01-31*
