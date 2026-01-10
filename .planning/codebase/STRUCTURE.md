# Codebase Structure

**Analysis Date:** 2025-01-10

## Directory Layout

```
get-shit-done/
├── bin/                     # Executable entry points
│   └── install.js          # CLI installation script
├── commands/                # Slash command definitions
│   └── gsd/                # GSD-specific commands
│       ├── help.md         # Help command
│       ├── new-project.md  # Project initialization
│       └── [20+ more .md]  # Other commands
├── get-shit-done/          # Plugin resources
│   ├── references/         # Knowledge base documents
│   │   ├── plan-format.md  # Planning guidelines
│   │   └── [8 more .md]    # Reference materials
│   ├── templates/          # Output generation templates
│   │   ├── project.md      # Project file template
│   │   ├── roadmap.md      # Roadmap template
│   │   └── [17+ more .md]  # Other templates
│   └── workflows/          # Process definitions
│       ├── execute-phase.md # Phase execution workflow
│       ├── plan-phase.md   # Phase planning workflow
│       └── [9 more .md]    # Other workflows
├── assets/                  # Marketing and documentation assets
├── package.json             # Project manifest
└── README.md                # User documentation
```

## Directory Purposes

**bin/**
- Purpose: CLI entry points and installation scripts
- Contains: install.js (Node.js installer), potentially legacy files
- Key files: install.js - handles npx installation and file copying
- Subdirectories: None

**commands/gsd/**
- Purpose: User interface layer - Claude Code slash commands
- Contains: *.md files (one per command with frontmatter metadata)
- Key files: help.md, new-project.md, plan-phase.md, execute-plan.md
- Subdirectories: None (flat structure)

**get-shit-done/references/**
- Purpose: Core philosophy and reusable guidance documents
- Contains: principles.md, questioning.md, plan-format.md, and others
- Key files: principles.md - system philosophy, plan-format.md - planning guidelines
- Subdirectories: None

**get-shit-done/templates/**
- Purpose: Document templates for .planning/ files and workflows
- Contains: Template definitions with frontmatter and examples
- Key files: project.md, roadmap.md, plan.md, summary.md, codebase/ subdirectory
- Subdirectories: codebase/ (templates for codebase analysis)

**get-shit-done/workflows/**
- Purpose: Business logic layer - detailed process instructions
- Contains: Workflow definitions called by slash commands
- Key files: execute-phase.md, research-phase.md, plan-phase.md
- Subdirectories: None

**assets/**
- Purpose: Static assets for documentation and marketing
- Contains: Images and other media files
- Key files: Documentation screenshots, logos
- Subdirectories: None

## Key File Locations

**Entry Points:**
- `bin/install.js` - Installation script (npx entry point)

**Configuration:**
- `package.json` - Project metadata and CLI entry definition
- `.gitignore` - Excluded files and directories

**Core Logic:**
- `bin/install.js` - File copying, path replacement, installation logic

**Documentation:**
- `README.md` - User-facing installation and usage guide
- `CLAUDE.md` - Instructions for working in this repository

## Naming Conventions

**Files:**
- kebab-case.md: All Markdown documents
- kebab-case.js: JavaScript source files
- UPPERCASE.md: Important project files (README.md)

**Directories:**
- kebab-case: All directories (bin, commands, get-shit-done, assets)

**Special Patterns:**
- {command-name}.md: Slash command definition files
- *-template.md: Template files (though not consistently applied)

## Where to Add New Code

**New Slash Command:**
- Primary code: `commands/gsd/{command-name}.md`
- Documentation: Update README.md with new command

**New Template:**
- Implementation: `get-shit-done/templates/{name}.md`
- Documentation: Template is self-documenting with guidelines

**New Workflow:**
- Implementation: `get-shit-done/workflows/{name}.md`
- Usage: Reference from command with @~/.claude/get-shit-done/workflows/{name}.md

**New Reference Document:**
- Implementation: `get-shit-done/references/{name}.md`
- Usage: Reference from commands/workflows as needed

**Utilities:**
- No utilities directory yet - consider `src/utils/` if JavaScript utilities needed

## Special Directories

**get-shit-done/**
- Purpose: Resources copied to Claude installation directory
- Source: Repository files (source of truth)
- Committed: Yes

**commands/**
- Purpose: Slash commands installed to Claude configuration
- Source: Repository files (source of truth)
- Committed: Yes

---

*Structure analysis: 2025-01-10*
*Update when directory structure changes*