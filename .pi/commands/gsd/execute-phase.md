---
name: gsd:execute-phase
description: Execute all plans in a phase with wave-based parallelization
---

# GSD: Execute Phase

Execute all plans in a phase using wave-based parallel execution.

## Usage

```
/gsd:execute-phase <phase-number> [--wave N] [--gaps-only] [--interactive]
```

## Arguments

- `phase-number` — Required. The phase to execute.

## Flags

- `--wave N` — Execute only Wave N (for pacing/quota management)
- `--gaps-only` — Execute only gap closure plans (after verify-work)
- `--interactive` — Execute sequentially inline with user checkpoints

## Creates

- Code changes in the project
- `.planning/phases/XX-name/XX-YY-SUMMARY.md` — per-plan outcomes
- `.planning/phases/XX-VERIFICATION.md` — post-execution verification
- Git commits (one per task)

## Process

1. Discover incomplete plans in the phase
2. Analyze dependencies, group into waves
3. Spawn executor agents (fresh context per plan)
4. Collect results, update state
5. Run verification after all plans complete

## Wave Execution

Plans run in parallel within waves, sequentially across waves:

```
Wave 1: Plan 01, Plan 02 (parallel)
Wave 2: Plan 03, Plan 04 (parallel, after Wave 1)
Wave 3: Plan 05 (after Wave 2)
```

## Reference

This command wraps the GSD execute-phase workflow. See `get-shit-done/workflows/execute-phase.md` for the full workflow definition.