# GSD Documentation

Comprehensive documentation for the Get Shit Done (GSD) framework — a meta-prompting, context engineering, and spec-driven development system for AI coding agents.

Language versions: [English](README.md) · [Português (pt-BR)](pt-BR/README.md) · [日本語](ja-JP/README.md) · [简体中文](zh-CN/README.md)

## Documentation Index

| Document | Audience | Description |
|----------|----------|-------------|
| [Architecture](ARCHITECTURE.md) | Contributors, advanced users | System architecture, agent model, data flow, and internal design |
| [Feature Reference](FEATURES.md) | All users | Complete feature and function documentation with requirements |
| [Command Reference](COMMANDS.md) | All users | Every command with syntax, flags, options, and examples |
| [Configuration Reference](CONFIGURATION.md) | All users | Full config schema, workflow toggles, model profiles, git branching |
| [CLI Tools Reference](CLI-TOOLS.md) | Contributors, agent authors | `gsd-tools.cjs` programmatic API for workflows and agents |
| [Agent Reference](AGENTS.md) | Contributors, advanced users | All 18 specialized agents — roles, tools, spawn patterns |
| [User Guide](USER-GUIDE.md) | All users | Workflow walkthroughs, troubleshooting, and recovery |
| [Context Monitor](context-monitor.md) | All users | Context window monitoring hook architecture |
| [Discuss Mode](workflow-discuss-mode.md) | All users | Assumptions vs interview mode for discuss-phase |

## Quick Links

- **What's new in v1.32:** STATE.md consistency gates, `--to N` autonomous flag, research gate, verifier scope filtering, read-before-edit guard, 4 new runtimes (Trae, Kilo, Augment, Cline), context reduction, response language config — see [CHANGELOG](../CHANGELOG.md)
- **Getting started:** [README](../README.md) → install → `/gsd-new-project`
- **Full workflow walkthrough:** [User Guide](USER-GUIDE.md)
- **All commands at a glance:** [Command Reference](COMMANDS.md)
- **Configuring GSD:** [Configuration Reference](CONFIGURATION.md)
- **How the system works internally:** [Architecture](ARCHITECTURE.md)
- **Contributing or extending:** [CLI Tools Reference](CLI-TOOLS.md) + [Agent Reference](AGENTS.md)
