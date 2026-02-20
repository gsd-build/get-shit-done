# Roadmap: GSD Worktree Isolation

## Overview

This roadmap delivers parallel phase execution through git worktree isolation. The journey progresses from foundational infrastructure (worktree lifecycle and lock management), through workflow integration (execute-phase and finalize-phase updates), to state reconciliation (STATE.md merge algorithm), and finally polish and recovery tooling. Each phase builds on the previous, enabling multiple AI sessions to work on different phases simultaneously without file conflicts.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (e.g., 2.1): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Foundation** - Worktree lifecycle, lock mechanism, and registry infrastructure
- [ ] **Phase 2: Workflow Integration** - execute-phase and finalize-phase worktree operations
- [ ] **Phase 3: State Reconciliation** - STATE.md merge algorithm and conflict handling
- [ ] **Phase 4: Polish and Recovery** - Cleanup commands, orphan detection, and error recovery

## Phase Details

### Phase 1: Foundation
**Goal**: Establish worktree lifecycle management with atomic locking and registry tracking
**Depends on**: Nothing (first phase)
**Requirements**: TREE-01, TREE-02, TREE-03, TREE-04, TREE-05, TREE-06, LOCK-01, LOCK-02, LOCK-03, LOCK-04
**Success Criteria** (what must be TRUE):
  1. User can create a worktree for a phase and it appears in a sibling directory with unique branch name
  2. User can list all active worktrees with their status, branch, and path information
  3. User can retrieve the path for an existing worktree by phase number
  4. Concurrent attempts to execute the same phase are blocked with clear error message
  5. Existing worktree is detected and reused instead of failing on recreation attempt
**Plans**: TBD

Plans:
- [ ] 01-01: TBD
- [ ] 01-02: TBD

### Phase 2: Workflow Integration
**Goal**: Update execute-phase and finalize-phase workflows to use worktree operations
**Depends on**: Phase 1
**Requirements**: FLOW-01, FLOW-02, FLOW-03, FLOW-04, FLOW-05, FLOW-06, FLOW-07
**Success Criteria** (what must be TRUE):
  1. Running execute-phase with `branching_strategy: "phase"` creates a worktree automatically
  2. Running execute-phase when worktree exists switches to it without error
  3. Finalize-phase blocks merge until verification gates pass (UAT, tests)
  4. Finalize-phase merges phase branch to main with --no-ff and cleans up worktree
  5. New worktrees have dependencies installed (npm install) and .env copied automatically
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: State Reconciliation
**Goal**: Implement STATE.md merge algorithm that preserves both phase-specific and global changes
**Depends on**: Phase 2
**Requirements**: STATE-01, STATE-02, STATE-03, STATE-04
**Success Criteria** (what must be TRUE):
  1. Worktree registry accurately tracks all active worktrees in JSON format
  2. STATE.md changes in worktree accumulate phase-specific progress without affecting main
  3. Finalization merges STATE.md correctly (worktree wins for phase sections, main wins for global)
  4. STATE.md conflicts are detected and user receives clear manual resolution steps
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: Polish and Recovery
**Goal**: Provide recovery tools for orphaned worktrees and incomplete operations
**Depends on**: Phase 3
**Requirements**: RECV-01, RECV-02, RECV-03
**Success Criteria** (what must be TRUE):
  1. Orphaned worktrees (path deleted but .git reference remains) are detected and reported
  2. User can run cleanup command to remove stale worktrees safely
  3. Incomplete finalization (merge succeeded but cleanup failed) can be recovered gracefully
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/2 | Not started | - |
| 2. Workflow Integration | 0/2 | Not started | - |
| 3. State Reconciliation | 0/1 | Not started | - |
| 4. Polish and Recovery | 0/1 | Not started | - |

---
*Roadmap created: 2026-02-20*
*Last updated: 2026-02-20*
