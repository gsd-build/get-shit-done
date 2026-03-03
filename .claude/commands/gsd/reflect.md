---
name: gsd:reflect
description: Analyze accumulated signals and distill patterns into lessons (v1.16.0+dev)
argument-hint: "[phase] [--all] [--drift]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - Glob
  - Grep
---

# /gsd:reflect

Analyze accumulated signals from the knowledge base, detect recurring patterns, and distill actionable lessons.

## Purpose

Run reflection on accumulated signals to detect patterns and create actionable lessons. This closes the self-improvement loop: signals capture what went wrong, patterns identify recurring issues, and lessons prevent future occurrences.

## Usage

```
/gsd:reflect              # Reflect on current project
/gsd:reflect {phase}      # Include phase-end reflection for specific phase
/gsd:reflect --all        # Cross-project pattern detection
/gsd:reflect --drift      # Include semantic drift analysis
/gsd:reflect --patterns-only  # Detect patterns without creating lessons
```

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| phase | number | no | Include phase-end reflection (PLAN vs SUMMARY comparison) |
| --all | flag | no | Enable cross-project scope (scan all projects in KB) |
| --drift | flag | no | Include semantic drift analysis |
| --patterns-only | flag | no | Skip lesson distillation, report patterns only |

## Examples

**Basic reflection on current project:**
```
/gsd:reflect
```

**Phase-end reflection after completing phase 3:**
```
/gsd:reflect 3
```

**Cross-project pattern detection:**
```
/gsd:reflect --all
```

**Phase reflection with drift analysis:**
```
/gsd:reflect 4 --drift
```

**Pattern detection without lesson creation:**
```
/gsd:reflect --patterns-only
```

## Behavior

1. **Route to workflow:** Invoke `get-shit-done/workflows/reflect.md` with arguments
2. **No command-level logic:** All reflection logic lives in the workflow

## Workflow Reference

See: `get-shit-done/workflows/reflect.md`

## Mode Behavior

- **YOLO mode:** Auto-approves HIGH confidence lessons (6+ evidence), writes MEDIUM/LOW with project scope
- **Interactive mode:** Presents each lesson candidate for user confirmation (yes/no/edit)

## Related

- `/gsd:collect-signals` -- Post-execution signal collection (populates KB)
- `/gsd:signal` -- Manual signal logging
- `/gsd:spike` -- Run experiments for design uncertainty
- `/gsd:complete-milestone` -- Can optionally trigger reflection
