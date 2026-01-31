# Technology Stack

**Analysis Date:** 2026-01-31

## Languages

**Primary:**
- JavaScript (Node.js) - Core CLI application, installer, hooks

**No secondary languages** - Pure JavaScript monorepo

## Runtime

**Environment:**
- Node.js >= 16.7.0 (specified in `package.json` engines field)

**Package Manager:**
- pnpm (preferred, lockfile: `pnpm-lock.yaml`)
- Supports npm as fallback (for `npm view` version checks)

## Frameworks

**Core:**
- None - Pure Node.js with built-in modules only (fs, path, os, readline, child_process)

**Build/Asset Processing:**
- esbuild 0.24.0 - Bundles/copies JavaScript hooks from `hooks/` to `hooks/dist/` for installation

**Execution Model:**
- CLI-based installer (`bin/install.js`) - handles multi-runtime setup and configuration
- Markdown command/agent system - all commands and agents are `.md` files with YAML frontmatter
- Hook system - simple Node.js scripts that integrate with Claude Code statusline

## Key Dependencies

**Production:**
- None - Zero production dependencies for the main package

**Development:**
- esbuild 0.24.0 - For copying and preparing hooks during build
  - Platform-specific binaries (@esbuild/darwin-arm64, @esbuild/linux-x64, etc.)
  - Used in: `pnpm build:hooks` and prepublishOnly hook

**No Testing Frameworks Specified** - No test files in repository structure

## Configuration

**Environment:**
- Configuration via environment variables for runtime-specific config directories:
  - `CLAUDE_CONFIG_DIR` - Override Claude Code config path (default: `~/.claude`)
  - `OPENCODE_CONFIG_DIR` - Override OpenCode config path (default: `~/.config/opencode` per XDG spec)
  - `GEMINI_CONFIG_DIR` - Override Gemini config path (default: `~/.gemini`)
  - `XDG_CONFIG_HOME` - XDG Base Directory fallback for OpenCode (default: `~/.config`)

**Build Configuration:**
- `pnpm-lock.yaml` - Lockfile for dependency reproducibility
- `.npmrc` optional - No `.npmrc` detected in repository
- No TypeScript config - Pure JavaScript, no transpilation

**Runtime Configuration:**
- `settings.json` - Generated in config directories for each runtime (Claude Code, OpenCode, Gemini)
- `config.json` - Per-project configuration template at `get-shit-done/templates/config.json`
  - Stores workflow mode, depth, parallelization settings, safety gates

## Installation & Distribution

**Publication:**
- npm registry: `get-shit-done-together`
- Published as scoped or unscoped package depending on npm account
- Versioning: Semantic Versioning (MAJOR.MINOR.PATCH)
- Entry point: `bin/install.js` (CLI binary)

**Installation Methods:**
- Global: `npx get-shit-done-together --global`
- Local (project-only): `npx get-shit-done-together --local`
- Interactive: `npx get-shit-done-together` (prompts for runtime and location)
- Multi-runtime: `npx get-shit-done-together --all --global`

**Distribution:**
- Published files (from `package.json` files array):
  - `bin/` - Installer executable
  - `commands/gsd/` - All GSD commands (27 commands total)
  - `agents/gsd-*.md` - Agent definitions (11 agents)
  - `hooks/dist/` - Built hooks for statusline and update checking
  - `get-shit-done/` - Reference docs, templates, workflows
  - `scripts/` - Build scripts

## Platform Support

**Development:**
- macOS (Darwin) - Tested on arm64
- Linux - EBuild supports all Linux architectures
- Windows - Path handling for cross-platform compatibility

**Production/Installation:**
- Works on Mac, Windows, and Linux (as per README.md)
- Multi-runtime support:
  - Claude Code (macOS, Windows, Linux)
  - OpenCode (open source, free models)
  - Gemini CLI (Google's model runtime)

## Compilation & Build

**Build Process:**
```bash
pnpm build:hooks  # Copies JS hooks to hooks/dist/
```

**Prepublish Hook:**
- `pnpm run build:hooks` runs automatically before `pnpm publish`
- No bundling or minification - hooks copied as-is to distribution

**Development Setup:**
```bash
pnpm install              # Install dependencies
pnpm link --global        # Link for global CLI testing
pnpm dev:local           # Install to ./.claude/ for testing
```

## Version Management

**Current Version:** 2.0.0 (from `package.json`)

**Version Tracking:**
- VERSION file written to config directory during installation
  - `~/.claude/get-shit-done/VERSION` (global Claude Code)
  - `./.claude/get-shit-done/VERSION` (local Claude Code)
  - `~/.gemini/get-shit-done/VERSION` (Gemini)
  - `~/.config/opencode/get-shit-done/VERSION` (OpenCode)

**Update Mechanism:**
- `gsd-check-update.js` hook runs at session start
- Checks npm registry via `npm view get-shit-done-together version`
- Caches result in `~/.claude/cache/gsd-update-check.json`
- Updates checked silently in background (10-second timeout)

---

*Stack analysis: 2026-01-31*
