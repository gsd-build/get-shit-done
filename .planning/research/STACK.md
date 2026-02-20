# Technology Stack: Git Worktree Management for Parallel Phase Execution

**Project:** GSD Worktree Isolation
**Researched:** 2026-02-20
**Focus:** Stack dimension for git worktree management in automated workflows

## Executive Summary

Git worktree is the standard approach for parallel branch development in 2025-2026. No additional libraries or tools are required - git worktree (available since Git 2.5) provides all necessary functionality. The key is proper shell script patterns for automation, lock management, and cleanup.

**Recommendation:** Implement a `phase-worktree.sh` script using native git worktree commands. No external dependencies. Shell-native implementation for zero runtime cost.

## Recommended Stack

### Core Technology

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `git worktree` | Git 2.5+ | Branch isolation | Built-in, no deps, shared .git objects, instant creation | HIGH |
| POSIX shell | Any | Automation scripts | Zero dependencies, works everywhere, GSD constraint compliance | HIGH |
| Lock files | N/A | Parallel coordination | Standard POSIX pattern, race-condition safe with `--lock` | HIGH |

### Key Git Worktree Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `git worktree add <path> -b <branch> [<start-point>] --lock` | Create isolated worktree | Starting phase execution |
| `git worktree list --porcelain` | Machine-readable worktree inventory | Status checks, automation |
| `git worktree remove <path> --force` | Clean removal | After phase finalization |
| `git worktree lock <path> --reason <string>` | Prevent pruning | Mark worktree as in-use |
| `git worktree unlock <path>` | Allow pruning | Before removal |
| `git worktree prune` | Clean stale metadata | After removals |
| `git worktree repair` | Fix moved worktrees | Recovery scenarios |

**Confidence:** HIGH - Verified against [official git documentation](https://git-scm.com/docs/git-worktree)

## Critical Pattern: Atomic Create with Lock

**Problem:** Race condition between `git worktree add` and `git worktree lock`.

**Solution:** Use `--lock` flag with add:

```bash
# WRONG: Race condition window exists
git worktree add ../phase-03 -b gsd/phase-03
git worktree lock ../phase-03  # Another process could prune between these

# CORRECT: Atomic create + lock
git worktree add ../phase-03 -b gsd/phase-03 main --lock --reason "GSD phase execution in progress"
```

**Why:** The `--lock` option keeps the worktree locked after creation. This is equivalent to `git worktree lock` after `git worktree add`, but without a race condition. There will be no gap that somebody can accidentally "prune" the new worktree.

**Confidence:** HIGH - Documented in [git commit 507e6e9](https://github.com/git/git/commit/507e6e9eecce5e7a2cc204c844bbb2f9b17b31e3)

## Recommended Script Implementation

### phase-worktree.sh Interface

```bash
#!/usr/bin/env bash
# .planning/scripts/phase-worktree.sh

usage() {
    cat << EOF
Usage: phase-worktree.sh <command> [phase_number]

Commands:
    create <phase>    Create worktree for phase (claims lock)
    remove <phase>    Remove worktree and release lock
    path <phase>      Print worktree path for phase
    status            List all phase worktrees and their status
    cleanup           Prune stale worktree metadata

Examples:
    phase-worktree.sh create 03
    phase-worktree.sh path 03
    phase-worktree.sh status
EOF
}
```

### Directory Naming Convention

```bash
# Pattern: sibling directories with clear naming
# <project>-phase-<N>-<slug>

MAIN_REPO=$(git rev-parse --show-toplevel)
PROJECT_NAME=$(basename "$MAIN_REPO")
WORKTREE_DIR="${MAIN_REPO}/../${PROJECT_NAME}-phase-${PHASE_NUM}"
BRANCH_NAME="gsd/phase-${PHASE_NUM}-${PHASE_SLUG}"
```

**Why sibling directories:**
- Self-documenting (`myproject-phase-03-auth/`)
- Easy tab completion
- No nested `.gitignore` complexity
- IDE opens each as separate project naturally

**Confidence:** MEDIUM - Community consensus from multiple sources, though some prefer `.worktrees/` subdirectory

### Create Worktree Pattern

```bash
create_worktree() {
    local phase_num="$1"
    local phase_slug="$2"
    local start_point="${3:-main}"

    local worktree_dir="${MAIN_REPO}/../${PROJECT_NAME}-phase-${phase_num}"
    local branch_name="gsd/phase-${phase_num}-${phase_slug}"

    # Check if branch already checked out elsewhere
    if git worktree list --porcelain | grep -q "branch refs/heads/${branch_name}"; then
        echo "ERROR: Branch ${branch_name} already checked out in another worktree" >&2
        return 1
    fi

    # Atomic create + lock (race-condition safe)
    git worktree add "$worktree_dir" -b "$branch_name" "$start_point" \
        --lock --reason "GSD phase ${phase_num} execution"

    echo "$worktree_dir"
}
```

### Remove Worktree Pattern

```bash
remove_worktree() {
    local phase_num="$1"
    local worktree_dir="${MAIN_REPO}/../${PROJECT_NAME}-phase-${phase_num}"

    # Unlock first (idempotent)
    git worktree unlock "$worktree_dir" 2>/dev/null || true

    # Remove with force (handles dirty worktrees)
    git worktree remove "$worktree_dir" --force

    # Clean up any stale metadata
    git worktree prune
}
```

### Status Check Pattern

```bash
list_worktrees() {
    # Use --porcelain for machine-readable output
    # Format: attribute<space>value per line, blank line between worktrees
    git worktree list --porcelain | while IFS= read -r line; do
        case "$line" in
            worktree*)
                current_path="${line#worktree }"
                ;;
            branch*)
                branch="${line#branch refs/heads/}"
                if [[ "$branch" == gsd/phase-* ]]; then
                    phase_num=$(echo "$branch" | sed 's/gsd\/phase-\([0-9]*\).*/\1/')
                    echo "Phase ${phase_num}: ${current_path} (${branch})"
                fi
                ;;
            locked*)
                echo "  [LOCKED] ${line#locked }"
                ;;
        esac
    done
}
```

**Confidence:** HIGH - `--porcelain` format is guaranteed stable across Git versions

## What NOT to Do

### Anti-Pattern 1: Manual Directory Deletion

**Wrong:**
```bash
rm -rf ../myproject-phase-03
```

**Why bad:** Leaves stale entries in `.git/worktrees/`. Future operations may fail or behave unexpectedly.

**Instead:**
```bash
git worktree remove ../myproject-phase-03 --force
git worktree prune
```

### Anti-Pattern 2: Same Branch in Multiple Worktrees

**Wrong:**
```bash
git worktree add ../worktree-1 -b feature-x
git worktree add ../worktree-2 feature-x  # Already checked out!
```

**Why bad:** Git refuses by default. If forced, changes in one worktree silently affect the other.

**Instead:** One worktree per branch, always.

### Anti-Pattern 3: Forgetting Lock for Long-Running Operations

**Wrong:**
```bash
git worktree add ../phase-03 -b gsd/phase-03
# ... hours pass, automated pruning runs ...
# Worktree metadata deleted!
```

**Instead:** Always use `--lock` for any worktree that will exist longer than a few minutes.

### Anti-Pattern 4: Parsing `git worktree list` Human Format

**Wrong:**
```bash
git worktree list | awk '{print $1}'  # Fragile, whitespace issues
```

**Instead:**
```bash
git worktree list --porcelain  # Stable, machine-readable
```

### Anti-Pattern 5: Moving Worktrees Manually

**Wrong:**
```bash
mv ../phase-03 ../phase-03-old
```

**Why bad:** Breaks internal git references between worktree and main repo.

**Instead:**
```bash
git worktree move ../phase-03 ../phase-03-old
# Or if already moved accidentally:
git worktree repair
```

**Confidence:** HIGH - Well-documented failure modes

## Parallel Execution Considerations

### Lock File Pattern for GSD

For tracking which phases are currently being executed (beyond git worktree's built-in lock):

```bash
# Lock directory in main repo
LOCK_DIR="${MAIN_REPO}/.planning/locks"
mkdir -p "$LOCK_DIR"

claim_phase_lock() {
    local phase_num="$1"
    local lock_file="${LOCK_DIR}/phase-${phase_num}.lock"

    # Atomic lock creation using mkdir (POSIX-safe)
    if ! mkdir "${lock_file}.d" 2>/dev/null; then
        # Lock exists - check if still valid
        local pid=$(cat "$lock_file" 2>/dev/null)
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            echo "Phase ${phase_num} locked by process ${pid}" >&2
            return 1
        fi
        # Stale lock, remove and retry
        rm -rf "${lock_file}.d" "$lock_file"
        mkdir "${lock_file}.d" || return 1
    fi

    echo $$ > "$lock_file"
    echo "Claimed lock for phase ${phase_num}"
}

release_phase_lock() {
    local phase_num="$1"
    local lock_file="${LOCK_DIR}/phase-${phase_num}.lock"
    rm -rf "${lock_file}.d" "$lock_file" 2>/dev/null
}
```

**Why mkdir:** `mkdir` is atomic on POSIX systems - it either succeeds or fails, no race window.

**Confidence:** MEDIUM - Standard pattern but verify for GSD's specific concurrency model

## Integration with Existing GSD Workflows

### execute-phase.md Integration Points

Current workflow references `phase-worktree.sh` at lines 40-59. The script should:

1. `create <phase>` - Called when branching_strategy is "phase" or "milestone"
2. `path <phase>` - Return worktree path for `cd` operation
3. `status` - Check if worktree already exists

### finalize-phase.md Integration Points

Current workflow references cleanup at lines 223-237. The script should:

1. `remove <phase>` - Clean removal with proper unlock
2. Handle case where worktree doesn't exist (already cleaned)

## Dependencies Analysis

| Dependency | Required | Notes |
|------------|----------|-------|
| Git 2.5+ | YES | Worktree support introduced |
| Git 2.17+ | Recommended | `--lock` flag added to `worktree add` |
| POSIX shell | YES | `#!/usr/bin/env bash` |
| Node.js | NO | Not needed for worktree management |
| External libraries | NO | Pure git + shell |

**Verification command:**
```bash
git --version  # Should be >= 2.17 for full feature support
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Isolation mechanism | git worktree | git clone | Clone duplicates entire .git, wastes disk, changes not shared |
| Isolation mechanism | git worktree | Docker containers | Overkill for branch isolation, adds complexity |
| Script language | Shell (bash) | Node.js | GSD constraint: no runtime deps, shell is sufficient |
| Lock mechanism | mkdir + git lock | File locks (flock) | flock not available everywhere, mkdir is POSIX |
| Wrapper tool | Custom script | git-worktree-runner | External dep, more features than needed |

## Sources

- [Git Worktree Official Documentation](https://git-scm.com/docs/git-worktree) - HIGH confidence
- [Git Commit 507e6e9: --lock option](https://github.com/git/git/commit/507e6e9eecce5e7a2cc204c844bbb2f9b17b31e3) - HIGH confidence
- [How Git Worktrees Changed My AI Agent Workflow (Nx Blog)](https://nx.dev/blog/git-worktrees-ai-agents) - MEDIUM confidence
- [Using Git Worktrees for Multi-Feature Development with AI Agents](https://www.nrmitchi.com/2025/10/using-git-worktrees-for-multi-feature-development-with-ai-agents/) - MEDIUM confidence
- [Git Worktree: Pros, Cons, and the Gotchas Worth Knowing](https://joshtune.com/posts/git-worktree-pros-cons/) - MEDIUM confidence
- [coderabbitai/git-worktree-runner](https://github.com/coderabbitai/git-worktree-runner) - Reference implementation patterns
- [Mastering Git Worktrees: Avoiding Common Pitfalls](https://infinitejs.com/posts/mastering-git-worktrees-pitfalls/) - MEDIUM confidence

---

*Stack research: 2026-02-20*
