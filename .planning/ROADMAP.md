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
- [x] **Phase 6.1: Local Modifications Integration** - Path migration and finalize-phase command (INSERTED, completed 2026-02-24)
- [x] **Phase 7: Merge Operations** - Atomic merge with rollback and state logging (completed 2026-02-24)
- [x] **Phase 8: Interactive & Integration** - Deep dive mode, worktree awareness, and health integration (completed 2026-02-24)
- [ ] **Phase 9: Documentation** - User guide, architecture docs, and troubleshooting
- [ ] **Phase 10: Parallel Milestones** - Enable parallel milestone execution with scoped phases

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

**Goal:** Add missing finalize-phase command to enable /gsd:finalize-phase
**Depends on:** Phase 6
**Source:** Local modifications made to ~/Projects/OpenClaw/gsd (installed GSD v1.20.3)
**Changes to integrate:**
  1. New finalize-phase command file (merge to main, cleanup worktree)
**Plans:** 1/1 plans complete

Plans:
- [x] 06.1-01-PLAN.md — Create finalize-phase command file

### Phase 7: Merge Operations
**Goal**: Enable safe upstream merges with automatic backup, atomic execution, and recovery
**Depends on**: Phase 6.1
**Requirements**: MERGE-01, MERGE-02, MERGE-03, MERGE-04
**Success Criteria** (what must be TRUE):
  1. User can merge upstream with automatic backup branch created before merge
  2. Failed merge automatically rolls back to pre-merge state with clear message
  3. User can abort an incomplete sync and restore to clean state
  4. Sync events (fetch, merge, abort) are logged in STATE.md with timestamps
**Plans:** 3/3 plans complete

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
**Plans:** 4/4 plans complete

Plans:
- [x] 8-01-PLAN.md — Interactive exploration mode (sync explore command with readline REPL)
- [x] 8-02-PLAN.md — Refactoring suggestions (semantic similarity detection + apply-suggestion)
- [x] 8-03-PLAN.md — Post-merge verification (test discovery + rollback prompt)
- [x] 8-04-PLAN.md — Worktree integration (sync guard + health check extension)

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

### Phase 10: Parallel Milestones
**Goal**: Enable parallel milestone execution with milestone-scoped phases and progress tracking
**Depends on**: Phase 8 (uses worktree and state patterns)
**Requirements**: PM-01, PM-02, PM-03, PM-04, PM-05, PM-06, PM-07, PM-08, PM-09, PM-10
**Success Criteria** (what must be TRUE):
  1. Multiple milestones can run in parallel with independent phase numbering
  2. Commands support `M7/01` syntax for milestone-scoped operations
  3. Progress display shows per-milestone progress bars
  4. State tracking maintains separate progress per milestone
  5. Migration tool converts legacy projects to parallel structure
  6. Existing single-milestone projects work unchanged (backward compatible)
**Plans:** 0/4 plans

Plans:
- [ ] 10-01-PLAN.md — Milestone directory structure and core commands
- [ ] 10-02-PLAN.md — Milestone-scoped workflow commands
- [ ] 10-03-PLAN.md — Multi-milestone state tracking
- [ ] 10-04-PLAN.md — Migration tool and backward compatibility

### Phase 11: Add --docs flag to discuss-phase for document-assisted context extraction

**Goal:** Enable document-assisted context extraction by adding --docs flag to discuss-phase that auto-extracts implementation decisions from reference documents (PRD, spec, etc.) with four-tier confidence classification, only prompting users for gaps and ambiguities
**Depends on:** Phase 10
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. User can pass --docs flag with comma-separated document paths
  2. Decisions are extracted from documents with four-tier classification (Explicit, Inferred, Ambiguous, Gap)
  3. User sees grouped summary of extractions and can override any decision
  4. Only gaps and ambiguities route to standard discuss-phase questioning
  5. CONTEXT.md includes provenance notation showing decision sources
  6. Standard discuss-phase flow (no --docs) remains unchanged
**Plans:** 1/2 plans executed

Plans:
- [ ] 11-01-PLAN.md — Add --docs flag parsing and document path validation
- [ ] 11-02-PLAN.md — Add extraction, presentation, and provenance-enhanced CONTEXT.md output

## Progress

**Execution Order:**
Phases execute in numeric order: 5 -> 6 -> 6.1 -> 7 -> 8 -> 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 5. Core Infrastructure | 4/4 | Complete | 2026-02-24 |
| 6. Analysis | 4/4 | Complete | 2026-02-24 |
| 6.1 Local Modifications Integration | 1/1 | Complete | 2026-02-24 |
| 7. Merge Operations | 3/3 | Complete    | 2026-02-24 |
| 8. Interactive & Integration | 4/4 | Complete | 2026-02-24 |
| 9. Documentation | 0/? | Not started | - |
| 10. Parallel Milestones | 0/4 | Not started | - |
| 11. Document-assisted discuss-phase | 1/2 | In Progress|  |

---
*Roadmap created: 2026-02-23*
*Last updated: 2026-03-07*
