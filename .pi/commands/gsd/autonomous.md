---
name: gsd:autonomous
description: Run all remaining phases autonomously — discuss→plan→execute per phase
argument-hint: "[--from N]"
---

# GSD Autonomous

Execute all remaining milestone phases autonomously. For each phase: discuss → plan → execute.

## Usage

```
/gsd:autonomous [--from N]
```

**Flags:**
- `--from N` — Start from phase N instead of current phase

## Process

Execute the autonomous workflow from `get-shit-done/workflows/autonomous.md` end-to-end.

## Reference

See `commands/gsd/autonomous.md` in the GSD source for the full command definition.