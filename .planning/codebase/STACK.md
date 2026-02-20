# Technology Stack

**Analysis Date:** 2026-02-20

## Languages

**Primary:**
- JavaScript (Node.js) - All runtime code, CLI tools, hooks

**Secondary:**
- Markdown - Commands, workflows, agents, templates, documentation
- YAML - Frontmatter in markdown files, GitHub workflows
- JSON - Configuration files, package manifests
- TOML - Gemini CLI command conversion target

## Runtime

**Environment:**
- Node.js >= 16.7.0 (specified in `package.json` engines)

**Package Manager:**
- npm
- Lockfile: Not committed (no package-lock.json in repo)

## Frameworks

**Core:**
- None - Pure Node.js standard library, no runtime framework

**Testing:**
- Node.js built-in test runner (`node:test`) - Unit testing for gsd-tools
- Node.js built-in assert (`node:assert`) - Assertions

**Build/Dev:**
- esbuild ^0.24.0 - Listed in devDependencies (hooks bundling)
- Custom build script `scripts/build-hooks.js` - Copies hooks to dist

## Key Dependencies

**Critical:**
- Zero runtime dependencies - All code uses Node.js built-in modules only

**Infrastructure (devDependencies):**
- esbuild ^0.24.0 - Build tooling for hooks

**Node.js Built-in Modules Used:**
- `fs` - File system operations
- `path` - Path manipulation
- `os` - Home directory, platform detection
- `readline` - Interactive prompts
- `crypto` - SHA256 hashing for file manifests
- `child_process` - spawn/execSync for background processes

## Configuration

**Environment:**
- `CLAUDE_CONFIG_DIR` - Custom Claude Code config directory
- `OPENCODE_CONFIG_DIR` / `OPENCODE_CONFIG` - OpenCode config paths
- `GEMINI_CONFIG_DIR` - Gemini config directory
- `XDG_CONFIG_HOME` - XDG base directory spec support

**Runtime Configuration Files:**
- `~/.claude/settings.json` - Claude Code settings, hooks, statusline
- `~/.config/opencode/opencode.json` - OpenCode permissions, settings
- `~/.gemini/settings.json` - Gemini settings

**Build:**
- `package.json` - npm package manifest
- `scripts/build-hooks.js` - Hook preparation script

## File Structure by Type

**JavaScript Files:**
- `bin/install.js` - Main installer CLI (1800+ lines)
- `hooks/gsd-statusline.js` - Statusline hook for Claude Code
- `hooks/gsd-check-update.js` - Update checker hook
- `scripts/build-hooks.js` - Build script
- `get-shit-done/bin/gsd-tools.cjs` - Core CLI utility (189KB, extensive)
- `get-shit-done/bin/gsd-tools.test.cjs` - Test suite (85KB)

**Markdown Files:**
- `commands/gsd/*.md` - 30 slash commands
- `agents/*.md` - 11 agent definitions
- `get-shit-done/workflows/*.md` - Workflow implementations
- `get-shit-done/references/*.md` - Reference documentation
- `get-shit-done/templates/*.md` - Template files

## Platform Requirements

**Development:**
- Node.js >= 16.7.0
- npm for package management
- Git for version control

**Production:**
- Distributed via npm (`npx get-shit-done-cc`)
- Installs to `~/.claude/`, `~/.config/opencode/`, or `~/.gemini/`
- Supports Claude Code, OpenCode, and Gemini CLI runtimes

## Build Process

**Hook Preparation:**
```bash
npm run build:hooks  # Copies hooks to hooks/dist/
```

**Pre-publish:**
```bash
npm run prepublishOnly  # Runs build:hooks before npm publish
```

**Testing:**
```bash
npm test  # Runs node --test get-shit-done/bin/gsd-tools.test.js
```

## Installation Targets

**Claude Code:**
- Global: `~/.claude/`
- Local: `./.claude/`

**OpenCode:**
- Global: `~/.config/opencode/` (XDG compliant)
- Local: `./.opencode/`

**Gemini:**
- Global: `~/.gemini/`
- Local: `./.gemini/`

---

*Stack analysis: 2026-02-20*
