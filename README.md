<div align="center">

# GET SHIT DONE

**Spec-driven development system for Claude Code. Solves context rot.**

[![npm version](https://img.shields.io/npm/v/get-shit-done-cc?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/get-shit-done-cc)
[![npm downloads](https://img.shields.io/npm/dm/get-shit-done-cc?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/get-shit-done-cc)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/5JJgD5svVS)
[![GitHub stars](https://img.shields.io/github/stars/glittercowboy/get-shit-done?style=for-the-badge&logo=github&color=181717)](https://github.com/glittercowboy/get-shit-done)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

```bash
npx get-shit-done-cc@latest
```

</div>

---

## How It Works

Four commands, one loop:

```
/gsd:discuss-phase N   → capture your decisions before planning
/gsd:plan-phase N      → research → create atomic plans → verify
/gsd:execute-phase N   → run plans in parallel waves, commit per task
/gsd:verify-work N     → UAT walk-through, auto-fix plans for failures
```

Each plan executes in a fresh 200k context window. No degradation. Git history is clean — one commit per task, automatically.

Start a project: `/gsd:new-project` — questions → research → requirements → roadmap.

Full cycle when all phases done: `/gsd:complete-milestone` → `/gsd:new-milestone`.

---

## Commands

### Core Workflow

| Command | What it does |
|---------|--------------|
| `/gsd:new-project` | Initialize: questions → research → requirements → roadmap |
| `/gsd:discuss-phase [N]` | Lock implementation decisions before planning |
| `/gsd:plan-phase [N]` | Research + create plans + verify against requirements |
| `/gsd:execute-phase <N>` | Execute all plans in parallel waves |
| `/gsd:verify-work [N]` | Manual UAT, auto-generates fix plans |
| `/gsd:complete-milestone` | Archive milestone, tag release |
| `/gsd:new-milestone [name]` | Start next version |

### Quick Mode

```
/gsd:quick
```

GSD guarantees (atomic commits, state tracking) without full planning. Use for bug fixes and one-off tasks.

### Utilities

| Command | What it does |
|---------|--------------|
| `/gsd:progress` | Where am I, what's next |
| `/gsd:map-codebase` | Analyze existing codebase before new-project |
| `/gsd:pause-work` / `/gsd:resume-work` | Session handoff |
| `/gsd:set-profile <auto\|quality\|balanced\|budget>` | Switch model profile |
| `/gsd:settings` | Configure workflow agents and execution |
| `/gsd:add-phase` / `/gsd:insert-phase` / `/gsd:remove-phase` | Roadmap management |
| `/gsd:add-todo` / `/gsd:check-todos` | Capture ideas |
| `/gsd:debug` | Systematic debugging with persistent state |
| `/gsd:update` | Update GSD |

---

## Install & Uninstall

```bash
# Standard install (Claude Code)
npx get-shit-done-cc@latest

# Non-interactive
npx get-shit-done-cc --claude --global
npx get-shit-done-cc --claude --local
npx get-shit-done-cc --opencode --global
npx get-shit-done-cc --gemini --global
```

```bash
# Uninstall
npx get-shit-done-cc --claude --global --uninstall
npx get-shit-done-cc --claude --local --uninstall
```

Verify: `/gsd:help` inside Claude Code.

> **Security note:** `--dangerously-skip-permissions` disables Claude Code's interactive permission prompts (file writes, shell commands, etc.). Only use this flag in isolated, automated environments (e.g., CI pipelines, sandboxed VMs) where you fully control and trust all executed code. Do not use it in production environments or when running untrusted workflows.

> Run Claude Code with `claude --dangerously-skip-permissions` — GSD is designed for frictionless automation.

---

## v2.0 Enhancements (This Fork)

This fork extends the base GSD system with autonomous execution, a persistent knowledge database, Telegram integration, and conversation mining. Built across 12 phases.

### What Was Built

**Auto Mode (Phases 1–2)**
Intelligent model selection using complexity signals. Haiku for simple tasks, Sonnet for standard, Opus for complex — with circuit breakers, iteration caps, error escalation, and a feedback loop that learns from corrections. 40–60% token savings vs all-Sonnet.

**Knowledge System (Phases 3–4)**
Local SQLite + sqlite-vec knowledge database at `.planning/knowledge/{user}.db`. Stores decisions, lessons, summaries with TTL lifecycle, vector + FTS5 search, and type-weighted ranking (decisions/lessons score 2× vs summaries). Passive extraction via Claude Code hooks captures knowledge during normal work. Three-stage deduplication: content hash → canonical hash → embedding similarity (0.88 threshold). Memory evolves — similar new knowledge updates existing entries rather than creating duplicates.

**Autonomous Execution (Phases 6–7)**
`/gsd:execute-roadmap` — runs an entire project roadmap unattended. Opus coordinator spawns per-phase sub-coordinators, each with fresh context. Token budget monitoring (alerts at 80%), failure handling with retry/skip/escalate, task chunking for large plans, and parallel execution for independent phases.

**Telegram MCP Server (Phases 8, 8.1)**
MCP server (`mcp-servers/telegram-mcp/`) that auto-loads with Claude Code. Sends blocking questions to your phone when human input is needed, resumes automatically on reply. Voice message support via local Whisper (no API cost). Multi-instance safe — each Claude Code session has isolated question queues with file locking and UUID-based session IDs.

**Doc Compression (Phase 9)**
PreToolUse hook intercepts reads of GSD planning documents and injects compressed summaries (60–70% token reduction) with absolute file links. Cache invalidated on content change. Circuit breaker disables compression after 3 failures.

**Installation System (Phase 10)**
Single command installs all dependencies, hooks, MCP config, and Whisper models:
```bash
npm run install:gsd
```

**Session Knowledge Extraction (Phase 11)**
Haiku analyzes completed Telegram MCP sessions at close time, extracting decisions and reasoning patterns beyond regex matching. Quality gates, chunking for long sessions, deduplication against the knowledge DB, and re-analysis prevention via content hash.

**Historical Conversation Mining (Phase 12)**
Mines `~/.claude/projects/{slug}/*.jsonl` for knowledge — the entire Claude Code conversation history. Format adapter converts Claude Code JSONL (97.5% noise removed) to Phase 11-compatible entries, then spawns Haiku subagents to extract insights.

---

## Fork Setup & Operations

### Install from Fork

```bash
git clone https://github.com/YOUR_FORK/get-shit-done.git
cd get-shit-done
cp .env.template .env
# Fill in TELEGRAM_BOT_TOKEN and TELEGRAM_OWNER_ID in .env
npm run install:gsd
```

This installs npm dependencies, Whisper models, Claude Code hooks, and MCP server config.

### Update from Fork

```bash
cd /path/to/get-shit-done
git pull origin main
npm run install:gsd   # reinstalls hooks, MCP config if changed
```

If you have local patches to GSD skills/commands, run `/gsd:reapply-patches` after updating.

### Apply to a Different Project

The install script deploys hooks and MCP config globally to `~/.claude/`. Once done, the knowledge system and Telegram integration work in any project — point Claude Code at your project directory and start.

The knowledge DB is per-project (`.planning/knowledge/{user}.db`) and global (`~/.claude/knowledge/{user}.db`). Both are created automatically on first use.

### Initialize the Knowledge Database

No explicit init step needed. The DB creates itself on first access. Verify it's working:

```bash
node get-shit-done/bin/gsd-tools.js knowledge status
# → {"available": true, "db_path": ".../.planning/knowledge/ollorin.db"}

node get-shit-done/bin/gsd-tools.js knowledge stats
# → entry counts by type and scope
```

### Mine Past Conversations

**From `~/.claude/projects/` (Claude Code conversation history):**

```bash
# Discover what's ready to mine, then process via Haiku subagents
node get-shit-done/bin/gsd-tools.js mine-conversations --max-age-days 90

# Or run the full orchestrated workflow in Claude Code:
# (ask Claude to run the mine-conversations workflow)
# @get-shit-done/workflows/mine-conversations.md
```

Options: `--max-age-days N` (default 30), `--limit N`, `--include-subagents`.
Already-analyzed conversations are skipped via content hash.

**From `.planning/telegram-sessions/` (Telegram session history):**

```bash
# List sessions pending analysis
node get-shit-done/bin/gsd-tools.js list-pending-sessions

# Run full analysis (spawns Haiku per session)
# @get-shit-done/workflows/analyze-pending-sessions.md
```

Both workflows are idempotent — safe to re-run. Results stored in `.planning/knowledge/`.

---

## Telegram Setup

1. Message `@BotFather` → `/newbot` → copy token
2. Add to `.env`:
   ```
   TELEGRAM_BOT_TOKEN=your_token_here
   TELEGRAM_OWNER_ID=your_telegram_user_id
   ```
3. The MCP server starts automatically with Claude Code (configured by `npm run install:gsd`)
4. Send `/start` to your bot in Telegram

Voice messages: install `ffmpeg` (`brew install ffmpeg`) — Whisper model is downloaded by the installer.

---

## Configuration

Settings in `.planning/config.json`. Change via `/gsd:settings`.

| Setting | Default | What it does |
|---------|---------|--------------|
| `mode` | `interactive` | `yolo` = auto-approve all steps |
| `depth` | `standard` | Planning thoroughness |
| `parallelization.enabled` | `true` | Run independent plans in parallel |
| `git.branching_strategy` | `none` | `phase` or `milestone` to create branches |

**Model profiles** (`/gsd:set-profile`):

| Profile | Planning | Execution | Verification |
|---------|----------|-----------|--------------|
| `auto` | adaptive | adaptive | adaptive |
| `quality` | Opus | Opus | Sonnet |
| `balanced` | Opus | Sonnet | Sonnet |
| `budget` | Sonnet | Sonnet | Haiku |

`auto` uses complexity signals (task type, file count, keywords) to route each task to the cheapest model that can handle it — Haiku for simple reads and docs, Sonnet for standard work, Opus for architecture and complex decisions. Circuit breakers and error escalation ensure quality.

---

## Troubleshooting

**Commands not found after install** — restart Claude Code, verify `~/.claude/commands/gsd/` exists.

**Docker / CI** — set `CLAUDE_CONFIG_DIR=/home/user/.claude` before installing.

**Telegram bot not responding** — check `.env` has correct token, send `/start` to bot first.

**Voice messages not working** — `brew install ffmpeg`, check Whisper model downloaded.

---

## License

MIT. See [LICENSE](LICENSE).

---

<div align="center">

**Claude Code is powerful. GSD makes it reliable.**

</div>
