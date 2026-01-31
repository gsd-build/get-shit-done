# Codebase Structure

**Analysis Date:** 2026-01-31

## Directory Layout
```
get-shit-done/
├── bin/                    # Installation entry point
│   └── install.js          # Cross-runtime installer
├── commands/               # User-facing slash commands
│   └── gsd/               # GSD command namespace
│       ├── new-project.md
│       ├── plan-phase.md
│       ├── execute-phase.md
│       └── [25+ commands]
├── agents/                 # Specialized AI agent definitions
│   ├── gsd-planner.md
│   ├── gsd-executor.md
│   ├── gsd-verifier.md
│   └── [11 total agents]
├── get-shit-done/         # Core system components
│   ├── workflows/         # Orchestrator workflows
│   │   ├── execute-phase.md
│   │   ├── plan-phase.md
│   │   └── [10+ workflows]
│   ├── templates/         # Document/prompt templates
│   │   ├── project.md
│   │   ├── phase-prompt.md
│   │   └── [20+ templates]
│   └── references/        # Domain knowledge
│       ├── planning-config.md
│       ├── tdd.md
│       └── [8 references]
├── hooks/                 # Runtime integration hooks
│   ├── gsd-statusline.js
│   ├── gsd-check-update.js
│   └── dist/              # Built hooks (bundled)
├── scripts/               # Build utilities
│   └── build-hooks.js     # Hook bundler
├── assets/                # Static assets
│   ├── gsd-logo-*.png
│   └── terminal.svg
├── .github/               # GitHub config
│   ├── FUNDING.yml
│   └── pull_request_template.md
└── [root files]           # package.json, README.md, etc.
```

## Directory Purposes

**`bin/`:**
- Purpose: Installation and deployment logic
- Key files: `install.js` (49359 bytes, handles Claude/OpenCode/Gemini installation)
- Responsibilities: File copying, path replacement, frontmatter conversion, hook registration

**`commands/gsd/`:**
- Purpose: User-facing slash command definitions
- Key files: `new-project.md`, `plan-phase.md`, `execute-phase.md`, `verify-work.md`, `quick.md`
- Responsibilities: Parse user input, validate project state, invoke workflows, handle errors
- Naming: Commands use kebab-case (e.g., `new-project.md`, `plan-phase.md`)

**`agents/`:**
- Purpose: Specialized AI agent prompt definitions
- Key files: `gsd-planner.md`, `gsd-executor.md`, `gsd-verifier.md`, `gsd-debugger.md`
- Responsibilities: Define agent behavior, tool access, execution patterns
- Naming: All agents prefixed with `gsd-` (e.g., `gsd-planner.md`)
- Count: 11 agents total

**`get-shit-done/workflows/`:**
- Purpose: Orchestrator workflows that coordinate agents
- Key files: `execute-phase.md`, `plan-phase.md`, `verify-work.md`, `map-codebase.md`
- Responsibilities: Discover plans/phases, analyze dependencies, spawn agents, aggregate results
- Pattern: Each workflow defines step-by-step orchestration process

**`get-shit-done/templates/`:**
- Purpose: Reusable document and prompt templates
- Key files: `project.md`, `phase-prompt.md`, `planner-subagent-prompt.md`, `requirements.md`
- Responsibilities: Standardize output formats, provide context scaffolding
- Subdirectories: `codebase/` (codebase mapping templates), `research-project/` (research templates)

**`get-shit-done/references/`:**
- Purpose: Domain knowledge and best practices
- Key files: `planning-config.md`, `tdd.md`, `verification-patterns.md`, `model-profiles.md`
- Responsibilities: Provide guidelines, patterns, reference material for agents

**`hooks/`:**
- Purpose: Runtime integration hooks
- Key files: `gsd-statusline.js`, `gsd-check-update.js`
- Responsibilities: Display project state, check for updates, integrate with runtime UI
- Build: `scripts/build-hooks.js` copies hooks to `hooks/dist/` for installation

**`scripts/`:**
- Purpose: Build and utility scripts
- Key files: `build-hooks.js` (copies hooks to dist for bundling)
- Responsibilities: Pre-publish preparation, hook bundling

**`assets/`:**
- Purpose: Static assets (logos, images)
- Key files: `gsd-logo-2000.png`, `gsd-logo-2000.svg`, `terminal.svg`
- Usage: README.md, documentation

## File Naming Conventions

**Commands:**
- Format: `kebab-case.md` (e.g., `new-project.md`, `plan-phase.md`)
- Location: `commands/gsd/`
- Pattern: Verb-noun pairs describing action

**Agents:**
- Format: `gsd-{role}.md` (e.g., `gsd-planner.md`, `gsd-executor.md`)
- Location: `agents/`
- Pattern: All prefixed with `gsd-`, role describes function

**Workflows:**
- Format: `{action}-{target}.md` (e.g., `execute-phase.md`, `plan-phase.md`)
- Location: `get-shit-done/workflows/`
- Pattern: Action verb + target noun

**Templates:**
- Format: `{document-type}.md` (e.g., `project.md`, `requirements.md`)
- Location: `get-shit-done/templates/`
- Pattern: Describes output document type

**Hooks:**
- Format: `gsd-{function}.js` (e.g., `gsd-statusline.js`, `gsd-check-update.js`)
- Location: `hooks/`
- Pattern: All prefixed with `gsd-`, function describes purpose

## Key File Locations

**Installation:**
- `bin/install.js` - Main installer (49359 bytes, handles all runtimes)

**Core Commands:**
- `commands/gsd/new-project.md` - Project initialization
- `commands/gsd/plan-phase.md` - Phase planning
- `commands/gsd/execute-phase.md` - Phase execution
- `commands/gsd/verify-work.md` - Work verification

**Core Agents:**
- `agents/gsd-planner.md` - Creates executable plans
- `agents/gsd-executor.md` - Executes plans
- `agents/gsd-verifier.md` - Verifies deliverables

**Core Workflows:**
- `get-shit-done/workflows/execute-phase.md` - Execution orchestration
- `get-shit-done/workflows/plan-phase.md` - Planning orchestration
- `get-shit-done/workflows/verify-work.md` - Verification orchestration

**Configuration:**
- `package.json` - NPM package definition, build scripts
- `.gitignore` - Git ignore patterns

## Where to Add New Code

**New Command:**
- Primary code: `commands/gsd/{command-name}.md`
- Follow pattern: Parse input → validate state → invoke workflow → return results
- Reference: `commands/gsd/new-project.md` for structure

**New Agent:**
- Primary code: `agents/gsd-{role}.md`
- Define: Role, tools, execution pattern, return format
- Reference: `agents/gsd-planner.md` for structure

**New Workflow:**
- Primary code: `get-shit-done/workflows/{action}-{target}.md`
- Define: Steps, agent spawning, result aggregation
- Reference: `get-shit-done/workflows/execute-phase.md` for structure

**New Template:**
- Primary code: `get-shit-done/templates/{document-type}.md`
- Define: Structure, placeholders, usage context
- Reference: `get-shit-done/templates/project.md` for structure

**New Hook:**
- Primary code: `hooks/gsd-{function}.js`
- Update: `scripts/build-hooks.js` to include in build
- Register: In `bin/install.js` hook registration logic

**New Reference:**
- Primary code: `get-shit-done/references/{topic}.md`
- Purpose: Domain knowledge, best practices, guidelines
- Reference: `get-shit-done/references/planning-config.md` for structure

## Runtime-Specific Adaptations

**Claude Code:**
- Commands: `commands/gsd/` → `~/.claude/commands/gsd/`
- Agents: `agents/` → `~/.claude/agents/`
- Hooks: Registered in `~/.claude/settings.json`

**OpenCode:**
- Commands: `commands/gsd/*.md` → `~/.config/opencode/command/gsd-*.md` (flattened)
- Frontmatter: Converted from Claude format (tools array → object)
- Paths: `~/.claude/` → `~/.config/opencode/`
- Permissions: Configured in `~/.config/opencode/opencode.json`

**Gemini CLI:**
- Commands: `commands/gsd/*.md` → `~/.gemini/commands/gsd/*.toml` (converted)
- Agents: `agents/gsd-*.md` → `~/.gemini/agents/gsd-*.md` (tool names converted)
- Format: TOML for commands, markdown for agents (with tool name conversion)

---
*Structure analysis: 2026-01-31*
