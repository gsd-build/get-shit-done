# Comprehensive Test Strategy: GSD Improvements

**Date:** 2026-03-29
**Scope:** dev-bugfix (17 PRs) + dev-improvement (4 commits)
**Method:** Iterative pass-based testing with retrospectives

---

## Complete Change Inventory

### dev-bugfix (17 PRs, 45 files, +1941/-154)

| PR | Type | Core Change | Risk Level | Current Tests |
|----|------|-------------|------------|---------------|
| #1394 | fix | Trailing slash, slug newlines, dup command registration | LOW | 3 new tests |
| #1408 | fix | Decimal phase regex in commit branching | LOW | 1 new test |
| #1409 | feat | Debug --diagnose flag | LOW | 0 (prompt-only) |
| #1410 | feat | Manager passthrough flags per step | MEDIUM | 2 new tests |
| #1411 | feat | check-commit guard for commit_docs | LOW | 2 new tests |
| #1412 | feat | response_language config | MEDIUM | 2 new tests |
| #1428 | fix | Preserve USER-PROFILE.md on update | LOW | 0 (installer) |
| #1429 | fix | Shared cache dir, stale hooks path | LOW | 1 adjusted test |
| #1434 | fix | Verifier always loads ROADMAP SCs | MEDIUM | 0 (agent prompt) |
| #1436 | fix | Codex .claude path replacement | LOW | 1 new test |
| #1437 | feat | Researcher claim provenance tagging | LOW | 0 (agent prompt) |
| #1439 | fix | todos/done -> todos/completed | LOW | 0 (docs/workflow) |
| #1442 | fix | Remove /gsd:complete-phase reference | LOW | 0 (workflow) |
| #1444 | feat | Autonomous --only N flag | MEDIUM | 0 (workflow) |
| #1445 | feat | Discuss --chain flag | MEDIUM | 0 (workflow) |
| #1456 | feat | workflow.use_worktrees toggle | MEDIUM | 2 new tests |
| #1470 | fix | git.base_branch config | MEDIUM | 1 new test |

### dev-improvement (4 commits, 13 files, +854/-292)

| Commit | Type | Core Change | Risk Level | Current Tests |
|--------|------|-------------|------------|---------------|
| ea885f0 | fix | withPlanningLock wired into ROADMAP writes | HIGH | 0 new (existing tests exercise paths) |
| ea885f0 | fix | readModifyWriteStateMd atomic helper | HIGH | 0 new (cmdStatePatch exercised by existing) |
| ea885f0 | fix | O(n) normalizeMd (was O(n^2)) | MEDIUM | 0 new (existing normalize tests cover behavior) |
| ea885f0 | fix | must_haves parse failure warning | LOW | 0 new |
| 720f0e8 | feat | Adaptive context enrichment for 1M | LOW | 0 (workflow prompts) |
| ccb744b | feat | 3 upstream bash hooks | MEDIUM | 0 new |
| 648ed4a | fix | Health check cross-validation + config validation | MEDIUM | 0 new |

---

## Risk Assessment

### HIGH risk (must test thoroughly)

1. **withPlanningLock integration** — wraps 5 ROADMAP write paths in locks. Risk: lock not released on error (deadlock), lock timeout too aggressive, function return values changed by wrapping.

2. **readModifyWriteStateMd** — new atomic helper replaces the read-outside-lock pattern. Risk: transform function sees stale data, lock contention under test, changed error semantics.

3. **O(n) normalizeMd refactor** — replaced isInsideFencedBlock/isClosingFence with pre-computed array. Risk: edge cases in fence detection (nested fences, unclosed fences, frontmatter delimiters that look like fences).

### MEDIUM risk (functional test needed)

4. **Hook installer registration** — 3 new hooks added to settings.json via install.js. Risk: duplicate registration on re-install, interaction with existing hooks, bash availability on Windows.

5. **Health check new validations** (W011-W015) — new checks that read STATE.md + ROADMAP.md + config.json. Risk: false positives on valid projects, missing edge cases.

6. **Workflow prompt changes** — context_window conditional blocks in execute-phase.md and plan-phase.md. Risk: syntax errors in template literals, incorrect threshold comparisons.

### LOW risk (smoke test sufficient)

7. **stateReplaceFieldWithFallback warning** — stderr output on miss. Risk: noisy warnings on valid operations.
8. **must_haves parse warning** — stderr output on empty parse. Risk: false warning on plans without must_haves.

---

## Pass 1: Structural Integrity

**Goal:** Verify that all code changes are syntactically correct, don't break existing behavior, and handle the most critical failure modes.

### Test 1.1: Baseline regression (AUTOMATED)
```
npm test
```
Expected: 1504+ tests pass, 0 failures.

### Test 1.2: Lock integration - ROADMAP write safety (NEW TESTS NEEDED)
```
Test: cmdPhaseAdd acquires and releases planning lock
Test: cmdPhaseInsert acquires and releases planning lock
Test: cmdPhaseComplete acquires and releases planning lock
Test: cmdPhaseRemove acquires and releases planning lock (via updateRoadmapAfterPhaseRemoval)
Test: cmdRoadmapUpdatePlanProgress acquires and releases planning lock
Test: Lock released even when write function throws
Test: Lock not held when roadmap doesn't exist (early return paths)
```

### Test 1.3: readModifyWriteStateMd atomicity (NEW TESTS NEEDED)
```
Test: readModifyWriteStateMd transforms content correctly
Test: readModifyWriteStateMd creates file if STATE.md doesn't exist
Test: readModifyWriteStateMd handles transform function that throws
Test: Lock file cleaned up after readModifyWriteStateMd
Test: cmdStatePatch uses atomic read-modify-write (no external read)
```

### Test 1.4: normalizeMd behavioral equivalence (NEW TESTS NEEDED)
```
Test: normalizeMd produces identical output to old implementation for:
  - Simple markdown with no fences
  - Single fenced code block
  - Multiple fenced code blocks
  - Nested backticks (``` inside code)
  - Unclosed fence at end of file
  - Frontmatter (---) that looks like fence but isn't
  - Empty file
  - File with only fences
  - Mixed headings, lists, and fences
```

### Test 1.5: Health check new validations (NEW TESTS NEEDED)
```
Test: W011 fires when STATE says phase 3 but ROADMAP has [x] Phase 3
Test: W011 does NOT fire when STATE and ROADMAP agree
Test: W012 fires for branching_strategy "banana"
Test: W013 fires for context_window -500
Test: W013 fires for context_window "abc"
Test: W014 fires for phase_branch_template without {phase}
Test: W015 fires for milestone_branch_template without {milestone}
Test: No false positives on a healthy project
```

### Test 1.6: Hook file validation (NEW TESTS NEEDED)
```
Test: gsd-session-state.sh exits 0 with .planning/STATE.md present
Test: gsd-session-state.sh exits 0 without .planning/ directory
Test: gsd-validate-commit.sh exits 0 for valid conventional commit
Test: gsd-validate-commit.sh exits 2 for "WIP save"
Test: gsd-validate-commit.sh exits 0 for non-commit bash command
Test: gsd-phase-boundary.sh outputs warning for .planning/ file write
Test: gsd-phase-boundary.sh silent for non-.planning/ file write
Test: All three hooks are executable
```

### Test 1.7: Installer hook registration (NEW TESTS NEEDED)
```
Test: install.js registers gsd-validate-commit.sh in PreToolUse
Test: install.js registers gsd-session-state.sh in SessionStart
Test: install.js registers gsd-phase-boundary.sh in PostToolUse
Test: Re-running install does not duplicate hook entries
Test: Uninstall removes all three new hooks
```

### Test 1.8: Warning output validation (MANUAL)
```
Test: must_haves warning fires for plan with block but empty parse
Test: must_haves warning does NOT fire for plan without must_haves
Test: stateReplaceFieldWithFallback warning fires for missing field
Test: stateReplaceFieldWithFallback warning includes field name
```

---

## Pass 1 Execution Plan

1. Run baseline regression (Test 1.1)
2. Write and run tests 1.2-1.7 (new test file: tests/improvement-wave1.test.cjs)
3. Fix any failures discovered
4. Document lessons learned in retrospective

---

## Retrospective Template (filled after each pass)

### Pass N Retrospective

**Tests written:** N
**Tests passing:** N
**Bugs found:** N
**Bugs fixed:** N

**Lessons learned:**
1. [What surprised us]
2. [What the tests revealed about our assumptions]
3. [Edge cases we didn't consider]

**Suggestions for next pass:**
- [ ] Suggestion A
- [ ] Suggestion B
- [ ] Suggestion C

---

## Future Passes (planned)

### Pass 2: Behavioral Correctness
- Verify workflow prompt templates produce valid syntax
- Test context_window threshold behavior (boundary: 499999 vs 500000)
- Test git.base_branch auto-detection with different origin/HEAD configs
- Test workflow.use_worktrees=false execution path

### Pass 3: Integration Testing
- End-to-end: create project -> discuss -> plan -> execute -> verify cycle
- Cross-branch: merge dev-improvement into dev-bugfix, verify no conflicts
- Installer: fresh install with all hooks, verify settings.json correctness

### Pass 4: Adversarial / Edge Cases
- Concurrent write simulation (two processes modifying STATE.md)
- Large file stress test (500+ line STATE.md through normalizeMd)
- Malformed config.json recovery
- ROADMAP.md with 50+ phases performance benchmark
