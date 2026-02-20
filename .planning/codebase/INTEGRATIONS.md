# External Integrations

**Analysis Date:** 2026-01-24

## APIs & External Services

**npm Registry:**
- Service: npm registry (npmjs.com)
- What it's used for: Version check for GSD updates
  - Client: Command-line `npm view get-shit-done-cc version` invocation
  - Location: `hooks/gsd-check-update.js` line 45
  - Timeout: 10 seconds
  - Frequency: Once per Claude Code session (via SessionStart hook)
  - Failure: Graceful - silently fails if npm registry is unreachable

**GitHub:**
- Service: GitHub REST API
- What it's used for: Release management
  - Location: `.github/workflows/release.yml`
  - Used by: `softprops/action-gh-release@v2` GitHub Actions workflow
  - Trigger: Git tag push matching pattern `v[0-9]+.[0-9]+.[0-9]+`
  - Permissions: `contents: write` (create releases)

**Discord:**
- Service: Discord community server
- What it's used for: Community support and discussion
  - Link: https://discord.gg/5JJgD5svVS
  - Reference: Shown in CLI output and documentation, not called via API

## Data Storage

**Databases:**
- None - Not used

**File Storage:**
- Local filesystem only
  - Config: `~/.claude/` or `~/.config/opencode/` (user home directories)
  - Caches: `~/.claude/cache/` (update check results)
  - Session data: `~/.claude/todos/` (per-session todo lists)
  - Settings: `settings.json` in config directory

**Caching:**
- File-based cache at `~/.claude/cache/gsd-update-check.json`
  - Content: JSON with `update_available`, `installed`, `latest`, `checked` timestamp
  - Location: `hooks/gsd-check-update.js`
  - Staleness: Cache is checked but no TTL enforced (checked once per session)

## Authentication & Identity

**Auth Provider:**
- None required
- Installation uses:
  - Interactive CLI prompts for user choices
  - Filesystem permissions (user must have write access to config directories)
  - No API keys, tokens, or credentials needed

## Monitoring & Observability

**Error Tracking:**
- None - Not integrated

**Logs:**
- CLI output only (ANSI color-coded messages)
- No persistent logging
- Errors written to stderr via console.error()

## CI/CD & Deployment

**Hosting:**
- npm registry (npmjs.com)
- GitHub Releases page

**CI Pipeline:**
- GitHub Actions
- Workflow: `.github/workflows/release.yml`
  - Trigger: Git tag push
  - Steps:
    1. Checkout code
    2. Extract version from tag
    3. Extract changelog section
    4. Create GitHub Release with `softprops/action-gh-release@v2`
- No tests run (no test suite defined)
- Pre-publish hook: `npm run build:hooks` copies compiled hooks to `hooks/dist/`

## Environment Configuration

**Required env vars:**
- `CLAUDE_CONFIG_DIR` (optional) - Override Claude Code config directory (falls back to `~/.claude`)
- `OPENCODE_CONFIG_DIR` (optional) - Override OpenCode config directory
- `OPENCODE_CONFIG` (optional) - Alternative OpenCode config file path
- `XDG_CONFIG_HOME` (optional) - XDG Base Directory spec (used for OpenCode if `OPENCODE_CONFIG_DIR` not set)

**Secrets location:**
- No secrets stored
- No API keys, tokens, or credentials managed

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- SessionStart hook: Spawned by Claude Code/OpenCode when session starts
  - Hook: `gsd-check-update.js`
  - Function: Checks npm registry for updates, writes result to `~/.claude/cache/gsd-update-check.json`
  - Async: Spawned in background, doesn't block session startup

## Registry Interactions

**npm Registry:**
- On install: Fetches package from registry via `npx`
- During runtime: Checks for updates via `npm view` command in background
- No authentication required (public package)

**GitHub Actions:**
- Uses official actions:
  - `actions/checkout@v4` - Check out repository code
  - `softprops/action-gh-release@v2` - Create GitHub releases
- No custom GitHub API calls (all via actions)

## Installation & Distribution

**Package Format:**
- npm package: `get-shit-done-cc`
- Distribution: Published to npm registry
- No external CDN or storage (uses npm's default distribution)

**Post-Install Configuration:**
- Modifies target runtime's `settings.json` to register hooks:
  - SessionStart hook for update checking
  - Statusline hook for Claude Code (optional, prompted)
- For OpenCode: Modifies `opencode.json` permissions for GSD directory access
  - Read permission: `~/.config/opencode/get-shit-done/*`
  - External directory permission: Same path

---

*Integration audit: 2026-01-24*
