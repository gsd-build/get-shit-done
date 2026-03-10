# External Integrations

**Analysis Date:** 2025-07-18

## APIs & External Services

**Brave Search API:**
- Purpose: Web search capability for research workflows (phase research, project research)
- SDK/Client: Native `fetch()` (Node.js 18+ global)
- Endpoint: `https://api.search.brave.com/res/v1/web/search`
- Auth: `BRAVE_API_KEY` env var or `~/.gsd/brave_api_key` file
- Implementation: `get-shit-done/bin/lib/commands.cjs` lines 320-379 (`cmdWebsearch` function)
- Behavior when unavailable: Silent skip — returns `{ available: false }`, agents fall back to built-in AI tool web search
- Config flag: `brave_search` in `.planning/config.json` (auto-detected during init)
- Detection logic: `get-shit-done/bin/lib/config.cjs` lines 30-32, `get-shit-done/bin/lib/init.cjs` lines 167-168

**npm Registry:**
- Purpose: Version update checking (compares installed vs latest published version)
- Client: Shells out to `npm view get-shit-done-cc version` via `execSync`
- Implementation: `hooks/gsd-check-update.js` lines 44-46
- Runs: Once per session via SessionStart hook, in a detached background process
- Timeout: 10 seconds
- Cache: `~/.claude/cache/gsd-update-check.json`

**Discord:**
- Purpose: Community link only (no API integration)
- Invite link: `https://discord.gg/gsd`
- Implementation: `commands/gsd/join-discord.md` — Simply displays the invite link

## Data Storage

**Databases:**
- None — The system uses the filesystem exclusively

**File Storage:**
- Local filesystem only
- All project data stored in `.planning/` directory structure:
  - `.planning/config.json` — Project configuration
  - `.planning/STATE.md` — Current project state (frontmatter + markdown)
  - `.planning/ROADMAP.md` — Phase roadmap
  - `.planning/REQUIREMENTS.md` — Requirements tracking
  - `.planning/phases/` — Phase directories with PLAN.md and SUMMARY.md files
  - `.planning/todos/pending/` and `.planning/todos/completed/` — Todo tracking
  - `.planning/codebase/` — Codebase analysis documents
  - `.planning/milestones/` — Archived milestone data

**Caching:**
- `~/.claude/cache/gsd-update-check.json` — npm update check results
- `/tmp/claude-ctx-{session_id}.json` — Context window metrics bridge file (written by statusline hook, read by context monitor hook)

## Authentication & Identity

**Auth Provider:**
- None — GSD is a local CLI tool with no user authentication
- The only auth token used is `BRAVE_API_KEY` for optional web search, passed as `X-Subscription-Token` header

## Monitoring & Observability

**Error Tracking:**
- None — Errors are written to stderr via `process.stderr.write()` in `get-shit-done/bin/lib/core.cjs` line 52-55

**Logs:**
- No logging framework
- Hooks use silent failure patterns (try/catch with empty catch blocks or `process.exit(0)`)
- CLI tool outputs JSON to stdout for structured results, error strings to stderr
- Large outputs (>50KB) written to temp files with `@file:` prefix protocol (`get-shit-done/bin/lib/core.cjs` lines 40-45)

## CI/CD & Deployment

**Hosting:**
- npm registry — Published as `get-shit-done-cc` package
- GitHub — Source at `github.com/glittercowboy/get-shit-done`

**CI Pipeline:**
- GitHub Actions
- `.github/workflows/test.yml` — Runs on push to main and PRs
  - Matrix: 3 OS (ubuntu, macOS, windows) × 3 Node versions (18, 20, 22)
  - Coverage via c8 on Node 20+ only (c8 v11 requires Node 20+)
  - Concurrency: cancels in-progress runs for same branch
  - Timeout: 10 minutes per job
- `.github/workflows/auto-label-issues.yml` — Adds `needs-triage` label to new issues

**Publishing:**
- `npm publish` with `prepublishOnly` hook running `build:hooks`
- `package.json` `files` array controls what's included: `bin/`, `commands/`, `get-shit-done/`, `agents/`, `hooks/dist/`, `scripts/`

## Git Integration

**Deep git integration (not a separate service, but critical external tool):**
- All git operations via `execSync('git ...')` in `get-shit-done/bin/lib/core.cjs` lines 123-155
- `execGit(cwd, args)` — Safe wrapper with shell escaping and error capture
- `isGitIgnored(cwd, targetPath)` — Uses `git check-ignore -q`
- Operations: `git add`, `git commit`, `git cat-file`, `git check-ignore`, `git rev-parse`, `git log`
- Commit operations: `get-shit-done/bin/gsd-tools.cjs` `commit` command
- Verification: `get-shit-done/bin/lib/verify.cjs` verifies commit hashes exist via `git cat-file -t`

## Environment Configuration

**Required env vars:**
- None strictly required — all features degrade gracefully

**Optional env vars:**
- `BRAVE_API_KEY` — Enables enhanced web search via Brave API

**Config file locations (user-level):**
- `~/.gsd/defaults.json` — Global defaults for new project configs
- `~/.gsd/brave_api_key` — Alternative to env var for Brave API key

**Config file locations (project-level):**
- `.planning/config.json` — Project-specific settings

**Key config fields:**
- `model_profile`: `"quality"` | `"balanced"` | `"budget"` — Controls which AI model is used per agent role
- `commit_docs`: boolean — Whether to auto-commit planning documents
- `branching_strategy`: `"none"` | `"phase"` | `"milestone"` — Git branching approach
- `parallelization`: boolean — Enable wave-based parallel plan execution
- `brave_search`: boolean — Auto-detected, enables web search
- `workflow.research`: boolean — Enable research subagent
- `workflow.plan_check`: boolean — Enable plan checking subagent
- `workflow.verifier`: boolean — Enable verification subagent

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## AI Runtime Hooks (Claude Code specific)

**SessionStart hook:**
- `hooks/gsd-check-update.js` — Spawns background process to check npm for updates

**PostToolUse hook:**
- `hooks/gsd-context-monitor.js` — Reads context metrics from bridge file, injects warnings when context usage > 65% (WARNING at ≤35% remaining, CRITICAL at ≤25% remaining)

**Statusline hook:**
- `hooks/gsd-statusline.js` — Displays model, task, directory, context usage bar in Claude Code UI; writes metrics to bridge file for context monitor

## AI Agent System (Multi-Runtime)

**Agent definitions** (installed into target projects):
- `agents/gsd-executor.md` — Plan execution with atomic commits
- `agents/gsd-planner.md` — Phase planning
- `agents/gsd-debugger.md` — Issue diagnosis
- `agents/gsd-verifier.md` — Work verification
- `agents/gsd-codebase-mapper.md` — Codebase analysis
- `agents/gsd-roadmapper.md` — Roadmap management
- `agents/gsd-phase-researcher.md` — Phase-level research
- `agents/gsd-project-researcher.md` — Project-level research
- `agents/gsd-research-synthesizer.md` — Research synthesis
- `agents/gsd-plan-checker.md` — Plan validation (read-only)
- `agents/gsd-integration-checker.md` — Integration validation (read-only)

**GitHub Copilot agents** (`.github/agents/`):
- Same agent set with `.agent.md` extension for GitHub Copilot compatibility

**Model profile resolution** (`get-shit-done/bin/lib/core.cjs` lines 18-30):
- Each agent maps to opus/sonnet/haiku based on selected profile (quality/balanced/budget)
- Resolved via `resolveModelInternal()` function

---

*Integration audit: 2025-07-18*
