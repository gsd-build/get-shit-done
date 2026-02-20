# Project Research Summary

**Project:** GSD Worktree Isolation
**Domain:** Git worktree management for parallel AI-assisted phase execution
**Researched:** 2026-02-20
**Confidence:** HIGH

## Executive Summary

Git worktree is the proven solution for parallel branch isolation in AI-assisted development workflows. The technology is mature (Git 2.5+, with `--lock` flag in 2.17+), requires zero external dependencies, and integrates naturally with GSD's existing phase-based execution model. The existing `execute-phase.md` and `finalize-phase.md` workflows already reference worktree operations but lack implementation — this project fills that gap with a `phase-worktree.sh` script and gsd-tools extensions.

The recommended approach is a shell-native implementation using atomic `git worktree add --lock` for creation, directory-based locks (`mkdir` is POSIX-atomic) for coordination, and a JSON registry for worktree tracking. Each phase gets its own branch (`gsd/phase-{N}-{slug}`) in a sibling directory. The architecture adds four components: Worktree Manager (shell script), Lock Registry (JSON file), Registry (worktree paths), and State Reconciliation (merge algorithm for STATE.md).

The primary risks are merge conflicts from parallel work, orphaned worktrees from improper cleanup, and missing dependencies in new worktrees. These are mitigated by: (1) planning wave-based parallelism to minimize file overlap, (2) mandatory `git worktree remove` via finalize-phase, and (3) post-create hooks that run `npm install` and copy `.env` files. The implementation should proceed in four phases: Foundation, Workflow Integration, State Reconciliation, and Polish.

## Key Findings

### Recommended Stack

The stack is minimal by design: native Git commands wrapped in POSIX shell scripts. No Node.js runtime, no external dependencies, no wrapper libraries.

**Core technologies:**
- **git worktree (Git 2.17+):** Branch isolation — built-in, shared .git objects, instant creation, `--lock` flag for atomic locking
- **POSIX shell (bash):** Automation scripts — zero dependencies, works everywhere, aligns with GSD's constraint compliance
- **Directory-based locks (mkdir):** Parallel coordination — atomic on all platforms, survives crashes better than flock
- **JSON registry:** Worktree tracking — explicit state beats parsing `git worktree list` output

**Critical commands:**
- `git worktree add <path> -b <branch> <start-point> --lock` — atomic create + lock
- `git worktree list --porcelain` — machine-readable status
- `git worktree remove <path> --force` — safe cleanup
- `git worktree prune` — metadata cleanup

### Expected Features

**Must have (table stakes):**
- Worktree lifecycle: create, list, remove, path derivation
- Branch-per-phase isolation with unique naming (`gsd/phase-{N}-{slug}`)
- Lock management to prevent concurrent phase execution
- Existing worktree detection (switch instead of recreate)
- Basic cleanup: remove worktree and branch after merge

**Should have (differentiators):**
- Post-create hooks: auto-run `npm install`, copy `.env.example`
- Post-merge cleanup automation (merge + prune + delete branch + remove worktree)
- Progress integration: show worktree status in `/gsd:progress`
- Pre-merge verification: run tests before allowing merge

**Defer (v2+):**
- Shared node_modules symlinks (breaks with different branch deps)
- GUI/web worktree manager (violates CLI-first design)
- Cross-worktree file watching (complex, race-prone)
- Automatic rebasing (dangerous when automated)
- Built-in AI session management (Claude Code handles this natively)

### Architecture Approach

The architecture adds a thin wrapper layer around Git worktree operations, integrated with existing GSD workflows. Worktrees are created as siblings to the main repo (predictable paths, no nested `.gitignore` complexity) and tracked via a JSON registry in `.planning/worktrees/`. STATE.md in worktrees diverges from main repo during execution, requiring reconciliation on merge.

**Major components:**
1. **Worktree Manager** (`phase-worktree.sh`) — create, list, status, path, remove worktrees; manage Git-level locks
2. **Lock Registry** (`.planning/worktrees/locks/`) — directory-based locks prevent concurrent phase execution
3. **Registry** (`.planning/worktrees/registry.json`) — track active worktrees with paths, branches, status
4. **State Reconciliation** (gsd-tools command) — merge STATE.md from worktree with main repo on finalization

**Data flow:**
1. `/gsd:execute-phase N` triggers lock acquisition + worktree creation
2. Executor agents run plans in isolated worktree, committing to phase branch
3. `/gsd:finalize-phase N` runs verification, merges to main, reconciles STATE.md, removes worktree

### Critical Pitfalls

1. **Orphaned worktrees from manual deletion** — Never `rm -rf` a worktree directory. Always use `git worktree remove`. Include automatic `git worktree prune` on startup of worktree operations.

2. **Missing dependencies in new worktrees** — Worktrees are clean checkouts; node_modules and .env don't exist. Implement post-create hooks that copy environment files and run `npm install` before returning success.

3. **Branch lock conflicts** — Git only allows one worktree per branch. Check `git worktree list` before creation; provide clear error messages with worktree location.

4. **Self-created merge conflicts from parallel agents** — Worktrees isolate files but not coordination. Mitigate via: wave-based planning to minimize file overlap, pre-merge conflict detection with `git merge-tree`, and tracking which files each worktree modifies.

5. **Path resolution failures in scripts** — Worktree `.git` is a file, not a directory. Use `git rev-parse --show-toplevel` for repo root, `git rev-parse --git-common-dir` for main repo paths.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation (Core Infrastructure)

**Rationale:** Lock mechanism and registry must exist before any worktree operations. These can be built and tested without modifying existing workflows.

**Delivers:**
- Directory-based locks in `.planning/worktrees/locks/`
- JSON registry for worktree tracking
- `phase-worktree.sh` with create, status, path, remove, list commands
- gsd-tools worktree subcommands

**Addresses:** Worktree lifecycle (table stakes), lock management, existing worktree detection

**Avoids:** Orphaned worktrees (automatic prune), branch conflicts (pre-flight check), path resolution (use `--show-toplevel`)

### Phase 2: Workflow Integration

**Rationale:** With foundation complete, update existing workflows to use worktree operations. Requires Phase 1 complete for testing.

**Delivers:**
- Updated `execute-phase.md` with worktree creation on `branching_strategy: "phase"`
- Updated `finalize-phase.md` with state reconciliation and cleanup
- Post-create hooks for dependency installation and env file copying

**Uses:** phase-worktree.sh commands, gsd-tools worktree commands

**Implements:** Worktree Manager integration, Lock Registry coordination

**Avoids:** Missing dependencies (post-create hooks), incomplete cleanup (gsd-tools remove)

### Phase 3: State Reconciliation

**Rationale:** STATE.md divergence handling is complex and benefits from testing integration in Phase 2. Edge cases need careful handling.

**Delivers:**
- `gsd-tools state reconcile` command
- Merge algorithm: worktree wins for phase-specific, main wins for global
- Conflict handling with manual resolution steps

**Implements:** State Reconciliation component

**Avoids:** Silent state loss (reconciliation preserves both sides), merge conflict confusion (clear conflict markers)

### Phase 4: Polish and Recovery

**Rationale:** Recovery commands and documentation are polish; core functionality must be stable first.

**Delivers:**
- `worktree cleanup --stale` command for orphaned worktree recovery
- `worktree repair` for crash recovery
- Show active worktrees in `/gsd:progress`
- Documentation and IDE setup guidance

**Addresses:** Worktree health checks, status dashboard (differentiators)

### Phase Ordering Rationale

- **Foundation first:** All other phases depend on lock mechanism and registry working correctly
- **Integration before reconciliation:** Need working workflows to test reconciliation in context
- **State reconciliation separate:** Algorithm is straightforward but edge cases (parallel updates to main, merge conflicts) need focused attention
- **Polish last:** Recovery tools are valuable but not blocking for core functionality

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 3 (State Reconciliation):** STATE.md merge algorithm has edge cases — need to enumerate scenarios where main and worktree both have changes. Consider testing with simulated parallel sessions.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Foundation):** Git worktree commands well-documented; directory locks are proven pattern
- **Phase 2 (Workflow Integration):** Existing workflows already have placeholder logic; integration points are clear
- **Phase 4 (Polish):** Standard recovery patterns; mainly implementation work

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official Git documentation, Git 2.17+ widely available |
| Features | HIGH | Multiple reference implementations (gwq, worktrunk, gtr) confirm feature landscape |
| Architecture | HIGH | Follows existing GSD patterns; worktree is wrapper, not core change |
| Pitfalls | HIGH | Verified with Git docs; well-documented failure modes with clear prevention |

**Overall confidence:** HIGH

### Gaps to Address

- **Stale lock recovery TTL:** Research suggests 24 hours + no process holding it, but needs validation for GSD's usage patterns. Decide during Phase 1 implementation.

- **Partial merge handling:** What if merge has conflicts? Recommendation is stop + present manual resolution + do not auto-cleanup. Needs explicit workflow documentation.

- **Submodule support:** Git docs note "support for submodules is incomplete" in worktrees. If GSD projects use submodules, add `git submodule update --init --recursive` to post-create hooks.

- **Disk space monitoring:** Research shows 9.82 GB used in 20-minute session with large codebase. Consider adding disk space check before worktree creation; defer to Phase 4 if not blocking.

## Sources

### Primary (HIGH confidence)
- [Git Worktree Official Documentation](https://git-scm.com/docs/git-worktree) — command reference, `--lock` flag, `--porcelain` format
- [Git Commit 507e6e9](https://github.com/git/git/commit/507e6e9eecce5e7a2cc204c844bbb2f9b17b31e3) — `--lock` option with add

### Secondary (MEDIUM confidence)
- [gwq](https://github.com/d-kuro/gwq), [worktrunk](https://github.com/max-sixty/worktrunk), [git-worktree-runner](https://github.com/coderabbitai/git-worktree-runner) — reference implementations
- [How Git Worktrees Changed My AI Agent Workflow](https://nx.dev/blog/git-worktrees-ai-agents) — AI workflow patterns
- [Git Worktrees: The Complete Guide for 2026](https://devtoolbox.dedyn.io/blog/git-worktrees-complete-guide) — comprehensive guide
- [Git Worktree: Pros, Cons, and the Gotchas Worth Knowing](https://joshtune.com/posts/git-worktree-pros-cons/) — pitfall documentation
- [Git worktrees for parallel AI coding agents](https://devcenter.upsun.com/posts/git-worktrees-for-parallel-ai-coding-agents/) — resource isolation patterns

### Tertiary (context only)
- GSD codebase analysis: existing execute-phase.md and finalize-phase.md workflows
- Claude Code documentation: native worktree support via `--worktree` flag

---
*Research completed: 2026-02-20*
*Ready for roadmap: yes*
