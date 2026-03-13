#!/usr/bin/env bash
set -euo pipefail

# phase-worktree.sh - Git worktree lifecycle management for GSD
# Provides atomic locking and worktree operations for parallel phase execution

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GSD_TOOLS="$SCRIPT_DIR/gsd-tools.cjs"

# ============================================================================
# Repository Info Helpers
# ============================================================================

get_repo_root() {
    git rev-parse --show-toplevel
}

get_repo_name() {
    basename "$(get_repo_root)"
}

# ============================================================================
# Worktree Path Functions
# ============================================================================

# Get worktree directory path (per user decision: .worktrees/{repo}-phase-{N})
get_worktree_dir() {
    local phase="$1"
    local repo_root
    local repo_name
    repo_root=$(get_repo_root)
    repo_name=$(get_repo_name)
    echo "${repo_root}/.worktrees/${repo_name}-phase-${phase}"
}

# Get branch name (per user decision: phase-{N}-{slug})
get_branch_name() {
    local phase="$1"
    local slug="$2"
    echo "phase-${phase}-${slug}"
}

# Get phase slug from roadmap via gsd-tools
get_phase_slug() {
    local phase="$1"
    # Use gsd-tools to get phase info
    local info
    info=$(node "$GSD_TOOLS" find-phase "$phase" 2>/dev/null) || {
        echo "unknown"
        return 1
    }
    # Extract slug from phase name (e.g., "01-foundation" -> "foundation")
    echo "$info" | sed 's/.*-//'
}

# Ensure .worktrees/ is in .gitignore
ensure_gitignore() {
    local repo_root
    repo_root=$(get_repo_root)
    local gitignore="${repo_root}/.gitignore"

    if ! grep -q "^\.worktrees/" "$gitignore" 2>/dev/null; then
        echo "" >> "$gitignore"
        echo "# Worktree directories (created by phase-worktree.sh)" >> "$gitignore"
        echo ".worktrees/" >> "$gitignore"
    fi
}

# Prune stale worktrees (TREE-06)
prune_stale() {
    # Run git worktree prune to clean up stale references
    git worktree prune 2>/dev/null || true
}

# ============================================================================
# Lock Functions
# ============================================================================

# Get lock directory path for a phase
get_lock_dir() {
    local phase="$1"
    local repo_root
    repo_root=$(git rev-parse --show-toplevel)
    echo "${repo_root}/.planning/worktrees/locks/phase-${phase}"
}

# Acquire atomic lock for a phase
# Returns 0 on success, 1 if lock already held
acquire_lock() {
    local phase="$1"
    local lock_dir
    lock_dir=$(get_lock_dir "$phase")

    # Ensure parent exists (mkdir -p is safe for parent)
    mkdir -p "$(dirname "$lock_dir")"

    # Atomic lock acquisition - only one process succeeds
    if mkdir "$lock_dir" 2>/dev/null; then
        # Write metadata for debugging/recovery
        cat > "${lock_dir}/info.json" << EOF
{
  "acquired": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "pid": $$,
  "owner": "${USER:-unknown}",
  "hostname": "$(hostname)"
}
EOF
        # Record in registry
        node "$GSD_TOOLS" lock record "$phase" 2>/dev/null || true
        return 0
    else
        echo "Error: Phase $phase is locked. Another session may be active." >&2
        echo "Lock info: $(cat "${lock_dir}/info.json" 2>/dev/null || echo 'unavailable')" >&2
        return 1
    fi
}

# Release lock for a phase
# Returns 0 on success, 1 if lock didn't exist
release_lock() {
    local phase="$1"
    local lock_dir
    lock_dir=$(get_lock_dir "$phase")

    if [ -d "$lock_dir" ]; then
        rm -f "${lock_dir}/info.json"
        rmdir "$lock_dir" 2>/dev/null || true
        node "$GSD_TOOLS" lock clear "$phase" 2>/dev/null || true
        return 0
    else
        echo "Warning: No lock to release for phase $phase" >&2
        return 1
    fi
}

# Check if a lock is stale (process no longer exists)
# Returns 0 (true) if stale, 1 (false) if active or no lock
check_stale_lock() {
    local phase="$1"
    local lock_dir
    lock_dir=$(get_lock_dir "$phase")
    local info_file="${lock_dir}/info.json"

    if [ ! -d "$lock_dir" ]; then
        echo '{"stale": false, "reason": "no_lock"}'
        return 1
    fi

    if [ ! -f "$info_file" ]; then
        echo '{"stale": true, "reason": "no_info_file"}'
        return 0
    fi

    # Extract PID (simple grep, avoid jq dependency in shell)
    local pid
    pid=$(grep -o '"pid": *[0-9]*' "$info_file" | grep -o '[0-9]*')

    if [ -z "$pid" ]; then
        echo '{"stale": true, "reason": "no_pid_in_info"}'
        return 0
    fi

    # Check if process exists
    if kill -0 "$pid" 2>/dev/null; then
        echo '{"stale": false, "reason": "active", "pid": '"$pid"'}'
        return 1
    else
        echo '{"stale": true, "reason": "pid_dead", "pid": '"$pid"'}'
        return 0
    fi
}

# Force remove a lock (for recovery)
force_unlock() {
    local phase="$1"
    local lock_dir
    lock_dir=$(get_lock_dir "$phase")

    echo "Force-unlocking phase $phase..."
    rm -rf "$lock_dir"
    node "$GSD_TOOLS" lock clear "$phase" 2>/dev/null || true
    echo "Lock removed."
}

# Self-test function for development/debugging
_test_lock_atomicity() {
    local test_phase="__test_atomicity__"
    local lock_dir
    lock_dir=$(get_lock_dir "$test_phase")

    echo "Testing lock atomicity..."

    # Clean up any previous test
    rm -rf "$lock_dir" 2>/dev/null || true

    # Acquire lock
    if acquire_lock "$test_phase"; then
        echo "[PASS] First lock acquired"
    else
        echo "[FAIL] Failed to acquire first lock"
        return 1
    fi

    # Try to acquire again (should fail)
    if acquire_lock "$test_phase" 2>/dev/null; then
        echo "[FAIL] Second lock should have failed"
        release_lock "$test_phase"
        return 1
    else
        echo "[PASS] Second lock correctly rejected"
    fi

    # Release and cleanup
    release_lock "$test_phase"
    echo "[PASS] Lock released"

    # Verify cleanup
    if [ -d "$lock_dir" ]; then
        echo "[FAIL] Lock directory still exists after release"
        return 1
    else
        echo "[PASS] Lock directory cleaned up"
    fi

    echo "All lock tests passed."
    return 0
}

# ============================================================================
# Worktree Lifecycle Functions
# ============================================================================

# Run post-create hooks for new worktree (FLOW-06, FLOW-07)
run_post_create_hooks() {
    local worktree_dir="$1"

    echo "Running post-create hooks..." >&2

    # FLOW-06: npm install if package.json exists
    if [ -f "${worktree_dir}/package.json" ]; then
        echo "  Installing npm dependencies..." >&2
        if [ -f "${worktree_dir}/package-lock.json" ]; then
            # Use npm ci for reproducible installs when lock file exists
            if (cd "$worktree_dir" && timeout 120 npm ci --silent --no-audit --no-fund 2>&1); then
                echo "  Dependencies installed (npm ci)." >&2
            else
                echo "  Warning: npm ci failed or timed out. Run manually if needed." >&2
            fi
        else
            # Fall back to npm install if no lock file
            if (cd "$worktree_dir" && timeout 120 npm install --silent --no-audit --no-fund 2>&1); then
                echo "  Dependencies installed (npm install)." >&2
            else
                echo "  Warning: npm install failed or timed out. Run manually if needed." >&2
            fi
        fi
    fi

    # FLOW-07: Copy .env.example to .env if present and .env missing
    if [ -f "${worktree_dir}/.env.example" ] && [ ! -f "${worktree_dir}/.env" ]; then
        echo "  Copying .env.example to .env..." >&2
        cp "${worktree_dir}/.env.example" "${worktree_dir}/.env"
        echo "  Environment file created." >&2
    fi

    return 0
}

# Create worktree for a phase with existing detection (TREE-01, TREE-05)
create_worktree() {
    local phase="$1"
    local slug="${2:-}"

    # Auto-detect slug if not provided
    if [ -z "$slug" ]; then
        slug=$(get_phase_slug "$phase") || slug="unknown"
    fi

    local worktree_dir
    local branch
    local repo_root

    worktree_dir=$(get_worktree_dir "$phase")
    branch=$(get_branch_name "$phase" "$slug")
    repo_root=$(get_repo_root)

    # Prune stale references first (TREE-06)
    prune_stale

    # Check if worktree already exists (TREE-05)
    local existing
    existing=$(node "$GSD_TOOLS" worktree get "$phase" 2>/dev/null) || true

    if [ -n "$existing" ]; then
        local existing_path
        existing_path=$(echo "$existing" | grep -o '"path": *"[^"]*"' | cut -d'"' -f4)
        if [ -d "$existing_path" ]; then
            echo "Worktree already exists for phase $phase: $existing_path" >&2
            echo "$existing_path"
            return 0
        else
            # Registry says it exists but path is gone - clean up
            echo "Cleaning up stale registry entry for phase $phase" >&2
            node "$GSD_TOOLS" worktree remove "$phase" 2>/dev/null || true
        fi
    fi

    # Check if directory already exists on disk
    if [ -d "$worktree_dir" ]; then
        echo "Warning: Directory $worktree_dir exists but not in registry" >&2
        echo "Use 'git worktree list' to check status" >&2
        return 1
    fi

    # Acquire lock (LOCK-01, LOCK-03)
    if ! acquire_lock "$phase"; then
        return 1
    fi

    # Ensure .worktrees/ parent exists and is gitignored
    mkdir -p "$(dirname "$worktree_dir")"
    ensure_gitignore

    # Check if branch already exists
    if git show-ref --verify --quiet "refs/heads/$branch" 2>/dev/null; then
        echo "Warning: Branch $branch already exists" >&2
        # Use -B to reset existing branch instead of -b
        if ! git worktree add "$worktree_dir" -B "$branch" HEAD --lock 2>&1; then
            release_lock "$phase"
            echo "Error: Failed to create worktree" >&2
            return 1
        fi
    else
        # Create new branch (TREE-01)
        if ! git worktree add "$worktree_dir" -b "$branch" HEAD --lock 2>&1; then
            release_lock "$phase"
            echo "Error: Failed to create worktree" >&2
            return 1
        fi
    fi

    # Update registry
    node "$GSD_TOOLS" worktree add "$phase" "$worktree_dir" \
        --branch "$branch" --slug "$slug" 2>/dev/null || true

    # Run post-create hooks (FLOW-06, FLOW-07)
    run_post_create_hooks "$worktree_dir"

    echo "$worktree_dir"
    return 0
}

# Remove worktree for a phase (TREE-04)
remove_worktree() {
    local phase="$1"
    local force="${2:-}"

    local worktree_dir
    worktree_dir=$(get_worktree_dir "$phase")

    # Prune stale first
    prune_stale

    # Get worktree info from registry
    local existing
    existing=$(node "$GSD_TOOLS" worktree get "$phase" 2>/dev/null) || true

    if [ -z "$existing" ] && [ ! -d "$worktree_dir" ]; then
        echo "No worktree found for phase $phase" >&2
        return 1
    fi

    # Get branch name from registry or construct it
    local branch=""
    if [ -n "$existing" ]; then
        branch=$(echo "$existing" | grep -o '"branch": *"[^"]*"' | cut -d'"' -f4)
    fi

    # Remove git worktree (NEVER rm -rf, per research)
    if [ -d "$worktree_dir" ]; then
        echo "Removing worktree at $worktree_dir..."

        # First, unlock the worktree if it was locked with --lock
        git worktree unlock "$worktree_dir" 2>/dev/null || true

        if [ "$force" = "--force" ]; then
            git worktree remove "$worktree_dir" --force 2>&1 || {
                echo "Warning: git worktree remove --force failed" >&2
                return 1
            }
        else
            git worktree remove "$worktree_dir" 2>&1 || {
                echo "Error: Could not remove worktree. Use --force if needed." >&2
                return 1
            }
        fi
    fi

    # Delete the branch if it exists and is fully merged
    if [ -n "$branch" ]; then
        if git show-ref --verify --quiet "refs/heads/$branch" 2>/dev/null; then
            # Try to delete (only succeeds if merged)
            if git branch -d "$branch" 2>/dev/null; then
                echo "Deleted merged branch $branch"
            else
                echo "Warning: Branch $branch not deleted (not fully merged or checked out elsewhere)" >&2
            fi
        fi
    fi

    # Release lock (LOCK-02)
    release_lock "$phase" 2>/dev/null || true

    # Remove from registry
    node "$GSD_TOOLS" worktree remove "$phase" 2>/dev/null || true

    echo "Worktree for phase $phase removed."
    return 0
}

# Get path to existing worktree (TREE-03)
path_worktree() {
    local phase="$1"

    # Check registry first
    local existing
    existing=$(node "$GSD_TOOLS" worktree get "$phase" 2>/dev/null) || true

    if [ -n "$existing" ]; then
        local existing_path
        existing_path=$(echo "$existing" | grep -o '"path": *"[^"]*"' | cut -d'"' -f4)
        if [ -d "$existing_path" ]; then
            echo "$existing_path"
            return 0
        fi
    fi

    # Fallback: check standard location
    local worktree_dir
    worktree_dir=$(get_worktree_dir "$phase")
    if [ -d "$worktree_dir" ]; then
        echo "$worktree_dir"
        return 0
    fi

    echo "No worktree found for phase $phase" >&2
    return 1
}

# List all worktrees (TREE-02)
list_worktrees() {
    # Prune stale first
    prune_stale

    # Get from registry
    node "$GSD_TOOLS" worktree list 2>/dev/null || echo "[]"
}

# Show worktree status with git info
status_worktrees() {
    # Prune stale first
    prune_stale

    # Get combined status
    node "$GSD_TOOLS" worktree status 2>/dev/null || {
        echo "Registry not initialized. Run 'phase-worktree.sh init' first." >&2
        return 1
    }
}

# Initialize worktree infrastructure
init_worktrees() {
    node "$GSD_TOOLS" worktree init
    ensure_gitignore
    echo "Worktree infrastructure initialized."
}

# ============================================================================
# Command Dispatch
# ============================================================================

# Command dispatch
case "${1:-}" in
    init)
        init_worktrees
        ;;
    create)
        create_worktree "${2:?Phase number required}" "${3:-}"
        ;;
    remove)
        remove_worktree "${2:?Phase number required}" "${3:-}"
        ;;
    path)
        path_worktree "${2:?Phase number required}"
        ;;
    list)
        list_worktrees
        ;;
    status)
        status_worktrees
        ;;
    prune)
        prune_stale
        echo "Pruned stale worktree references."
        ;;
    acquire-lock)
        acquire_lock "${2:?Phase number required}"
        ;;
    release-lock)
        release_lock "${2:?Phase number required}"
        ;;
    check-stale)
        check_stale_lock "${2:?Phase number required}"
        ;;
    force-unlock)
        force_unlock "${2:?Phase number required}"
        ;;
    _test)
        _test_lock_atomicity
        ;;
    *)
        # If sourced, don't show usage
        if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
            echo "Usage: phase-worktree.sh <command> [args]"
            echo ""
            echo "Worktree Commands:"
            echo "  init                   Initialize worktree infrastructure"
            echo "  create <phase> [slug]  Create worktree for phase"
            echo "  remove <phase> [--force]  Remove worktree for phase"
            echo "  path <phase>           Get path to existing worktree"
            echo "  list                   List all worktrees (JSON)"
            echo "  status                 Show worktree status with git info"
            echo "  prune                  Prune stale worktree references"
            echo ""
            echo "Lock Commands:"
            echo "  acquire-lock <phase>   Acquire atomic lock for phase"
            echo "  release-lock <phase>   Release lock for phase"
            echo "  check-stale <phase>    Check if lock is stale"
            echo "  force-unlock <phase>   Force remove lock (recovery)"
            echo ""
            echo "Testing:"
            echo "  _test                  Run lock atomicity self-test"
            exit 1
        fi
        ;;
esac
