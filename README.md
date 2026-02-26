# get-shit-done-codex (Codex CLI/Desktop)

A meta-prompting, context engineering and spec-driven development system for [OpenAI Codex](https://github.com/openai/codex), including both CLI and Desktop.

Fork of [get-shit-done](https://github.com/taches/get-shit-done) by TÂCHES, adapted for Codex CLI by [undeemed](https://github.com/undeemed).

> [!CAUTION]
> As of February 25, 2026, Codex is supported upstream. This fork remains focused on Codex-specific UX and compatibility with extra goodies.

[![npm version](https://img.shields.io/npm/v/%40undeemed%2Fget-shit-done-codex?style=flat-square)](https://www.npmjs.com/package/@undeemed/get-shit-done-codex)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
![npm Downloads](https://img.shields.io/npm/dt/@undeemed/get-shit-done-codex?style=flat-square)

## What This Does

get-shit-done-codex (GSD) solves context rot — the quality degradation that happens as AI fills its context window. It structures your project through specs and plans so Codex CLI has what it needs to build reliably.

**The problem:** AI assistants lose quality as conversations grow. Context gets polluted, requirements get forgotten, work becomes inconsistent.

**The solution:** Hierarchical planning with fresh context windows. Each task runs in isolation with exactly the context it needs—no degradation from accumulated garbage.

## What Changed In This Fork

- **AGENTS-first for Codex:** `AGENTS.md` is the primary behavior contract  . [Agent.md > Skills.md](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)
- **Two command surfaces:** choose native skills (`$gsd-*`) or prompt aliases (`/prompts:gsd-*`).
- **Installer integrity checks:** `--verify` audits installation health, `--repair` restores missing artifacts.
- **Mode-aware installs:** installer adapts `AGENTS.md` and command guidance to your chosen mode.

## Installation

```bash
npx @undeemed/get-shit-done-codex@latest
```

You can install globally (`~/.codex/`) or locally (`./`).

### Recommended

```bash
npx @undeemed/get-shit-done-codex --global
```

If you run this in an interactive terminal, the installer will prompt you to choose `skills` (`$`) or `prompts` (`/prompts`).
In non-interactive runs, default is `skills` mode.

For non-interactive installs:

```bash
npx @undeemed/get-shit-done-codex --global   # Install to ~/.codex/
npx @undeemed/get-shit-done-codex --local    # Install to current directory
npx @undeemed/get-shit-done-codex --global --codex-mode skills   # Native skills only
npx @undeemed/get-shit-done-codex --global --codex-mode prompts  # Prompt aliases only
npx @undeemed/get-shit-done-codex --global --migrate             # Apply detected migration cleanup
npx @undeemed/get-shit-done-codex --global --skip-migrate        # Keep legacy surface files
npx @undeemed/get-shit-done-codex --verify --global              # Check install integrity
npx @undeemed/get-shit-done-codex --verify --repair --global     # Auto-repair
```

### Codex Modes

| Mode      | Installs                     | Use Commands Like           |
| --------- | ---------------------------- | --------------------------- |
| `skills` (default) | `skills/gsd-*/SKILL.md`      | `$gsd-help`, `$gsd-plan-phase 1` |
| `prompts` | `prompts/gsd-*.md`           | `/prompts:gsd-help`         |

After installation, run `codex` (CLI) or `codex app` (Desktop), then run `$gsd-help` (or `/prompts:gsd-help` in prompts mode).
Single-surface policy: mixed `skills/` + `prompts/` installs are treated as drift and fail `--verify`.

### Installed File Structure

`$` skills mode (`--codex-mode skills`, default):

```text
~/.codex/
├── AGENTS.md
├── skills/
│   └── gsd-*/SKILL.md
└── get-shit-done/
```

`/prompts` mode (`--codex-mode prompts`):

```text
~/.codex/
├── AGENTS.md
├── prompts/
│   └── gsd-*.md
└── get-shit-done/
```

For local installs, replace `~/.codex/` with `./`.

### Verify And Repair

- `--verify`: checks `AGENTS.md`, command surfaces, workflow assets, and version metadata.
- `--verify --repair`: reinstalls missing/broken artifacts and verifies again.
- Migration is **detect-then-confirm**, not automatic:
  - Interactive install asks before removing legacy surface files
  - Non-interactive install skips cleanup unless `--migrate` is passed
  - `--skip-migrate` keeps legacy files explicitly

### AGENTS-First Reliability

This fork is intentionally **AGENTS.md-first** for Codex reliability:

- `AGENTS.md` is the source of truth for behavior and workflow constraints
- `$gsd-*` skills are lightweight command wrappers around the same workflow docs
- `/prompts:gsd-*` are optional compatibility aliases (prompts mode)

## Staying Updated

```bash
# Check for updates from inside Codex
$gsd-update
# or: /prompts:gsd-update

# Update from terminal
npx @undeemed/get-shit-done-codex@latest --global
```

The installer writes a `get-shit-done/VERSION` file so `$gsd-update` (or `/prompts:gsd-update`) can detect installed vs latest and show changelog before updating.

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
$gsd-new-project

# 2. Plan the first phase
$gsd-plan-phase 1

# 3. Execute the phase
$gsd-execute-phase 1

# 4. Verify it works
$gsd-verify-work 1
```

## How It Works

### 1. Initialize Project

```
$gsd-new-project
```

One command takes you from idea to ready-for-planning:

- Deep questioning to understand what you're building
- Optional domain research (spawns 4 parallel researcher agents)
- Requirements definition with v1/v2/out-of-scope scoping
- Roadmap creation with phase breakdown

**Creates:** `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `.planning/research/`

### 2. Plan Phase

```
$gsd-plan-phase 1
```

The system researches how to implement the phase, creates 2-3 atomic task plans, and verifies them against requirements.

**Creates:** `{phase}-RESEARCH.md`, `{phase}-{N}-PLAN.md`

### 3. Execute Phase

```
$gsd-execute-phase 1
```

Runs all plans in parallel waves. Each plan executes in a fresh 200k context window. Every task gets its own atomic commit.

**Creates:** `{phase}-{N}-SUMMARY.md`, `{phase}-VERIFICATION.md`

### 4. Verify Work

```
$gsd-verify-work 1
```

Manual user acceptance testing. The system walks you through testable deliverables and creates fix plans if issues are found.

## Commands

| Command                  | Description                                                       |
| ------------------------ | ----------------------------------------------------------------- |
| `$gsd-new-project`       | Initialize project: questions → research → requirements → roadmap |
| `$gsd-plan-phase [N]`    | Research + plan + verify for a phase                              |
| `$gsd-execute-phase <N>` | Execute all plans in parallel waves                               |
| `$gsd-verify-work [N]`   | Manual user acceptance testing                                    |
| `$gsd-help`              | Show all commands                                                 |

Use `/prompts:gsd-*` aliases when installed with `--codex-mode prompts`.

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

- Restart Codex to reload installed command surfaces
- Check `~/.codex/skills/gsd-*/SKILL.md` (global) or `./skills/gsd-*/SKILL.md` (local)
- If using prompt aliases, check `~/.codex/prompts/gsd-*.md` (global) or `./prompts/gsd-*.md` (local)

**Update to latest:**

```bash
npx @undeemed/get-shit-done-codex@latest
```

**Can users be notified when an update is available?**

- Yes. The installer prints an update notice if a newer npm version exists.
- In-Codex update checks are available via `$gsd-update` (or `/prompts:gsd-update`).
- For release notifications outside the CLI, enable GitHub release watching on this repo.

## More Documentation

For deeper guides, detailed workflows, and comprehensive documentation, see the [original get-shit-done README](https://github.com/taches/get-shit-done/blob/main/README.md).

The original repository contains:

- Detailed workflow explanations
- Advanced usage patterns
- Complete command reference
- Best practices and examples
- Architecture and design principles

**Note:** The original README is written for Codex Code. When following it, remember that this fork uses:

- Codex-native skills (`$gsd-*`) by default
- Optional prompt aliases (`/prompts:gsd-*`) via `--codex-mode prompts`
- OpenAI Codex CLI & Desktop

## Keywords

`get-shit-done` `gsd` `openai` `codex` `codex-cli` `codex-desktop` `codex-app` `openai-codex` `ai` `ai-coding` `ai-agents` `meta-prompting` `context-engineering` `context-rot` `spec-driven-development` `prompt-engineering` `multi-agent` `subagent` `ai-workflow` `developer-tools` `dev-tools` `productivity` `code-generation`

## Credits

Original project by [TÂCHES](https://github.com/taches). This fork adapts it for Codex CLI.

## License

MIT
