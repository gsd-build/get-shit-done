---
name: gsd:plan-phase
description: Research and create execution plans for a phase
---

# GSD: Plan Phase

Research how to implement a phase and create atomic task plans.

## Usage

```
/gsd:plan-phase [phase-number] [--auto] [--reviews]
```

## Flags

- `--auto` — Skip interactive prompts
- `--reviews` — Load codebase review findings

## Creates

- `.planning/phases/XX-name/XX-RESEARCH.md` — ecosystem research
- `.planning/phases/XX-name/XX-YY-PLAN.md` — execution plans (2-3)

## Process

1. Read CONTEXT.md for user preferences
2. Spawn researcher to investigate implementation patterns
3. Create 2-3 atomic plans sized for single context windows
4. Verify plans against requirements (plan-checker loop, max 3x)
5. Group plans into dependency waves

## Plan Structure

Each plan uses XML structure:
- `<task>` elements with type, action, verify, done
- `read_first` for required context
- `acceptance_criteria` for verification

## Reference

This command wraps the GSD plan-phase workflow. See `get-shit-done/workflows/plan-phase.md` for the full workflow definition.