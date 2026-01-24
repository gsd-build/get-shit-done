# Parallel Work Support

GSD v1.11 enables running multiple GSD sessions simultaneously from different terminal windows without state corruption.

## How It Works

**The Problem (Before v1.11)**:
When two terminals ran GSD commands simultaneously, they could both:
1. Read STATE.md at the same time
2. Make different decisions about "current position"
3. Write conflicting updates to STATE.md
4. Corrupt project state

**The Solution (v1.11 State Derivation)**:
Instead of reading a centralized STATE.md for position, GSD now DERIVES state from the filesystem:

- **Plan complete?** Check if SUMMARY.md exists (atomic operation)
- **Current phase?** Find first phase with incomplete plans (read-only scan)
- **Progress?** Count SUMMARY files / PLAN files (pure calculation)

File existence checks are atomic - two processes can check simultaneously and both get correct answers.

## Safe Parallel Scenarios

### Two Terminals, Different Phases
```
Terminal 1: /gsd:execute-phase 2
Terminal 2: /gsd:execute-phase 3
```
✓ Safe - Each works on its own phase, creates its own SUMMARY files.

### Two Terminals, Same Phase, Different Plans
```
Terminal 1: Executing 02-01-PLAN.md
Terminal 2: Executing 02-02-PLAN.md (Plan 02-01 was already complete)
```
✓ Safe - Each creates its own SUMMARY file in the same directory.

### Planning While Executing
```
Terminal 1: /gsd:execute-phase 2
Terminal 2: /gsd:plan-phase 3
```
✓ Safe - Planning only reads existing files and writes new PLAN files.

### Progress Queries During Execution
```
Terminal 1: /gsd:execute-phase 2 (long-running)
Terminal 2: /gsd:progress (repeatedly)
```
✓ Safe - Progress queries are read-only filesystem scans.

## Unsafe Scenarios (Avoid)

### Two Terminals, Same Plan
```
Terminal 1: Executing 02-01-PLAN.md
Terminal 2: Also executing 02-01-PLAN.md
```
✗ Unsafe - Both try to create the same SUMMARY file. One will fail.

**Prevention**: GSD checks for existing SUMMARY before starting execution.

### Simultaneous ROADMAP Edits
```
Terminal 1: /gsd:add-phase "New feature"
Terminal 2: /gsd:remove-phase 3
```
✗ Unsafe - Both modify ROADMAP.md. Use sequentially.

**Prevention**: Structural modifications should be done one at a time.

### Simultaneous STATE.md Context Writes
```
Terminal 1: Completing plan, writing to STATE.md
Terminal 2: Also completing plan, writing to STATE.md
```
⚠ Semi-safe - One write may overwrite the other's context notes, but the true state (SUMMARY existence) remains correct. Cosmetic issue only.

## Verification

Run the parallel safety test suite to verify your installation:

```bash
~/.claude/get-shit-done/references/state-derivation-tests.sh
```

Expected output:
```
Results: 15 passed, 0 failed
✓ All tests passed - state derivation is parallel-safe
```

## Technical Details

See `get-shit-done/references/state-derivation.md` for the complete function library:

| Function | Purpose | Parallel Safe? |
|----------|---------|----------------|
| get_current_phase() | Find first incomplete phase | ✓ Yes |
| get_current_plan() | Find first plan without SUMMARY | ✓ Yes |
| get_progress() | Calculate completion percentage | ✓ Yes |
| get_phase_status() | Check if phase is complete | ✓ Yes |
| get_decisions() | Aggregate decisions from SUMMARYs | ✓ Yes |
| get_blockers() | Aggregate blockers from SUMMARYs | ✓ Yes |

All functions are read-only (ls, find, grep, wc). No writes, no locks.

## STATE.md Role After v1.11

STATE.md is now a **human-readable reference**, not a machine state store:

- **Written**: After each plan completes (for human review)
- **Read**: For accumulated context (decisions, blockers, session notes)
- **NOT read**: For position/progress determination (derived instead)

This means STATE.md can become slightly out of sync if multiple sessions write to it simultaneously - but that's cosmetic, not functional. The true state is always derivable from SUMMARY.md existence.

## The Core Principle

> SUMMARY.md existence = "complete". The filesystem IS the state.

This principle enables parallel execution because:
1. File existence is an atomic query (no partial reads)
2. Multiple processes can check simultaneously without coordination
3. Creating a SUMMARY file is the atomic "commit" operation
4. No locks needed - just filesystem operations

## Troubleshooting

### "Plan already has SUMMARY" error
Another terminal (or previous session) already completed this plan. Run `/gsd:progress` to see current state.

### Progress shows different values between terminals
Both are correct - one terminal may have just completed a plan. Derived state is always current.

### STATE.md looks outdated
STATE.md is for human reference. The true state is derived from SUMMARY files. STATE.md will be updated when the next plan completes.
