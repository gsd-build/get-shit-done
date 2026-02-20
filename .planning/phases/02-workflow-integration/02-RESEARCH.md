# Phase 2: Workflow Integration - Research

**Researched:** 2026-02-20
**Domain:** GSD workflow modification, shell script integration, post-create hooks
**Confidence:** HIGH

## Summary

Phase 2 integrates the worktree infrastructure from Phase 1 into GSD's execute-phase and finalize-phase workflows. The core challenge is updating these workflow markdown files to call `phase-worktree.sh` functions instead of raw git commands, and adding post-create hooks (npm install, .env copy) that run after worktree creation. The existing workflows already have branching_strategy detection logic; they just need to use the Phase 1 infrastructure correctly.

The execute-phase workflow currently has a `handle_branching` step that checks for `.planning/scripts/phase-worktree.sh`, but Phase 1 placed the script at `get-shit-done/bin/phase-worktree.sh`. The finalize-phase workflow has similar logic and also needs to use the actual script location. Both workflows need updates to integrate with the registry and lock system properly.

**Primary recommendation:** Update execute-phase.md and finalize-phase.md in both the project `get-shit-done/workflows/` and the local patches `~/.claude/gsd-local-patches/get-shit-done/workflows/` to use the correct script path (`get-shit-done/bin/phase-worktree.sh`), add post-create hooks to the create function, and ensure finalize-phase uses `phase-worktree.sh remove` for proper cleanup.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FLOW-01 | execute-phase creates worktree when `branching_strategy: "phase"` | Update handle_branching step to call `phase-worktree.sh create` |
| FLOW-02 | execute-phase switches to existing worktree if present | `create_worktree` already returns existing path; workflow just needs to `cd` to it |
| FLOW-03 | finalize-phase verifies gates (UAT, tests, verification) before merge | Already implemented in finalize-phase.md; verify it blocks on failures |
| FLOW-04 | finalize-phase merges phase branch to main with `--no-ff` | Already implemented in merge_to_main step; verify branch name pattern |
| FLOW-05 | finalize-phase removes worktree and deletes merged branch | Update cleanup_worktree step to call `phase-worktree.sh remove` |
| FLOW-06 | Post-create hook runs `npm install` if package.json exists | Add hook to `create_worktree` function in phase-worktree.sh |
| FLOW-07 | Post-create hook copies `.env.example` to `.env` if present | Add hook to `create_worktree` function in phase-worktree.sh |
</phase_requirements>

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| phase-worktree.sh | Phase 1 | Worktree lifecycle operations | Built in Phase 1, provides atomic locking and registry integration |
| gsd-tools.cjs | Existing | Registry commands, init context | Already handles worktree/lock registry via `worktree add/remove/get/list/status` |
| execute-phase.md | Existing | Phase execution workflow | Target for FLOW-01, FLOW-02 updates |
| finalize-phase.md | Existing | Phase finalization workflow | Target for FLOW-03, FLOW-04, FLOW-05 updates |

### Supporting

| Tool | Purpose | When to Use |
|------|---------|-------------|
| npm | Dependency installation | Post-create hook when package.json exists |
| cp | File copying | Copy .env.example to .env in new worktree |
| git worktree list | Worktree verification | Detect if running inside worktree vs main repo |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| npm install | npm ci | npm ci is cleaner but fails if no lock file; npm install safer for varied projects |
| Shell hook | Node.js hook | Shell keeps phase-worktree.sh self-contained; Node adds dependency |
| Inline hook code | Separate hook script | Inline is simpler for 2 hooks; separate would be overkill |

## Architecture Patterns

### Pattern 1: Script Path Resolution in Workflows

**What:** Workflows need to locate `phase-worktree.sh` regardless of whether they're running from main repo or worktree.

**When to use:** In `handle_branching` (execute-phase) and `cleanup_worktree` (finalize-phase) steps.

**Example:**
```bash
# Get GSD installation path (where workflows live = where scripts live)
GSD_BIN="${HOME}/.claude/get-shit-done/bin"
PHASE_WORKTREE="${GSD_BIN}/phase-worktree.sh"

# Alternatively, if GSD is in project:
PROJECT_GSD_BIN="$(git rev-parse --show-toplevel)/get-shit-done/bin"
if [ -f "${PROJECT_GSD_BIN}/phase-worktree.sh" ]; then
  PHASE_WORKTREE="${PROJECT_GSD_BIN}/phase-worktree.sh"
fi

# Use the script
WORKTREE_PATH=$("${PHASE_WORKTREE}" create "${PHASE_NUMBER}")
```

**Key insight:** Phase 1 placed the script at `get-shit-done/bin/phase-worktree.sh`, not `.planning/scripts/`. The existing workflow checks for `.planning/scripts/phase-worktree.sh` which won't exist. Workflows must check the correct path.

### Pattern 2: Post-Create Hook in create_worktree

**What:** Run environment setup (npm install, .env copy) after git worktree add succeeds.

**When to use:** At the end of `create_worktree()` function in phase-worktree.sh, before returning the path.

**Example:**
```bash
# Inside create_worktree(), after git worktree add succeeds
run_post_create_hooks() {
    local worktree_dir="$1"

    # FLOW-06: npm install if package.json exists
    if [ -f "${worktree_dir}/package.json" ]; then
        echo "Installing dependencies in worktree..."
        (cd "$worktree_dir" && npm install --silent) || {
            echo "Warning: npm install failed, continuing anyway" >&2
        }
    fi

    # FLOW-07: Copy .env.example to .env if present and .env missing
    if [ -f "${worktree_dir}/.env.example" ] && [ ! -f "${worktree_dir}/.env" ]; then
        echo "Copying .env.example to .env..."
        cp "${worktree_dir}/.env.example" "${worktree_dir}/.env"
    fi
}
```

**Key insight:** Hooks should be non-fatal (warn but continue) since worktree creation itself succeeded. The user may need to manually resolve npm issues.

### Pattern 3: Detecting Worktree vs Main Repo

**What:** Determine if current working directory is inside a worktree or the main repository.

**When to use:** In finalize-phase to know where to cd for merge operations.

**Example:**
```bash
# Check if in a worktree
is_in_worktree() {
    # In worktree: .git is a file pointing to main repo
    # In main repo: .git is a directory
    [ -f "$(git rev-parse --show-toplevel)/.git" ]
}

# Get main repo path when in worktree
get_main_repo() {
    # git rev-parse --git-common-dir returns path to shared .git
    # Remove /worktrees/xxx suffix to get main repo
    local common_dir
    common_dir=$(git rev-parse --git-common-dir)
    dirname "$common_dir"
}
```

**Alternative method:**
```bash
# git worktree list shows main repo first
MAIN_REPO=$(git worktree list | head -1 | awk '{print $1}')
```

### Recommended Workflow Update Structure

```
execute-phase.md
├── initialize step (unchanged)
├── handle_branching step (UPDATE: use phase-worktree.sh)
│   ├── Check branching_strategy
│   ├── Locate phase-worktree.sh script
│   ├── Call create (returns existing path if present)
│   ├── cd to worktree path
│   └── Display WORKTREE READY banner
├── validate_phase step (unchanged)
├── ... remaining steps (unchanged)

finalize-phase.md
├── initialize step (unchanged)
├── check_uat_status step (VERIFY: gate blocks properly)
├── check_verification_status step (VERIFY: gate blocks properly)
├── run_tests step (unchanged)
├── verify_branch_state step (unchanged)
├── merge_to_main step (VERIFY: --no-ff preserved, branch name correct)
├── cleanup_worktree step (UPDATE: use phase-worktree.sh remove)
├── update_state step (unchanged)
└── report_completion step (unchanged)
```

### Anti-Patterns to Avoid

- **Hardcoding script path:** Use `GSD_BIN` or detect from project root; paths vary by installation
- **Synchronous npm install without timeout:** npm can hang; consider background or timeout
- **Assuming .env.example location:** Check exists before copy; some projects use `.env.local.example`
- **Forgetting to unlock before remove:** Phase 1's remove_worktree handles this, but raw git commands need explicit unlock
- **Using rm -rf on worktree directory:** NEVER - use `git worktree remove` to maintain git metadata integrity

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Worktree creation | Raw `git worktree add` in workflow | `phase-worktree.sh create` | Handles registry, lock, existing detection |
| Worktree removal | Raw `git worktree remove` + `git branch -d` | `phase-worktree.sh remove` | Handles unlock, branch cleanup, registry update |
| Lock management | Manual mkdir in workflow | Built into `phase-worktree.sh create` | Already integrated with registry |
| Existing worktree detection | Manual registry query | `phase-worktree.sh create` returns existing path | Idempotent by design |

**Key insight:** Phase 1 built `phase-worktree.sh` specifically to encapsulate these operations. Workflows should be thin orchestration layers that call the script, not re-implement the logic.

## Common Pitfalls

### Pitfall 1: Wrong Script Path in Workflows

**What goes wrong:** Workflow looks for `.planning/scripts/phase-worktree.sh` (per current code) but script is at `get-shit-done/bin/phase-worktree.sh`.

**Why it happens:** The current execute-phase.md and finalize-phase.md reference `.planning/scripts/phase-worktree.sh` which was a hypothetical location before Phase 1 implementation.

**How to avoid:**
- Update all path checks to use `get-shit-done/bin/phase-worktree.sh`
- Consider adding a GSD_BIN environment variable or detection logic
- Test workflow from fresh clone to catch path assumptions

**Warning signs:** "phase-worktree.sh: command not found" errors; workflow falls back to raw git checkout.

### Pitfall 2: npm install Hanging Indefinitely

**What goes wrong:** Post-create hook runs `npm install`, which prompts for input (e.g., deprecated package warnings) or hangs on slow networks.

**Why it happens:** npm can be interactive in some edge cases; network timeouts can be very long.

**How to avoid:**
- Use `npm install --silent --no-audit --no-fund` to minimize output and checks
- Add timeout wrapper: `timeout 120 npm install` (2 min max)
- Make hook failures non-fatal with warning message
- Consider `npm ci` if lock file exists, `npm install` as fallback

**Warning signs:** Worktree creation takes >2 minutes; process seems stuck.

### Pitfall 3: Branch Name Mismatch

**What goes wrong:** finalize-phase expects branch `gsd/phase-{N}-{slug}` but Phase 1 creates `phase-{N}-{slug}` (no gsd/ prefix).

**Why it happens:** Different naming conventions between config template and actual implementation.

**How to avoid:**
- Phase 1 uses `phase-{N}-{slug}` per user decision (see CONTEXT.md: "Simple, no namespace prefix")
- Update finalize-phase branch expectations to match
- Get branch name from registry rather than constructing it

**Warning signs:** "branch not found" errors during merge; wrong branch merged.

### Pitfall 4: Gate Checking Not Actually Blocking

**What goes wrong:** finalize-phase has UAT/verification checks but user can proceed anyway.

**Why it happens:** Checks report status but don't exit/block the workflow.

**How to avoid:**
- Verify check steps have `return 1` or equivalent on failure
- Ensure subsequent steps aren't reached when gates fail
- Add explicit "blocked" status in workflow output

**Warning signs:** Phase finalized with failed UAT; VERIFICATION.md shows gaps but merge happened.

### Pitfall 5: Worktree Cleanup After Failed Merge

**What goes wrong:** Merge fails (conflict), but cleanup_worktree runs anyway, deleting the worktree with uncommitted conflict resolution.

**Why it happens:** Cleanup step not gated on merge success.

**How to avoid:**
- Only run cleanup_worktree if merge succeeds
- On merge failure, provide manual resolution steps WITHOUT cleanup
- Check MERGE_EXIT before cleanup

**Warning signs:** "Worktree removed" message after merge conflict; user loses work.

## Code Examples

### Updated handle_branching Step (execute-phase.md)

```markdown
<step name="handle_branching">
Check `branching_strategy` from init:

**"none":** Skip, continue on current branch.

**"phase" or "milestone":** Create worktree using phase-worktree.sh:

```bash
# Locate phase-worktree.sh script
REPO_ROOT=$(git rev-parse --show-toplevel)
PHASE_WORKTREE="${REPO_ROOT}/get-shit-done/bin/phase-worktree.sh"

# Fallback to home-installed GSD
if [ ! -f "$PHASE_WORKTREE" ]; then
  PHASE_WORKTREE="${HOME}/.claude/get-shit-done/bin/phase-worktree.sh"
fi

if [ -f "$PHASE_WORKTREE" ]; then
  # create_worktree is idempotent: returns existing path or creates new
  WORKTREE_PATH=$("$PHASE_WORKTREE" create "${PHASE_NUMBER}" "${PHASE_SLUG}")
  WORKTREE_EXIT=$?

  if [ $WORKTREE_EXIT -eq 0 ] && [ -n "$WORKTREE_PATH" ]; then
    echo "Switching to worktree: $WORKTREE_PATH"
    cd "$WORKTREE_PATH"
    BRANCH_NAME=$(git branch --show-current)
  else
    echo "Error: Failed to create/access worktree" >&2
    exit 1
  fi
else
  # Fallback: simple branch checkout (no worktree isolation)
  git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
fi
```

Display to user:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD > WORKTREE READY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Working directory: {WORKTREE_PATH}
Branch: {BRANCH_NAME}

Parallel sessions can work on other phases without conflicts.
```

All subsequent commits go to this branch in the worktree. Use `/gsd:finalize-phase {N}` after completion to merge to main and cleanup.
</step>
```

### Post-Create Hook Function (phase-worktree.sh)

```bash
# Add to phase-worktree.sh after git worktree add succeeds

# Run post-create hooks for new worktree (FLOW-06, FLOW-07)
run_post_create_hooks() {
    local worktree_dir="$1"

    echo "Running post-create hooks..."

    # FLOW-06: npm install if package.json exists
    if [ -f "${worktree_dir}/package.json" ]; then
        echo "  Installing npm dependencies..."
        if (cd "$worktree_dir" && timeout 120 npm install --silent --no-audit --no-fund 2>&1); then
            echo "  Dependencies installed."
        else
            echo "  Warning: npm install failed or timed out. Run manually if needed." >&2
        fi
    fi

    # FLOW-07: Copy .env.example to .env if present and .env missing
    if [ -f "${worktree_dir}/.env.example" ] && [ ! -f "${worktree_dir}/.env" ]; then
        echo "  Copying .env.example to .env..."
        cp "${worktree_dir}/.env.example" "${worktree_dir}/.env"
        echo "  Environment file created."
    fi
}

# In create_worktree(), add after registry update:
#     run_post_create_hooks "$worktree_dir"
```

### Updated cleanup_worktree Step (finalize-phase.md)

```markdown
<step name="cleanup_worktree">
Remove the git worktree and release lock **only if merge succeeded**:

**Skip if MERGE_EXIT != 0** — don't clean up after failed merge.

```bash
# Locate phase-worktree.sh
REPO_ROOT=$(git rev-parse --show-toplevel)
PHASE_WORKTREE="${REPO_ROOT}/get-shit-done/bin/phase-worktree.sh"

# Fallback to home-installed GSD
if [ ! -f "$PHASE_WORKTREE" ]; then
  PHASE_WORKTREE="${HOME}/.claude/get-shit-done/bin/phase-worktree.sh"
fi

if [ -f "$PHASE_WORKTREE" ]; then
  # Use phase-worktree.sh remove for proper cleanup
  # Handles: git worktree unlock, git worktree remove, git branch -d, registry update
  "$PHASE_WORKTREE" remove "${PHASE_NUMBER}"
else
  # Manual worktree cleanup (fallback)
  git worktree unlock "${WORK_DIR}" 2>/dev/null || true
  git worktree remove "${WORK_DIR}" 2>/dev/null || true
  git branch -d "${PHASE_BRANCH}" 2>/dev/null || true
fi
```

**Report cleanup:**
```
## > Worktree Cleaned Up

- Worktree removed: ${WORK_DIR}
- Branch deleted: ${PHASE_BRANCH}
- Lock released: phase-${PHASE_NUMBER}
```
</step>
```

### Gate Check Pattern (finalize-phase.md)

```bash
# In check_uat_status and check_verification_status, ensure blocking:

if [ "$UAT_STATUS" != "passed" ]; then
  echo "## X UAT Not Passed"
  echo ""
  echo "UAT status: $UAT_STATUS"
  echo "Cannot finalize phase until UAT passes."
  echo ""
  echo "Run: /gsd:verify-work ${PHASE_NUMBER}"
  exit 1  # CRITICAL: Must block, not just warn
fi
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw git worktree in workflow | Dedicated script with registry | Phase 1 (now) | Unified locking, tracking, idempotency |
| Manual npm install prompt | Post-create hook | Phase 2 (this phase) | Automated environment setup |
| Fallback branch checkout | Worktree isolation standard | Phase 2 (this phase) | True parallel isolation |

**Deprecated/outdated:**
- **`.planning/scripts/phase-worktree.sh` path:** Never existed; script is at `get-shit-done/bin/`
- **gsd/phase-{N} branch prefix:** User decision in Phase 1 CONTEXT.md specified `phase-{N}-{slug}` without prefix

## Edge Cases

### Edge Case 1: Worktree Exists but Registry Out of Sync

**Scenario:** User manually created worktree or registry.json was deleted.

**Detection:** `git worktree list` shows worktree but `phase-worktree.sh path` returns error.

**Resolution:**
- `phase-worktree.sh create` checks filesystem as fallback
- Consider adding `phase-worktree.sh sync` command (future enhancement)
- Current code handles via prune + re-add to registry

### Edge Case 2: Worktree Has Uncommitted Changes at Finalization

**Scenario:** User forgot to commit changes before running finalize-phase.

**Detection:** `verify_branch_state` step checks `git status --porcelain`.

**Resolution:** Workflow already handles this with warning message; requires user to commit first.

### Edge Case 3: npm install Fails in Post-Create Hook

**Scenario:** Network issue, missing node, incompatible npm version.

**Detection:** Non-zero exit from npm install.

**Resolution:** Hook should warn but not fail worktree creation. User can manually run `npm install` after.

### Edge Case 4: Multiple Finalize Attempts

**Scenario:** First finalize partially succeeds (merge ok, cleanup fails); user retries.

**Detection:** Worktree path doesn't exist or branch already deleted.

**Resolution:** `phase-worktree.sh remove` handles missing worktree gracefully. Add check for already-merged branch.

## Open Questions

1. **Should hooks be configurable?**
   - What we know: FLOW-06 and FLOW-07 specify npm install and .env copy
   - What's unclear: What if project uses yarn, pnpm, or has custom hooks?
   - Recommendation: Start with npm/env, add hook config in Phase 4 (Polish)

2. **npm install vs npm ci behavior**
   - What we know: npm ci is cleaner for CI but requires lock file
   - What's unclear: What percentage of projects have valid lock files?
   - Recommendation: Try npm ci first, fall back to npm install if lock file missing

3. **Worktree working directory after creation**
   - What we know: execute-phase needs to cd into worktree
   - What's unclear: Should phase-worktree.sh output just the path, or should it emit shell commands to source?
   - Recommendation: Output path only; let workflow handle cd (current approach is correct)

## Sources

### Primary (HIGH confidence)

- **Phase 1 Artifacts:** `phase-worktree.sh`, `gsd-tools.cjs`, `registry.json` — verified working code
- **execute-phase.md** (existing) — current workflow structure, handle_branching step
- **finalize-phase.md** (existing) — current gate checks and cleanup logic
- **01-RESEARCH.md** (Phase 1) — git worktree patterns, atomic locking
- **01-VERIFICATION.md** (Phase 1) — verified all TREE-* and LOCK-* requirements

### Secondary (MEDIUM confidence)

- **REQUIREMENTS.md** — FLOW-01 through FLOW-07 definitions
- **ROADMAP.md** — Phase 2 success criteria
- **CONTEXT.md** (Phase 1) — branch naming decisions (`phase-{N}-{slug}`, no prefix)

### Tertiary (context only)

- npm documentation for install vs ci behavior
- Git worktree documentation for detecting worktree status

## Metadata

**Confidence breakdown:**
- Workflow updates: HIGH — existing code + Phase 1 foundation are well understood
- Post-create hooks: HIGH — straightforward shell scripting, patterns clear
- Edge cases: MEDIUM — some scenarios may emerge during implementation

**Research date:** 2026-02-20
**Valid until:** 30 days (GSD internal project, stable domain)
