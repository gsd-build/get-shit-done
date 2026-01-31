# GSD Documentation

Welcome to the Get Shit Done Together (GSD) documentation.

## Quick Links

- [Overview](overview.md) — What GSD is and how it works
- [Getting Started](guides/getting-started.md) — Your first GSD project

## Documentation Structure

```
docs/
├── overview.md              # System overview
├── concepts/                # Core concepts explained
│   ├── projects.md          # Strategic container
│   ├── milestones.md        # Version releases
│   ├── phases.md            # Roadmap delivery units
│   └── plans.md             # Executable prompts
├── reference/               # Technical reference
│   ├── commands.md          # All slash commands
│   ├── agents.md            # Subagent details
│   └── templates.md         # File templates
└── guides/                  # How-to guides
    ├── getting-started.md   # First project walkthrough
    └── workflows.md         # Common patterns
```

## Concepts

Understand the GSD hierarchy:

| Level | Purpose | Documentation |
|-------|---------|---------------|
| **Project** | Strategic vision | [projects.md](concepts/projects.md) |
| **Milestone** | Version release | [milestones.md](concepts/milestones.md) |
| **Phase** | Delivery unit | [phases.md](concepts/phases.md) |
| **Plan** | Executable prompt | [plans.md](concepts/plans.md) |

## Reference

Technical details:

- [Commands](reference/commands.md) — All `/gsd:*` commands
- [Agents](reference/agents.md) — Subagent behaviors
- [Templates](reference/templates.md) — File formats

## Guides

Practical workflows:

- [Getting Started](guides/getting-started.md) — First project
- [Workflows](guides/workflows.md) — Common patterns
  - Git branching strategies (none, phase, milestone)
  - Branch-per-milestone workflow
  - Git worktree workflows

## Quick Start

```bash
# Install
npx get-shit-done-together

# Initialize project
/gsd:new-project

# Plan and execute
/gsd:plan-phase 1
/gsd:execute-phase 1

# Check progress
/gsd:progress
```

## Key Commands

| Command | Purpose |
|---------|---------|
| `/gsd:new-project` | Start new project |
| `/gsd:plan-phase [N]` | Plan a phase |
| `/gsd:execute-phase [N]` | Execute a phase |
| `/gsd:progress` | Check status |
| `/gsd:help` | Show all commands |

## The .planning/ Directory

All GSD artifacts live in `.planning/`:

```
.planning/
├── PROJECT.md        # Vision and requirements
├── ROADMAP.md        # Phase structure
├── STATE.md          # Current position
├── config.json       # Settings
└── phases/           # Execution directories
```

## Getting Help

- `/gsd:help` — In-tool help
- [Discord](https://discord.gg/gsd) — Community support
- [GitHub Issues](https://github.com/anthropics/get-shit-done-together/issues) — Bug reports
