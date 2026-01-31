# External Integrations

**Analysis Date:** 2026-01-31

## APIs & External Services

**Package Registry:**
- npm (npmjs.com) - Used for:
  - Package distribution and installation
  - Version checking: `npm view get-shit-done-together version`
  - Update detection and changelog display
  - Client: Node.js built-in `child_process.execSync()`

**Code Documentation API:**
- Context7 (MCP) - Provides up-to-date library documentation
  - Tools: `mcp__context7__*` (wildcard permission for all Context7 functions)
  - Used by: gsd-phase-researcher, gsd-planner agents for research
  - Purpose: Verify library capabilities, API docs, current versions
  - Helps overcome training data staleness

**Web Search:**
- WebSearch (MCP tool) - General web search capability
  - Used by: gsd-phase-researcher, gsd-project-researcher for research
  - Purpose: Investigate implementation approaches, libraries, best practices
  - Note: Referenced in research documentation; actual implementation depends on Claude Code/OpenCode runtime

**Web Fetch:**
- WebFetch (allowed-tool) - Fetch remote content
  - Used by: plan-phase command, planner agent
  - Purpose: Retrieve documentation, fetch changelog for updates
  - Implements changelog display before user confirms update

**Perplexity (Optional):**
- Mentioned in CLAUDE.md for research tasks
- MCP server integration (user-configured, not built-in)
- Used for complex reasoning and research validation

## Source Control & Repository

**GitHub:**
- Repository: zpyoung/get-shit-done-together
- URL: https://github.com/zpyoung/get-shit-done-together
- Used for:
  - Source code hosting and version control
  - Issue tracking (bugs.url in package.json)
  - Changelog display: [link in update.md points to CHANGELOG.md on main branch](https://github.com/zpyoung/get-shit-done-together/blob/main/CHANGELOG.md)
  - CI/CD validation (mentioned in CONTRIBUTING.md - "must pass CI")

**Git Integration:**
- All commands use `git` command-line directly via Node.js `child_process`
- Git used for:
  - Commit planning files (STATE.md, ROADMAP.md, PLAN.md)
  - Atomic phase execution (gsd-executor makes commits)
  - Repository status checks

## Runtime Integrations

**Claude Code (Anthropic):**
- Primary target runtime
- Config directory: `~/.claude/`
- Settings file: `~/.claude/settings.json`
- Hooks integration: Statusline and update checking
- Tools used:
  - Read, Write, Bash, Glob, Grep (file operations)
  - Task (agent spawning)
  - WebFetch, WebSearch (optional, for research phases)
  - MCP tools (context7, perplexity via user config)

**OpenCode (Open Source):**
- Secondary runtime support
- Config directory: `~/.config/opencode/` (XDG Base Directory)
- Feature-reduced copy of commands (flattened to single directory)
- Supported tools: Lowercase versions of Claude Code tools
- Command conversion: Tools and YAML converted to OpenCode permission format
- No MCP tools (OpenCode handles auto-discovery)

**Gemini CLI (Google):**
- Tertiary runtime support
- Config directory: `~/.gemini/`
- Commands converted to TOML format
- Built-in tool names converted to snake_case (read_file, run_shell_command)
- MCP tools excluded (auto-discovered at runtime)
- Support for agents as callable tools

## Community & Support

**Discord:**
- Server: https://discord.gg/5JJgD5svVS
- Purpose: Community discussion, help, feature requests
- Referenced in: install.js banner, join-discord.md command
- Used for user engagement and feedback

## Model Context Protocol (MCP) Tools

**Integrated MCP Tools:**

**Context7:**
- Tool pattern: `mcp__context7__*` (wildcard)
- Libraries supported: Next.js, React, TypeScript, FastAPI, etc.
- Provides: Current documentation, API references, examples
- Used in: Research phases to verify library capabilities
- Resolves: Training data staleness issues

**WebSearch (if configured):**
- MCP tool for general web search
- Mentioned in research documentation
- Implementation depends on Claude Code user configuration

**Perplexity (if configured):**
- Referenced in user CLAUDE.md guidelines
- Used for complex research tasks
- User configures via mcpServers config

## Authentication & Authorization

**No authentication required for:**
- Local file operations (Read, Write, Bash)
- Git operations (assumes user has local git configured)
- npm version checks (public npm registry)

**Authentication location (user's responsibility):**
- Claude Code API access - via Claude Code runtime
- npm registry auth - via `~/.npmrc` if private packages needed
- GitHub auth - via local git config (if pushing to private repos)
- MCP server auth - configured in Claude Code settings per user

## Configuration & Secrets

**No built-in secrets management:**
- GSD itself doesn't use API keys or credentials
- Configuration is user-provided via settings.json
- Environment variables for custom config directories (optional)

**Per-runtime config:**
- Claude Code: `~/.claude/settings.json`
- OpenCode: `~/.config/opencode/settings.json`
- Gemini CLI: `~/.gemini/settings.json`

**Project-local config:**
- `.planning/config.json` - Workflow preferences (mode, depth, gates, parallelization)
- No secrets stored in project configs

## Data Storage

**No external databases** - State stored locally only

**Local state files:**
- `.planning/STATE.md` - Current project position and decisions
- `.planning/ROADMAP.md` - Phase breakdown and milestones
- `.planning/RESEARCH.md` - Phase research findings
- `.planning/PLAN.md` - Executable task plans
- `.planning/config.json` - Workflow configuration
- Version tracking: `~/.claude/get-shit-done/VERSION`
- Update cache: `~/.claude/cache/gsd-update-check.json`

## Webhooks & Callbacks

**Incoming:** None - GSD is CLI-only, no web server

**Outgoing:**
- git commit creation for phase tracking
- npm registry version queries (read-only)
- Optional: Discord webhook mentions (user-configured, not built-in)

## Environment Configuration

**Required environment variables:**
- None - All have sensible defaults

**Optional environment variables:**
- `CLAUDE_CONFIG_DIR` - Override Claude Code config directory (default: `~/.claude`)
- `OPENCODE_CONFIG_DIR` - Override OpenCode config directory (default: `~/.config/opencode`)
- `GEMINI_CONFIG_DIR` - Override Gemini config directory (default: `~/.gemini`)
- `XDG_CONFIG_HOME` - XDG Base Directory for OpenCode (default: `~/.config`)
- `XDG_BASE_DIR` - Alternative XDG override (if set)

## Monitoring & Observability

**Error Tracking:** None - GSD doesn't report errors externally

**Logging:**
- Console-only output via Node.js stdout/stderr
- Colored terminal output (cyan, green, yellow, blue for different message types)
- No external logging service integration

**Update Status:**
- Statusline integration shows GSD update availability
- Cache file: `~/.claude/cache/gsd-update-check.json`
- Checked silently at session start via `gsd-check-update.js` hook

## Deployment & Installation

**Installation Method:**
- npm-based (npx): Zero-friction global or local install
- Supports Windows, macOS, Linux
- No system dependencies beyond Node.js

**Installation Process:**
- Copies commands/agents to runtime config directories
- Converts YAML/Markdown between runtimes (Claude → OpenCode → Gemini)
- Registers hooks in runtime settings.json
- Creates VERSION file for update tracking
- Cleans up orphaned files from previous versions

**Uninstallation:**
- `npx get-shit-done-together --uninstall` removes all GSD files
- Removes hooks from settings.json
- Preserves user custom commands/agents (non-GSD files)

---

*Integration audit: 2026-01-31*
