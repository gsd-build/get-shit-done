# Technology Stack

**Analysis Date:** 2026-02-06

## Languages

**Primary:**
- JavaScript - Runtime scripting for CLI and hooks
- TypeScript 5.3.0 - Type-safe development for gsd-memory MCP server

**Secondary:**
- Markdown - Configuration templates and documentation

## Runtime

**Environment:**
- Node.js >= 16.7.0 (root package)
- Node.js >= 18.0.0 (gsd-memory)

**Package Manager:**
- npm (lockfiles present: package-lock.json, gsd-memory/package-lock.json)

## Frameworks

**Core:**
- Model Context Protocol (MCP) SDK v1.0.0 - MCP server implementation for gsd-memory
- No Web framework (CLI tool, not web-based)

**CLI & Installation:**
- esbuild 0.24.0 - Hook bundling for distribution

**Testing:**
- Vitest 1.0.0 - Unit and integration test runner for gsd-memory
- Location: `gsd-memory/vitest.config.ts`

**Build/Dev:**
- TypeScript Compiler (tsc) - Builds TypeScript to ES2022 JavaScript
- ESM module system (NodeNext) for modern Node.js

## Key Dependencies

**Critical:**

- `@modelcontextprotocol/sdk` v1.0.0 (gsd-memory) - MCP protocol implementation
  - Provides `Server`, `StdioServerTransport`, tool schemas
  - Used in: `gsd-memory/src/index.ts`

- `gray-matter` v4.0.3 (gsd-memory) - YAML frontmatter parser
  - Extracts metadata from markdown files
  - Used in: `gsd-memory/src/extractors/frontmatter.ts`

- `yaml` v2.3.0 (gsd-memory) - YAML parsing library
  - Parses complex YAML structures in project metadata
  - Used in: gsd-memory tools for decision/pattern extraction

**Runtime Utilities:**

- Node.js built-in modules:
  - `fs` (filesystem operations)
  - `path` (path manipulation)
  - `child_process` (shell execution for QMD integration)
  - `os` (environment/home directory access)
  - `readline` (interactive prompts in installer)

## Configuration

**Environment:**

Configuration driven by environment variables:
- `CLAUDE_CONFIG_DIR` - Override Claude Code config location (default: `~/.claude`)
- `OPENCODE_CONFIG_DIR` / `OPENCODE_CONFIG` - OpenCode config directory
- `GEMINI_CONFIG_DIR` - Gemini CLI config location (default: `~/.gemini`)
- `XDG_CONFIG_HOME` - XDG base directory (used by OpenCode)

**Build:**

- `gsd-memory/tsconfig.json` - TypeScript configuration
  - Target: ES2022
  - Module: NodeNext
  - Strict mode enabled
  - Source maps and declaration files generated

- `gsd-memory/vitest.config.ts` - Test configuration
  - Node environment
  - Unit tests: `tests/**/*.test.ts` (excludes integration)
  - Integration tests: `tests/integration/**`

- `scripts/build-hooks.js` - esbuild configuration for hook bundling

**Installation Scripts:**
- `bin/install.js` - Main installation CLI (1665 lines)
  - Handles global/local installation for Claude Code, OpenCode, Gemini
  - Manages settings.json hooks configuration
  - Installs MCP server for Claude Code

- `scripts/build-hooks.js` - Bundles hooks to `hooks/dist/` for distribution

## Platform Requirements

**Development:**

- Node.js >= 18.0.0
- npm for dependency management
- TypeScript compiler (installed via npm)
- Optional: QMD for semantic search (falls back to grep)

**Production:**

**Deployment Target:**
- Claude Code (global: `~/.claude/`)
- Claude Code (local: `./.claude/`)
- OpenCode (global: `~/.config/opencode/`)
- OpenCode (local: `./.opencode/`)
- Gemini CLI (global: `~/.gemini/`)
- Gemini CLI (local: `./.gemini/`)
- MCP Server Location: `~/.gsd/mcp-server/` (Claude Code only)

**Dependencies at Runtime:**
- npm (for MCP server installation during setup)
- Optional: qmd CLI tool (semantic search enhancement, falls back gracefully)

**Settings Management:**
- `~/.claude/settings.json` - Claude Code configuration
- `~/.config/opencode/opencode.json` - OpenCode configuration
- `~/.gemini/settings.json` - Gemini CLI configuration
- `~/.gsd/projects.json` - GSD Memory project registry

---

*Stack analysis: 2026-02-06*
