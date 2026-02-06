# External Integrations

**Analysis Date:** 2026-02-06

## APIs & External Services

**Package Registry:**
- npm registry - Package distribution and version checking
  - Used for: Publishing `get-shit-done-cc` package
  - Used for: Version checking via `npm view get-shit-done-cc version`
  - Implementation: `hooks/gsd-check-update.js` spawns background process

## Data Storage

**Local Filesystem Only:**

- User home directory configuration
  - `~/.claude/` - Claude Code global config
  - `~/.config/opencode/` - OpenCode global config (XDG Base Directory compliant)
  - `~/.gemini/` - Gemini CLI global config
  - `~/.gsd/` - GSD system directory
    - `~/.gsd/projects.json` - Project registry (managed by `gsd-memory/src/registry.ts`)
    - `~/.gsd/mcp-server/` - GSD Memory MCP server installation

- Project-local installations
  - `./.claude/` - Local Claude Code files
  - `./.opencode/` - Local OpenCode files
  - `./.gemini/` - Local Gemini files

**Registry Format:**
- JSON for `~/.gsd/projects.json`:
  ```typescript
  {
    version: string;
    projects: Array<{
      name: string;
      path: string;
      qmdCollection?: string;
      registeredAt: string;
      lastIndexed?: string;
    }>;
  }
  ```

**Markdown Metadata:**
- YAML frontmatter in `.md` files parsed via gray-matter
- Metadata extracted by GSD Memory tools:
  - `gsd-memory/src/extractors/frontmatter.ts` - Parses YAML headers
  - `gsd-memory/src/extractors/summary.ts` - Extracts tech stack, decisions
  - `gsd-memory/src/extractors/research.ts` - Extracts pitfalls, patterns
  - `gsd-memory/src/extractors/project.ts` - Extracts project constraints

**Caching:**
- Local cache in `~/.claude/cache/gsd-update-check.json`
  - Structure: `{ update_available, installed, latest, checked }`
  - Updated by `hooks/gsd-check-update.js` in SessionStart hook

## Authentication & Identity

**Auth Provider:**
- None - GSD is CLI-only, no user authentication
- No API keys or OAuth required

**Configuration Management:**
- Settings stored in user config directories (no remote sync)
- OpenCode: `~/.config/opencode/opencode.json` (XDG-compliant)
- Claude Code: `~/.claude/settings.json`
- Gemini: `~/.gemini/settings.json`

## Monitoring & Observability

**Error Tracking:**
- None integrated (no error reporting service)

**Logs:**
- Console output only
- Installer uses stdio for interactive prompts via readline
- Hooks write to cache files (no structured logging)

**Version Checking:**
- Background check via `hooks/gsd-check-update.js`
  - Spawns child process to avoid blocking
  - Compares local VERSION file against npm registry
  - No analytics or telemetry

## CI/CD & Deployment

**Hosting:**
- GitHub repository: https://github.com/glittercowboy/get-shit-done
- npm registry - Package hosted at `get-shit-done-cc`

**CI Pipeline:**
- Not detected in codebase (GitHub workflows may exist but not analyzed)

**Package Distribution:**
- npm publish via `prepublishOnly` script hook
  - Runs `npm run build:hooks` before publish
  - Bundles hooks to `hooks/dist/` via esbuild

## Environment Configuration

**Required env vars (optional, all have defaults):**
- `CLAUDE_CONFIG_DIR` - Custom Claude Code config directory
- `OPENCODE_CONFIG_DIR` - Custom OpenCode config directory
- `OPENCODE_CONFIG` - Alternative OpenCode config path (uses dirname)
- `GEMINI_CONFIG_DIR` - Custom Gemini config directory
- `XDG_CONFIG_HOME` - XDG base directory (OpenCode respects this)

**No secrets required:**
- GSD is credential-free (no external API keys needed)
- Installation is entirely local

**Secrets location:**
- Not applicable (no API keys or credentials used)

## Webhooks & Callbacks

**Incoming:**
- None (CLI tool, not a service)

**Outgoing:**
- None (no external service calls except npm registry for version check)

## CLI Tools Integration

**Optional External Tools:**

**QMD (Semantic Search):**
- Tool: `qmd` command-line utility
- Integration: `gsd-memory/src/qmd.ts`
- Usage: Semantic search over project knowledge
- When unavailable: Gracefully falls back to grep-based search
  - Command: `which qmd` to check availability
  - Commands used:
    - `qmd query <query> --collection <name> --json`
    - `qmd add <name> <paths>`
    - `qmd update <collection>`
    - `qmd status <collection> --json`

**Shell Integration:**

- Node.js child_process execution:
  - `npm view get-shit-done-cc version` - Version check
  - `which qmd` - QMD availability check
  - Falls back to grep if QMD unavailable

**Runtime Execution:**
- MCP Server communication via stdio:
  - `gsd-memory/src/index.ts` creates `StdioServerTransport`
  - Runs as standalone Node process
  - Communicates with Claude Code via MCP protocol

## Installation Targets

**Claude Code:**
- Global: `~/.claude/`
  - MCP server installed to `~/.gsd/mcp-server/`
  - Hooks configured in `~/.claude/settings.json`
- Local: `./.claude/` (project-specific)

**OpenCode:**
- Global: `~/.config/opencode/`
  - Uses XDG Base Directory spec
  - Permissions configured in `~/.config/opencode/opencode.json`
- Local: `./.opencode/` (project-specific)

**Gemini CLI:**
- Global: `~/.gemini/`
  - Experimental agents enabled automatically
- Local: `./.gemini/` (project-specific)

## File Format Conversions

**Markdown Frontmatter Conversion:**
- Claude Code → OpenCode:
  - `allowed-tools:` array → `tools:` object (key=tool, value=true)
  - `AskUserQuestion` → `question`
  - `SlashCommand` → `skill`
  - Color names converted to hex values
  - `/gsd:` commands → `/gsd-` flat structure

- Claude Code → Gemini CLI:
  - `allowed-tools:` → YAML array in `tools:`
  - Gemini built-in tool mappings (e.g., Read → read_file, Bash → run_shell_command)
  - HTML `<sub>` tags stripped (terminal incompatibility)
  - Markdown files converted to TOML format

---

*Integration audit: 2026-02-06*
