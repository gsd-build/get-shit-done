# Technology Stack

**Analysis Date:** 2026-02-05

## Languages

**Primary:**
- JavaScript (Node.js) - All runtime code (`bin/install.js`, `hooks/*.js`, `scripts/*.js`)

**Secondary:**
- Markdown - Commands, agents, workflows, templates, and documentation
- PowerShell/Bash - Installation scripts for Cursor IDE (`cursor-gsd/scripts/`)
- JSON - Configuration files (`package.json`, `config.json`)
- YAML - Agent frontmatter definitions
- TOML - Gemini CLI command format (generated during install)

## Runtime

**Environment:**
- Node.js >= 16.7.0 (specified in `package.json` engines field)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (present, lockfileVersion 3)

## Frameworks

**Core:**
- None - Pure Node.js with built-in modules only

**Testing:**
- None detected - No test framework configured

**Build/Dev:**
- esbuild ^0.24.0 - Used for bundling hooks (`scripts/build-hooks.js`)

## Key Dependencies

**Runtime Dependencies:**
- None - Zero runtime dependencies (`"dependencies": {}` in package.json)

**Dev Dependencies:**
- esbuild ^0.24.2 - JavaScript bundler for hooks distribution

**Built-in Node.js Modules Used:**
- `fs` - File system operations
- `path` - Path manipulation
- `os` - System information (homedir)
- `readline` - Interactive prompts
- `child_process` (spawn, execSync) - Background processes and npm commands

## Configuration

**Environment Variables:**
- `CLAUDE_CONFIG_DIR` - Custom Claude Code config directory
- `OPENCODE_CONFIG_DIR` - Custom OpenCode config directory
- `OPENCODE_CONFIG` - OpenCode config file path
- `GEMINI_CONFIG_DIR` - Custom Gemini config directory
- `XDG_CONFIG_HOME` - XDG base directory (for OpenCode)

**Project Configuration:**
- `.planning/config.json` - GSD project settings (mode, depth, workflow, parallelization, gates, safety)

**Build Configuration:**
- `package.json` - npm package definition
- `scripts/build-hooks.js` - Hook bundling script

## Platform Requirements

**Development:**
- Node.js >= 16.7.0
- npm (for dependency management)
- Git (for version control)

**Production/Distribution:**
- Published to npm as `get-shit-done-cc`
- Installed via `npx get-shit-done-cc`
- Supports Mac, Windows, and Linux

**Target Runtimes:**
- Claude Code - Installs to `~/.claude/` (global) or `./.claude/` (local)
- OpenCode - Installs to `~/.config/opencode/` (XDG compliant)
- Gemini CLI - Installs to `~/.gemini/`
- Cursor IDE - Installs to `~/.cursor/` (separate distribution in `cursor-gsd/`)

## Package Distribution

**npm Package:**
- Name: `get-shit-done-cc`
- Version: 1.11.1
- License: MIT
- Binary: `get-shit-done-cc` → `bin/install.js`

**Published Files:**
- `bin/` - Installer script
- `commands/` - Slash commands
- `get-shit-done/` - Templates, workflows, references
- `agents/` - Agent definitions
- `hooks/dist/` - Bundled hooks
- `scripts/` - Build scripts

## File Organization

**Source Structure:**
```
bin/install.js          # Main installer (1500+ lines)
hooks/                   # Hook source files
  gsd-check-update.js   # Update checker
  gsd-statusline.js     # Status bar display
scripts/
  build-hooks.js        # Copies hooks to dist/
agents/*.md             # Agent definitions
commands/gsd/*.md       # Slash commands
get-shit-done/          # Core system files
  templates/            # Planning templates
  workflows/            # Workflow definitions
  references/           # Reference documentation
cursor-gsd/             # Cursor IDE variant (separate distribution)
```

---

*Stack analysis: 2026-02-05*
