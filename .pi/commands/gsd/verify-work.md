---
name: gsd:verify-work
description: Manual user acceptance testing for phase deliverables
---

# GSD: Verify Work

Confirm that the phase actually works as expected.

## Usage

```
/gsd:verify-work [phase-number]
```

## Creates

- `.planning/phases/XX-UAT.md` — user acceptance test results
- Fix plans if issues found

## Process

1. Extract testable deliverables from the phase
2. Walk through one at a time: "Can you log in with email?"
3. User confirms yes/no or describes what's wrong
4. If broken, spawn debug agents to diagnose
5. Create verified fix plans ready for re-execution

## Why This Matters

Automated verification checks code exists and tests pass. This is where you confirm it *works* the way you expected.

## Reference

This command wraps the GSD verify-work workflow. See `get-shit-done/workflows/verify-work.md` for the full workflow definition.