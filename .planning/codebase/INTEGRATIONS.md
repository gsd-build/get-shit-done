# External Integrations

**Analysis Date:** 2026-02-20

## APIs & External Services

**npm Registry:**
- Purpose: Version checking for update notifications
- Location: `hooks/gsd-check-update.js`
- Method: `npm view get-shit-done-cc version`
- Caching: Results cached in `~/.claude/cache/gsd-update-check.json`

**Brave Search API (Optional):**
- Purpose: Web search via `websearch` command in gsd-tools
- Location: `get-shit-done/bin/gsd-tools.cjs` (websearch command)
- Auth: Requires Brave API key (user-configured)
- Usage: Research workflows

## Data Storage

**Databases:**
- None - File-based storage only

**File Storage:**
- Local filesystem
- Planning docs in `.planning/` directory
- Config in runtime-specific directories (`~/.claude/`, etc.)

**Caching:**
- `~/.claude/cache/gsd-update-check.json` - npm version check cache
- `~/.claude/todos/` - Session task tracking

## Authentication & Identity

**Auth Provider:**
- None - GSD does not handle authentication
- Relies on parent runtime (Claude Code, OpenCode, Gemini) auth

## Monitoring & Observability

**Error Tracking:**
- None - Silent failure pattern for hooks (don't break statusline)

**Logs:**
- Console output only
- No persistent logging

## CI/CD & Deployment

**Hosting:**
- npm registry (`get-shit-done-cc` package)
- GitHub (`glittercowboy/get-shit-done`)

**CI Pipeline:**
- GitHub Actions: `.github/workflows/auto-label-issues.yml`
- Auto-labels new issues with "needs-triage"
- No automated testing/deployment pipeline

## Environment Configuration

**Required env vars:**
- None required for basic operation

**Optional env vars:**
- `CLAUDE_CONFIG_DIR` - Override Claude Code config location
- `OPENCODE_CONFIG_DIR` - Override OpenCode config location
- `OPENCODE_CONFIG` - OpenCode config file path (directory extracted)
- `GEMINI_CONFIG_DIR` - Override Gemini config location
- `XDG_CONFIG_HOME` - XDG base directory (used by OpenCode)

**Secrets location:**
- No secrets managed by GSD
- API keys (e.g., Brave Search) configured by user in their environment

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Runtime Integrations

**Claude Code:**
- Hooks system via `settings.json`
- SessionStart hook: `gsd-check-update.js`
- Statusline hook: `gsd-statusline.js`
- Slash commands: `commands/gsd/*.md`
- Agents: `agents/gsd-*.md`

**OpenCode:**
- Flat command structure: `command/gsd-*.md`
- Permission config: `opencode.json`
- Tool name mapping (e.g., `AskUserQuestion` -> `question`)
- Agents: `agents/gsd-*.md`

**Gemini CLI:**
- TOML command format: `commands/gsd/*.toml`
- Tool name mapping (e.g., `Read` -> `read_file`, `Bash` -> `run_shell_command`)
- Experimental agents flag required
- Template variable escaping (`${VAR}` -> `$VAR`)
- Agents: `agents/gsd-*.md`

## File System Hooks

**SessionStart:**
- `gsd-check-update.js` - Spawns background npm version check
- Writes to cache file for statusline to read

**Statusline:**
- `gsd-statusline.js` - Reads from stdin (JSON)
- Reads `~/.claude/todos/` for active task
- Reads `~/.claude/cache/gsd-update-check.json` for update status
- Outputs formatted statusline to stdout

## Cross-Runtime Compatibility

**Frontmatter Conversion:**
- Claude Code: Native YAML frontmatter with `allowed-tools:` array
- OpenCode: Converts to `tools:` object with `{toolname: true}`
- Gemini: Converts to TOML format with `tools:` array

**Tool Name Mapping:**
| Claude Code | OpenCode | Gemini CLI |
|-------------|----------|------------|
| Read | read | read_file |
| Write | write | write_file |
| Edit | edit | replace |
| Bash | bash | run_shell_command |
| Glob | glob | glob |
| Grep | grep | search_file_content |
| WebSearch | websearch | google_web_search |
| WebFetch | webfetch | web_fetch |
| TodoWrite | todowrite | write_todos |
| AskUserQuestion | question | ask_user |
| Task | task | (excluded - auto-registered) |
| mcp__* | mcp__* | (excluded - auto-discovered) |

**Path Replacement:**
- Source uses `~/.claude/` as canonical paths
- Installer replaces with runtime-appropriate paths

---

*Integration audit: 2026-02-20*
