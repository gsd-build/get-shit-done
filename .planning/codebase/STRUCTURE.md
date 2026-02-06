# Codebase Structure

**Analysis Date:** 2026-02-06

## Directory Layout

```
get-shit-done/
├── agents/                        # Specialized subagent definitions (11 files)
│   ├── gsd-codebase-mapper.md    # Analyzes existing codebase → STACK.md, ARCHITECTURE.md, etc.
│   ├── gsd-debugger.md           # Systematic debugging with persistent state
│   ├── gsd-executor.md           # Executes individual plans, writes SUMMARY.md
│   ├── gsd-integration-checker.md # Validates external integrations
│   ├── gsd-phase-researcher.md   # Domain research for a phase, guided by CONTEXT.md
│   ├── gsd-plan-checker.md       # Verifies plans achieve phase goals
│   ├── gsd-planner.md            # Creates task breakdowns and dependency graphs
│   ├── gsd-project-researcher.md # Initial domain research for new projects
│   ├── gsd-research-synthesizer.md # Aggregates research findings
│   ├── gsd-roadmapper.md         # Creates phase roadmap from requirements
│   └── gsd-verifier.md           # Checks deliverables against must-haves
├── assets/                        # Images and brand materials
├── bin/
│   └── install.js                # Multi-runtime installer (main entry point)
├── commands/gsd/                 # User-facing slash commands (28 files)
│   ├── new-project.md            # /gsd:new-project → Initialize project
│   ├── discuss-phase.md          # /gsd:discuss-phase [N] → Capture user decisions
│   ├── plan-phase.md             # /gsd:plan-phase [N] → Research + plan + verify
│   ├── execute-phase.md          # /gsd:execute-phase [N] → Execute all plans in waves
│   ├── verify-work.md            # /gsd:verify-work [N] → User acceptance testing
│   ├── map-codebase.md           # /gsd:map-codebase → Analyze existing codebase
│   ├── quick.md                  # /gsd:quick → Ad-hoc task execution
│   ├── add-phase.md              # /gsd:add-phase → Append phase to roadmap
│   ├── insert-phase.md           # /gsd:insert-phase [N] → Insert phase before N
│   ├── remove-phase.md           # /gsd:remove-phase [N] → Delete phase
│   ├── new-milestone.md          # /gsd:new-milestone [name] → Start new version
│   ├── complete-milestone.md     # /gsd:complete-milestone → Archive and tag release
│   ├── audit-milestone.md        # /gsd:audit-milestone → Verify definition of done
│   ├── plan-milestone-gaps.md    # /gsd:plan-milestone-gaps → Create closure plans
│   ├── pause-work.md             # /gsd:pause-work → Create handoff document
│   ├── resume-work.md            # /gsd:resume-work → Restore from handoff
│   ├── progress.md               # /gsd:progress → Where am I? What's next?
│   ├── add-todo.md               # /gsd:add-todo [desc] → Capture idea for later
│   ├── check-todos.md            # /gsd:check-todos → List pending todos
│   ├── debug.md                  # /gsd:debug [desc] → Systematic debugging
│   ├── settings.md               # /gsd:settings → Configure workflow settings
│   ├── set-profile.md            # /gsd:set-profile <profile> → Switch model profile
│   ├── update.md                 # /gsd:update → Update GSD with changelog preview
│   ├── help.md                   # /gsd:help → Show all commands
│   ├── list-phase-assumptions.md # /gsd:list-phase-assumptions [N] → See intended approach
│   ├── join-discord.md           # /gsd:join-discord → Community link
│   └── research-phase.md         # /gsd:research-phase [N] → Phase-specific research
├── get-shit-done/
│   ├── references/               # Shared decision frameworks and patterns (9 files)
│   │   ├── checkpoints.md        # State checkpoint patterns
│   │   ├── continuation-format.md # Session continuation format
│   │   ├── git-integration.md    # Git workflow and commit strategies
│   │   ├── model-profiles.md     # Model configuration (quality/balanced/budget)
│   │   ├── planning-config.md    # Configuration field reference
│   │   ├── questioning.md        # Deep questioning methodology
│   │   ├── tdd.md                # Test-driven development pattern
│   │   ├── ui-brand.md           # UI brand guidelines for output
│   │   └── verification-patterns.md # Verification and testing patterns
│   ├── templates/                # Reusable document structures
│   │   ├── codebase/             # Codebase analysis templates (7 templates)
│   │   │   ├── architecture.md   # Template for ARCHITECTURE.md
│   │   │   ├── concerns.md       # Template for CONCERNS.md
│   │   │   ├── conventions.md    # Template for CONVENTIONS.md
│   │   │   ├── integrations.md   # Template for INTEGRATIONS.md
│   │   │   ├── stack.md          # Template for STACK.md
│   │   │   ├── structure.md      # Template for STRUCTURE.md
│   │   │   └── testing.md        # Template for TESTING.md
│   │   ├── config.json           # Template for .planning/config.json
│   │   ├── context.md            # Template for {phase}-CONTEXT.md
│   │   ├── continue-here.md      # Template for pause-work checkpoint
│   │   ├── debug-subagent-prompt.md # Template for debugger prompts
│   │   ├── discovery.md          # Template for discovery phase
│   │   ├── DEBUG.md              # Template for DEBUG.md output
│   │   ├── milestone-archive.md  # Template for archived milestone
│   │   ├── milestone.md          # Template for MILESTONE.md
│   │   ├── phase-prompt.md       # Template for phase research/planning
│   │   ├── planner-subagent-prompt.md # Template for planner invocation
│   │   ├── project.md            # Template for PROJECT.md
│   │   ├── requirements.md       # Template for REQUIREMENTS.md
│   │   ├── research-project/     # Research subdirectory (for initial research)
│   │   ├── research.md           # Template for {phase}-RESEARCH.md
│   │   ├── roadmap.md            # Template for ROADMAP.md
│   │   ├── state.md              # Template for STATE.md
│   │   ├── summary.md            # Template for {phase}-{N}-SUMMARY.md
│   │   ├── UAT.md                # Template for user acceptance testing
│   │   ├── user-setup.md         # Template for initial user questionnaire
│   │   └── verification-report.md # Template for verification results
│   └── workflows/                # Reusable orchestration patterns (12 files)
│       ├── complete-milestone.md # Archive milestone, tag release
│       ├── diagnose-issues.md    # Systematic issue diagnosis
│       ├── discovery-phase.md    # Initial discovery workflow
│       ├── discuss-phase.md      # Capture implementation decisions
│       ├── execute-phase.md      # Execute all plans with wave parallelization
│       ├── execute-plan.md       # Execute individual plan (main executor workflow)
│       ├── list-phase-assumptions.md # Show intended approach
│       ├── map-codebase.md       # Map tech/arch/quality/concerns of existing codebase
│       ├── resume-project.md     # Resume from handoff
│       ├── transition.md         # Transition between phases/milestones
│       ├── verify-phase.md       # Phase verification workflow
│       └── verify-work.md        # User acceptance testing workflow
├── gsd-memory/                   # Cross-project knowledge MCP server (TypeScript)
│   ├── src/
│   │   ├── index.ts              # MCP server entry point, tool definitions
│   │   ├── qmd.ts                # YAML frontmatter and QMD parsing utilities
│   │   ├── registry.ts           # Project registration and indexing
│   │   ├── extractors/           # Extract metadata from project artifacts
│   │   │   ├── frontmatter.ts    # Parse YAML frontmatter from markdown
│   │   │   ├── project.ts        # Extract KEY-DECISIONS from PROJECT.md
│   │   │   ├── research.ts       # Extract findings from RESEARCH.md
│   │   │   └── summary.ts        # Extract PATTERNS-ESTABLISHED, decisions from SUMMARY.md
│   │   └── tools/                # MCP tools exposed to agents
│   │       ├── decisions.ts      # gsd_memory_decisions tool
│   │       ├── index-tool.ts     # gsd_memory_index / gsd_memory_index_all tools
│   │       ├── patterns.ts       # gsd_memory_patterns tool
│   │       ├── pitfalls.ts       # gsd_memory_pitfalls tool
│   │       ├── register.ts       # gsd_memory_register / gsd_memory_unregister tools
│   │       ├── search.ts         # gsd_memory_search tool
│   │       ├── stack.ts          # gsd_memory_stack tool
│   │       └── status.ts         # gsd_memory_status tool
│   ├── tests/                    # Unit and integration tests
│   │   ├── extractors/           # Extractor unit tests
│   │   ├── integration/          # End-to-end MCP server tests
│   │   ├── tools/                # Tool functionality tests
│   │   ├── fixtures/             # Mock project fixtures
│   │   ├── setup.ts              # Test utilities
│   │   └── qmd-wrapper.test.ts   # QMD parsing tests
│   ├── package.json              # TypeScript project config
│   ├── tsconfig.json
│   ├── vitest.config.ts          # Unit test runner config
│   └── vitest.integration.config.ts # Integration test config
├── hooks/                        # Git hooks and status utilities
│   ├── gsd-check-update.js      # Check for GSD updates
│   └── gsd-statusline.js        # CLI status line display
├── scripts/
│   └── build-hooks.js            # Build script for hooks
├── .planning/                    # Project planning state (created by /gsd:new-project)
│   ├── codebase/                 # Codebase analysis documents (created by /gsd:map-codebase)
│   │   ├── STACK.md              # Technology stack
│   │   ├── INTEGRATIONS.md       # External APIs and services
│   │   ├── ARCHITECTURE.md       # System architecture and patterns
│   │   ├── STRUCTURE.md          # Directory layout and file organization
│   │   ├── CONVENTIONS.md        # Coding conventions and style
│   │   ├── TESTING.md            # Testing patterns and frameworks
│   │   └── CONCERNS.md           # Technical debt and issues
│   ├── PROJECT.md                # Project vision and context
│   ├── REQUIREMENTS.md           # Scoped requirements (v1/v2)
│   ├── ROADMAP.md                # Phase structure and status
│   ├── STATE.md                  # Current position and decisions
│   ├── config.json               # Workflow configuration
│   ├── phases/                   # Phase directories (created dynamically)
│   │   └── NN-phase-name/
│   │       ├── NN-N-PLAN.md      # Task breakdown
│   │       ├── NN-N-SUMMARY.md   # Execution result
│   │       ├── {phase}-RESEARCH.md # Domain research
│   │       └── {phase}-CONTEXT.md  # User decisions
│   └── research/                 # Initial research (from /gsd:new-project)
└── package.json                  # Root package (main, bin, files, engines)
```

## Directory Purposes

**`agents/`**
- Purpose: Specialized worker definitions spawned with fresh context
- Contains: 11 agent markdown files, each with role definition and process
- Key files:
  - `gsd-executor.md` — Main implementation agent
  - `gsd-planner.md` — Task decomposition and dependency analysis
  - `gsd-codebase-mapper.md` — Analyzes existing codebases (tech/arch/quality/concerns)

**`commands/gsd/`**
- Purpose: User-facing slash commands
- Contains: 28 markdown command definitions with YAML frontmatter
- Metadata: name, description, argument-hint, allowed-tools
- Pattern: Each command is a standalone markdown file that is installed as a `/gsd:...` command

**`get-shit-done/references/`**
- Purpose: Shared decision frameworks and patterns
- Contains: 9 reusable reference documents
- Used by: Agents and orchestrators load these with `@~/.claude/get-shit-done/references/X.md` syntax

**`get-shit-done/templates/`**
- Purpose: Document structure contracts for generated artifacts
- Contains: 23 markdown templates with placeholder sections
- Examples: `project.md`, `requirements.md`, `summary.md`
- `codebase/` subdirectory: 7 templates for codebase analysis documents

**`get-shit-done/workflows/`**
- Purpose: Reusable orchestration blueprints
- Contains: 12 workflow markdown files with step-by-step process definitions
- Examples: `execute-plan.md` (main executor workflow), `map-codebase.md` (mapper orchestration)

**`gsd-memory/`**
- Purpose: Cross-project knowledge system (MCP server)
- Contains: TypeScript source, tests, configuration
- Language: TypeScript (Node.js 18+)
- Dependencies: `@modelcontextprotocol/sdk`, `gray-matter`, `yaml`

**`.planning/`** (created per project)
- Purpose: Project state and artifacts directory
- Contains: PROJECT.md, ROADMAP.md, STATE.md, phase directories
- `codebase/` — Codebase analysis documents (generated by `/gsd:map-codebase`)
- `phases/` — Phase execution artifacts (generated by planning/execution)

## Key File Locations

**Entry Points:**
- `bin/install.js` — Installation entry point (main: "bin/install.js" in package.json)
- `agents/*.md` — Subagent definitions
- `commands/gsd/*.md` — User commands (registered as `/gsd:...`)

**Configuration:**
- `package.json` — Root package metadata and bin entry
- `gsd-memory/package.json` — MCP server package config
- `get-shit-done/templates/config.json` — Template for `.planning/config.json`

**Core Logic:**
- `commands/gsd/new-project.md` — Project initialization workflow
- `get-shit-done/workflows/execute-plan.md` — Main execution workflow
- `agents/gsd-planner.md` — Plan creation logic
- `agents/gsd-executor.md` — Implementation logic
- `gsd-memory/src/index.ts` — MCP server and tools

**Testing:**
- `gsd-memory/tests/` — Unit and integration tests
- `gsd-memory/vitest.config.ts` — Test runner configuration

## Naming Conventions

**Files:**

- **Command files:** Dash-separated lowercase: `new-project.md`, `execute-phase.md`
- **Agent files:** Snake-case prefix: `gsd-executor.md`, `gsd-planner.md`
- **Workflow files:** Dash-separated lowercase: `execute-plan.md`, `map-codebase.md`
- **Template files:** Dash-separated lowercase: `project.md`, `requirements.md`
- **Project artifacts:** UPPERCASE with phase number: `PROJECT.md`, `01-01-PLAN.md`, `01-01-SUMMARY.md`

**Directories:**

- **Command group:** `commands/gsd/` — all slash commands grouped by runtime (installed to `~/.claude/commands/gsd/` or `./.claude/commands/gsd/`)
- **Agent group:** `agents/` — all subagent definitions
- **Workflow group:** `get-shit-done/workflows/` — all orchestration workflows
- **Template group:** `get-shit-done/templates/` — all document templates
- **Reference group:** `get-shit-done/references/` — all shared patterns
- **Phase directories:** `.planning/phases/NN-slug/` — numbered phases (01-foundation, 02-user-auth, etc.)

## Where to Add New Code

**New Subagent:**
- Implementation: `agents/gsd-{name}.md`
- Reference it in: `get-shit-done/workflows/` that spawn it via Task tool
- Define tools: Add to `allowed-tools` frontmatter in agent file

**New Command:**
- Implementation: `commands/gsd/{name}.md`
- Frontmatter required: name, description, argument-hint, allowed-tools
- Spawning agents: Use Task tool with `subagent_type="gsd-{agent-name}"`

**New Workflow:**
- Implementation: `get-shit-done/workflows/{name}.md`
- Purpose section: Explain what orchestration pattern it provides
- Process steps: Define with `<step name="step-name">` tags
- Usage: Referenced by commands via `@~/.claude/get-shit-done/workflows/X.md`

**New Template:**
- Implementation: `get-shit-done/templates/{name}.md`
- Structure: Sections with [placeholder text] to be filled by agents
- Codebase templates: `get-shit-done/templates/codebase/{name}.md`

**New Reference Pattern:**
- Implementation: `get-shit-done/references/{name}.md`
- Content: Decision frameworks, patterns with examples
- Usage: Referenced in agents via `@~/.claude/get-shit-done/references/X.md`

**New MCP Tool (gsd-memory):**
- Tool implementation: `gsd-memory/src/tools/{name}.ts`
- Tool definition: Add to tools array in `gsd-memory/src/index.ts`
- Tests: `gsd-memory/tests/tools/{name}.test.ts`
- Extractor (if metadata extraction): `gsd-memory/src/extractors/{name}.ts`

**Tests (for gsd-memory):**
- Unit tests: `gsd-memory/tests/{domain}/{name}.test.ts`
- Integration tests: `gsd-memory/tests/integration/{name}.test.ts`
- Fixtures: `gsd-memory/tests/fixtures/` (mock projects and data)

## Special Directories

**`.planning/`**
- Purpose: Project planning state (per project, created by `/gsd:new-project`)
- Generated: Dynamically created, not in repo
- Committed: Optional (controlled by `config.json` `commit_docs` setting)
- Contents: PROJECT.md, ROADMAP.md, STATE.md, phases/, research/, codebase/

**`.planning/codebase/`**
- Purpose: Codebase analysis documents (created by `/gsd:map-codebase`)
- Generated: Created by codebase-mapper agents
- Committed: Optional (should be committed for reference)
- Contains: STACK.md, ARCHITECTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md, INTEGRATIONS.md, STRUCTURE.md

**`gsd-memory/dist/`**
- Purpose: Compiled TypeScript output
- Generated: Yes (from `npm run build`)
- Committed: No (excluded by npm `files` field)

**`gsd-memory/tests/fixtures/`**
- Purpose: Mock project structures for testing
- Generated: Pre-created fixtures for test cases
- Committed: Yes (needed for tests to run)

---

*Structure analysis: 2026-02-06*
