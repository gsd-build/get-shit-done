---
name: gsd:progress
description: Show current project position and next steps
---

# GSD: Progress

Where am I? What's next?

## Usage

```
/gsd:progress
```

## Shows

- Current phase and plan
- Completed phases
- Blocking issues
- Suggested next command

## Implementation

Uses `gsd-tools.cjs state get-position` to determine current position.

## Reference

This command reads STATE.md and ROADMAP.md to determine project position.
See `get-shit-done/bin/gsd-tools.cjs` for the state management implementation.