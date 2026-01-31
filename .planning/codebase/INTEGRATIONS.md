# External Integrations

**Analysis Date:** 2026-01-31

## APIs & External Services

**Package Registry:**
- npm Registry - Version checking for updates
  - Integration method: `npm view get-shit-done-cc version` command executed via child_process
  - Used in: `hooks/gsd-check-update.js`
  - Purpose: Check for available updates on session start
  - No authentication required (public package)

**Version Control:**
- GitHub - Source code repository
  - Repository: `git+https://github.com/glittercowboy/get-shit-done.git`
  - Homepage: `https://github.com/glittercowboy/get-shit-done`
  - Issues: `https://github.com/glittercowboy/get-shit-done/issues`
  - Used for: Source code hosting, issue tracking, releases

**Community:**
- Discord - Community server
  - URL: `https://discord.gg/5JJgD5svVS`
  - Referenced in: `README.md`, `bin/install.js`, `commands/gsd/join-discord.md`

## Data Storage

**File System:**
- Local file system only - No databases
  - Configuration files: Written to runtime config directories (`~/.claude/`, `~/.config/opencode/`, `~/.gemini/`)
  - Cache: `~/.claude/cache/gsd-update-check.json` (update check results)
  - Todos: `~/.claude/todos/` (session-based todo files)

**No External Storage:**
- No cloud databases
- No file storage services
- No caching services (Redis, etc.)

## Authentication & Identity

**No Authentication Required:**
- No auth providers integrated
- No API keys or tokens needed
- No user authentication system

## Monitoring & Observability

**Error Tracking:**
- None - Errors handled via console output and process exit codes

**Analytics:**
- None - No analytics tracking

**Logs:**
- stdout/stderr only - No external logging service

## CI/CD & Deployment

**Package Publishing:**
- npm Registry - Package distribution
  - Package name: `get-shit-done-cc`
  - Version: Managed in `package.json`
  - Pre-publish hook: `npm run build:hooks` (builds hooks to `hooks/dist/`)

**Version Control:**
- GitHub - Source control and releases
  - No CI/CD pipelines configured in this repository
  - Manual release process

**Distribution:**
- npm - Primary distribution channel
  - Installation: `npx get-shit-done-cc` or `npm install -g get-shit-done-cc`
  - No hosting platform required (CLI tool)

## Environment Configuration

**Development:**
- No required environment variables
- Optional environment variables (for custom config directories):
  - `CLAUDE_CONFIG_DIR` - Override Claude Code config directory (default: `~/.claude`)
  - `GEMINI_CONFIG_DIR` - Override Gemini CLI config directory (default: `~/.gemini`)
  - `OPENCODE_CONFIG_DIR` - Override OpenCode config directory (default: `~/.config/opencode`)
  - `OPENCODE_CONFIG` - OpenCode config file path (used to derive config directory)
  - `XDG_CONFIG_HOME` - XDG Base Directory config home (used by OpenCode)

**Production:**
- No environment variables required for end users
- Configuration via CLI flags (`--config-dir`) or environment variables (optional)

## Webhooks & Callbacks

**Incoming:**
- None - No webhook endpoints

**Outgoing:**
- None - No outgoing webhook calls

---
*Integration audit: 2026-01-31*
