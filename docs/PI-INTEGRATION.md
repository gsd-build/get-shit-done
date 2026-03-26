# GSD Pi Integration

> Using Get Shit Done with the pi coding agent.

## Overview

GSD (Get Shit Done) is a meta-prompting, context engineering, and spec-driven development system. This integration provides pi-native access to GSD's workflow commands and agents.

## Installation

GSD is already integrated into this project. The pi integration files are located in:

```
.pi/
├── commands/gsd/     # Pi command wrappers
├── agents/           # Pi agent definitions
└── taskplane.json    # Taskplane configuration
```

## Available Commands

### Core Workflow

| Command | Description |
|---------|-------------|
| `/gsd:new-project` | Initialize project with full context gathering |
| `/gsd:discuss-phase` | Capture implementation decisions |
| `/gsd:plan-phase` | Research and create execution plans |
| `/gsd:execute-phase` | Execute plans with parallelization |
| `/gsd:verify-work` | User acceptance testing |
| `/gsd:quick` | Ad-hoc tasks without full planning |
| `/gsd:progress` | Show current position |
| `/gsd:help` | Show all commands |

## Quick Start

### 1. Initialize a New Project

```
/gsd:new-project
```

This will:
- Ask questions about your idea
- Research the ecosystem (optional)
- Create requirements and roadmap
- Set up `.planning/` directory

### 2. Plan Your First Phase

```
/gsd:discuss-phase 1
/gsd:plan-phase 1
```

### 3. Execute

```
/gsd:execute-phase 1
```

### 4. Verify

```
/gsd:verify-work 1
```

## Available Agents

| Agent | Role |
|-------|------|
| `gsd-planner` | Creates execution plans |
| `gsd-executor` | Executes plans with atomic commits |
| `gsd-verifier` | Verifies phase goals |
| `gsd-phase-researcher` | Researches implementation patterns |
| `gsd-project-researcher` | Researches domain ecosystem |

## How It Works

### Command Wrappers

The commands in `.pi/commands/gsd/` are lightweight wrappers that:

1. Define the command interface (name, description, usage)
2. Reference the full GSD workflow definitions
3. Provide quick reference for the user

### Agent Definitions

The agents in `.pi/agents/` are pi-native definitions that:

1. Specify tools and permissions
2. Define the agent role and process
3. Reference the full GSD agent definitions for detailed behavior

## File Structure

After running GSD commands, you'll have:

```
.planning/
├── PROJECT.md        # Project vision
├── REQUIREMENTS.md   # Scoped requirements
├── ROADMAP.md        # Phase breakdown
├── STATE.md          # Current position
├── config.json       # Workflow settings
├── research/         # Domain research
└── phases/           # Phase execution artifacts
    └── 01-name/
        ├── 01-CONTEXT.md
        ├── 01-RESEARCH.md
        ├── 01-01-PLAN.md
        ├── 01-01-SUMMARY.md
        └── 01-VERIFICATION.md
```

## Testing

Run the pi integration tests:

```bash
npm test
```

Or specifically:

```bash
node --test tests/pi-integration.test.cjs
```

## Differences from Claude Code

| Feature | Claude Code | Pi |
|---------|-------------|-----|
| Command format | `/gsd:command` | `/gsd:command` |
| Agent spawning | Task tool | Built-in agent support |
| Hooks | Native hooks | Extension-based |
| Model profiles | Built-in | Per-agent config |

## Contributing

To add or modify pi integration:

1. Add/modify commands in `.pi/commands/gsd/`
2. Add/modify agents in `.pi/agents/`
3. Run tests: `npm test`
4. Update this doc if needed

## Related Documentation

- [GSD Architecture](./ARCHITECTURE.md)
- [GSD Agents](./AGENTS.md)
- [GSD User Guide](./USER-GUIDE.md)