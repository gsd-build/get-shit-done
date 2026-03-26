---
name: gsd:new-project
description: Initialize a new project with deep context gathering and PROJECT.md
---

# GSD: New Project

Initialize a new project through unified flow: questioning → research → requirements → roadmap.

## Usage

```
/gsd:new-project [--auto]
```

## Flags

- `--auto` — Automatic mode. Runs research → requirements → roadmap without interaction.

## Creates

- `.planning/PROJECT.md` — project context
- `.planning/config.json` — workflow preferences
- `.planning/research/` — domain research (optional)
- `.planning/REQUIREMENTS.md` — scoped requirements
- `.planning/ROADMAP.md` — phase structure
- `.planning/STATE.md` — project memory

## Process

Execute the new-project workflow from the GSD system:

1. Ask questions until the idea is fully understood
2. Optionally spawn research agents (4 parallel: stack, features, architecture, pitfalls)
3. Extract requirements (v1/v2/out-of-scope)
4. Create roadmap with phases
5. Get user approval

## Next Step

After this command: Run `/gsd:plan-phase 1` to start execution.

## Reference

This command wraps the GSD new-project workflow. See `get-shit-done/workflows/new-project.md` for the full workflow definition.