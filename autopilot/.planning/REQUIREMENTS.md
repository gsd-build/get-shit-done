# Requirements: GSD Autopilot Parallel Phase Execution

**Defined:** 2026-03-11
**Core Value:** Multiple phases execute concurrently without conflicts, cutting total project build time while maintaining the same correctness guarantees as sequential execution.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Scheduling

- [ ] **SCHED-01**: User can enable parallel mode with `--parallel` flag (backward compatible, sequential remains default)
- [ ] **SCHED-02**: Autopilot auto-detects parallelizable phases from ROADMAP.md `dependsOn` fields using DAG scheduling
- [ ] **SCHED-03**: User can manually specify which phases run in parallel (e.g., `--parallel 2,3,5`)
- [ ] **SCHED-04**: User can limit max concurrent workers with `--concurrency N` flag (default ~3)
- [ ] **SCHED-05**: Phases with unmet dependencies are queued until dependencies complete
- [ ] **SCHED-06**: As phases complete, newly eligible phases are automatically dispatched

### Execution

- [ ] **EXEC-01**: Multiple ClaudeService instances run simultaneously, one per parallel phase
- [ ] **EXEC-02**: Each parallel phase runs the full lifecycle (discuss → plan → execute → verify) independently
- [ ] **EXEC-03**: Phase completion updates are atomic and conflict-free across concurrent workers
- [ ] **EXEC-04**: State consistency is maintained — STATE.md and state.json reflect accurate parallel status

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

- [ ] **EVNT-01**: Events are tagged with phase/worker ID for source identification
- [ ] **EVNT-02**: Per-worker event files prevent concurrent write conflicts
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
| Distributed execution across machines | Requires network coordination, shared state, auth — completely different architecture |
| Dynamic worker scaling mid-run | Massive complexity for marginal gain; static concurrency is sufficient |
| Cross-phase file locking | Hides dependency design problems; worktrees provide proper isolation |
| Automatic retry on failure | AI agent phases are not idempotent; gap-iteration handles recovery |
| Speculative execution | AI work is expensive; discarding completed speculative work wastes tokens |
| Priority-based scheduling | Dependency graph already determines ordering |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHED-01 | — | Pending |
| SCHED-02 | — | Pending |
| SCHED-03 | — | Pending |
| SCHED-04 | — | Pending |
| SCHED-05 | — | Pending |
| SCHED-06 | — | Pending |
| EXEC-01 | — | Pending |
| EXEC-02 | — | Pending |
| EXEC-03 | — | Pending |
| EXEC-04 | — | Pending |
| GIT-01 | — | Pending |
| GIT-02 | — | Pending |
| GIT-03 | — | Pending |
| GIT-04 | — | Pending |
| GIT-05 | — | Pending |
| GIT-06 | — | Pending |
| FAIL-01 | — | Pending |
| FAIL-02 | — | Pending |
| FAIL-03 | — | Pending |
| FAIL-04 | — | Pending |
| EVNT-01 | — | Pending |
| EVNT-02 | — | Pending |
| EVNT-03 | — | Pending |
| DASH-01 | — | Pending |
| DASH-02 | — | Pending |
| DASH-03 | — | Pending |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 0
- Unmapped: 26 ⚠️

---
*Requirements defined: 2026-03-11*
*Last updated: 2026-03-11 after initial definition*
