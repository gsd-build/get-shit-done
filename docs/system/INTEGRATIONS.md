# External Integrations

**Analysis Date:** 2026-01-16

## APIs & External Services

**Claude Code Integration:**
- Claude Code IDE - Primary integration target
  - Integration method: Installed commands and agents that run within Claude Code
  - Command format: Slash commands (e.g., `/gsd:help`, `/gsd:new-project`)
  - Agent execution: Spawned subagents via Claude Code's skill system
  - No API key required - Works through Claude Code's built-in interfaces

**GitHub Integration:**
- GitHub Repository - Source control and distribution
  - Repository: `https://github.com/glittercowboy/get-shit-done.git`
  - CI/CD: GitHub as distribution platform for npm package
  - Git operations: Supported for project state management

**NPM Registry:**
- npm registry (`npmjs.com`)
  - Package: `get-shit-done-cc`
  - Installation: `npx get-shit-done-cc` or `npm install -g get-shit-done-cc@latest`
  - Update checking: `/gsd:whats-new` command checks latest version

## Data Storage

**Databases:**
- None - Project state stored locally in `.planning/` directory structure

**File Storage:**
- Local filesystem only
  - State files: `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `PROJECT.md`
  - Plans: `*-PLAN.md` files in phase directories
  - Summaries: `*-SUMMARY.md` files after execution

**Caching:**
- None

## Authentication & Identity

**Auth Provider:**
- None - System operates entirely locally
- No user accounts, logins, or API keys needed
- Claude Code authentication handled by Claude IDE itself

**OAuth Integrations:**
- None

## Monitoring & Observability

**Version Tracking:**
- Local VERSION file: `~/.claude/get-shit-done/VERSION` or `./.claude/get-shit-done/VERSION`
- Written during installation to track installed version - `bin/install.js`
- `/gsd:whats-new` command compares local version with latest npm package

**Error Tracking:**
- None - No external monitoring services

**Analytics:**
- None - No telemetry or analytics collection

**Logs:**
- None - Console output only during installation

## CI/CD & Deployment

**Hosting:**
- npm registry - Package distribution
- GitHub - Source control

**CI Pipeline:**
- Not detected - Manual releases via npm publish

**Distribution Pipeline:**
- GitHub repository â npm registry â User installation via npx

## Environment Configuration

**Development:**
- No env vars required to run
- Optional: `CLAUDE_CONFIG_DIR` to override default Claude config directory
- Git recommended for version control

**Staging:**
- Not applicable - Local-only tool

**Production:**
- Installed globally via npm
- Creates `~/.claude/` directory structure if it doesn't exist
- Path replacement in markdown files during installation

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

---

*Integration audit: 2026-01-16*
*Update when adding/removing external services*