# Codebase Structure

**Analysis Date:** 2026-02-05

## Directory Layout

```
get-shit-done/
├── .github/                    # GitHub workflows and templates
│   └── FUNDING.yml            # Sponsorship config
│   └── pull_request_template.md
├── agents/                     # Subagent definitions
│   └── gsd-*.md               # One file per agent type
├── assets/                     # Images and branding
│   └── gsd-logo-*.png/svg     # Logo files
│   └── terminal.svg           # Install animation
├── bin/                        # Executable entry points
│   └── install.js             # NPX installer
├── commands/                   # Slash command definitions
│   └── gsd/                   # GSD-specific commands
│       └── *.md               # One file per command
├── cursor-gsd/                 # Cursor IDE adaptation (parallel port)
│   └── src/                   # Mirror of main structure
│   └── scripts/               # Install scripts for Cursor
├── get-shit-done/             # Core skill resources
│   ├── references/            # Principle documents
│   ├── templates/             # File templates
│   │   └── codebase/         # Codebase analysis templates
│   │   └── research-project/ # Research output templates
│   └── workflows/             # Multi-step procedures
├── hooks/                      # Runtime hooks
│   └── gsd-statusline.js      # Statusline display
│   └── gsd-check-update.js    # Update checker
├── scripts/                    # Build scripts
│   └── build-hooks.js         # Bundle hooks with esbuild
├── package.json                # Project manifest
├── README.md                   # User documentation
├── CHANGELOG.md                # Version history
└── LICENSE                     # MIT license
```

## Directory Purposes

**agents/**
- Purpose: Specialized subagent definitions spawned by orchestrator commands
- Contains: `gsd-*.md` files (executor, planner, verifier, debugger, etc.)
- Key files: `gsd-executor.md`, `gsd-planner.md`, `gsd-verifier.md`, `gsd-codebase-mapper.md`
- Subdirectories: None (flat structure)

**bin/**
- Purpose: Executable entry point for NPX installation
- Contains: `install.js` — the main installer script
- Key files: `install.js` (1500+ lines handling all installation logic)
- Subdirectories: None

**commands/gsd/**
- Purpose: Slash command definitions for Claude Code/OpenCode/Gemini
- Contains: One `.md` file per command (27 commands total)
- Key files: `new-project.md`, `plan-phase.md`, `execute-phase.md`, `verify-work.md`, `help.md`
- Subdirectories: None (flat structure)

**get-shit-done/references/**
- Purpose: Core philosophy and guidance documents loaded by commands/workflows
- Contains: Principle docs for checkpoints, continuation, git, model profiles, etc.
- Key files: `checkpoints.md`, `model-profiles.md`, `verification-patterns.md`, `tdd.md`
- Subdirectories: None

**get-shit-done/templates/**
- Purpose: Document templates for `.planning/` files created in user projects
- Contains: Template definitions with frontmatter and guidelines
- Key files: `project.md`, `roadmap.md`, `summary.md`, `state.md`, `config.json`
- Subdirectories: 
  - `codebase/` — Templates for stack, architecture, structure, conventions, testing, concerns, integrations
  - `research-project/` — Templates for research outputs (stack, features, architecture, pitfalls, summary)

**get-shit-done/workflows/**
- Purpose: Reusable multi-step procedures called by commands and agents
- Contains: Detailed process definitions with structured returns
- Key files: `execute-phase.md`, `execute-plan.md`, `verify-work.md`, `map-codebase.md`, `discovery-phase.md`
- Subdirectories: None

**hooks/**
- Purpose: Runtime hooks for statusline display and update checking
- Contains: JavaScript hooks bundled by esbuild during prepublish
- Key files: `gsd-statusline.js`, `gsd-check-update.js`
- Subdirectories: None (bundled to `dist/` during build)

**cursor-gsd/**
- Purpose: Cursor IDE adaptation of GSD (parallel port with Cursor-specific adaptations)
- Contains: Mirror of main structure with Cursor-specific install scripts
- Key files: `src/` mirrors main structure, `scripts/install.ps1` and `install.sh`
- Subdirectories: `src/` (agents, commands, templates, workflows, hooks, references)

**scripts/**
- Purpose: Build scripts for development
- Contains: `build-hooks.js` — bundles hooks with esbuild
- Key files: `build-hooks.js`
- Subdirectories: None

## Key File Locations

**Entry Points:**
- `bin/install.js` — NPX installation entry point, all install logic
- `commands/gsd/*.md` — Slash commands (user-facing entry points post-install)

**Configuration:**
- `package.json` — Project metadata, dependencies, npm scripts, bin entry
- `get-shit-done/templates/config.json` — Default config template for user projects
- `.gitignore` — Excluded files

**Core Logic:**
- `bin/install.js` — Installation logic (file copying, path replacement, runtime detection)
- `agents/*.md` — Subagent definitions (executor, planner, verifier, etc.)
- `get-shit-done/workflows/*.md` — Workflow procedures

**Testing:**
- No automated tests (system relies on manual testing and user feedback)

**Documentation:**
- `README.md` — User-facing installation and usage guide
- `CHANGELOG.md` — Version history and release notes
- `CONTRIBUTING.md` — Contribution guidelines
- `GSD-STYLE.md` — Code style and conventions

## Naming Conventions

**Files:**
- `kebab-case.md` — All markdown files (commands, workflows, templates)
- `gsd-*.md` — Agent files (prefix identifies GSD-specific agents)
- `kebab-case.js` — JavaScript files
- `UPPERCASE.md` — Important project files (README, CHANGELOG, LICENSE)

**Directories:**
- `kebab-case` — All directories
- Plural for collections: `commands/`, `agents/`, `templates/`, `workflows/`, `hooks/`
- Singular for namespaces: `gsd/` (under commands)

**Special Patterns:**
- `{command-name}.md` — Slash command definition (matches command name)
- `{phase}-{plan}-PLAN.md` — Plan file naming in user projects
- `{phase}-{plan}-SUMMARY.md` — Summary file naming in user projects
- `gsd-{role}.md` — Agent naming pattern

## Where to Add New Code

**New Slash Command:**
- Primary code: `commands/gsd/{command-name}.md`
- Workflow if complex: `get-shit-done/workflows/{workflow-name}.md`
- Documentation: Update `README.md` command table

**New Agent:**
- Implementation: `agents/gsd-{role}.md`
- Frontmatter: name, description, tools, color
- Usage: Spawned via Task tool from orchestrator commands

**New Workflow:**
- Implementation: `get-shit-done/workflows/{name}.md`
- Usage: Reference from commands with `@~/.claude/get-shit-done/workflows/{name}.md`

**New Template:**
- Implementation: `get-shit-done/templates/{name}.md` or `get-shit-done/templates/codebase/{name}.md`
- Documentation: Include guidelines section in template

**New Reference Document:**
- Implementation: `get-shit-done/references/{name}.md`
- Usage: Reference from commands/workflows as needed

**New Hook:**
- Implementation: `hooks/gsd-{name}.js`
- Build: Add to `scripts/build-hooks.js` bundle list
- Settings: Register in `bin/install.js` settings.json configuration

**Cursor Adaptation:**
- Mirror changes in `cursor-gsd/src/` directory
- Update `cursor-gsd/scripts/` if install process changes

## Special Directories

**.planning/** (in user projects)
- Purpose: Project state and planning artifacts
- Source: Created by GSD commands during project initialization
- Committed: Configurable (default: yes, can be gitignored)

**hooks/dist/** (during publish)
- Purpose: Bundled hooks with dependencies
- Source: Generated by `scripts/build-hooks.js` via esbuild
- Committed: No (generated during `npm run prepublishOnly`)

**cursor-gsd/**
- Purpose: Parallel port for Cursor IDE
- Source: Maintained alongside main codebase
- Committed: Yes (separate adaptation with own install scripts)

---

*Structure analysis: 2026-02-05*
*Update when directory structure changes*
