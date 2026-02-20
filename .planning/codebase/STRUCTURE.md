# Codebase Structure

**Analysis Date:** 2026-02-20

## Directory Layout

```
get-shit-done/
├── agents/                     # Subagent system prompts (spawned via Task())
├── bin/                        # Installer entry point
│   └── install.js              # Cross-runtime installer (~1800 lines)
├── commands/                   # Slash command definitions
│   └── gsd/                    # All /gsd:* commands (~30 commands)
├── docs/                       # User documentation
├── get-shit-done/              # Core system files (copied to runtime config)
│   ├── bin/                    # Runtime utilities
│   │   └── gsd-tools.cjs       # Bundled state management tool (~190KB)
│   ├── references/             # Shared knowledge docs
│   ├── templates/              # Document templates
│   │   └── codebase/           # Codebase mapping templates
│   └── workflows/              # Orchestration workflows (~30 workflows)
├── hooks/                      # Runtime hooks (source)
│   ├── gsd-statusline.js       # Statusline hook
│   └── gsd-check-update.js     # Update check hook
├── scripts/                    # Build scripts
│   └── build-hooks.js          # Hook bundler
├── assets/                     # Documentation assets
├── .github/                    # GitHub config (workflows, templates)
├── .claude/                    # Local Claude Code config (dev only)
├── .planning/                  # Planning directory (dev only)
│   └── codebase/               # Codebase analysis docs
├── package.json                # NPM package config
├── CHANGELOG.md                # Release history
└── README.md                   # Project documentation
```

## Directory Purposes

**`agents/`:**
- Purpose: Specialized AI agent system prompts
- Contains: 11 markdown files with YAML frontmatter defining agent behavior
- Key files:
  - `gsd-executor.md` - Plan execution agent
  - `gsd-planner.md` - Phase planning agent
  - `gsd-verifier.md` - Verification agent
  - `gsd-debugger.md` - Debugging agent
  - `gsd-codebase-mapper.md` - Codebase analysis agent

**`bin/`:**
- Purpose: NPM package entry point
- Contains: Single installer script
- Key files: `install.js` - Interactive/CLI installer supporting Claude, OpenCode, Gemini

**`commands/gsd/`:**
- Purpose: User-facing slash command definitions
- Contains: ~30 markdown command files
- Key files:
  - `new-project.md` - Project initialization
  - `plan-phase.md` - Phase planning
  - `execute-phase.md` - Phase execution
  - `progress.md` - Status display
  - `help.md` - Command reference

**`get-shit-done/bin/`:**
- Purpose: Runtime JavaScript utilities
- Contains: Bundled CommonJS tool
- Key files: `gsd-tools.cjs` - State management, parsing, git operations

**`get-shit-done/workflows/`:**
- Purpose: Multi-step orchestration implementations
- Contains: ~30 markdown workflow files
- Key files:
  - `new-project.md` - Full project init workflow
  - `plan-phase.md` - Planning with verification loop
  - `execute-phase.md` - Wave-based execution
  - `verify-work.md` - User acceptance testing
  - `complete-milestone.md` - Milestone finalization

**`get-shit-done/templates/`:**
- Purpose: Document structure templates
- Contains: Markdown templates for all project artifacts
- Key files:
  - `phase-prompt.md` - PLAN.md template
  - `summary.md` - SUMMARY.md template
  - `state.md` - STATE.md template
  - `roadmap.md` - ROADMAP.md template
  - `project.md` - PROJECT.md template

**`get-shit-done/references/`:**
- Purpose: Shared implementation patterns and configuration docs
- Contains: Reference documentation loaded by agents
- Key files:
  - `checkpoints.md` - Checkpoint handling patterns
  - `tdd.md` - Test-driven development patterns
  - `verification-patterns.md` - Verification strategies
  - `model-profiles.md` - Model selection guide

**`hooks/`:**
- Purpose: AI runtime integration scripts
- Contains: Node.js hooks for statusline and lifecycle events
- Key files:
  - `gsd-statusline.js` - Shows model, task, context usage
  - `gsd-check-update.js` - Checks for GSD updates on session start

**`scripts/`:**
- Purpose: Build-time utilities
- Contains: Node.js build scripts
- Key files: `build-hooks.js` - Bundles hooks with dependencies

## Key File Locations

**Entry Points:**
- `bin/install.js`: NPM package entry, installation logic
- `commands/gsd/*.md`: All user-invokable commands
- `hooks/gsd-statusline.js`: Statusline display

**Configuration:**
- `package.json`: NPM package metadata, scripts
- `get-shit-done/templates/config.json`: Default config template

**Core Logic:**
- `get-shit-done/bin/gsd-tools.cjs`: All state manipulation logic
- `get-shit-done/workflows/*.md`: Orchestration implementations
- `agents/*.md`: Agent behavior definitions

**Testing:**
- `get-shit-done/bin/gsd-tools.test.cjs`: Unit tests for gsd-tools

## Naming Conventions

**Files:**
- Commands: `kebab-case.md` (e.g., `execute-phase.md`, `new-project.md`)
- Agents: `gsd-{role}.md` (e.g., `gsd-executor.md`, `gsd-planner.md`)
- Workflows: `kebab-case.md` matching command names
- Templates: `kebab-case.md` (e.g., `phase-prompt.md`)
- References: `kebab-case.md` (e.g., `checkpoints.md`)

**Directories:**
- `kebab-case` throughout
- Singular names (`command/` for OpenCode, `commands/` for Claude/Gemini)

**Project Artifacts (created during use):**
- Plans: `{phase}-{plan}-PLAN.md` (e.g., `01-02-PLAN.md`)
- Summaries: `{phase}-{plan}-SUMMARY.md` (e.g., `01-02-SUMMARY.md`)
- Research: `{phase}-RESEARCH.md` (e.g., `01-RESEARCH.md`)
- Context: `{phase}-CONTEXT.md` (e.g., `01-CONTEXT.md`)

## Where to Add New Code

**New Command:**
- Primary code: `commands/gsd/{command-name}.md`
- Workflow (if complex): `get-shit-done/workflows/{command-name}.md`
- Tests: Manual testing via Claude Code

**New Agent:**
- Implementation: `agents/gsd-{agent-name}.md`
- Follow existing agent structure (role, project_context, process steps, success criteria)

**New Workflow:**
- Implementation: `get-shit-done/workflows/{workflow-name}.md`
- Command wrapper: `commands/gsd/{command-name}.md`

**New Template:**
- Implementation: `get-shit-done/templates/{template-name}.md`
- For codebase mapping: `get-shit-done/templates/codebase/{template-name}.md`

**New Reference:**
- Implementation: `get-shit-done/references/{reference-name}.md`

**New State Tool Function:**
- Implementation: Source not in repo (bundled `gsd-tools.cjs`)
- Tests: `get-shit-done/bin/gsd-tools.test.cjs`

**New Hook:**
- Implementation: `hooks/{hook-name}.js`
- Build: Add to `scripts/build-hooks.js`

## Special Directories

**`hooks/dist/`:**
- Purpose: Bundled hooks ready for distribution
- Generated: Yes (by `npm run build:hooks`)
- Committed: Yes (distribution artifact)

**`.planning/`:**
- Purpose: Project planning state (when GSD is used on itself)
- Generated: Yes (by GSD commands)
- Committed: Optional (per project config)

**`node_modules/`:**
- Purpose: NPM dependencies
- Generated: Yes
- Committed: No

---

*Structure analysis: 2026-02-20*
