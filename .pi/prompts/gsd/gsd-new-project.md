---
description: Initialize a new project with deep context gathering and PROJECT.md
---

# GSD New Project

Initialize a new project through unified flow: questioning → research (optional) → requirements → roadmap.

## Usage

```
/gsd-new-project [--auto]
```

**Flags:**
- `--auto` — Automatic mode. After config questions, runs research → requirements → roadmap without further interaction. Expects idea document via @ reference.

## Creates

- `.planning/PROJECT.md` — project context
- `.planning/config.json` — workflow preferences
- `.planning/research/` — domain research (optional)
- `.planning/REQUIREMENTS.md` — scoped requirements
- `.planning/ROADMAP.md` — phase structure
- `.planning/STATE.md` — project memory

## Process

Execute the new-project workflow from `get-shit-done/workflows/new-project.md` end-to-end.
Preserve all workflow gates (validation, approvals, commits, routing).

## Reference

See `commands/gsd/new-project.md` in the GSD source for the full command definition.