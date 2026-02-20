# Technology Stack

**Analysis Date:** 2026-01-24

## Languages

**Primary:**
- JavaScript (Node.js) - All runtime code, CLI tools, hooks, build scripts

**Secondary:**
- Markdown - Documentation, command specs, agent definitions, configuration files

## Runtime

**Environment:**
- Node.js 16.7.0 or higher (specified in `package.json` engines field)

**Package Manager:**
- npm (Node Package Manager)
- Lockfile: `package-lock.json` present and maintained (lockfileVersion 3)

## Frameworks

**Core:**
- Vanilla Node.js stdlib - No external web framework dependencies
  - Built-in modules: `fs`, `path`, `os`, `readline`, `child_process`

**Build/Dev:**
- esbuild ^0.24.0 - Used for bundling hook scripts (defined in `devDependencies`)

**CLI Framework:**
- Custom CLI implementation using Node.js - Interactive installer with color-coded output

## Key Dependencies

**Critical:**
- esbuild 0.24.2+ - Bundler for hook compilation and distribution

**Zero Production Dependencies:**
- The project explicitly maintains an empty `dependencies` object in `package.json`
- All runtime code uses only Node.js built-in modules

## Configuration

**Environment:**
- Claude Code config: `~/.claude/` (with fallback to `CLAUDE_CONFIG_DIR` env var)
- OpenCode config: `~/.config/opencode/` (XDG Base Directory spec compliant, with fallback to `OPENCODE_CONFIG_DIR` env var)

**Build:**
- Build script: `/Users/trekkie/projects/get-shit-done/scripts/build-hooks.js`
- Output location: `hooks/dist/` (created during `npm run build:hooks`)
- Run via: `npm run prepublishOnly` (automatic pre-publication)

**Version Management:**
- Current version: 1.9.13 (from `package.json`)
- Version tracking file: `get-shit-done/VERSION` (written at installation)

## Platform Requirements

**Development:**
- Node.js 16.7.0+
- npm (any recent version)
- Works on Mac, Windows, and Linux

**Production:**
- Same as development
- No database required
- No external services required
- Filesystem access to user's home directory

## Installation & Distribution

**Package Registry:**
- Published to npm as `get-shit-done-cc`
- Installed via: `npx get-shit-done-cc`
- Installation modes:
  - Global: Installs to `~/.claude/` or `~/.config/opencode/` (configurable)
  - Local: Installs to `./.claude/` or `./.opencode/` within project

**Installation Artifacts:**
- Commands (markdown): `commands/gsd/` directory (flattened to `command/gsd-*.md` for OpenCode)
- Agents (markdown): `agents/` directory with `gsd-*.md` files
- Skill templates: `get-shit-done/` directory
- Hooks (JavaScript): `hooks/dist/` (copied from source to target config directory)
- Documentation: `CHANGELOG.md` copied to installation

## Runtime Characteristics

**Memory-Resident:**
- Hook processes spawned by Claude Code/OpenCode sessions
- Background update check spawned separately with `child_process.spawn()`

**State Management:**
- File-based: JSON caches stored in `~/.claude/cache/`
- Session data: `~/.claude/todos/` directory
- Settings: `settings.json` in Claude Code/OpenCode config directory

---

*Stack analysis: 2026-01-24*
