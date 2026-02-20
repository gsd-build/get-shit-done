# Requirements: GSD Worktree Isolation

**Defined:** 2026-02-20
**Core Value:** Enable parallel phase execution through git worktree isolation — multiple AI sessions can work on different phases simultaneously without file conflicts.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Worktree Lifecycle

- [ ] **TREE-01**: Create worktree for phase with unique branch (`gsd/phase-{N}-{slug}`)
- [ ] **TREE-02**: List all active worktrees with status, branch, and path
- [ ] **TREE-03**: Get path for existing worktree by phase number
- [ ] **TREE-04**: Remove worktree and release associated lock
- [ ] **TREE-05**: Detect existing worktree and switch to it instead of recreating
- [ ] **TREE-06**: Prune stale worktree references automatically on operations

### Lock Management

- [ ] **LOCK-01**: Acquire directory-based lock before worktree creation (atomic `mkdir`)
- [ ] **LOCK-02**: Release lock on worktree removal
- [ ] **LOCK-03**: Prevent concurrent execution of same phase across sessions
- [ ] **LOCK-04**: Track locks in JSON registry with metadata (timestamp, owner)

### Workflow Integration

- [ ] **FLOW-01**: execute-phase creates worktree when `branching_strategy: "phase"`
- [ ] **FLOW-02**: execute-phase switches to existing worktree if present
- [ ] **FLOW-03**: finalize-phase verifies gates (UAT, tests, verification) before merge
- [ ] **FLOW-04**: finalize-phase merges phase branch to main with `--no-ff`
- [ ] **FLOW-05**: finalize-phase removes worktree and deletes merged branch
- [ ] **FLOW-06**: Post-create hook runs `npm install` if package.json exists
- [ ] **FLOW-07**: Post-create hook copies `.env.example` to `.env` if present

### State Management

- [ ] **STATE-01**: Worktree registry tracks active worktrees in JSON file
- [ ] **STATE-02**: STATE.md updates in worktree accumulate per-phase changes
- [ ] **STATE-03**: Reconcile STATE.md on finalization (worktree wins for phase, main for global)
- [ ] **STATE-04**: Detect STATE.md conflicts and present manual resolution steps

### Recovery

- [ ] **RECV-01**: Detect and report orphaned worktrees (path deleted but .git reference remains)
- [ ] **RECV-02**: Provide cleanup command for stale worktrees
- [ ] **RECV-03**: Recover from incomplete finalization (merge succeeded, cleanup failed)

## v2 Requirements

Deferred to future release. Not in current roadmap.

### Dashboard

- **DASH-01**: Show active worktrees in `/gsd:progress` output
- **DASH-02**: Report disk space usage per worktree
- **DASH-03**: Show worktree health status (healthy, stale, locked, orphaned)

### Advanced Hooks

- **HOOK-01**: Pre-merge hook runs test suite before allowing merge
- **HOOK-02**: Post-merge hook triggers notifications
- **HOOK-03**: Configurable hook scripts via `.planning/config.json`

### PR Integration

- **PR-01**: Create GitHub PR from finalize-phase workflow
- **PR-02**: Auto-populate PR description from phase VERIFICATION.md

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Shared node_modules symlinks | Breaks when branches have different dependencies; each worktree runs `npm ci` independently |
| Automatic concurrent merges | Merge conflicts require human judgment; auto-merge causes data loss |
| GUI/web worktree manager | Violates GSD's CLI-first design; external tools can add GUI |
| Cross-worktree file watching | Complex, race-prone, unclear semantics; worktrees are independent |
| Automatic rebase onto main | Dangerous when automated; can rewrite history unexpectedly |
| Built-in AI session management | Claude Code handles this natively via `/resume`; duplicating causes conflicts |
| Submodule support | Git docs note incomplete worktree support; add to hooks if needed later |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TREE-01 | Phase 1 | ✓ Verified |
| TREE-02 | Phase 1 | ✓ Verified |
| TREE-03 | Phase 1 | ✓ Verified |
| TREE-04 | Phase 1 | ✓ Verified |
| TREE-05 | Phase 1 | ✓ Verified |
| TREE-06 | Phase 1 | ✓ Verified |
| LOCK-01 | Phase 1 | ✓ Verified |
| LOCK-02 | Phase 1 | ✓ Verified |
| LOCK-03 | Phase 1 | ✓ Verified |
| LOCK-04 | Phase 1 | ✓ Verified |
| FLOW-01 | Phase 2 | ✓ Verified |
| FLOW-02 | Phase 2 | ✓ Verified |
| FLOW-03 | Phase 2 | ✓ Verified |
| FLOW-04 | Phase 2 | ✓ Verified |
| FLOW-05 | Phase 2 | ✓ Verified |
| FLOW-06 | Phase 2 | ✓ Verified |
| FLOW-07 | Phase 2 | ✓ Verified |
| STATE-01 | Phase 3 | Pending |
| STATE-02 | Phase 3 | Pending |
| STATE-03 | Phase 3 | Pending |
| STATE-04 | Phase 3 | Pending |
| RECV-01 | Phase 4 | Pending |
| RECV-02 | Phase 4 | Pending |
| RECV-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-20*
*Last updated: 2026-02-20 after initial definition*
