# Parallel Validation Scenarios

Manual test scenarios to validate parallel GSD execution works correctly.

## Scenario 1: Two Phases, Two Terminals

**Setup:**
1. Create test project with 3 phases, each with 1 simple plan
2. Execute phase 1 to completion (creates baseline)

**Test:**
1. Open Terminal A: `cd project && /gsd:execute-phase 2`
2. Open Terminal B: `cd project && /gsd:execute-phase 3`
3. Both should complete without errors

**Expected Results:**
- Both terminals complete their respective phases
- Both SUMMARY files created correctly
- STATE.md may show Terminal A or B's last update (cosmetic)
- ROADMAP.md shows both phases complete

**Validation:**
```bash
# Check SUMMARYs exist
ls .planning/phases/02-*/02-01-SUMMARY.md
ls .planning/phases/03-*/03-01-SUMMARY.md

# Verify ROADMAP checkboxes
grep -E "^\s*-\s*\[x\].*Phase [23]" .planning/ROADMAP.md
```

## Scenario 2: Progress Query During Execution

**Setup:**
1. Create test project with 5 plans in phase 1
2. Complete 2 plans manually

**Test:**
1. Terminal A: Start `/gsd:execute-phase 1` (will take time)
2. Terminal B: Run `/gsd:progress` repeatedly during execution

**Expected Results:**
- Progress percentage increases as plans complete
- No errors in either terminal
- Progress queries don't block execution

**Validation:**
```bash
# Watch progress update in real-time
watch -n 2 'ls .planning/phases/01-*/*-SUMMARY.md 2>/dev/null | wc -l'
```

## Scenario 3: Plan While Execute

**Setup:**
1. Project with phase 1 executed, phase 2 empty (no plans)

**Test:**
1. Terminal A: `/gsd:execute-phase 1` (on remaining plans)
2. Terminal B: `/gsd:plan-phase 2`

**Expected Results:**
- Phase 1 execution completes
- Phase 2 plans created
- No conflicts

**Validation:**
```bash
# Both should exist
ls .planning/phases/01-*/*-SUMMARY.md
ls .planning/phases/02-*/*-PLAN.md
```

## Scenario 4: Resume After Crash

**Setup:**
1. Start executing a 3-plan phase
2. Kill Claude session after 1 plan completes (Ctrl+C hard kill)

**Test:**
1. New session: `/gsd:resume-work`

**Expected Results:**
- Correctly identifies completed plan (SUMMARY exists)
- Correctly identifies next plan (no SUMMARY)
- No state corruption despite interrupted write to STATE.md

**Validation:**
```bash
# SUMMARY count should match actual completed work
ls .planning/phases/01-*/*-SUMMARY.md | wc -l

# Next plan should be the one without SUMMARY
ls .planning/phases/01-*/*-PLAN.md | while read plan; do
  summary="${plan/PLAN/SUMMARY}"
  [ ! -f "$summary" ] && echo "Next: $plan"
done
```

## Scenario 5: Same Plan Race Condition (Negative Test)

**Setup:**
1. Project with an incomplete plan (no SUMMARY)

**Test:**
1. Terminal A: Start executing the plan
2. Terminal B: Try to start the same plan before A completes

**Expected Results:**
- Terminal B should detect plan is in progress or wait
- Only ONE SUMMARY file gets created
- No duplicate work

**Validation:**
```bash
# Should be exactly 1 SUMMARY
ls .planning/phases/01-*/01-01-SUMMARY.md | wc -l  # Should be 1
```

## Validation Checklist

For each scenario, verify:

- [ ] Both terminals complete without error
- [ ] SUMMARY files created in correct locations
- [ ] No duplicate commits (git log clean)
- [ ] STATE.md reflects reasonable state (may vary by last writer)
- [ ] ROADMAP.md checkboxes match SUMMARY existence

## Automated Validation

The test harness validates the derivation functions:

```bash
~/.claude/get-shit-done/references/state-derivation-tests.sh
```

Tests cover:
- Single-terminal state derivation
- Parallel query safety (same dir, simultaneous reads)
- Edge cases (empty phases, all complete, none complete)
- Function consistency (repeated calls return same results)

## Known Limitations

1. **ROADMAP.md writes not parallelized** - Adding/removing phases should be done one at a time
2. **STATE.md cosmetic races** - Last writer wins for human-readable state, but derived state is always correct
3. **Same-plan execution** - Two terminals on the same plan will conflict; detected and prevented
4. **Git commits** - Each terminal commits independently; may need merge if modifying same files
