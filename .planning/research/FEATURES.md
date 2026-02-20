# Feature Landscape: Git Worktree Workflow Integration

**Domain:** Parallel development workflow management for AI-assisted coding
**Researched:** 2026-02-20
**Overall Confidence:** HIGH (based on Claude Code docs, git official docs, established tooling patterns)

## Executive Summary

Git worktree support for GSD enables isolated parallel phase execution — multiple AI agents can work on different phases simultaneously without file conflicts. The feature landscape divides into worktree lifecycle management (create, switch, cleanup), state isolation (dependencies, configuration), session management (persistence, resume), and finalization (merge, cleanup).

The ecosystem has matured significantly with AI coding tools driving adoption. Tools like [gwq](https://github.com/d-kuro/gwq), [worktrunk](https://github.com/max-sixty/worktrunk), and [git-worktree-runner](https://github.com/coderabbitai/git-worktree-runner) provide reference implementations. Claude Code has [native worktree support](https://code.claude.com/docs/en/common-workflows) via the `--worktree` flag.

---

## Table Stakes

Features users expect. Missing = worktree isolation feels broken or incomplete.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **Worktree creation** | Core functionality — create isolated working directory for a phase | Low | git 2.15+ | `git worktree add <path> -b <branch>` |
| **Worktree listing** | Know what's active across the repository | Low | None | `git worktree list` with metadata |
| **Worktree removal** | Clean up completed work | Low | None | Must use `git worktree remove`, not `rm -rf` |
| **Branch-per-phase isolation** | Each phase gets its own branch in its own directory | Low | Worktree creation | Core value proposition |
| **Lock management** | Prevent concurrent access to same phase | Medium | None | Git has built-in `--lock` but needs surfacing |
| **Existing worktree detection** | Don't recreate what exists — switch to it | Low | Worktree listing | `status` command before `create` |
| **Path derivation** | Consistent, predictable worktree locations | Low | None | Pattern: `.worktrees/phase-{N}-{slug}` or similar |
| **Current worktree awareness** | Know which worktree you're in | Low | None | `git worktree list --porcelain` parsing |
| **Return to main repo** | Navigate back to main working tree | Low | Current awareness | Path stored in worktree metadata |
| **Merge to main** | Integrate completed phase work | Medium | Branch exists, tests pass | Standard git merge with `--no-ff` |
| **Branch cleanup after merge** | Delete merged phase branches | Low | Successful merge | `git branch -d` (safe delete) |
| **Stale worktree pruning** | Clean up orphaned worktree references | Low | None | `git worktree prune` |

### Table Stakes Rationale

These features are baseline because:
1. **Git provides them natively** — just needs wrapper scripts
2. **Every worktree tool implements them** — gwq, worktrunk, gtr all have these
3. **Claude Code expects them** — `/resume` picker shows sessions from same repo worktrees
4. **Without them, worktrees are painful** — manual paths, forgotten branches, stale refs

---

## Differentiators

Features that set GSD's worktree support apart. Not expected, but highly valued.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Post-create hooks** | Auto-run setup after worktree creation (npm install, env copy) | Medium | Worktree creation | [gtr pattern](https://github.com/coderabbitai/git-worktree-runner): `.gtrconfig` with `postCreate` |
| **Pre-merge hooks** | Run tests/linting before allowing merge | Medium | Merge workflow | Worktrunk has `pre_merge` hooks |
| **Post-merge cleanup automation** | One command: merge + prune + delete branch + remove worktree | Medium | Merge, removal | What `/gsd:finalize-phase` should do |
| **Configuration file copying** | Copy `.env.example`, `.vscode/settings.json` to new worktrees | Medium | Post-create hooks | Pattern: `.worktreeinclude` or `gtrconfig` glob patterns |
| **Parallel phase status dashboard** | View all active phases, their status, branch names at once | Medium | Worktree listing | gwq has `-v` verbose and `--json` output |
| **Session persistence per worktree** | Resume AI conversations in specific worktree context | High | GSD state management | Claude Code does this natively; GSD STATE.md per worktree |
| **Automatic dependency isolation** | Handle node_modules per worktree efficiently | High | Post-create hooks | [pnpm symlinks](https://akshay-na.medium.com/pnpm-streamlining-javascript-development-in-conjunction-with-git-worktree-8286a046e3c0) help; consider symlink strategy |
| **Worktree health checks** | Detect stale, locked, or corrupt worktrees | Medium | Worktree listing | Useful for long-running projects |
| **Cross-worktree state sync** | Keep `.planning/` state visible across all worktrees | High | State management | Challenge: `.planning/` is in repo but changes per-phase |
| **Integration with `/gsd:progress`** | Show worktree status in progress display | Low | Progress workflow | Enhances existing workflow |
| **Tmux/terminal integration** | Spawn worktrees in new terminal panes | Medium | OS integration | [workmux](https://github.com/raine/workmux) pattern |
| **PR creation from worktree** | Create GitHub PR directly from phase branch | Low | gh CLI | Aligns with finalization workflow |

### Differentiator Rationale

These go beyond basic worktree management:
1. **Hooks reduce manual setup** — every tool implements them differently; GSD can integrate with existing workflows
2. **Dashboard enables oversight** — parallel work needs visibility
3. **Cleanup automation is the killer feature** — the manual cleanup dance is the #1 worktree pain point

---

## Anti-Features

Features to explicitly NOT build. These create complexity without proportional value or conflict with GSD's design philosophy.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Shared node_modules symlinks** | Breaks when branches have different dependencies; creates subtle bugs | Each worktree runs `npm ci` independently; use pnpm for space efficiency |
| **Automatic concurrent merges** | Merge conflicts require human judgment; auto-merge causes data loss | Merge one phase at a time; surface conflicts clearly |
| **GUI/web worktree manager** | Violates GSD's CLI-first design; adds maintenance burden | Good CLI + clear output; let external tools (VS Code, GitKraken) add GUI |
| **Worktree templates** | Over-engineering; branches already have the repo content | Use post-create hooks for additional setup |
| **Cross-worktree file watching** | Complex, race-prone, unclear semantics | Each worktree is independent; sync via git push/pull |
| **Automatic rebase onto main** | Dangerous when done automatically; can rewrite history | Manual rebase before finalization; warn about divergence |
| **Worktree-specific git config** | Confusing; per-repo config should be consistent | Use `.gsd/worktree-config` for GSD-specific settings, not git config |
| **Transparent worktree switching** | Switching context silently breaks mental model | Explicit `cd` to worktree; clear indication of current worktree |
| **Built-in AI session management** | Claude Code already handles this; duplicating causes conflicts | Rely on `/resume` and native session persistence |

### Anti-Feature Rationale

1. **Shared dependencies** — [every guide warns against this](https://devtoolbox.dedyn.io/blog/git-worktrees-complete-guide); "Dependency Isolation: Run 'npm install' in each worktree"
2. **Auto-merge** — "eventually, these outputs must be integrated, which can lead to complex logical conflicts"
3. **GUI** — GSD is CLI-first; let the ecosystem handle visual tools
4. **Session management** — "Sessions are stored per project directory. The /resume picker shows sessions from the same git repository, including worktrees" — Claude Code handles this

---

## Feature Dependencies

```
                    [Worktree Creation]
                           |
              +------------+------------+
              |            |            |
    [Path Derivation]  [Lock Mgmt]  [Branch Creation]
              |            |            |
              +-----+------+            |
                    |                   |
           [Worktree Detection] -------+
                    |
                    v
           [Current Awareness]
                    |
         +---------+---------+
         |                   |
[Return to Main]    [Post-Create Hooks]
                             |
                   +---------+---------+
                   |                   |
          [Config Copying]    [Dependency Install]


         [Phase Execution in Worktree]
                    |
                    v
              [Verification]
                    |
                    v
           [Pre-Merge Hooks]
                    |
                    v
            [Merge to Main]
                    |
         +---------+---------+
         |                   |
[Branch Cleanup]    [Worktree Removal]
         |                   |
         +--------+----------+
                  |
                  v
         [Stale Pruning]
```

### Dependency Chain Summary

1. **Creation flow:** path derivation → detection → creation → lock → hooks
2. **Execution flow:** current awareness → phase execution → verification
3. **Finalization flow:** pre-merge hooks → merge → branch delete → worktree remove → prune

---

## MVP Recommendation

### Must Have (Phase 1 — Core Isolation)

1. **Worktree lifecycle** — create, list, remove, path derivation
2. **Phase branch mapping** — each phase gets `phase-{N}-{slug}` branch
3. **Lock management** — prevent concurrent phase execution
4. **Existing worktree detection** — switch instead of recreate
5. **Basic cleanup** — remove worktree and branch after merge

These are table stakes. Without them, worktree isolation doesn't work.

### Should Have (Phase 2 — Workflow Integration)

6. **Post-create hooks** — run `npm install`, copy `.env.example`
7. **Finalize workflow** — merge + cleanup in one command
8. **Progress integration** — show worktree status in `/gsd:progress`
9. **Pre-merge verification** — run tests before allowing merge

These make worktrees pleasant to use rather than just functional.

### Nice to Have (Phase 3 — Polish)

10. **Status dashboard** — view all active worktrees and their state
11. **Health checks** — detect stale or corrupt worktrees
12. **PR creation** — create GitHub PR from finalization

These are convenience features that can be added incrementally.

### Defer Indefinitely

- Shared dependencies
- GUI management
- Cross-worktree file watching
- Automatic rebasing

---

## Complexity Assessment

| Feature Category | Estimated Effort | Risk Level | Notes |
|------------------|------------------|------------|-------|
| Worktree lifecycle (create/list/remove) | Low | Low | Git handles heavy lifting |
| Lock management | Medium | Low | File-based locks are simple |
| Hook system | Medium | Medium | Need to define config format |
| Finalization workflow | Medium | Medium | Merge conflicts need handling |
| State synchronization | High | High | `.planning/` visibility across worktrees |
| Dashboard/status | Medium | Low | Mostly presentation |

---

## Sources

### Official Documentation
- [Git Worktree Documentation](https://git-scm.com/docs/git-worktree)
- [Claude Code Common Workflows](https://code.claude.com/docs/en/common-workflows)

### Reference Implementations
- [gwq - Git worktree manager with fuzzy finder](https://github.com/d-kuro/gwq)
- [Worktrunk - CLI for Git worktree management](https://github.com/max-sixty/worktrunk)
- [git-worktree-runner - CodeRabbit's worktree tool](https://github.com/coderabbitai/git-worktree-runner)
- [git-worktree-toolbox - MCP server and CLI](https://github.com/ben-rogerson/git-worktree-toolbox)

### Best Practices Guides
- [Git Worktrees: The Complete Guide for 2026](https://devtoolbox.dedyn.io/blog/git-worktrees-complete-guide)
- [How Git Worktrees Changed My AI Agent Workflow](https://nx.dev/blog/git-worktrees-ai-agents)
- [Git Worktree Best Practices](https://gist.github.com/ChristopherA/4643b2f5e024578606b9cd5d2e6815cc)

### AI-Specific Workflows
- [Git Worktrees with Claude Code: The Complete Guide](https://notes.muthu.co/2026/02/git-worktrees-with-claude-code-the-complete-guide/)
- [Parallel Development with Git Worktree for Cursor & Claude Code](https://engineering.zenity.io/p/parallel-development-with-git-worktree-for-cursor-claude-code)
- [Using Git Worktrees for Parallel AI Development](https://stevekinney.com/courses/ai-development/git-worktrees)

### Pitfalls and Anti-Patterns
- [Git Worktree: Pros, Cons, and the Gotchas Worth Knowing](https://joshtune.com/posts/git-worktree-pros-cons/)
- [pnpm with Git Worktree](https://akshay-na.medium.com/pnpm-streamlining-javascript-development-in-conjunction-with-git-worktree-8286a046e3c0)

---

*Feature landscape analysis: 2026-02-20*
