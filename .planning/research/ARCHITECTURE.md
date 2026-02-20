# Architecture Patterns: Worktree Integration

**Domain:** Phase-based execution system with git worktree isolation
**Researched:** 2026-02-20
**Confidence:** HIGH (based on existing codebase analysis + verified git worktree patterns)

## Executive Summary

Integrating git worktree isolation into GSD's existing execute-phase workflow requires minimal architectural changes. The current system already anticipates worktrees (see `handle_branching` step in execute-phase.md and cleanup in finalize-phase.md) but lacks the implementation. The integration point is clear: worktrees wrap phase execution, not individual plans.

Key insight: Worktrees share git history but isolate file state. This means STATE.md in the main repo diverges from worktree copies, requiring a reconciliation strategy during finalization.

## Recommended Architecture

```
                                   MAIN REPOSITORY
                                   ===============

    .planning/                     .planning/worktrees/
    ├── STATE.md (authoritative)   ├── locks.json (coordination)
    ├── ROADMAP.md                 └── registry.json (worktree paths)
    ├── config.json
    └── phases/
        ├── 01-setup/
        ├── 02-core/
        └── 03-features/

          │                              │
          │ git worktree add             │ coordination
          ▼                              ▼

    WORKTREE: ~/worktrees/project/phase-02
    =========================================
    .planning/
    ├── STATE.md (local copy, diverges)
    ├── ROADMAP.md (commits go here)
    └── phases/02-core/
        ├── 02-01-PLAN.md
        ├── 02-01-SUMMARY.md (created during execution)
        └── ...

    All code changes committed to branch: gsd/phase-02-core
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Worktree Manager** (`phase-worktree.sh` or gsd-tools subcommand) | Create, list, status, path, remove worktrees; manage locks | Main repo git, lock registry |
| **Lock Registry** (`.planning/worktrees/locks.json`) | Prevent concurrent execution of same phase; track active worktrees | Worktree Manager |
| **Execute-Phase Workflow** | Invoke worktree creation, delegate to executor, handle branching strategy | Worktree Manager, gsd-tools init |
| **Finalize-Phase Workflow** | Verify gates, merge branch, reconcile state, cleanup worktree | Worktree Manager, main repo |
| **gsd-tools.cjs** | Extended with worktree-aware init, state reconciliation commands | All workflows |

### Data Flow

**Phase Execution with Worktree:**

```
1. User: /gsd:execute-phase 2
                │
                ▼
2. Workflow: gsd-tools init execute-phase 2
   Returns: branching_strategy="phase", branch_name="gsd/phase-02-core"
                │
                ▼
3. Workflow: Check .planning/worktrees/locks.json
   ├── Phase 2 NOT locked → Continue
   └── Phase 2 locked → Error: "Phase 2 in progress at [path]"
                │
                ▼
4. Workflow: git worktree add ../worktrees/phase-02 -b gsd/phase-02-core
   Worktree Manager: Create lock entry, record path in registry
                │
                ▼
5. Workflow: cd [worktree_path]
   Now operating in isolated directory
                │
                ▼
6. Executor agents: Run plans, commit to gsd/phase-02-core branch
   STATE.md in worktree updated (diverges from main)
                │
                ▼
7. Workflow: All plans complete → Prompt /gsd:finalize-phase 2
```

**Phase Finalization with Worktree:**

```
1. User: /gsd:finalize-phase 2
                │
                ▼
2. Workflow: Verify UAT, Verification, Tests pass
                │
                ▼
3. Workflow: cd [main_repo]
   git checkout main
   git merge gsd/phase-02-core --no-ff
                │
                ▼
4. Workflow: Reconcile STATE.md
   ├── Read worktree STATE.md (has execution details)
   ├── Read main STATE.md (may have parallel updates)
   └── Merge: position from worktree, preserve any main-repo additions
                │
                ▼
5. Workflow: git worktree remove [path]
   Worktree Manager: Remove lock, update registry
                │
                ▼
6. Workflow: git branch -d gsd/phase-02-core
   Commit: "docs(phase-2): finalize phase - merged to main"
```

## Patterns to Follow

### Pattern 1: Lock-Before-Create

**What:** Always acquire a lock before creating a worktree. Release lock only after successful cleanup.

**When:** Every worktree lifecycle operation.

**Why:** Prevents race conditions where two sessions try to execute the same phase.

**Implementation:**
```bash
# Lock acquisition (atomic via mkdir)
acquire_lock() {
  local phase=$1
  local lock_dir=".planning/worktrees/locks/${phase}"

  if mkdir "$lock_dir" 2>/dev/null; then
    echo "$USER@$(hostname):$$" > "$lock_dir/owner"
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$lock_dir/acquired"
    return 0
  else
    return 1  # Already locked
  fi
}

# Lock release
release_lock() {
  local phase=$1
  rm -rf ".planning/worktrees/locks/${phase}"
}
```

### Pattern 2: Registry as Source of Truth

**What:** Maintain a JSON registry of active worktrees with their paths, branches, and status.

**When:** Worktree creation, status checks, cleanup.

**Why:** `git worktree list` output is hard to parse reliably. A registry provides structured lookup.

**Implementation:**
```json
// .planning/worktrees/registry.json
{
  "version": "1.0",
  "worktrees": {
    "phase-02": {
      "path": "/Users/dev/worktrees/myproject/phase-02",
      "branch": "gsd/phase-02-core",
      "created": "2026-02-20T10:30:00Z",
      "phase_number": "02",
      "phase_name": "Core Features",
      "status": "active"
    }
  }
}
```

### Pattern 3: State Reconciliation on Merge

**What:** After merging, reconcile STATE.md by taking execution details from worktree while preserving any concurrent main-repo updates.

**When:** finalize-phase, after successful merge.

**Why:** Main repo STATE.md may have been updated by other operations (debugging, manual edits). Worktree STATE.md has the execution progress.

**Implementation Strategy:**
```javascript
// Reconciliation logic in gsd-tools.cjs
function reconcileState(mainState, worktreeState) {
  // Take from worktree (execution details):
  // - Current Position (phase, plan, status)
  // - Recent Activity entries for this phase
  // - Metrics for this phase
  // - Session Continuity

  // Preserve from main (may have parallel updates):
  // - Decisions added during execution
  // - Blockers added/resolved
  // - Any content not related to the executed phase

  // Merge strategy: worktree wins for phase-specific, main wins for global
}
```

### Pattern 4: Worktree Path Convention

**What:** Use a predictable path structure for worktrees.

**When:** Worktree creation.

**Why:** Predictable paths enable easier status checks, cleanup, and multi-session coordination.

**Convention:**
```
{repo_parent}/worktrees/{repo_name}/phase-{N}

Example:
/Users/dev/Projects/myapp            # Main repo
/Users/dev/Projects/worktrees/myapp/phase-02   # Phase 2 worktree
/Users/dev/Projects/worktrees/myapp/phase-03   # Phase 3 worktree (parallel)
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Shared Branch Execution

**What:** Trying to execute multiple phases on the same branch.

**Why bad:** Git branches can only be checked out in one worktree at a time. Attempting this causes "fatal: 'branch' is already checked out" errors.

**Instead:** Each phase gets its own branch (`gsd/phase-{N}-{slug}`).

### Anti-Pattern 2: Worktree State Isolation Without Reconciliation

**What:** Treating worktree STATE.md as completely independent and simply overwriting main on merge.

**Why bad:** Loses any concurrent updates to main STATE.md (decisions, blockers, manual edits).

**Instead:** Implement proper state reconciliation that merges execution progress with main-repo state.

### Anti-Pattern 3: Implicit Worktree Cleanup

**What:** Relying on users to manually clean up worktrees.

**Why bad:** Orphaned worktrees accumulate, locks remain held, disk space wasted.

**Instead:** `finalize-phase` is mandatory path; provide `worktree cleanup` command for recovery.

### Anti-Pattern 4: File-Level Locking

**What:** Using file locks (flock, lockfile) for phase coordination.

**Why bad:** Platform-dependent, doesn't survive process crashes well, requires cleanup logic.

**Instead:** Directory-based locks (`mkdir` is atomic on all platforms) with metadata files.

## Component Integration Points

### gsd-tools.cjs Extensions

New commands needed:

| Command | Purpose | Returns |
|---------|---------|---------|
| `worktree create <phase>` | Create worktree, acquire lock, update registry | `{path, branch, lock_acquired}` |
| `worktree status [phase]` | Check worktree/lock status | `{exists, locked, path, branch}` |
| `worktree path <phase>` | Get worktree path for phase | Path string or null |
| `worktree remove <phase>` | Remove worktree, release lock, update registry | `{removed, lock_released}` |
| `worktree list` | List all active worktrees | Array of worktree info |
| `state reconcile <worktree_state> <main_state>` | Merge state files | Reconciled STATE.md content |

### Config Extensions

```json
{
  "git": {
    "branching_strategy": "phase",  // "none" | "phase" | "milestone"
    "phase_branch_template": "gsd/phase-{phase}-{slug}",
    "worktree_base_path": "../worktrees/{repo}"  // Relative to main repo
  }
}
```

### execute-phase.md Modifications

The `handle_branching` step already has placeholder logic. Replace with:

```markdown
<step name="handle_branching">
Check `branching_strategy` from init:

**"none":** Skip, continue on current branch.

**"phase" or "milestone":**

```bash
# Use gsd-tools for worktree operations
WORKTREE_RESULT=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs worktree create "${PHASE_NUMBER}")

if [ "$(echo "$WORKTREE_RESULT" | jq -r '.lock_acquired')" != "true" ]; then
  echo "ERROR: Phase ${PHASE_NUMBER} is already being executed"
  echo "Active at: $(echo "$WORKTREE_RESULT" | jq -r '.existing_path')"
  exit 1
fi

WORKTREE_PATH=$(echo "$WORKTREE_RESULT" | jq -r '.path')
cd "$WORKTREE_PATH"
```
</step>
```

### finalize-phase.md Modifications

Replace manual git commands with gsd-tools integration:

```markdown
<step name="cleanup_worktree">
```bash
# Reconcile state before cleanup
node ~/.claude/get-shit-done/bin/gsd-tools.cjs state reconcile \
  --worktree "${WORKTREE_PATH}/.planning/STATE.md" \
  --main "${MAIN_REPO}/.planning/STATE.md" \
  --output "${MAIN_REPO}/.planning/STATE.md"

# Remove worktree and release lock
node ~/.claude/get-shit-done/bin/gsd-tools.cjs worktree remove "${PHASE_NUMBER}"
```
</step>
```

## Build Order / Dependencies

Implementation should proceed in this order:

### Phase 1: Foundation (No Breaking Changes)

1. **Lock mechanism** - Directory-based locks in `.planning/worktrees/locks/`
2. **Registry** - JSON registry for worktree tracking
3. **gsd-tools worktree commands** - `create`, `status`, `path`, `remove`, `list`

These can be built and tested without modifying existing workflows.

### Phase 2: Workflow Integration

4. **execute-phase.md update** - Replace placeholder bash with gsd-tools calls
5. **finalize-phase.md update** - Add state reconciliation, use gsd-tools cleanup

Requires Phase 1 complete.

### Phase 3: State Reconciliation

6. **state reconcile command** - Merge algorithm for STATE.md
7. **Conflict handling** - Handle cases where reconciliation fails

Requires Phase 2 for testing integration.

### Phase 4: Polish

8. **Recovery commands** - `worktree cleanup --stale`, `worktree repair`
9. **Status integration** - Show active worktrees in `/gsd:progress`
10. **Documentation** - Update help, add worktree guide

Requires Phases 1-3 stable.

## Scalability Considerations

| Concern | Single User | Multiple Parallel Phases | CI/CD Integration |
|---------|-------------|--------------------------|-------------------|
| Lock contention | N/A | Directory locks scale | Use --force flags for automation |
| Disk space | Minimal overhead | O(N) for N phases | Consider shallow clones |
| State divergence | None | Reconciliation handles | May need merge conflict handling |
| Worktree proliferation | Manual cleanup | finalize-phase cleanup | Auto-cleanup on job completion |

## Confidence Assessment

| Aspect | Confidence | Rationale |
|--------|------------|-----------|
| Component boundaries | HIGH | Follows existing GSD patterns; worktree is a wrapper, not core change |
| Lock mechanism | HIGH | Directory-based locks are proven; used by many tools |
| State reconciliation | MEDIUM | Algorithm is straightforward but edge cases need testing |
| Registry approach | HIGH | Explicit registry beats parsing git output |
| Build order | HIGH | Clear dependencies, each phase testable independently |

## Open Questions

1. **Stale lock recovery:** How long before a lock is considered stale? (Recommendation: 24 hours + no process holding it)

2. **Partial merge handling:** What if merge has conflicts? (Recommendation: Stop, present manual resolution steps, do not auto-cleanup)

3. **Nested worktree paths:** Should worktrees be siblings or under main repo? (Recommendation: Siblings via `../worktrees/` to avoid accidental commits)

4. **Dependencies installation:** Should worktrees auto-run `npm install`? (Recommendation: No, let user/workflow handle it; add note in WORKTREE READY message)

## Sources

- GSD codebase analysis: `/Users/mauricevandermerwe/Projects/get-shit-done/.planning/codebase/ARCHITECTURE.md`
- Existing workflow: `/Users/mauricevandermerwe/Projects/get-shit-done/get-shit-done/workflows/execute-phase.md`
- Finalize workflow: `/Users/mauricevandermerwe/Projects/get-shit-done/get-shit-done/workflows/finalize-phase.md`
- Git worktree documentation: https://git-scm.com/docs/git-worktree
- [Git Worktrees: The Complete Guide for 2026](https://devtoolbox.dedyn.io/blog/git-worktrees-complete-guide)
- [The Complete Guide to Git Worktrees with Claude Code](https://notes.muthu.co/2026/02/the-complete-guide-to-git-worktrees-with-claude-code/)
- [Git Worktrees for Parallel AI-Assisted Development](https://www.d4b.dev/blog/2026-02-08-git-worktrees-for-parallel-ai-assisted-development)
- [How I Use Git Worktrees](https://matklad.github.io/2024/07/25/git-worktrees.html)

---

*Architecture research: 2026-02-20*
