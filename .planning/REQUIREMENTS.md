# Requirements: GSD Autopilot Parallel Phase Execution

**Defined:** 2026-03-11
**Core Value:** Multiple phases execute concurrently without conflicts, cutting total project build time while maintaining the same correctness guarantees as sequential execution.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Scheduling

- [ ] **SCHED-01**: User can enable parallel mode with `--parallel` flag (backward compatible, sequential remains default)
- [x] **SCHED-02**: Autopilot auto-detects parallelizable phases from ROADMAP.md `dependsOn` fields using DAG scheduling
- [ ] **SCHED-03**: User can manually specify which phases run in parallel (e.g., `--parallel 2,3,5`)
- [ ] **SCHED-04**: User can limit max concurrent workers with `--concurrency N` flag (default ~3)
- [x] **SCHED-05**: Phases with unmet dependencies are queued until dependencies complete
- [x] **SCHED-06**: As phases complete, newly eligible phases are automatically dispatched

### Execution

- [ ] **EXEC-01**: Multiple ClaudeService instances run simultaneously, one per parallel phase
- [ ] **EXEC-02**: Each parallel phase runs the full lifecycle (discuss -> plan -> execute -> verify) independently
- [x] **EXEC-03**: Phase completion updates are atomic and conflict-free across concurrent workers
- [x] **EXEC-04**: State consistency is maintained -- STATE.md and state.json reflect accurate parallel status

### Git Isolation

- [ ] **GIT-01**: Each parallel phase executes in its own git worktree
- [ ] **GIT-02**: On phase completion, worktree changes are merged back to the central branch
- [ ] **GIT-03**: Merge conflicts are auto-resolved where possible
- [ ] **GIT-04**: A merge conflict resolution report is generated documenting what was fixed
- [ ] **GIT-05**: Resolution reports are available as context for reconciling future merge conflicts
- [ ] **GIT-06**: Worktree is cleaned up (removed) after successful merge

### Failure Handling

- [ ] **FAIL-01**: Default fail-fast behavior stops all workers when one phase fails
- [ ] **FAIL-02**: `--continue` flag lets independent phases finish even when one fails
- [ ] **FAIL-03**: Graceful shutdown on SIGINT/SIGTERM cleans up all child processes and worktrees
- [ ] **FAIL-04**: Failed phase worktrees are preserved for debugging (not auto-cleaned)

### Events & Logging

- [x] **EVNT-01**: Events are tagged with phase/worker ID for source identification
- [x] **EVNT-02**: Per-worker event files prevent concurrent write conflicts
- [ ] **EVNT-03**: Event streams from all workers are consolidated for dashboard consumption

### Dashboard

- [ ] **DASH-01**: Dashboard shows per-phase status (running/queued/done/failed) for all parallel phases
- [ ] **DASH-02**: Questions from each phase are routed to the correct phase context
- [ ] **DASH-03**: User can answer questions for specific phases without affecting others

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Dashboard Enhancements

- **DASH-04**: Live dependency graph visualization with color-coded nodes
- **DASH-05**: Execution time estimation from ActivityStore historical data

### Scheduling Enhancements

- **SCHED-07**: Intelligent resource-aware scheduling (throttle based on CPU/memory)
- **SCHED-08**: Per-phase log files written to `phases/N/autopilot.log`

## Out of Scope

| Feature | Reason |
|---------|--------|
| Distributed execution across machines | Requires network coordination, shared state, auth -- completely different architecture |
| Dynamic worker scaling mid-run | Massive complexity for marginal gain; static concurrency is sufficient |
| Cross-phase file locking | Hides dependency design problems; worktrees provide proper isolation |
| Automatic retry on failure | AI agent phases are not idempotent; gap-iteration handles recovery |
| Speculative execution | AI work is expensive; discarding completed speculative work wastes tokens |
| Priority-based scheduling | Dependency graph already determines ordering |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHED-01 | Phase 2 | Pending |
| SCHED-02 | Phase 1 | Complete |
| SCHED-03 | Phase 2 | Pending |
| SCHED-04 | Phase 2 | Pending |
| SCHED-05 | Phase 1 | Complete |
| SCHED-06 | Phase 1 | Complete |
| EXEC-01 | Phase 2 | Pending |
| EXEC-02 | Phase 2 | Pending |
| EXEC-03 | Phase 1 | Complete |
| EXEC-04 | Phase 1 | Complete |
| GIT-01 | Phase 2 | Pending |
| GIT-02 | Phase 2 | Pending |
| GIT-03 | Phase 3 | Pending |
| GIT-04 | Phase 3 | Pending |
| GIT-05 | Phase 3 | Pending |
| GIT-06 | Phase 2 | Pending |
| FAIL-01 | Phase 3 | Pending |
| FAIL-02 | Phase 3 | Pending |
| FAIL-03 | Phase 3 | Pending |
| FAIL-04 | Phase 3 | Pending |
| EVNT-01 | Phase 1 | Complete |
| EVNT-02 | Phase 1 | Complete |
| EVNT-03 | Phase 4 | Pending |
| DASH-01 | Phase 4 | Pending |
| DASH-02 | Phase 4 | Pending |
| DASH-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0

---
*Requirements defined: 2026-03-11*
*Last updated: 2026-03-11 after roadmap creation*
