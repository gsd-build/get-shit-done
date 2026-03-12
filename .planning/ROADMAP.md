# Roadmap: GSD Autopilot Parallel Phase Execution

## Overview

This roadmap transforms the sequential GSD Autopilot into a parallel execution engine. The work progresses from concurrency primitives and scheduling (Phase 1), through the execution engine with git isolation (Phase 2), to failure handling and merge conflict resolution (Phase 3), and finally dashboard integration (Phase 4). Each phase delivers a verifiable capability boundary -- the scheduler can be unit-tested independently, the execution engine can run headlessly before dashboard work begins, and failure handling is separated from the happy path to keep the core engine focused.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Scheduler and Isolation Model** - DAG-based dependency scheduling, single-writer state, per-worker event files (completed 2026-03-12)
- [ ] **Phase 2: Parallel Execution Engine** - CLI flags, worker pool, git worktrees, parallel phase lifecycle
- [ ] **Phase 3: Failure Handling and Git Conflict Resolution** - Fail-fast/continue modes, graceful shutdown, merge conflict resolution
- [ ] **Phase 4: Dashboard and Event Stream Integration** - Consolidated event stream, per-phase status and question routing in dashboard

## Phase Details

### Phase 1: Scheduler and Isolation Model
**Goal**: The concurrency foundations exist so that parallel workers can be scheduled, state updates are conflict-free, and events are cleanly separated per worker
**Depends on**: Nothing (first phase)
**Requirements**: SCHED-02, SCHED-05, SCHED-06, EXEC-03, EXEC-04, EVNT-01, EVNT-02
**Success Criteria** (what must be TRUE):
  1. Given a ROADMAP.md with `dependsOn` fields, the scheduler produces a correct topological ordering and identifies which phases can run concurrently
  2. The scheduler detects dependency cycles and reports them as errors rather than hanging or producing incorrect orderings
  3. When a phase completes, the scheduler automatically identifies and returns newly eligible phases whose dependencies are now satisfied
  4. State mutations from multiple simulated workers are serialized through the single-writer pattern with no lost updates
  5. Each worker writes to its own event file (`events-phase-{N}.ndjson`) and events carry a `workerId` tag
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md -- DAG scheduler with parseDependsOn and DependencyScheduler (TDD)
- [ ] 01-02-PLAN.md -- Event writer worker metadata and state write queue

### Phase 2: Parallel Execution Engine
**Goal**: Users can run `--parallel` and have multiple phases execute concurrently via git-worktree-isolated workers, with the full discuss/plan/execute/verify lifecycle per phase
**Depends on**: Phase 1
**Requirements**: SCHED-01, SCHED-03, SCHED-04, EXEC-01, EXEC-02, GIT-01, GIT-02, GIT-06
**Success Criteria** (what must be TRUE):
  1. Running autopilot with `--parallel` launches multiple ClaudeService instances that execute independent phases concurrently
  2. Running autopilot without `--parallel` behaves identically to the existing sequential mode (backward compatible)
  3. Each parallel phase executes in its own git worktree and the worktree is cleaned up after successful merge back to the central branch
  4. User can specify `--concurrency N` to limit the number of simultaneous workers and `--parallel 2,3,5` to select specific phases
  5. Each parallel phase runs the full lifecycle (discuss, plan, execute, verify) independently without interfering with other active phases
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Failure Handling and Git Conflict Resolution
**Goal**: The parallel engine handles errors gracefully -- failed phases do not corrupt the project, merge conflicts are resolved and documented, and the user retains full control over recovery
**Depends on**: Phase 2
**Requirements**: FAIL-01, FAIL-02, FAIL-03, FAIL-04, GIT-03, GIT-04, GIT-05
**Success Criteria** (what must be TRUE):
  1. When a phase fails in default mode, all other workers are stopped and the user sees a clear error indicating which phase failed and why
  2. When `--continue` is used, independent phases continue executing after a failure and only dependent phases are blocked
  3. SIGINT/SIGTERM triggers graceful shutdown that terminates all child processes and cleans up worktrees (except failed ones preserved for debugging)
  4. Merge conflicts between worktree branches are auto-resolved where possible, with a conflict resolution report documenting what was fixed
  5. Resolution reports from prior merges are available as context for resolving future merge conflicts in the same run
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

### Phase 4: Dashboard and Event Stream Integration
**Goal**: The dashboard shows real-time status for all parallel phases and routes questions to the correct phase worker, giving the user full visibility and interaction during parallel execution
**Depends on**: Phase 3
**Requirements**: EVNT-03, DASH-01, DASH-02, DASH-03
**Success Criteria** (what must be TRUE):
  1. The dashboard displays per-phase status (running/queued/done/failed) for all parallel phases simultaneously
  2. Event streams from all active workers are consolidated into a single SSE stream that the dashboard consumes without losing or duplicating events
  3. Questions from each phase appear in the dashboard tagged to their source phase, and the user can answer them independently without affecting other phases
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Scheduler and Isolation Model | 2/2 | Complete   | 2026-03-12 |
| 2. Parallel Execution Engine | 0/? | Not started | - |
| 3. Failure Handling and Git Conflict Resolution | 0/? | Not started | - |
| 4. Dashboard and Event Stream Integration | 0/? | Not started | - |
