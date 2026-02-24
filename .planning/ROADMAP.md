# Roadmap: GSD v1.1 Upstream Sync

## Overview

This roadmap delivers upstream sync tooling for GSD fork maintainers. The journey progresses from core infrastructure (configure, fetch, status, notifications), through analysis capabilities (commit grouping, conflict detection), to merge operations (atomic merge, rollback, state logging), then interactive features and integration (deep dive mode, worktree awareness), and finally documentation. Each phase builds on the previous, enabling fork maintainers to stay current with upstream while preserving custom enhancements through intelligent tooling.

## Phases

**Phase Numbering:**
- v1.0 completed Phases 1-4 (Worktree Isolation)
- v1.1 continues from Phase 5 (Upstream Sync)
- Decimal phases (e.g., 5.1): Urgent insertions (marked with INSERTED)

- [x] **Phase 5: Core Infrastructure** - Upstream configuration, fetch, status, and update notifications (completed 2026-02-24)
- [x] **Phase 6: Analysis** - Commit grouping, conflict preview, and change detection (completed 2026-02-24)
- [ ] **Phase 6.1: Local Modifications Integration** - Path migration and finalize-phase command (INSERTED)
- [ ] **Phase 7: Merge Operations** - Atomic merge with rollback and state logging
- [ ] **Phase 8: Interactive & Integration** - Deep dive mode, worktree awareness, and health integration
- [ ] **Phase 9: Documentation** - User guide, architecture docs, and troubleshooting

## Phase Details

### Phase 5: Core Infrastructure
**Goal**: Establish upstream remote management with fetch, status, and proactive notifications
**Depends on**: v1.0 complete (uses existing gsd-tools patterns)
**Requirements**: SYNC-01, SYNC-02, SYNC-03, SYNC-04, NOTIF-01, NOTIF-02, NOTIF-03
**Success Criteria** (what must be TRUE):
  1. User can configure upstream remote URL and it persists in config.json
  2. User can fetch upstream changes without modifying their local branches
  3. User can see how many commits behind upstream they are with summary info
  4. User can view upstream commit log with author, date, and message summaries
  5. Starting a GSD session shows notification when upstream has new commits
**Plans:** 4/4 plans complete

Plans:
- [x] 5-01-PLAN.md — Create upstream.cjs module with configure and fetch operations
- [x] 5-02-PLAN.md — Add status and log commands to upstream.cjs
- [x] 5-03-PLAN.md — Integrate upstream commands into gsd-tools.cjs CLI
- [x] 5-04-PLAN.md — Add notification check for session start integration

### Phase 6: Analysis
**Goal**: Provide visibility into upstream changes with grouping and conflict prediction
**Depends on**: Phase 5
**Requirements**: ANAL-01, ANAL-02, ANAL-03, ANAL-04
**Success Criteria** (what must be TRUE):
  1. User can see upstream commits grouped by feature/directory affected
  2. User can preview which files would conflict before attempting merge
  3. User receives warning about rename/delete conflicts that need manual attention
  4. User is notified when upstream contains binary file changes
**Plans:** 4/4 plans complete

Plans:
- [x] 6-01-PLAN.md — Commit grouping functions in upstream.cjs (cmdUpstreamAnalyze)
- [x] 6-02-PLAN.md — Conflict preview with risk scoring (cmdUpstreamPreview)
- [x] 6-03-PLAN.md — Structural conflict resolution workflow (cmdUpstreamResolve)
- [x] 6-04-PLAN.md — gsd-tools CLI routing + workflow command integration

### Phase 06.1: Local Modifications Integration (INSERTED)

**Goal:** Migrate workflow paths from global to project-local and add finalize-phase command
**Depends on:** Phase 6
**Source:** Local modifications made to ~/Projects/OpenClaw/gsd (installed GSD v1.20.3)
**Changes to integrate:**
  1. New finalize-phase command file (merge to main, cleanup worktree)
  2. Path updates from global (~/.claude/) to project-local (gsd/) installation
**Plans:** 2 plans

Plans:
- [ ] 06.1-01-PLAN.md — Create finalize-phase command file
- [ ] 06.1-02-PLAN.md — Update workflow paths from global to project-local

### Phase 7: Merge Operations
**Goal**: Enable safe upstream merges with automatic backup, atomic execution, and recovery
**Depends on**: Phase 6.1
**Requirements**: MERGE-01, MERGE-02, MERGE-03, MERGE-04
**Success Criteria** (what must be TRUE):
  1. User can merge upstream with automatic backup branch created before merge
  2. Failed merge automatically rolls back to pre-merge state with clear message
  3. User can abort an incomplete sync and restore to clean state
  4. Sync events (fetch, merge, abort) are logged in STATE.md with timestamps
**Plans:** 3 plans

Plans:
- [ ] 7-01-PLAN.md — Add STATE.md sync history logging and backup branch helpers
- [ ] 7-02-PLAN.md — Add merge command with pre-merge safety and atomic rollback
- [ ] 7-03-PLAN.md — Add abort command for incomplete sync restoration

### Phase 8: Interactive & Integration
**Goal**: Provide interactive exploration and integrate with existing GSD features
**Depends on**: Phase 7
**Requirements**: INTER-01, INTER-02, INTER-03, INTEG-01, INTEG-02
**Success Criteria** (what must be TRUE):
  1. User can explore specific upstream commits interactively (view diffs, ask questions)
  2. User receives refactoring suggestions before merge to minimize conflicts
  3. Post-merge verification tests run automatically to confirm custom features work
  4. User receives warning when attempting sync with active worktrees
  5. Health check reports incomplete/stalled sync operations
**Plans:** 4 plans

Plans:
- [ ] 8-01-PLAN.md — Interactive exploration mode (sync explore command with readline REPL)
- [ ] 8-02-PLAN.md — Refactoring suggestions (semantic similarity detection + apply-suggestion)
- [ ] 8-03-PLAN.md — Post-merge verification (test discovery + rollback prompt)
- [ ] 8-04-PLAN.md — Worktree integration (sync guard + health check extension)

### Phase 9: Documentation
**Goal**: Document upstream sync features for users and developers
**Depends on**: Phase 8
**Requirements**: DOC-01, DOC-02, DOC-03, DOC-04
**Success Criteria** (what must be TRUE):
  1. User guide explains /gsd:sync-upstream command with examples
  2. Architecture docs include mermaid diagrams showing sync flow
  3. README documents upstream sync features under GSD Enhancements section
  4. Troubleshooting guide covers common sync issues with recovery steps
**Plans:** TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 5 -> 6 -> 6.1 -> 7 -> 8 -> 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 5. Core Infrastructure | 4/4 | Complete | 2026-02-24 |
| 6. Analysis | 4/4 | Complete | 2026-02-24 |
| 6.1 Local Modifications Integration | 0/2 | Planned | - |
| 7. Merge Operations | 0/3 | Ready | - |
| 8. Interactive & Integration | 0/4 | Planned | - |
| 9. Documentation | 0/? | Not started | - |

---
*Roadmap created: 2026-02-23*
*Last updated: 2026-02-24*
