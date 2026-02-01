# Technology Stack

**Analysis Date:** 2026-02-01

## Languages

**Primary:**
- JavaScript - v16.7.0+ (Node.js runtime) - CLI installation and hooks
- Markdown - Command/workflow definitions and documentation

**Secondary:**
- YAML - Configuration and frontmatter in command files
- TOML - Configuration conversion for Gemini CLI

## Runtime

**Environment:**
- Node.js v16.7.0 or higher (specified in `package.json` engines field)
- Cross-platform: macOS, Windows, Linux

**Package Manager:**
- npm (Node Package Manager)
- Lockfile: `package-lock.json` present (v3 lockfile format)

## Frameworks

**Build/Dev:**
- esbuild ^0.24.0 - JavaScript bundler for preparing distributions

**No frameworks for core application** - GSD is a pure Node.js CLI/installer with no web framework dependencies. The entire system is framework-agnostic and runs within Claude Code, OpenCode, and Gemini CLI environments.

## Key Dependencies

**Production Dependencies:**
- None (empty dependencies object in package.json)

**DevDependencies:**
- esbuild ^0.24.0 - Only dev-time dependency for building hooks

This is intentional - GSD uses only Node.js built-in modules:
- `fs` - File system operations
- `path` - Path manipulation
- `os` - OS operations (home directory, platform detection)
- `readline` - Interactive CLI prompts
- `child_process` - Spawning background processes for update checks

## Configuration

**Environment:**

The system respects environment variables for config directory location:
- `CLAUDE_CONFIG_DIR` - Override Claude Code config directory (default: `~/.claude`)
- `OPENCODE_CONFIG_DIR` - Override OpenCode config directory (used with XDG Base Directory spec)
- `XDG_CONFIG_HOME` - XDG standard for OpenCode config (default: `~/.config`)
- `GEMINI_CONFIG_DIR` - Override Gemini CLI config directory (default: `~/.gemini`)

**Build:**
- `scripts/build-hooks.js` - Copies hooks to `hooks/dist/` for packaging
- `bin/install.js` - Main installer (1400+ lines, handles all runtime setup)

**Config Files:**
- `.planning/config.json` - Project-level GSD configuration (created during `/gsd:new-project`)
- `~/.claude/settings.json` - Claude Code settings (hooks, statusline configuration)
- `~/.config/opencode/opencode.json` - OpenCode settings (permissions, hooks)
- `~/.gemini/settings.json` - Gemini CLI settings (experimental agents, hooks)

**Key config locations created by installer:**
- `{config_dir}/commands/gsd/` - GSD slash commands (Claude/Gemini)
- `{config_dir}/command/gsd-*.md` - Flattened commands (OpenCode only)
- `{config_dir}/agents/` - GSD agents (available to all runtimes)
- `{config_dir}/get-shit-done/` - GSD reference docs and templates
- `{config_dir}/hooks/` - Hooks for status display and update checks

## Platform Requirements

**Development:**
- Node.js 16.7.0 or higher
- npm (bundled with Node.js)
- Git (for version control, not required for installation)
- Terminal/shell (bash, zsh, sh, PowerShell on Windows)

**Production:**
- Claude Code, OpenCode, or Gemini CLI (the runtime platforms)
- No additional server or cloud infrastructure
- Works offline after installation
- Optional: npm access for `npm view get-shit-done-cc version` (update checking only)

**Cross-Platform Support:**
- macOS - Full support, tested
- Linux - Full support, tested
- Windows - Full support with PowerShell/cmd.exe path handling

## Package Publishing

**NPM Package:**
- Package name: `get-shit-done-cc`
- Current version: 1.11.1
- Registry: npmjs.org
- Entry point: `bin/install.js` (executable via `npx get-shit-done-cc`)
- Installation method: `npm install -g get-shit-done-cc` or `npx get-shit-done-cc`

**Packaged Files:**
```json
"files": [
  "bin",
  "commands",
  "get-shit-done",
  "agents",
  "hooks/dist",
  "scripts"
]
```

Excluded from NPM package:
- `.git/` - Version control
- `.github/` - CI/CD workflows
- `hooks/*.js` - Source hooks (pre-bundled as `hooks/dist/`)
- `node_modules/` - Dependencies
- Documentation files not in core functionality

---

*Stack analysis: 2026-02-01*
