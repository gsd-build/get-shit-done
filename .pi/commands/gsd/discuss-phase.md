---
name: gsd:discuss-phase
description: Capture implementation decisions before planning a phase
---

# GSD: Discuss Phase

Shape the implementation by capturing your preferences before planning.

## Usage

```
/gsd:discuss-phase [phase-number] [--auto] [--analyze]
```

## Flags

- `--auto` — Skip interactive questions, use defaults
- `--analyze` — Add trade-off analysis for decisions

## Creates

- `.planning/phases/XX-name/XX-CONTEXT.md` — user preferences for the phase

## Process

1. Analyze the phase from ROADMAP.md
2. Identify gray areas (visual features → layout/density; APIs → format/error handling)
3. Ask until preferences are captured
4. Write CONTEXT.md for researcher and planner

## Why This Matters

The deeper you go here, the more the system builds what *you* want. Skip it and get reasonable defaults.

## Reference

This command wraps the GSD discuss-phase workflow. See `get-shit-done/workflows/discuss-phase.md` for the full workflow definition.