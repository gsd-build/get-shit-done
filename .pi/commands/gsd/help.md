---
name: gsd:help
description: Show all GSD commands and usage guide
---

# GSD: Help

Show all available GSD commands and usage guide.

## Usage

```
/gsd:help
```

## Available Commands

### Core Workflow

| Command | Description |
|---------|-------------|
| `/gsd:new-project` | Initialize project: questions → research → requirements → roadmap |
| `/gsd:discuss-phase` | Capture implementation decisions before planning |
| `/gsd:plan-phase` | Research and create execution plans |
| `/gsd:execute-phase` | Execute plans with wave-based parallelization |
| `/gsd:verify-work` | User acceptance testing |
| `/gsd:quick` | Ad-hoc tasks without full planning |
| `/gsd:progress` | Show current position and next steps |

### Navigation

| Command | Description |
|---------|-------------|
| `/gsd:next` | Auto-detect and run next step |
| `/gsd:help` | This help message |

## Workflow

1. `/gsd:new-project` → Creates PROJECT.md, REQUIREMENTS.md, ROADMAP.md
2. `/gsd:discuss-phase 1` → Creates CONTEXT.md
3. `/gsd:plan-phase 1` → Creates RESEARCH.md, PLAN.md files
4. `/gsd:execute-phase 1` → Executes plans, creates SUMMARY.md
5. `/gsd:verify-work 1` → User acceptance testing
6. Repeat for each phase

## Reference

See `docs/PI-INTEGRATION.md` for pi-specific setup and usage.
See `get-shit-done/workflows/` for workflow definitions.