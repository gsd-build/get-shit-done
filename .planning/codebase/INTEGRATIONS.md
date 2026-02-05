# External Integrations

**Analysis Date:** 2026-02-05

## APIs & External Services

**npm Registry:**
- Purpose: Package distribution and version checking
- Usage: `npm view get-shit-done-cc version` in `hooks/gsd-check-update.js`
- Auth: None (public package)

**Discord Community:**
- URL: `https://discord.gg/5JJgD5svVS`
- Purpose: User community and support
- Integration: Link printed after installation

**GitHub:**
- Repository: `https://github.com/glittercowboy/get-shit-done`
- Purpose: Source code hosting, issue tracking
- Integration: Referenced in `package.json` (repository, homepage, bugs fields)

## Target Runtime Integrations

**Claude Code:**
- Config location: `~/.claude/` or `CLAUDE_CONFIG_DIR`
- Settings file: `settings.json`
- Hooks: SessionStart event, statusLine configuration
- Commands: Nested structure in `commands/gsd/*.md`
- Agents: Markdown with YAML frontmatter

**OpenCode:**
- Config location: `~/.config/opencode/` (XDG compliant) or `OPENCODE_CONFIG_DIR`
- Settings file: `opencode.json`
- Commands: Flat structure in `command/gsd-*.md`
- Permissions: Configured in `opencode.json` for GSD directory access
- Tool name mapping: Different tool names (e.g., `AskUserQuestion` → `question`)
- No statusline support (uses themes instead)

**Gemini CLI:**
- Config location: `~/.gemini/` or `GEMINI_CONFIG_DIR`
- Settings file: `settings.json`
- Commands: TOML format (`.toml` extension)
- Experimental: `enableAgents` flag required
- Tool name mapping: Different tool names (e.g., `Read` → `read_file`, `Bash` → `run_shell_command`)
- Hooks: Same as Claude Code

**Cursor IDE:**
- Config location: `~/.cursor/`
- Settings file: `settings.json`
- Separate distribution: `cursor-gsd/` directory
- Install scripts: PowerShell (`install.ps1`) and Bash (`install.sh`)

## Data Storage

**Databases:**
- None - File-based storage only

**File Storage:**
- Local filesystem only
- Project files in `.planning/` directory
- Global config in runtime-specific directories (`~/.claude/`, `~/.config/opencode/`, `~/.gemini/`, `~/.cursor/`)
- Todos stored in `~/.claude/todos/` (or equivalent)
- Update cache in `~/.claude/cache/gsd-update-check.json`

**Caching:**
- File-based cache for update checking: `~/.claude/cache/gsd-update-check.json`
- Structure: `{ update_available, installed, latest, checked }`

## Authentication & Identity

**Auth Provider:**
- None - No authentication required
- Inherits authentication from target runtime (Claude Code, OpenCode, Gemini)

## Monitoring & Observability

**Error Tracking:**
- None - Errors logged to console/stdout

**Logs:**
- Console output during installation
- Silent failure in hooks to avoid breaking statusline

## CI/CD & Deployment

**Hosting:**
- npm registry (npmjs.com)
- GitHub for source code

**CI Pipeline:**
- None detected in main repository
- Manual publish via `npm publish`
- Prepublish hook: `npm run build:hooks`

**Release Process:**
- Version in `package.json`
- VERSION file written to installation directory
- CHANGELOG.md for release notes

## Environment Configuration

**Required env vars:**
- None required

**Optional env vars:**
- `CLAUDE_CONFIG_DIR` - Override Claude config location
- `OPENCODE_CONFIG_DIR` - Override OpenCode config location
- `OPENCODE_CONFIG` - OpenCode config file path
- `GEMINI_CONFIG_DIR` - Override Gemini config location
- `XDG_CONFIG_HOME` - XDG base directory for OpenCode
- `USERPROFILE` - Windows user profile (for Cursor installer)
- `HOME` - Unix home directory fallback

**Secrets location:**
- None - No secrets required by GSD itself
- Target runtimes manage their own API keys

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Hooks System

**Claude Code / Gemini Hooks:**
- SessionStart: `gsd-check-update.js` - Checks npm for updates
- statusLine: `gsd-statusline.js` - Displays model, task, directory, context usage

**Hook Configuration (settings.json):**
```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/gsd-check-update.js"
          }
        ]
      }
    ]
  },
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/hooks/gsd-statusline.js"
  }
}
```

**Hook Behavior:**
- `gsd-check-update.js`: Spawns background process, writes to cache file, exits immediately
- `gsd-statusline.js`: Reads JSON from stdin, outputs formatted status line

## Git Integration

**Commit Attribution:**
- Configurable via settings (`settings.attribution.commit`)
- Options: Keep default, remove, or custom attribution
- Processed during file installation

**Git Operations (in workflows):**
- Atomic commits per task
- Commit message format: `type(phase-plan): description`
- Optional branching strategies: none, phase, milestone

---

*Integration audit: 2026-02-05*
