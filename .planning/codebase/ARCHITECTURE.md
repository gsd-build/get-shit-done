# Architecture

**Analysis Date:** 2025-01-14

## Pattern Overview

**Overall:** Meta-Prompting Framework with Plugin Architecture

**Key Characteristics:**
- Single installer executable with editor-specific plugins
- File-based template and workflow system
- No persistent runtime services
- Editor integration via extension APIs
- Markdown-driven command system

## Layers

**Installation Layer:**
- Purpose: Deploy GSD system to target editors
- Contains: CLI installer, configuration manager, path resolution
- Location: `bin/*.js`
- Depends on: Node.js runtime only
- Used by: End users via npm

**Command Layer:**
- Purpose: Define slash commands for Claude Code
- Contains: Command definitions, argument parsing, help text
- Location: `commands/gsd/*.md`
- Depends on: Claude Code's slash command system
- Used by: Claude Code users via `/gsd:*` commands

**Template Layer:**
- Purpose: Provide reusable document structures
- Contains: Markdown templates for various development artifacts
- Location: `get-shit-done/templates/*.md`
- Depends on: File system for instantiation
- Used by: Commands and workflows

**Workflow Layer:**
- Purpose: Orchestrate complex multi-step development processes
- Contains: Detailed workflow definitions with agent coordination
- Location: `get-shit-done/workflows/*.md`
- Depends on: Template layer, Claude's agent spawning capabilities
- Used by: Advanced commands like execute-phase

**Extension Layer:**
- Purpose: Bridge GSD commands to VSCode-based editors
- Contains: VSCode extension with command translation
- Location: `commands/opencode/extension.js`
- Depends on: VSCode extension API
- Used by: OpenCode users via VSCode commands

## Data Flow

**Installation Flow:**

1. User runs `npx get-shit-done-cc --global`
2. Installer detects editor (Claude vs OpenCode)
3. Copies command files to `~/.{editor}/commands/gsd/`
4. Copies templates to `~/.{editor}/get-shit-done/`
5. Updates editor configuration

**Command Execution (Claude Code):**

1. User types `/gsd:help`
2. Claude loads corresponding `.md` file from `~/.claude/commands/gsd/help.md`
3. Claude processes embedded prompts and objectives
4. Claude executes the defined workflow

**Command Execution (OpenCode):**

1. User runs `opencode.gsd.help` command
2. VSCode extension translates to `/gsd:help` equivalent
3. Extension reads markdown file and displays guidance
4. For agent commands: Shows limitation message (not yet supported)

**State Management:**
- File-based: All project state in `.planning/` directory
- No database or persistent services
- Configuration in JSON files per editor

## Key Abstractions

**Command Definition:**
- Purpose: Encapsulate a specific GSD operation
- Examples: `commands/gsd/help.md`, `commands/gsd/new-project.md`
- Pattern: YAML frontmatter + Markdown content with embedded prompts

**Template:**
- Purpose: Reusable document structure
- Examples: `get-shit-done/templates/PROJECT.md`, `get-shit-done/templates/PLAN.md`
- Pattern: Markdown with placeholder variables and sections

**Workflow:**
- Purpose: Complex multi-agent orchestration
- Examples: `get-shit-done/workflows/execute-phase.md`, `get-shit-done/workflows/plan-phase.md`
- Pattern: Detailed process definitions with agent spawning and coordination

**ConfigManager:**
- Purpose: Handle editor-specific configuration
- Examples: `bin/config-manager.js`
- Pattern: Class-based configuration with fallbacks

## Entry Points

**CLI Entry:**
- Location: `bin/install.js`
- Triggers: `npx get-shit-done-cc` or `npm run get-shit-done-cc`
- Responsibilities: Parse args, detect editor, copy files, update config

**Claude Commands:**
- Location: `~/.claude/commands/gsd/*.md` (after installation)
- Triggers: `/gsd:*` slash commands in Claude Code
- Responsibilities: Guide Claude through specific operations

**OpenCode Commands:**
- Location: `commands/opencode/extension.js`
- Triggers: `opencode.gsd.*` commands in VSCode
- Responsibilities: Translate commands and show guidance

## Error Handling

**Strategy:** Fail-fast with descriptive messages

**Patterns:**
- CLI installer: Console.error and process.exit(1)
- Extensions: VSCode error messages and output channels
- Commands: Built into Claude's error handling

## Cross-Cutting Concerns

**Configuration:**
- Editor-specific settings in `~/.{editor}/settings.json`
- GSD config under `gsd` key with defaults

**File Operations:**
- Path expansion for `~/` notation
- Recursive directory copying with content replacement
- Atomic writes (though not explicitly implemented)

**Editor Detection:**
- Environment variables (`CLAUDE_CONFIG_DIR`, `OPENCODE_CONFIG_DIR`)
- Directory existence checks
- Process detection (basic pgrep)

---

*Architecture analysis: 2025-01-14*
*Update when major patterns change*