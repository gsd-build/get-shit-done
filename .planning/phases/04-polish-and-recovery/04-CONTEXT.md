# Phase 4: Polish and Recovery - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Provide recovery tools for orphaned worktrees and incomplete operations. Users can detect, report, and fix issues with worktree state — including orphans (path deleted but reference remains), stale locks from dead processes, and incomplete finalization (merge succeeded but cleanup failed).

</domain>

<decisions>
## Implementation Decisions

### Detection & Reporting
- Auto-check for orphans during every worktree operation (create/remove/list)
- Report orphans in detailed table format showing path, branch, age, and suggested action
- Definition of "orphaned" includes: path missing, stale locks from dead processes, AND worktrees inactive beyond age threshold
- Age threshold for "potentially orphaned" is configurable via config/flag

### Cleanup Behavior
- Default mode is interactive — prompt for confirmation on each orphan
- Process one orphan at a time (no batch selection)
- Refuse cleanup if uncommitted changes detected — show warning, block cleanup
- Full cleanup removes worktree + registry entry + releases lock atomically

### Recovery Flow
- Detect incomplete finalization using both marker file AND git state verification
- Auto-resume incomplete finalization — automatically complete failed cleanup steps
- On recovery failure, rollback to safe state — undo partial recovery, leave system in known state
- Both auto-detect (finalize-phase offers to fix) AND explicit command available

### Command Design
- Single command: `/gsd:health` — detects and offers to fix all issues
- Default behavior is interactive fix — show issues, offer to fix each one
- Support `--quiet` or `--ci` flag for non-interactive mode (exit codes only)
- Detailed exit codes: 0 healthy, 1 orphans, 2 incomplete, 3 both, 4+ errors

### Claude's Discretion
- Exact format of detailed table output
- Marker file location and format for incomplete finalization detection
- Specific wording of interactive prompts
- Default age threshold value for "potentially orphaned"

</decisions>

<specifics>
## Specific Ideas

- Health command should feel like a "doctor" — diagnose first, then offer to fix
- One at a time confirmation ensures user understands each action being taken
- Refusing cleanup on uncommitted changes protects against accidental data loss
- Detailed exit codes enable CI/automation to take specific actions based on issue type

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-polish-and-recovery*
*Context gathered: 2026-02-23*
