---
name: gsd:quick
description: Execute ad-hoc tasks with GSD guarantees without full planning
---

# GSD: Quick

For ad-hoc tasks that don't need full planning.

## Usage

```
/gsd:quick [--full] [--discuss] [--research]
```

## Flags

- `--full` — Enable plan-checking and verification
- `--discuss` — Gather context before planning
- `--research` — Investigate approaches before planning

## Creates

- `.planning/quick/YYMMDD-xxx-slug/PLAN.md`
- `.planning/quick/YYMMDD-xxx-slug/SUMMARY.md`

## Process

1. Ask what you want to do
2. Optionally discuss gray areas (`--discuss`)
3. Optionally research approaches (`--research`)
4. Create plan and execute
5. Optionally verify (`--full`)

## Use Cases

- Bug fixes
- Small features
- Refactoring
- Configuration changes

## Reference

This command wraps the GSD quick workflow. See `get-shit-done/workflows/quick.md` for the full workflow definition.