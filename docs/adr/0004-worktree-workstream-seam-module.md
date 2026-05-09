# Planning Workspace Module as single seam for worktree and workstream state

- **Status:** Accepted
- **Date:** 2026-05-08

We decided to treat planning/worktree behavior as one explicit Planning Workspace Module Interface rather than spread policy across ad-hoc call sites. The Module owns `.planning` path resolution, active workstream pointer policy, workstream-name invariants, and lock semantics, while a focused Worktree Root Resolution Adapter owns linked-worktree root mapping and metadata prune behavior. This raises depth at the seam, increases leverage for callers, and improves locality for bug fixes in the worktree/workstream loop.

## Decision

- The Planning Workspace Module Interface is authoritative for:
  - `planningDir` / `planningRoot` / `planningPaths`
  - active workstream pointer policy (`session-scoped > shared`)
  - pointer self-heal behavior (invalid/stale pointers clear to null)
  - planning lock semantics (`withPlanningLock`)
- Worktree root detection stays behind one Worktree Root Resolution Adapter (`resolveWorktreeRoot`), so callers do not re-derive git-dir/common-dir logic.
- Worktree metadata cleanup remains non-destructive by default: `pruneOrphanedWorktrees` runs `git worktree prune` only and does not remove linked worktree directories.
- Workstream naming is one invariant across create/migrate/set/get/env-pointer paths: values must be canonical slugs that remain addressable by all workstream commands.

## Consequences

- Tests can pin behavior through one Interface instead of source-grep fragments, improving regression quality for worktree/workstream bugs.
- Bug classes caused by contract drift (for example migration names accepted in one path but rejected in another) are fixed once in the Module and propagate to all callers.
- Callers become thin Adapters over a deeper seam; future policy changes (session identity strategy, lock recovery, worktree prune behavior) stay localized.
