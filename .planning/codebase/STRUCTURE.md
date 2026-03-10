# Codebase Structure

**Analysis Date:** 2025-01-27

## Directory Layout

```
get-shit-done-copilot/
├── bin/                        # npm package entry point (installer)
│   └── install.js              # Interactive installer (2376 lines) — copies to runtime dirs
├── commands/                   # Claude Code slash command definitions
│   └── gsd/                    # All /gsd:* commands as .md files
│       ├── new-project.md
│       ├── plan-phase.md
│       ├── execute-phase.md
│       ├── ... (30+ commands)
│       └── verify-work.md
├── get-shit-done/              # Core content — installed to ~/.claude/get-shit-done/
│   ├── bin/                    # CLI tools
│   │   ├── gsd-tools.cjs      # Main CLI entry (589 lines) — command router
│   │   └── lib/                # Library modules
│   │       ├── core.cjs        # Shared utilities, model profiles, git helpers
│   │       ├── state.cjs       # STATE.md read/write/progression engine
│   │       ├── phase.cjs       # Phase CRUD, lifecycle, plan indexing
│   │       ├── roadmap.cjs     # ROADMAP.md parsing and updates
│   │       ├── verify.cjs      # Verification suite, consistency, health
│   │       ├── config.cjs      # config.json CRUD
│   │       ├── template.cjs    # Template selection and filling
│   │       ├── milestone.cjs   # Milestone archiving, requirements marking
│   │       ├── commands.cjs    # Standalone utility commands
│   │       ├── init.cjs        # Compound init commands for workflow bootstrap
│   │       └── frontmatter.cjs # YAML frontmatter parser/serializer/CRUD
│   ├── workflows/              # Multi-step workflow procedures (Markdown)
│   │   ├── new-project.md
│   │   ├── plan-phase.md
│   │   ├── execute-phase.md
│   │   ├── execute-plan.md
│   │   ├── ... (30+ workflows)
│   │   └── verify-phase.md
│   ├── templates/              # Document templates (Markdown)
│   │   ├── project.md          # PROJECT.md template
│   │   ├── roadmap.md          # ROADMAP.md template
│   │   ├── state.md            # STATE.md template
│   │   ├── milestone.md        # MILESTONE.md template
│   │   ├── phase-prompt.md     # PLAN.md template
│   │   ├── summary.md          # SUMMARY.md template (+ complex, standard, minimal)
│   │   ├── verification-report.md
│   │   ├── codebase/           # Codebase mapping templates
│   │   │   ├── architecture.md
│   │   │   ├── stack.md
│   │   │   ├── conventions.md
│   │   │   ├── testing.md
│   │   │   ├── concerns.md
│   │   │   ├── integrations.md
│   │   │   └── structure.md
│   │   └── research-project/   # Research project templates
│   └── references/             # Static reference documents
│       ├── model-profiles.md   # Model selection guidance
│       ├── git-integration.md  # Git workflow patterns
│       ├── verification-patterns.md
│       ├── questioning.md      # User questioning patterns
│       ├── ui-brand.md         # UI/UX branding rules
│       ├── tdd.md              # Test-driven development patterns
│       ├── planning-config.md  # Planning configuration reference
│       └── ... (14 reference docs)
├── agents/                     # Agent system prompts (Claude Code format)
│   ├── gsd-executor.md         # Plan execution agent
│   ├── gsd-planner.md          # Plan creation agent
│   ├── gsd-verifier.md         # Verification agent
│   ├── gsd-debugger.md         # Debug agent
│   ├── gsd-codebase-mapper.md  # Codebase analysis agent
│   ├── gsd-phase-researcher.md # Phase research agent
│   ├── gsd-project-researcher.md # Project research agent
│   ├── gsd-research-synthesizer.md # Research synthesis agent
│   ├── gsd-roadmapper.md       # Roadmap creation agent
│   ├── gsd-plan-checker.md     # Plan review agent
│   └── gsd-integration-checker.md # Integration verification agent
├── hooks/                      # Claude Code hook scripts
│   ├── gsd-statusline.js       # Notification hook — statusline with context usage
│   ├── gsd-context-monitor.js  # PostToolUse hook — injects context warnings to agent
│   └── gsd-check-update.js     # SessionStart hook — background version check
├── .github/                    # GitHub Copilot runtime equivalent
│   ├── agents/                 # Agent definitions (.agent.md format)
│   ├── skills/                 # Slash commands (skill format per command)
│   │   └── gsd-*/              # One directory per command
│   ├── get-shit-done/          # Mirrored core content (workflows, bin, templates, refs)
│   └── workflows/              # GitHub Actions (test.yml, auto-label-issues.yml)
├── scripts/                    # Build and test scripts
│   ├── build-hooks.js          # Copies hooks to hooks/dist/ for npm publishing
│   └── run-tests.cjs           # Cross-platform test runner
├── tests/                      # Unit tests (Node.js test runner)
│   ├── core.test.cjs
│   ├── state.test.cjs
│   ├── phase.test.cjs
│   ├── ... (14 test files)
│   └── helpers.cjs             # Shared test utilities
├── docs/                       # User documentation
│   ├── USER-GUIDE.md
│   └── context-monitor.md
├── assets/                     # Logo images and terminal SVG
├── package.json                # npm package config
├── package-lock.json
├── README.md
├── CHANGELOG.md
├── LICENSE                     # MIT
└── SECURITY.md
```

## Directory Purposes

**`bin/`:**
- Purpose: npm package entry point
- Contains: Single file `install.js` (2376 lines) — the interactive installer
- Key files: `bin/install.js`

**`commands/gsd/`:**
- Purpose: Claude Code slash command definitions — each file = one `/gsd:*` command
- Contains: Markdown files with YAML frontmatter (name, description, allowed-tools) and XML body (objective, execution_context, process)
- Key files: `commands/gsd/new-project.md`, `commands/gsd/execute-phase.md`, `commands/gsd/plan-phase.md`

**`get-shit-done/`:**
- Purpose: Core content installed to the AI assistant's config directory (e.g., `~/.claude/get-shit-done/`)
- Contains: CLI tools, workflows, templates, references
- Key files: `get-shit-done/bin/gsd-tools.cjs` (CLI entry)

**`get-shit-done/bin/lib/`:**
- Purpose: Node.js library modules for the `gsd-tools` CLI
- Contains: 11 CommonJS modules — each handles a domain (state, phase, roadmap, etc.)
- Key files: `core.cjs` (shared utilities, model profiles), `state.cjs` (STATE.md engine), `init.cjs` (compound bootstrap commands)

**`get-shit-done/workflows/`:**
- Purpose: Multi-step orchestration procedures that commands delegate to
- Contains: 30+ Markdown files with embedded bash, XML steps, and subagent spawning patterns
- Key files: `new-project.md`, `plan-phase.md`, `execute-phase.md`, `execute-plan.md`

**`get-shit-done/templates/`:**
- Purpose: Templates for planning documents generated during workflows
- Contains: Markdown templates for project, roadmap, state, plan, summary, verification files
- Key files: `project.md`, `roadmap.md`, `state.md`, `phase-prompt.md`

**`get-shit-done/references/`:**
- Purpose: Static reference material loaded by agents and workflows for context
- Contains: 14 Markdown files covering git patterns, model profiles, UI branding, TDD, verification
- Key files: `model-profiles.md`, `ui-brand.md`, `verification-patterns.md`

**`agents/`:**
- Purpose: System prompts defining specialized AI agent roles (Claude Code format)
- Contains: 11 agent definition Markdown files
- Key files: `gsd-executor.md`, `gsd-planner.md`, `gsd-verifier.md`

**`hooks/`:**
- Purpose: Claude Code runtime hooks (statusline, context monitoring, update checking)
- Contains: 3 Node.js hook scripts + `dist/` (built output for npm)
- Key files: `gsd-statusline.js`, `gsd-context-monitor.js`

**`.github/`:**
- Purpose: GitHub Copilot runtime equivalent — agents, skills (commands), and mirrored core content
- Contains: `.github/agents/` (agent.md format), `.github/skills/` (skill directories), `.github/get-shit-done/` (core content copy)
- Key files: `.github/agents/gsd-executor.agent.md`, `.github/skills/gsd-execute-phase/skill.md`

**`tests/`:**
- Purpose: Unit tests for CLI library modules
- Contains: 14 test files using Node.js built-in test runner
- Key files: `core.test.cjs`, `state.test.cjs`, `helpers.cjs`

**`scripts/`:**
- Purpose: Build and test automation
- Contains: `build-hooks.js` (copies hooks to dist), `run-tests.cjs` (cross-platform test runner)

## Key File Locations

**Entry Points:**
- `bin/install.js`: npm package entry — interactive installer
- `get-shit-done/bin/gsd-tools.cjs`: CLI tools entry — command router

**Configuration:**
- `package.json`: npm package metadata, scripts, dependencies
- `.planning/config.json` (runtime): Per-project GSD configuration (model_profile, commit_docs, branching, etc.)

**Core Logic (CLI library):**
- `get-shit-done/bin/lib/core.cjs`: Shared utilities, model profiles table, git helpers, phase normalization
- `get-shit-done/bin/lib/state.cjs`: STATE.md read/write, frontmatter sync, progression engine
- `get-shit-done/bin/lib/phase.cjs`: Phase CRUD, lifecycle (add/insert/remove/complete), plan indexing
- `get-shit-done/bin/lib/init.cjs`: Compound init commands (one call = all context for a workflow)
- `get-shit-done/bin/lib/frontmatter.cjs`: YAML frontmatter parser, serializer, CRUD operations
- `get-shit-done/bin/lib/verify.cjs`: Verification suite, consistency checks, health validation with repair
- `get-shit-done/bin/lib/roadmap.cjs`: ROADMAP.md parsing, phase extraction, progress updates
- `get-shit-done/bin/lib/commands.cjs`: Utility commands (slug, timestamp, todos, scaffold, websearch)
- `get-shit-done/bin/lib/config.cjs`: config.json ensure/set/get operations
- `get-shit-done/bin/lib/template.cjs`: Template selection heuristics and filling
- `get-shit-done/bin/lib/milestone.cjs`: Milestone completion, archiving, requirements marking

**Testing:**
- `tests/*.test.cjs`: Unit tests (one per lib module)
- `tests/helpers.cjs`: Shared test utilities (temp dirs, fixture creation)
- `scripts/run-tests.cjs`: Cross-platform test runner

## Naming Conventions

**Files:**
- CLI modules: `kebab-case.cjs` (e.g., `core.cjs`, `frontmatter.cjs`)
- Command definitions: `kebab-case.md` (e.g., `execute-phase.md`, `new-project.md`)
- Agent definitions: `gsd-kebab-case.md` (Claude) or `gsd-kebab-case.agent.md` (GitHub Copilot)
- Workflow files: `kebab-case.md` (e.g., `execute-phase.md`, `plan-phase.md`)
- Test files: `module-name.test.cjs` (e.g., `core.test.cjs`, `state.test.cjs`)
- Hook files: `gsd-kebab-case.js` (e.g., `gsd-statusline.js`)
- Template files: `kebab-case.md` (e.g., `phase-prompt.md`, `summary-complex.md`)

**Directories:**
- Phase directories (runtime): `NN-kebab-slug` (e.g., `01-setup`, `02-auth`, `03.1-hotfix`)
- GitHub Copilot skills: `gsd-kebab-case/` (e.g., `gsd-execute-phase/`)
- All lowercase with hyphens

**Functions:**
- CLI command handlers: `cmdCamelCase(cwd, ...)` (e.g., `cmdStateLoad`, `cmdPhaseAdd`, `cmdInitExecutePhase`)
- Internal helpers: `camelCase` (e.g., `findPhaseInternal`, `resolveModelInternal`, `normalizePhaseName`)

**Constants:**
- `UPPER_SNAKE_CASE` for module-level constants (e.g., `MODEL_PROFILES`, `FRONTMATTER_SCHEMAS`)

## Where to Add New Code

**New GSD Command:**
- Command definition: `commands/gsd/<command-name>.md`
- GitHub Copilot skill: `.github/skills/gsd-<command-name>/<command-name>.md`
- Workflow (if multi-step): `get-shit-done/workflows/<command-name>.md`
- Mirror workflow to: `.github/get-shit-done/workflows/<command-name>.md`

**New Agent:**
- Claude Code format: `agents/gsd-<agent-name>.md`
- GitHub Copilot format: `.github/agents/gsd-<agent-name>.agent.md`
- Add model profile entry to `MODEL_PROFILES` in `get-shit-done/bin/lib/core.cjs`

**New CLI Tool Command:**
- If new domain: Create `get-shit-done/bin/lib/<domain>.cjs`, require in `gsd-tools.cjs`, add case to switch
- If extending existing domain: Add `cmd*` function to existing module, add route in `gsd-tools.cjs` switch
- Add test: `tests/<domain>.test.cjs`

**New Init Command:**
- Add function `cmdInit<Workflow>` to `get-shit-done/bin/lib/init.cjs`
- Add case to `init` switch in `get-shit-done/bin/gsd-tools.cjs`
- Add test to `tests/init.test.cjs`

**New Template:**
- Planning templates: `get-shit-done/templates/<template-name>.md`
- Codebase mapping templates: `get-shit-done/templates/codebase/<template-name>.md`
- Mirror to: `.github/get-shit-done/templates/...`

**New Reference Document:**
- Add to `get-shit-done/references/<reference-name>.md`
- Mirror to `.github/get-shit-done/references/<reference-name>.md`

**New Hook:**
- Source: `hooks/gsd-<hook-name>.js`
- Add to `HOOKS_TO_COPY` array in `scripts/build-hooks.js`
- Register in installer: update `bin/install.js` hook registration section

**New Test:**
- Add `tests/<module-name>.test.cjs`
- Automatically picked up by `scripts/run-tests.cjs` (scans `tests/*.test.cjs`)

## Special Directories

**`.planning/` (runtime, per-project):**
- Purpose: All project state — created by GSD at runtime in user's project
- Generated: Yes (by `/gsd:new-project` and subsequent commands)
- Committed: Yes (unless gitignored; controlled by `commit_docs` config)
- Contents: `PROJECT.md`, `ROADMAP.md`, `STATE.md`, `REQUIREMENTS.md`, `config.json`, `phases/`, `codebase/`, `milestones/`, `todos/`, `research/`, `quick/`

**`.github/get-shit-done/` (source):**
- Purpose: GitHub Copilot runtime copy of core content (mirrors `get-shit-done/`)
- Generated: No (maintained as separate copy with path adjustments)
- Committed: Yes
- Note: Files differ slightly from `get-shit-done/` — paths reference `.github/` instead of `~/.claude/`

**`hooks/dist/` (build output):**
- Purpose: Built hook files ready for npm publishing
- Generated: Yes (by `npm run build:hooks` / `scripts/build-hooks.js`)
- Committed: No (in `.gitignore`)

**`node_modules/`:**
- Purpose: Dev dependencies (esbuild, c8 for coverage)
- Generated: Yes
- Committed: No

---

*Structure analysis: 2025-01-27*
