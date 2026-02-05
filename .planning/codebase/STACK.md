# Technology Stack

**Analysis Date:** 2026-02-05

## Languages

**Primary:**
- JavaScript - Used for all executable code (CLI tools, hooks, installation scripts)
- Markdown - Used for all documentation files, command definitions, agent specifications, and workflows

**Secondary:**
- YAML - Used in configuration within markdown frontmatter (agent metadata, command options)
- JSON - Used for package manifests and configuration files

## Runtime

**Environment:**
- Node.js v16.7.0+ (minimum requirement per `package.json` engines field)
- Current development environment: Node.js v22.21.1

**Package Manager:**
- npm v11.5.1 (development)
- npm v6+ (minimum for installation)
- Lockfile: `package-lock.json` (v3, present)

## Frameworks

**Core:**
- Node.js core modules only (no framework dependencies)
  - `fs` - File system operations
  - `path` - Cross-platform path handling
  - `os` - Operating system information and home directory resolution
  - `readline` - Interactive CLI prompts
  - `child_process` - Process spawning for background hooks and npm checks
  - `process` - Process environment variables and exit codes

**Build/Dev:**
- esbuild v0.24.0 - Build tool for bundling hooks (devDependency only, used for `npm run build:hooks`)

## Key Dependencies

**Zero Production Dependencies:** This is a zero-dependency tool by design. All functionality uses Node.js standard library only.

**Build Chain:**
- esbuild v0.24.0 (devDependency) - Compiles hooks from `hooks/*.js` to `hooks/dist/*.js`
- npm - Package management and lifecycle scripts

## Configuration

**Environment:**
The system reads environment variables for runtime configuration:

**Supported Environment Variables:**
- `OPENCODE_CONFIG_DIR` - OpenCode configuration directory override
- `OPENCODE_CONFIG` - OpenCode config file path (for deriving directory)
- `XDG_CONFIG_HOME` - XDG Base Directory standard for OpenCode config
- `GEMINI_CONFIG_DIR` - Gemini CLI configuration directory override
- `CLAUDE_CONFIG_DIR` - Claude Code configuration directory override (uses `~/.claude/` if not set)

**Default Configuration Paths:**
- Claude Code: `~/.claude/get-shit-done/` (global) or `./.claude/get-shit-done/` (local project)
- OpenCode: `~/.config/opencode/get-shit-done/` (XDG Base Directory compliant)
- Gemini CLI: `~/.gemini/get-shit-done/` (global) or `./.gemini/get-shit-done/` (local project)

**Build:**
- `scripts/build-hooks.js` - Copies hooks from `hooks/` to `hooks/dist/` for distribution
- No bundler configuration (hooks are pure Node.js, no transpilation needed)
- ESBuild required only as devDependency for potential future build optimization

## Platform Requirements

**Development:**
- Node.js >=16.7.0
- npm >=6.0.0
- Git (for version tracking and hooks)
- Bash/PowerShell/zsh compatible shell (for CLI usage)
- Cross-platform support: Windows, macOS, Linux

**Production:**
- Deployment target: npm registry (npmjs.org)
- Installation method: `npm install -g get-shit-done-cc` (global) or `npm install` (local)
- Installation runs: `node bin/install.js` which copies files to AI IDE config directories
- Supports three AI IDE runtimes:
  - Claude Code (by Anthropic)
  - OpenCode (open source alternative)
  - Gemini CLI (by Google)

## Module Structure

**Distribution Package (`files` in package.json):**
- `bin/` - CLI entry point and installer script
- `commands/` - Command definitions for each `/gsd:*` command
- `get-shit-done/` - Reference materials, templates, workflows
- `agents/` - Agent specification documents
- `hooks/dist/` - Compiled Git hooks (pre-computed, not built on install)
- `scripts/` - Build scripts (for maintainers only)

**Runtime File Organization:**
- `bin/install.js` - Interactive installer (~700 lines, handles all three runtimes)
- `hooks/gsd-*.js` - Git hooks (statusline, update check, precompact)
- `hooks/dist/gsd-*.js` - Distribution copies of hooks
- `scripts/build-hooks.js` - Build script (development only)

## Special Notes

**No External API Clients:** The system does not depend on any npm packages for API communication. All API integration happens through the AI IDE runtimes (Claude Code, OpenCode, Gemini), which provide their own SDK implementations via custom agents and commands.

**Install-Time Behavior:** Installation modifies user's IDE config directories (creates `.claude/`, `.opencode/`, `.gemini/` directories) with GSD command definitions and hooks. No global system installation required beyond npm.

**Hook System:** GSD installs custom Git hooks to user projects:
- Pre-commit hooks for version checks and status line updates
- Hooks run in user's project context, not in GSD installation directory
- Hooks are pure Node.js (no bundling or external deps needed)

---

*Stack analysis: 2026-02-05*
