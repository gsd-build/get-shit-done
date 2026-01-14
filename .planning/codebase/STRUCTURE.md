# Codebase Structure

**Analysis Date:** 2025-01-14

## Directory Layout

```
get-shit-done/
├── bin/                # Installation and utility scripts
├── commands/           # Command definitions and extensions
│   └── gsd/           # GSD-specific commands
├── get-shit-done/     # Skill resources
│   ├── references/    # Principle documents
│   ├── templates/     # File templates
│   └── workflows/     # Multi-step procedures
├── docs/               # Documentation and planning materials
├── assets/             # Static assets
├── .claude/            # Claude Code installation target
├── .opencode/          # OpenCode installation target
├── package.json        # Project manifest
└── README.md           # User documentation
```

## Directory Purposes

**bin/**
- Purpose: Installation and utility scripts
- Contains: JavaScript executables (*.js files)
- Key files: install.js (main installer), config-manager.js, agent-bridge.js, test-opencode-integration.js
- Subdirectories: None

**commands/gsd/**
- Purpose: Slash command definitions for Claude Code
- Contains: Markdown files with command definitions
- Key files: help.md, new-project.md, plan-phase.md, execute-plan.md, map-codebase.md
- Subdirectories: None (flat structure)

**get-shit-done/references/**
- Purpose: Core philosophy and guidance documents
- Contains: principles.md, questioning.md, plan-format.md
- Key files: principles.md (system philosophy)
- Subdirectories: None

**get-shit-done/templates/**
- Purpose: Document templates for .planning/ files
- Contains: Template definitions with frontmatter
- Key files: project.md, roadmap.md, plan.md, summary.md
- Subdirectories: codebase/ (analysis templates)

**get-shit-done/workflows/**
- Purpose: Reusable multi-step procedures
- Contains: Workflow definitions called by commands
- Key files: execute-plan.md, research-phase.md, map-codebase.md
- Subdirectories: None

**docs/**
- Purpose: Documentation and planning materials
- Contains: Various documentation files
- Key files: opencode.md (integration docs)
- Subdirectories: None

**assets/**
- Purpose: Static assets
- Contains: Images, icons, or other static files
- Key files: Not specified in analysis
- Subdirectories: None

## Key File Locations

**Entry Points:**
- `bin/install.js` - CLI entry point for installation
- `commands/opencode/extension.js` - VSCode extension entry point
- `~/.claude/commands/gsd/*.md` - Claude Code command entry points (after installation)

**Configuration:**
- `package.json` - Project metadata and npm configuration
- `commands/opencode/package.json` - VSCode extension configuration
- `.opencode/package.json` - OpenCode plugin configuration

**Core Logic:**
- `bin/install.js` - Installation logic and file operations
- `bin/config-manager.js` - Configuration management
- `bin/agent-bridge.js` - Agent coordination and delegation
- `get-shit-done/templates/` - Template processing logic

**Testing:**
- `bin/test-opencode-integration.js` - Integration test suite
- `test-output/` - Test artifacts and verification files

**Documentation:**
- `README.md` - User installation and usage guide
- `docs/opencode.md` - OpenCode integration documentation
- `get-shit-done/references/` - Developer philosophy and principles

## Naming Conventions

**Files:**
- kebab-case.js: JavaScript source files
- kebab-case.md: Markdown documents
- UPPERCASE.md: Important project files (README.md)
- PascalCase: Class names in JavaScript

**Directories:**
- kebab-case: All directories
- plural names: commands/, templates/, workflows/, references/
- dot-prefix: .claude/, .opencode/ (hidden directories)

**Special Patterns:**
- {command-name}.md: Slash command definition files
- *-template.md: Template files with embedded variables
- test-*.js: Test files with descriptive prefixes

## Where to Add New Code

**New Slash Command:**
- Primary code: `commands/gsd/{command-name}.md`
- Documentation: Update `README.md` with new command
- Tests: Add to `bin/test-opencode-integration.js` if applicable

**New Template:**
- Implementation: `get-shit-done/templates/{name}.md`
- Documentation: Template is self-documenting with guidelines

**New Workflow:**
- Implementation: `get-shit-done/workflows/{name}.md`
- Usage: Reference from command with `@./.opencode/get-shit-done/workflows/{name}.md`

**New Reference Document:**
- Implementation: `get-shit-done/references/{name}.md`
- Usage: Reference from commands/workflows as needed

**Utilities:**
- Shared helpers: `bin/{utility-name}.js`
- Core utilities: Add to existing bin files or create new ones

## Special Directories

**get-shit-done/**
- Purpose: Resources installed to ./.opencode/ during installation
- Source: Copied by bin/install.js during installation
- Committed: Yes (source of truth)

**commands/**
- Purpose: Slash commands installed to ./.opencode/commands/
- Source: Copied by bin/install.js during installation
- Committed: Yes (source of truth)

---

*Structure analysis: 2025-01-14*
*Update when directory structure changes*