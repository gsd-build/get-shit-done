# Domain Pitfalls: Git Worktree for Parallel Phase Execution

**Domain:** Git worktree management for parallel AI agent workflows
**Researched:** 2026-02-20
**Confidence:** HIGH (verified with official Git docs and multiple credible sources)

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or broken workflows.

### Pitfall 1: Orphaned Worktrees from Manual Deletion

**What goes wrong:** Developers delete worktree directories manually with `rm -rf` instead of using `git worktree remove`. Git retains stale metadata pointing to non-existent directories, which accumulates over time and can cause confusing errors.

**Why it happens:** Natural instinct to clean up directories like any other folder. The worktree directory looks like a normal project folder. Users don't realize Git tracks worktree state separately.

**Consequences:**
- `git worktree list` shows "prunable" entries with "gitdir file points to non-existent location"
- Branch may remain locked (cannot be checked out elsewhere)
- Lock files remain in `.git/worktrees/` directory
- Disk space not fully reclaimed (Git metadata persists)

**Prevention:**
- Always use `git worktree remove <path>` for cleanup
- In GSD: The `finalize-phase` workflow already wraps cleanup correctly with `git worktree remove`
- Add pre-flight check in `phase-worktree.sh` that runs `git worktree prune` on startup
- Document in workflow that manual `rm -rf` corrupts state

**Detection:**
- `git worktree list` shows entries with "prunable" annotation
- `git worktree prune --dry-run` shows what would be cleaned

**Phase to address:** Phase 1 (Core Infrastructure) - Include automatic prune on worktree operations

**Sources:**
- [Git Official Documentation](https://git-scm.com/docs/git-worktree)
- [Gotcha with git worktree and removing the worktree directory](https://musteresel.github.io/posts/2018/01/git-worktree-gotcha-removed-directory.html)

---

### Pitfall 2: Missing Dependencies in New Worktrees

**What goes wrong:** When creating a worktree, only tracked files are checked out. Everything in `.gitignore` (node_modules, .env, dist/, venv) does not exist. Agents try to run code with zero dependencies installed.

**Why it happens:** Worktrees are clean checkouts from Git, not copies of the working directory. Developers expect the new worktree to "just work" like the original.

**Consequences:**
- Immediate runtime failures when agents try to execute code
- Build commands fail silently or with cryptic errors
- Tests cannot run (no test framework installed)
- Environment variables missing (no .env file)

**Prevention:**
- **Post-checkout hook:** Create a hook that copies .env files and runs dependency installation
- **Setup script integration:** GSD's `phase-worktree.sh create` should:
  1. Create worktree
  2. Copy .env files from main repo
  3. Run `npm install` / `pip install` / etc.
  4. Validate setup before returning success
- **Configuration for copy patterns:** Allow projects to specify which files to copy (e.g., `.env*`, `.npmrc`, `.tool-versions`)

**Detection:**
- Worktree creation succeeds but subsequent commands fail
- "MODULE_NOT_FOUND" or "command not found" errors
- Empty node_modules or missing venv directory

**Phase to address:** Phase 1 (Core Infrastructure) - post-checkout setup with dependency installation

**Sources:**
- [Git Worktree .env Auto-Copy Setup](https://github.com/therohitdas/copy-env)
- [Using Git Hooks When Creating Worktrees](https://mskelton.dev/bytes/using-git-hooks-when-creating-worktrees)
- [Git Worktrees with AI Tools](https://envi.codecompose.dev/guides/git-worktrees.html)

---

### Pitfall 3: Branch Lock Conflicts

**What goes wrong:** Git only allows one worktree per branch. Attempting to create another worktree from the same branch fails with "fatal: 'branch-name' is already checked out".

**Why it happens:** Git prevents the same branch from being modified in two places simultaneously to avoid corruption. This is a safety feature, not a bug.

**Consequences:**
- Worktree creation fails unexpectedly
- Workflow scripts may exit with non-zero status
- Users confused why they can't "work on the same feature"
- Cannot delete a branch that's checked out in any worktree

**Prevention:**
- **Unique branch naming:** GSD already uses `gsd/phase-{N}-{slug}` pattern - enforce uniqueness
- **Check before create:** Before `git worktree add`, run `git worktree list` to verify branch isn't already checked out
- **Clear error messages:** Detect this specific error and provide actionable guidance ("This branch is already checked out in /path/to/worktree")
- **Consider detached HEAD for read-only operations:** For verification or review tasks, use `git worktree add --detach`

**Detection:**
- Error message: "fatal: '{branch}' is already checked out at '{path}'"
- `git worktree list` shows the branch checked out elsewhere

**Phase to address:** Phase 1 (Core Infrastructure) - branch conflict detection before creation

**Sources:**
- [Git Official Documentation](https://git-scm.com/docs/git-worktree)
- [Git Worktree: Pros, Cons, and the Gotchas Worth Knowing](https://joshtune.com/posts/git-worktree-pros-cons/)

---

### Pitfall 4: Self-Created Merge Conflicts from Parallel Agents

**What goes wrong:** Multiple agents working in separate worktrees touch the same files. When branches merge, conflicts are guaranteed. The GitButler team states: "The worktrees are separate, so you can create merge conflicts between them without knowing."

**Why it happens:** Worktrees provide file-level isolation but no coordination layer. Agents are blind to each other's changes until merge time. Common files (package.json, shared utilities, configuration) attract multiple modifications.

**Consequences:**
- Merge to main fails with conflicts
- Integration takes longer than the parallel work saved
- May require human intervention to resolve semantic conflicts
- Lost productivity from re-work

**Prevention:**
- **Task independence at planning time:** Ensure phases planned for parallel execution don't share files (GSD's wave system helps here)
- **Pre-merge conflict detection:** Before finalize-phase merge, check for conflicts:
  ```bash
  git merge-tree $(git merge-base main phase-branch) main phase-branch
  ```
- **Frequent integration:** Merge from main frequently within worktrees to reduce drift
- **File ownership patterns:** Some teams use CODEOWNERS-style rules to flag when multiple agents modify same files
- **Consider tools like Clash:** [clash-sh/clash](https://github.com/clash-sh/clash) detects potential conflicts across worktrees before merge

**Detection:**
- `git merge --no-commit --no-ff` fails with conflict markers
- Post-commit hooks that check for files modified in multiple active worktrees
- Large diff when finally merging (indicates significant drift)

**Phase to address:** Phase 3 (Finalization) - pre-merge conflict detection; Phase 1 should track which files each worktree modifies

**Sources:**
- [Codex App Worktrees Explained](https://www.verdent.ai/guides/codex-app-worktrees-explained)
- [Git worktrees for parallel AI coding agents](https://devcenter.upsun.com/posts/git-worktrees-for-parallel-ai-coding-agents/)
- [Clash - Manage merge conflicts across git worktrees](https://github.com/clash-sh/clash)

---

### Pitfall 5: Submodule Initialization Failures

**What goes wrong:** Worktrees don't automatically initialize submodules. The directories exist but are empty, causing build failures in projects using submodules.

**Why it happens:** Git official documentation states: "Multiple checkout in general is still experimental, and the support for submodules is incomplete." Worktrees require explicit submodule initialization.

**Consequences:**
- Empty directories where submodule content should be
- Build systems fail to find expected files
- Cannot move worktrees containing submodules with `git worktree move`
- Each worktree has unique submodule copies (disk space multiplication)

**Prevention:**
- **Post-checkout initialization:** After `git worktree add`, always run:
  ```bash
  git submodule update --init --recursive
  ```
- **Detect submodules in project:** Check for `.gitmodules` before worktree creation; if present, include submodule init in setup
- **Warn about disk space:** Submodules multiply per worktree (not hardlinked)
- **Avoid worktree move:** Document that `git worktree move` fails with submodules

**Detection:**
- Empty directories that should contain submodule content
- Build errors referencing missing files in submodule paths
- `git submodule status` shows uninitialized submodules (leading `-`)

**Phase to address:** Phase 1 (Core Infrastructure) - detect and handle submodules during worktree creation

**Sources:**
- [Git Worktrees: From Zero to Hero - Submodules](https://gist.github.com/ashwch/mastering-git-worktree-with-submodules)
- [Git Official Documentation - Worktree](https://git-scm.com/docs/git-worktree)

---

## Moderate Pitfalls

Issues that cause delays or confusion but are recoverable.

### Pitfall 6: Disk Space Explosion

**What goes wrong:** Disk usage multiplies rapidly with worktrees. Cursor forum users reported 9.82 GB used in a 20-minute session with a ~2GB codebase. Dependencies, build artifacts, and caches multiply per worktree.

**Why it happens:** Each worktree needs its own node_modules, build outputs, and framework caches. Bazel/Pants/Nx monorepos store gigabytes of cache data that multiplies. Old worktrees aren't cleaned up automatically.

**Prevention:**
- **Aggressive cleanup:** Remove worktrees immediately after phase finalization (GSD's finalize-phase does this)
- **Shared caches where possible:** Use npm/yarn/pnpm workspace features, shared Bazel cache
- **Disk monitoring:** Track `.git/worktrees/` size; alert when > threshold
- **Maximum active worktrees:** Enforce limit (e.g., 3-5 concurrent worktrees)
- **Auto-prune on TTL:** Worktrees unused for N days get pruned

**Detection:**
- Disk space warnings from OS
- Slow operations due to low disk
- `du -sh .git/worktrees/` shows unexpectedly large size

**Phase to address:** Phase 2 (Parallel Operations) - disk monitoring and limits

---

### Pitfall 7: Incorrect Path Resolution in Scripts/Hooks

**What goes wrong:** Git hooks and scripts that use relative paths or assume specific directory structure fail in worktrees. Worktrees have `.git` as a file (pointing to main repo) not a directory.

**Why it happens:** In worktrees, `git rev-parse --git-dir` returns `.git/worktrees/<worktree-name>`, not `.git`. Scripts using `cd "$GIT_DIR/.."` end up in `.git/worktrees/` instead of repo root.

**Prevention:**
- **Use `--git-common-dir`:** Always use `git rev-parse --git-common-dir` for main repo paths
- **Use `--show-toplevel`:** For working tree root, use `git rev-parse --show-toplevel`
- **Audit existing hooks:** Check all scripts in `.git/hooks/` for path assumptions
- **Test hooks in worktrees:** Part of QA should be running hooks from worktree context

**Detection:**
- Hooks fail with "directory not found" errors
- Scripts write files to wrong locations
- Pre-commit runs in wrong directory

**Phase to address:** Phase 1 (Core Infrastructure) - ensure all GSD scripts use correct path resolution

**Sources:**
- [Using Git Hooks When Creating Worktrees](https://mskelton.dev/bytes/using-git-hooks-when-creating-worktrees)
- [Git Official Documentation](https://git-scm.com/docs/git-worktree)

---

### Pitfall 8: IDE/Editor Confusion with Multiple Worktrees

**What goes wrong:** Editors, language servers, file watchers, and dev servers behave unexpectedly when multiple instances point at the same shared repo metadata. VS Code only added worktree support in July 2025.

**Why it happens:** IDEs index the entire project and cache metadata. Multiple instances may fight over lock files or show stale state. Language servers may not handle the worktree `.git` file format.

**Prevention:**
- **Separate VS Code workspaces:** Open each worktree as a separate workspace, not just a folder
- **Check IDE version:** Ensure VS Code >= July 2025 for native worktree support
- **Avoid JetBrains native UI:** JetBrains products have no worktree creation UI - command line only
- **Document supported editors:** Explicitly list which editors work well with worktree setup

**Detection:**
- Language server crashes or provides stale information
- Git operations in IDE show incorrect branch
- "File changed on disk" dialogs appearing unexpectedly

**Phase to address:** Documentation phase - provide IDE-specific setup guidance

**Sources:**
- [Git Worktree: Pros, Cons, and the Gotchas Worth Knowing](https://joshtune.com/posts/git-worktree-pros-cons/)
- [tree-me: Because git worktrees shouldn't be a chore](https://haacked.com/archive/2025/11/21/tree-me/)

---

### Pitfall 9: Shared Database/Resource Conflicts

**What goes wrong:** Worktrees isolate code but not runtime environment. Two agents modifying the same local database, Docker daemon, or cache directories create race conditions.

**Why it happens:** Database isolation doesn't exist at the worktree level. Ports, Docker containers, and services are system-level resources. Two agents running tests simultaneously may corrupt shared state.

**Prevention:**
- **Unique ports per worktree:** Configure each worktree to use different ports (e.g., 3001, 3002, 3003)
- **Isolated databases:** Use separate database files/containers per worktree, or use in-memory databases for tests
- **Docker compose profiles:** Each worktree uses a different compose profile with unique container names
- **Environment variable overrides:** Generate unique `.env` per worktree with port offsets

**Detection:**
- "Port already in use" errors
- Database lock errors
- Intermittent test failures that pass in isolation
- "Connection refused" to services

**Phase to address:** Phase 2 (Parallel Operations) - resource isolation strategy

**Sources:**
- [Git worktrees for parallel AI coding agents](https://devcenter.upsun.com/posts/git-worktrees-for-parallel-ai-coding-agents/)

---

## Minor Pitfalls

Annoyances that can be worked around.

### Pitfall 10: Stale Lock Files After Crashes

**What goes wrong:** If a process crashes or is killed while holding a worktree lock, the lock file remains. Subsequent operations may fail claiming the worktree is "locked by another process."

**Prevention:**
- **Lock file cleanup command:** `git worktree unlock <path>` removes stale locks
- **Add crash recovery:** GSD's worktree scripts should check for stale locks on startup
- **Lock with reason:** Use `git worktree lock --reason "message"` for intentional locks to distinguish from stale ones

**Detection:**
- `git worktree list` shows "locked" annotation on worktrees
- Operations fail with "worktree is locked" errors

---

### Pitfall 11: Remote Tracking Not Configured

**What goes wrong:** Worktrees created from remote branches don't automatically set up upstream tracking. `git pull` and `git push` fail without explicit remote specification.

**Prevention:**
- **Use `-t` flag:** When creating worktree from remote branch, use `git worktree add -t <path> <remote>/<branch>`
- **Set upstream after creation:** Run `git branch --set-upstream-to=origin/<branch>` after worktree creation
- **GSD scripts should handle:** Ensure `phase-worktree.sh` sets up tracking correctly

**Detection:**
- "There is no tracking information for the current branch" error on push/pull
- `git status` doesn't show ahead/behind count

---

### Pitfall 12: Forgetting Worktree Location

**What goes wrong:** With multiple worktrees, developers lose track of which directory is which worktree. Changes made in wrong worktree, confusion about branch state.

**Prevention:**
- **Consistent naming convention:** Use `../{repo}-{feature}` pattern for worktree paths
- **Use `git worktree list`:** Shows all worktrees with their branches and paths
- **GSD tracking:** GSD's `phase-worktree.sh status` should show current worktree map
- **Shell prompt integration:** Include worktree/branch in shell prompt

**Detection:**
- Commits appear on wrong branch
- `pwd` shows unexpected directory
- Changes don't appear in expected branch

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Core Infrastructure (Phase 1) | Orphaned worktrees, missing deps, branch conflicts | Build robust creation/cleanup scripts, include dependency setup |
| Parallel Operations (Phase 2) | Disk space explosion, resource conflicts | Add monitoring, enforce limits, isolate resources |
| Finalization (Phase 3) | Merge conflicts, incomplete cleanup | Pre-merge conflict detection, verify cleanup completed |
| Integration with execute-phase | Path resolution in scripts | Use `--show-toplevel` and `--git-common-dir` |
| Integration with finalize-phase | Cleanup after merge failure | Handle partial states, manual recovery instructions |

## GSD-Specific Considerations

Based on the existing GSD codebase:

1. **`execute-phase.md` already references `phase-worktree.sh`:** The workflow expects this script to exist in `.planning/scripts/`. Ensure the script handles all pitfalls above.

2. **`finalize-phase.md` handles cleanup correctly:** Uses `git worktree remove` not manual deletion. Verify the error handling for partial failures.

3. **No rollback mechanism (from CONCERNS.md):** If phase execution fails partway, worktree may be left in inconsistent state. Consider git-based checkpoints before risky operations.

4. **Path hardcoding (from CONCERNS.md):** Worktree scripts must not assume `~/.claude/` paths work the same in worktrees. Use dynamic path resolution.

5. **State.md field updates fragile (from CONCERNS.md):** Ensure STATE.md updates work correctly from worktree context, not just main repo.

## Sources

- [Git Official Documentation - git-worktree](https://git-scm.com/docs/git-worktree) - HIGH confidence
- [Git Worktree: Pros, Cons, and the Gotchas Worth Knowing](https://joshtune.com/posts/git-worktree-pros-cons/) - MEDIUM confidence
- [Git worktrees for parallel AI coding agents](https://devcenter.upsun.com/posts/git-worktrees-for-parallel-ai-coding-agents/) - MEDIUM confidence
- [Using Git Worktrees for Parallel AI Development](https://stevekinney.com/courses/ai-development/git-worktrees) - MEDIUM confidence
- [Clash - Manage merge conflicts across git worktrees](https://github.com/clash-sh/clash) - MEDIUM confidence
- [Git Worktree .env Auto-Copy Setup](https://github.com/therohitdas/copy-env) - MEDIUM confidence
- [Using Git Hooks When Creating Worktrees](https://mskelton.dev/bytes/using-git-hooks-when-creating-worktrees) - MEDIUM confidence
- [Git Worktrees: The Complete Guide for 2026](https://devtoolbox.dedyn.io/blog/git-worktrees-complete-guide) - MEDIUM confidence
- [Codex App Worktrees Explained](https://www.verdent.ai/guides/codex-app-worktrees-explained) - MEDIUM confidence

---

*Pitfalls audit: 2026-02-20*
