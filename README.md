# get-shit-done-codex (Codex CLI/Desktop)

A meta-prompting, context engineering and spec-driven development system for [OpenAI Codex](https://github.com/openai/codex), including both CLI and Desktop.

Fork of [get-shit-done](https://github.com/taches/get-shit-done) by TÂCHES, adapted for Codex CLI by [undeemed](https://github.com/undeemed).

[![npm version](https://img.shields.io/npm/v/%40undeemed%2Fget-shit-done-codex?style=flat-square)](https://www.npmjs.com/package/@undeemed/get-shit-done-codex)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
![npm Downloads](https://img.shields.io/npm/dt/@undeemed/get-shit-done-codex?style=flat-square)

## What This Does

get-shit-done-codex (GSD) solves context rot — the quality degradation that happens as AI fills its context window. It structures your project through specs and plans so Codex CLI has what it needs to build reliably.

**The problem:** AI assistants lose quality as conversations grow. Context gets polluted, requirements get forgotten, work becomes inconsistent.

**The solution:** Hierarchical planning with fresh context windows. Each task runs in isolation with exactly the context it needs—no degradation from accumulated garbage.

## Installation

```bash
npx @undeemed/get-shit-done-codex@latest
```

You'll be prompted to install globally (`~/.codex/`) or locally (`./`).

For non-interactive installs:

```bash
npx @undeemed/get-shit-done-codex --global   # Install to ~/.codex/
npx @undeemed/get-shit-done-codex --local    # Install to current directory
```

After installation, run `codex` (CLI) or `codex app` (Desktop), then use `/prompts:gsd-help` to see all commands.

## Staying Updated

```bash
# Check for updates from inside Codex
/prompts:gsd-update

# Update from terminal
npx @undeemed/get-shit-done-codex@latest --global
```

The installer now writes a `get-shit-done/VERSION` file so `/prompts:gsd-update` can detect installed vs latest and show changelog before updating.

## npm Trusted Publisher (OIDC)

This repo includes a GitHub Actions publish workflow at:

- `.github/workflows/publish.yml`

When setting up npm Trusted Publisher for this package, use:

- **Publisher:** `GitHub Actions`
- **Organization or user:** `undeemed`
- **Repository:** `get-shit-done-codex`
- **Workflow filename:** `publish.yml`
- **Environment name:** leave blank (unless you later bind this workflow to a specific GitHub Environment)

## Quick Start

```bash
# 1. Initialize project (questions → research → requirements → roadmap)
/prompts:gsd-new-project

# 2. Plan the first phase
/prompts:gsd-plan-phase 1

# 3. Execute the phase
/prompts:gsd-execute-phase 1

# 4. Verify it works
/prompts:gsd-verify-work 1
```

## How It Works

### 1. Initialize Project

```
/prompts:gsd-new-project
```

One command takes you from idea to ready-for-planning:

- Deep questioning to understand what you're building
- Optional domain research (spawns 4 parallel researcher agents)
- Requirements definition with v1/v2/out-of-scope scoping
- Roadmap creation with phase breakdown

**Creates:** `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `.planning/research/`

### 2. Plan Phase

```
/prompts:gsd-plan-phase 1
```

The system researches how to implement the phase, creates 2-3 atomic task plans, and verifies them against requirements.

**Creates:** `{phase}-RESEARCH.md`, `{phase}-{N}-PLAN.md`

### 3. Execute Phase

```
/prompts:gsd-execute-phase 1
```

Runs all plans in parallel waves. Each plan executes in a fresh 200k context window. Every task gets its own atomic commit.

**Creates:** `{phase}-{N}-SUMMARY.md`, `{phase}-VERIFICATION.md`

### 4. Verify Work

```
/prompts:gsd-verify-work 1
```

Manual user acceptance testing. The system walks you through testable deliverables and creates fix plans if issues are found.

## Commands

| Command                             | Description                                                       |
| ----------------------------------- | ----------------------------------------------------------------- |
| `/prompts:gsd-new-project`          | Initialize project: questions → research → requirements → roadmap |
| `/prompts:gsd-plan-phase [N]`       | Research + plan + verify for a phase                              |
| `/prompts:gsd-execute-phase <N>`    | Execute all plans in parallel waves                               |
| `/prompts:gsd-verify-work [N]`      | Manual user acceptance testing                                    |
| `/prompts:gsd-complete-milestone`   | Archive milestone, tag release                                    |
| `/prompts:gsd-new-milestone [name]` | Start next version                                                |
| `/prompts:gsd-progress`             | Show current status and what's next                               |
| `/prompts:gsd-update`               | Check npm for a newer release and apply update                    |
| `/prompts:gsd-help`                 | Show all commands                                                 |

See `/prompts:gsd-help` for the complete command reference.

## Why It Works

### Context Engineering

GSD maintains structured context files that stay within quality limits:

- `PROJECT.md` — Project vision, always loaded
- `REQUIREMENTS.md` — Scoped v1/v2 requirements with phase traceability
- `ROADMAP.md` — Where you're going, what's done
- `STATE.md` — Decisions, blockers, position — memory across sessions
- `PLAN.md` — Atomic task with XML structure, verification steps
- `SUMMARY.md` — What happened, committed to history

### Multi-Agent Orchestration

Every stage uses a thin orchestrator that spawns specialized agents:

- **Research** — 4 parallel researchers investigate stack, features, architecture, pitfalls
- **Planning** — Planner creates plans, checker verifies, loops until pass
- **Execution** — Executors implement in parallel, each with fresh 200k context
- **Verification** — Verifier checks codebase against goals, debuggers diagnose failures

The orchestrator stays at 30-40% context. The work happens in fresh subagent contexts.

### Atomic Git Commits

Each task gets its own commit immediately after completion:

```bash
feat(01-01): implement user authentication
feat(01-01): add password hashing
docs(01-01): complete auth-setup plan
```

Git bisect finds exact failing task. Each task independently revertable.

## Troubleshooting

**Commands not found?**

- Restart Codex CLI to reload prompts
- Check `~/.codex/prompts/gsd-*.md` (global) or `./prompts/gsd-*.md` (local)

**Update to latest:**

```bash
npx @undeemed/get-shit-done-codex@latest
```

**Can users be notified when an update is available?**

- Yes. The installer prints an update notice if a newer npm version exists.
- In-Codex update checks are available via `/prompts:gsd-update`.
- For release notifications outside the CLI, enable GitHub release watching on this repo.

## More Documentation

For deeper guides, detailed workflows, and comprehensive documentation, see the [original get-shit-done README](https://github.com/taches/get-shit-done/blob/main/README.md).

The original repository contains:

- Detailed workflow explanations
- Advanced usage patterns
- Complete command reference
- Best practices and examples
- Architecture and design principles

**Note:** The original README is written for Claude Code. When following it, remember that this fork uses:

- `/prompts:gsd-*` command format (instead of `/gsd:*`)
- OpenAI Codex CLI & Desktop (instead of Claude Code)
- `~/.codex/` directory (instead of `~/.claude/`)

## Keywords

`get-shit-done` `gsd` `openai` `codex` `codex-cli` `codex-desktop` `codex-app` `openai-codex` `ai` `ai-coding` `ai-agents` `meta-prompting` `context-engineering` `context-rot` `spec-driven-development` `prompt-engineering` `multi-agent` `subagent` `ai-workflow` `developer-tools` `dev-tools` `productivity` `code-generation`

## Credits

Original project by [TÂCHES](https://github.com/taches). This fork adapts it for Codex CLI.

## License

MIT
