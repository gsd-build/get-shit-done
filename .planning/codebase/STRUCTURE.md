# Codebase Structure

**Analysis Date:** 2026-01-24

## Directory Layout

```
get-shit-done/
├── bin/                        # Installation and CLI entry point
│   └── install.js              # NPM installer, config setup, file deployment
├── agents/                      # Subagent definitions (prompts)
│   ├── gsd-codebase-mapper.md   # Analyzes codebase, writes docs
│   ├── gsd-debugger.md          # Troubleshoots execution failures
│   ├── gsd-executor.md          # Executes PLAN.md files atomically
│   ├── gsd-integration-checker.md # Validates external integrations
│   ├── gsd-phase-researcher.md  # Researches phase requirements
│   ├── gsd-plan-checker.md      # Verifies plan viability
│   ├── gsd-planner.md           # Creates executable PLAN.md files
│   ├── gsd-project-researcher.md # Initial discovery and context gathering
│   ├── gsd-research-synthesizer.md # Synthesizes research findings
│   ├── gsd-roadmapper.md        # Creates phase roadmaps
│   └── gsd-verifier.md          # Tests phases against success criteria
├── commands/                    # Slash commands (user interface)
│   └── gsd/                     # GSD command definitions
│       ├── add-phase.md         # Inserts phase into roadmap
│       ├── add-todo.md          # Adds task to todo list
│       ├── audit-milestone.md   # Reviews milestone completeness
│       ├── check-todos.md       # Lists pending tasks
│       ├── complete-milestone.md # Marks milestone done
│       ├── debug.md             # Diagnoses issues
│       ├── discuss-phase.md     # Talks through phase design
│       ├── execute-phase.md     # Executes phase plans
│       ├── help.md              # Shows GSD help
│       ├── insert-phase.md      # Inserts phase before another
│       ├── join-discord.md      # Links to community
│       ├── list-phase-assumptions.md # Lists assumptions
│       ├── map-codebase.md      # Analyzes codebase structure
│       ├── new-milestone.md     # Creates new milestone
│       ├── new-project.md       # Initializes new project
│       ├── pause-work.md        # Suspends execution
│       ├── plan-milestone-gaps.md # Plans gap closure
│       ├── plan-phase.md        # Plans a phase
│       ├── progress.md          # Shows project progress
│       ├── quick.md             # Quick status summary
│       ├── remove-phase.md      # Removes phase
│       ├── research-phase.md    # Researches phase details
│       ├── resume-work.md       # Continues from pause
│       ├── settings.md          # Manages configuration
│       └── [27+ commands total]
├── get-shit-done/               # Core knowledge base
│   ├── references/              # Static knowledge and patterns
│   │   ├── checkpoints.md       # Checkpoint types and patterns
│   │   ├── continuation-format.md # Resume protocol
│   │   ├── git-integration.md   # Git workflow patterns
│   │   ├── model-profiles.md    # Model capability profiles
│   │   ├── planning-config.md   # Configuration options
│   │   ├── questioning.md       # Discovery questioning patterns
│   │   ├── tdd.md               # Test-driven development patterns
│   │   ├── ui-brand.md          # UI styling guidelines
│   │   └── verification-patterns.md # Testing patterns
│   ├── workflows/               # Orchestration logic
│   │   ├── complete-milestone.md    # Milestone completion workflow
│   │   ├── diagnose-issues.md       # Issue diagnosis workflow
│   │   ├── discover-phase.md        # Phase discovery workflow
│   │   ├── discuss-phase.md         # Phase discussion workflow
│   │   ├── execute-phase.md         # Phase execution orchestrator
│   │   ├── execute-plan.md          # Single plan execution
│   │   ├── list-phase-assumptions.md # Assumption listing workflow
│   │   ├── map-codebase.md          # Codebase mapping orchestrator
│   │   ├── plan-phase.md            # Phase planning orchestrator
│   │   ├── resume-project.md        # Project resumption workflow
│   │   ├── transition.md            # Transition between phases
│   │   ├── verify-phase.md          # Phase verification orchestrator
│   │   └── verify-work.md           # Work verification workflow
│   └── templates/               # Output templates and examples
│       ├── config.json          # Configuration template
│       ├── context.md           # CONTEXT.md template
│       ├── DEBUG.md             # Debug template
│       ├── debug-subagent-prompt.md # Debugging prompts
│       ├── phase-prompt.md      # Phase specification template
│       ├── requirements.md      # Requirements template
│       ├── summary.md           # SUMMARY.md template
│       ├── UAT.md               # User acceptance testing template
│       └── user-setup.md        # Setup instructions template
├── hooks/                       # Runtime hooks and utilities
│   ├── gsd-check-update.js      # Checks for GSD updates
│   └── gsd-statusline.js        # Claude Code statusline display
├── scripts/                     # Build and utility scripts
│   └── build-hooks.js           # Bundled hook compilation
├── .planning/                   # Project state and artifacts
│   └── codebase/                # Codebase analysis documents (generated)
├── assets/                      # Documentation assets
├── .github/                     # GitHub workflows
├── package.json                 # NPM metadata
├── README.md                    # Main documentation
├── GSD-STYLE.md                 # Coding and style conventions
├── CONTRIBUTING.md              # Contribution guidelines
└── CHANGELOG.md                 # Version history
```

## Directory Purposes

**`bin/`**
- Purpose: NPM package entry point and installation logic
- Contains: `install.js` - handles setup for Claude Code / OpenCode
- Key files: `bin/install.js` (1300 lines, comprehensive installer)
- Access: Run via `npx get-shit-done-cc`

**`agents/`**
- Purpose: Specialized agent prompt definitions
- Contains: 11 agent definitions for different roles (executor, planner, verifier, etc.)
- Key files: `agents/gsd-executor.md` (executes plans), `agents/gsd-planner.md` (creates plans)
- Access: Spawned by workflows via Task tool, not user-facing

**`commands/gsd/`**
- Purpose: User-facing slash command definitions
- Contains: 27 command specifications with argument hints
- Key files: `commands/gsd/new-project.md`, `commands/gsd/execute-phase.md`, `commands/gsd/plan-phase.md`
- Access: `/gsd:command-name` in Claude Code, `/gsd-command-name` in OpenCode

**`get-shit-done/references/`**
- Purpose: Static knowledge base and patterns
- Contains: 8 reference documents on checkpoints, verification, model profiles, etc.
- Key files: `checkpoints.md` (checkpoint types), `verification-patterns.md` (testing patterns)
- Access: Loaded via @-file includes in agent prompts

**`get-shit-done/workflows/`**
- Purpose: Multi-step orchestration logic
- Contains: 13 workflow files coordinating complex operations
- Key files: `execute-phase.md` (phase execution), `plan-phase.md` (phase planning)
- Access: Called from commands via execution_context, workflows spawn other agents

**`get-shit-done/templates/`**
- Purpose: Templates for generated project artifacts
- Contains: 9 templates for PLAN.md, CONTEXT.md, config.json, etc.
- Key files: `phase-prompt.md` (PLAN.md structure), `config.json` (config defaults)
- Access: Agents use to create consistent output files

**`hooks/`**
- Purpose: Claude Code runtime integrations
- Contains: 2 JS files for statusline display and update checking
- Key files: `gsd-statusline.js` (displays context window and current task)
- Access: Called by Claude Code settings hooks system

**`scripts/`**
- Purpose: Build and maintenance utilities
- Contains: Build scripts for compiling hooks
- Key files: `build-hooks.js` (esbuild configuration)
- Access: Run via `npm run build:hooks`

## Key File Locations

**Entry Points:**
- `bin/install.js`: Installation and setup
- `commands/gsd/new-project.md`: First-time project initialization
- `commands/gsd/help.md`: Help documentation
- `package.json`: NPM metadata and dependencies

**Configuration:**
- `package.json`: Runtime version, dependencies, build scripts
- `get-shit-done/templates/config.json`: Default project configuration
- `GSD-STYLE.md`: Coding conventions and style guide

**Core Logic:**
- `get-shit-done/workflows/plan-phase.md`: Plan creation orchestrator
- `get-shit-done/workflows/execute-phase.md`: Plan execution orchestrator
- `agents/gsd-executor.md`: Atomic plan execution
- `agents/gsd-planner.md`: Plan generation algorithm

**Testing/Verification:**
- `agents/gsd-verifier.md`: Verification agent and patterns
- `get-shit-done/references/verification-patterns.md`: Testing patterns
- `get-shit-done/templates/UAT.md`: User acceptance testing template

## Naming Conventions

**Files:**
- Commands: kebab-case with `.md` extension (e.g., `new-project.md`, `add-phase.md`)
- Agents: `gsd-[role].md` pattern (e.g., `gsd-executor.md`, `gsd-planner.md`)
- Workflows: kebab-case with `.md` extension (e.g., `execute-phase.md`)
- Templates: PascalCase or UPPERCASE with `.md` or `.json` (e.g., `DEBUG.md`, `config.json`)
- References: kebab-case describing content (e.g., `checkpoints.md`, `verification-patterns.md`)

**Directories:**
- Semantic purpose-based names (e.g., `agents/`, `commands/`, `workflows/`)
- Organizational: `gsd/` subdirectory under `commands/` for grouping
- Project artifacts: `.planning/` prefix indicates project-specific (gitignored by default)

**Project Artifact Files:**
- Phase directories: `NN-phase-name/` (zero-padded numbers, e.g., `01-authentication/`)
- Plan files: `{phase}-{plan}-PLAN.md` (e.g., `01-authentication-PLAN.md`)
- Summary files: `{phase}-{plan}-SUMMARY.md`
- State file: `STATE.md` (project state journal)
- Config file: `config.json` (JSON configuration)

## Where to Add New Code

**New Command:**
1. Create file: `commands/gsd/new-command-name.md`
2. Structure: Use YAML frontmatter with name, description, argument-hint, allowed-tools
3. Include: `<objective>`, `<execution_context>`, `<process>`, `<success_criteria>` sections
4. Pattern: Delegate complex logic to workflows via `<execution_context>` references
5. Example: See `commands/gsd/help.md` (simple) or `commands/gsd/new-project.md` (complex)

**New Workflow:**
1. Create file: `get-shit-done/workflows/workflow-name.md`
2. Structure: Start with `<purpose>` and `<core_principle>`, include `<required_reading>`
3. Include: `<process>` section with numbered steps using `<step>` elements
4. Pattern: Each step describes one orchestration task, may spawn agents via Task tool
5. Reference: Workflows are not standalone; called from commands via execution_context

**New Agent:**
1. Create file: `agents/gsd-new-agent.md`
2. Structure: YAML frontmatter with name, description, tools, color
3. Include: `<role>`, `<execution_flow>` or main logic sections
4. Pattern: Agents are isolated subprompts; read STATE.md first, return results
5. Spawning: Only called from workflows, not directly from commands

**New Reference:**
1. Create file: `get-shit-done/references/topic.md`
2. Structure: Semantic outer container (e.g., `<checkpoints>...</checkpoints>`)
3. Include: Guidance, patterns, examples for agents to follow
4. Pattern: Static knowledge, never updated at runtime
5. Reference: Loaded via @-file includes in agent prompts

**New Template:**
1. Create file: `get-shit-done/templates/artifact-name.md` or `.json`
2. Structure: Show actual structure and placeholders [in-brackets]
3. Include: Example filled-in version if helpful
4. Pattern: Agents use to generate consistent output files
5. Reference: Instantiated with actual values during execution

## Special Directories

**`.planning/`:**
- Purpose: Project-specific state and artifacts
- Generated: Yes (created by `new-project` command)
- Committed: Configurable (default: true, but respects .gitignore)
- Contains: STATE.md (state journal), phases/ (phase directories), milestones/ (roadmaps), codebase/ (analysis docs)
- Access: Read/written by all agents and workflows

**`.planning/codebase/`:**
- Purpose: Static codebase analysis documents
- Generated: Yes (created by `map-codebase` command)
- Committed: Yes (if not gitignored)
- Contains: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, STACK.md, INTEGRATIONS.md, CONCERNS.md
- Access: Read by agents when planning/executing (via @-file includes)
- Update: Refresh with `/gsd:map-codebase` after major changes

**`.planning/phases/`:**
- Purpose: Per-phase planning and execution artifacts
- Generated: Yes (created during planning)
- Committed: Configurable
- Contains: `NN-phase-name/` directories with PLAN.md, SUMMARY.md, and checkpoint notes
- Access: Read by execute-phase workflow, written by planner and executor

**`.planning/milestones/`:**
- Purpose: High-level roadmap and milestone tracking
- Generated: Yes (created during project initialization)
- Committed: Configurable
- Contains: ROADMAP.md, milestone progress tracking
- Access: Read by plan-phase when determining next milestone scope

---

*Structure analysis: 2026-01-24*
