# Phase 3 Context: State Reconciliation

**Created:** 2026-02-22
**Phase Goal:** Implement STATE.md merge algorithm that preserves both phase-specific and global changes

## Decisions

### Section Ownership (Merge Strategies)

| Section | Strategy | Details |
|---------|----------|---------|
| Current Position | **Additive** | Multiple phases can be in-progress simultaneously |
| Performance Metrics | **Additive** | Each phase adds its own stats on merge |
| Key Decisions | **Union** | All entries combined, no conflicts |
| Implementation Notes | **Union** | All entries combined |
| TODOs | **Union + main wins removals** | Additions merge, completions from main stick (no resurrection) |
| Blockers | **Union + main wins removals** | Same as TODOs |
| Session Continuity | Phase-specific | Each worktree tracks its own session context |
| Open Questions | **Union** | All questions combined |

**Implications:**
- Most sections are additive — conflicts should be rare
- Completed TODOs on main are authoritative — worktrees cannot resurrect them
- No section uses "last writer wins" — all changes are preserved or combined

### Conflict Boundaries

| Scenario | Resolution |
|----------|------------|
| Same line edited (e.g., progress bar) | **Recalculate** from actual plan completion state |
| Same key, different values | **Add both** entries — duplicates OK, clean up later if needed |
| Inserted phases (4.1) | **Not a STATE.md issue** — decimal notation avoids renumbering |
| Unknown conflicts | **Claude suggests** resolution options, user confirms |

**Implications:**
- Progress percentage is derived, not stored — merge recalculates from plan states
- Duplicate entries are acceptable — prefer data preservation over forced deduplication
- Actual user-blocking conflicts should be extremely rare

### Resolution Experience

| Step | Behavior |
|------|----------|
| Conflict detected | **Rollback** merge attempt, return to clean slate |
| Show conflict | **Side-by-side diff** — "Main has X, worktree has Y, I suggest Z" |
| User choice | **Multiple choice** — accept suggestion / keep main / keep worktree / edit manually |
| Manual edit | **Open STATE.md in user's editor**, wait for save, then continue finalization |

**Implications:**
- No half-merged state for users to untangle
- User always sees both versions before deciding
- Full control: accept, pick a side, or edit themselves

### Registry-STATE Coupling

| Aspect | Behavior |
|--------|----------|
| Relationship | **Complementary** — registry for machines, STATE.md for humans |
| Updates | **Independent** — each updated by its own operations |
| Drift | **Allowed during work**, validated at finalization |
| Reconciliation | **Auto-reconcile first**, escalate to user only if that fails |

**Source of Truth:**

| Fact | Owner |
|------|-------|
| Worktree exists (path, branch) | Registry (JSON) |
| Worktree is locked | Registry (JSON) |
| Phase is in-progress | STATE.md |
| Phase is complete | STATE.md |
| Plans executed | STATE.md |

**Implications:**
- Registry and STATE.md can drift temporarily — this is expected
- Merge process must check for drift and reconcile
- Each source is authoritative for its domain — no conflicts between them

## Deferred Ideas

None captured.

## Open Questions

- What editor command to use for "edit manually"? (`$EDITOR`, `code`, platform-specific?)
- Should auto-reconcile log what it did, or only report on failure?

---
*Context captured: 2026-02-22*
