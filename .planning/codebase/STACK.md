# Technology Stack

**Analysis Date:** 2026-01-31

## Languages
**Primary:**
- JavaScript (ES2020+) - All application code in `bin/install.js`, `scripts/build-hooks.js`, `hooks/*.js`

## Runtime
**Environment:**
- Node.js >=16.7.0 (specified in `package.json` engines field)
- No browser runtime (CLI tool only)

**Package Manager:**
- npm (version managed by user's Node.js installation)
- Lockfile: `package-lock.json` present

## Frameworks
**Core:**
- None (vanilla Node.js CLI tool)

**Build/Dev:**
- esbuild ^0.24.0 - Build tool for bundling hooks (dev dependency)
- Node.js built-in modules - fs, path, os, child_process, readline

## Key Dependencies
**Critical:**
- None (zero runtime dependencies - pure Node.js)

**Dev Dependencies:**
- esbuild ^0.24.0 - Used by `scripts/build-hooks.js` to prepare hooks for distribution

## Configuration
**Build:**
- `package.json` - Package manifest, scripts, and metadata
- `scripts/build-hooks.js` - Build script that copies hooks to `hooks/dist/`
- No TypeScript config (pure JavaScript)
- No bundler config (esbuild used programmatically)

**Package Distribution:**
- Published to npm as `get-shit-done-cc`
- Installed via `npx get-shit-done-cc` or `npm install -g get-shit-done-cc`
- Files included: `bin/`, `commands/`, `get-shit-done/`, `agents/`, `hooks/dist/`, `scripts/`

## Platform Requirements
**Development:**
- macOS/Linux/Windows (any platform with Node.js >=16.7.0)
- No external system dependencies

**Production:**
- Distributed as npm package
- Installed to user's runtime config directories:
  - Claude Code: `~/.claude/` (or `CLAUDE_CONFIG_DIR`)
  - OpenCode: `~/.config/opencode/` (or `OPENCODE_CONFIG_DIR` / `XDG_CONFIG_HOME`)
  - Gemini CLI: `~/.gemini/` (or `GEMINI_CONFIG_DIR`)
- Runs on user's Node.js installation

---
*Stack analysis: 2026-01-31*
