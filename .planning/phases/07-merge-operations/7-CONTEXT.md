# Phase 7 Context: Merge Operations

**Created:** 2026-02-24
**Phase Goal:** Enable safe upstream merges with automatic backup, atomic execution, and recovery

## Scope Clarification

This phase delivers the actual merge capability. It builds on Phase 5 (fetch/status) and Phase 6 (analysis/conflict preview). The merge must be safe and recoverable.

**Requirements covered:**
- MERGE-01: Automatic backup branch creation
- MERGE-02: Atomic merge with rollback on failure
- MERGE-03: Abort/restore capability
- MERGE-04: Event logging to STATE.md

## STATE.md Event Logging

**Decision: Comprehensive events with standard detail in dedicated section**

| Aspect | Decision |
|--------|----------|
| Events logged | Comprehensive — all sync-related operations |
| Detail level | Standard — commit hashes, branch names, brief error messages |
| Location | New "Sync History" section in STATE.md (below Session Continuity) |
| Retention | Keep all entries — full audit trail, never auto-delete |

**Events to log:**
| Event | Trigger |
|-------|---------|
| `fetch` | Upstream fetch completed |
| `merge-start` | Merge operation initiated |
| `merge-complete` | Merge succeeded |
| `merge-failed` | Merge failed (with reason) |
| `abort` | User aborted incomplete sync |
| `upstream-configured` | Initial upstream URL set |
| `upstream-url-changed` | Upstream URL modified |
| `backup-created` | Pre-merge backup branch created |
| `rollback-executed` | Automatic rollback after failure |
| `conflict-detected` | Merge conflicts encountered |

**Log entry format (standard detail):**
```markdown
### Sync History

| Date | Event | Details |
|------|-------|---------|
| 2026-02-24 14:30 | merge-complete | abc123d..def456g (5 commits) |
| 2026-02-24 14:29 | backup-created | backup/pre-sync-2026-02-24 |
| 2026-02-24 14:29 | fetch | 5 new commits from upstream |
| 2026-02-23 10:00 | upstream-configured | https://github.com/gsd-build/get-shit-done |
```

**Error message handling:**
- Include brief error message in Details column
- For conflicts: "3 files with conflicts: path/to/file.js, ..."
- For rollback: "Restored to abc123d after merge failure"

## Dependencies

### Path Alignment (from Phase 6.1)

Phase 6.1 updates all workflow/agent paths from global (`~/.claude/get-shit-done/`) to project-local (`gsd/get-shit-done/`). After Phase 6.1 completes, verify that Phase 7 plans use project-local paths consistently.

**Files to check:**
- 7-01-PLAN.md
- 7-02-PLAN.md
- 7-03-PLAN.md

If any plans reference `~/.claude/`, update them to `gsd/` paths before execution.

## Areas Not Discussed

The following areas were identified but not discussed. Researcher and planner should use reasonable defaults aligned with existing GSD patterns:

### Backup Branch Naming & Lifecycle
- Consider: naming convention, auto-cleanup timing, retention policy
- Lean toward: explicit names with timestamps, no auto-cleanup

### Atomic Merge & Rollback Triggers
- Consider: what constitutes "failure", partial success handling
- Lean toward: any git error triggers rollback, conservative approach

### Abort/Restore User Experience
- Consider: command UX, uncommitted changes handling, feedback
- Lean toward: clear prompts, preserve user's uncommitted work

## Deferred Ideas

Captured during discussion but out of scope for Phase 7:

- None captured

---
*Context created: 2026-02-24*
