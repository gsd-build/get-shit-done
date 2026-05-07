# GSD Documentation

Comprehensive documentation for the Get Shit Done (GSD) framework — a meta-prompting, context engineering, and spec-driven development system for AI coding agents.

Language versions: [English](README.md) · [Português (pt-BR)](pt-BR/README.md) · [日本語](ja-JP/README.md) · [简体中文](zh-CN/README.md)

## Documentation Index

| Document | Audience | Description |
|----------|----------|-------------|
| [Architecture](ARCHITECTURE.md) | Contributors, advanced users | System architecture, agent model, data flow, and internal design |
| [Feature Reference](FEATURES.md) | All users | Feature narratives and requirements for released features (see [CHANGELOG](../CHANGELOG.md) for latest additions) |
| [Command Reference](COMMANDS.md) | All users | Stable commands with syntax, flags, options, and examples |
| [Configuration Reference](CONFIGURATION.md) | All users | Full config schema, workflow toggles, model profiles, git branching |
| [CLI Tools Reference](CLI-TOOLS.md) | Contributors, agent authors | `gsd-tools.cjs` programmatic API for workflows and agents |
| [Agent Reference](AGENTS.md) | Contributors, advanced users | Role cards for primary agents — roles, tools, spawn patterns (the `agents/` filesystem is authoritative) |
| [User Guide](USER-GUIDE.md) | All users | Workflow walkthroughs, troubleshooting, and recovery |
| [Issue-Driven Orchestration](issue-driven-orchestration.md) | All users | Recipe for driving GSD from a tracker issue (GitHub / Linear / Jira) using existing primitives — no new commands or daemon |
| [Context Monitor](context-monitor.md) | All users | Context window monitoring hook architecture |
| [Discuss Mode](workflow-discuss-mode.md) | All users | Assumptions vs interview mode for discuss-phase |
| [Canary Stream](CANARY.md) | Contributors, early adopters | `dev` → `@canary` dist-tag policy, when to install, rollback path |

## Quick Links

- **What's new:** see [CHANGELOG](../CHANGELOG.md) for current release notes, and upstream [README](../README.md) for release highlights
- **Canary preview:** [`docs/CANARY.md`](CANARY.md) — opt into the early-preview stream from `dev`. Active cut: [`v1.50.0-canary.1`](RELEASE-v1.50.0-canary.1.md)
- **Getting started:** [README](../README.md) → install → `/gsd-new-project`
- **Full workflow walkthrough:** [User Guide](USER-GUIDE.md)
- **All commands at a glance:** [Command Reference](COMMANDS.md)
- **Configuring GSD:** [Configuration Reference](CONFIGURATION.md)
- **How the system works internally:** [Architecture](ARCHITECTURE.md)
- **Contributing or extending:** [CLI Tools Reference](CLI-TOOLS.md) + [Agent Reference](AGENTS.md)