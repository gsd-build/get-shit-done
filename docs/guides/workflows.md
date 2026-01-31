# Common Workflows

This guide covers common GSD workflows and patterns.

## Standard Development Flow

### New Project (Greenfield)

```
/gsd:new-project
    ↓ (deep questioning, research, roadmap)
/gsd:plan-phase 1
    ↓ (creates PLAN.md files)
/gsd:execute-phase 1
    ↓ (runs plans, creates SUMMARY.md files)
/gsd:progress
    ↓ (routes to next phase)
... repeat for each phase ...
/gsd:audit-milestone
    ↓ (verify completeness)
/gsd:complete-milestone
    ↓ (archive and tag)
/gsd:new-milestone
    ↓ (start next version)
```

### Existing Codebase (Brownfield)

```
/gsd:map-codebase
    ↓ (analyze existing code)
/gsd:new-project
    ↓ (detects existing code, infers validated requirements)
... continue as greenfield ...
```

---

## Session Management

### Starting a New Session

```
/gsd:progress
```

This shows where you left off and routes to the next action.

### Pausing Work

When you need to stop mid-phase:

```
/gsd:pause-work
```

Creates `.continue-here.md` with:
- Current position
- Completed work
- Remaining work
- Decisions made
- Next action

### Resuming Work

In a new session:

```
/gsd:resume-work
```

Restores full context and routes to next action.

### Context Getting Full

If Claude's context is filling up:

```
/gsd:pause-work    # Save state
/clear             # Clear context
/gsd:resume-work   # Restore from saved state
```

---

## Phase Workflows

### Standard Phase Flow

```
/gsd:plan-phase 2
/gsd:execute-phase 2
/gsd:progress
```

### Complex Phase (With Discussion)

For phases needing clarification:

```
/gsd:discuss-phase 2
    ↓ (clarify decisions)
/gsd:plan-phase 2
    ↓ (research + planning)
/gsd:execute-phase 2
```

### Phase With User Testing

```
/gsd:execute-phase 2
/gsd:verify-work 2
    ↓ (user acceptance testing)
# If issues found:
/gsd:plan-phase 2 --gaps
/gsd:execute-phase 2 --gaps-only
/gsd:verify-work 2
```

### Surface Assumptions First

Before planning complex phases:

```
/gsd:list-phase-assumptions 3
    ↓ (review Claude's assumptions)
# Discuss and clarify
/gsd:plan-phase 3
```

---

## Gap Closure

### After Verification Finds Gaps

```
/gsd:execute-phase 2
    ↓ (verification finds gaps)
/gsd:plan-phase 2 --gaps
    ↓ (creates gap closure plans)
/gsd:execute-phase 2 --gaps-only
    ↓ (runs only gap closure plans)
/gsd:verify-work 2
    ↓ (re-verify)
```

### After User Testing Finds Issues

```
/gsd:verify-work 2
    ↓ (user reports issues)
# Issues diagnosed automatically
/gsd:plan-phase 2 --gaps
/gsd:execute-phase 2 --gaps-only
```

### After Milestone Audit

```
/gsd:audit-milestone
    ↓ (finds gaps)
/gsd:plan-milestone-gaps
    ↓ (creates new phases)
/gsd:plan-phase 7
/gsd:execute-phase 7
/gsd:audit-milestone
    ↓ (re-audit)
/gsd:complete-milestone
```

---

## Urgent Work

### Insert Urgent Phase

When critical work appears mid-milestone:

```
/gsd:insert-phase 3.1 "Critical security fix"
/gsd:plan-phase 3.1
/gsd:execute-phase 3.1
/gsd:progress
    ↓ (continues to phase 4)
```

### Quick Ad-Hoc Task

For small tasks not worth a full phase:

```
/gsd:quick "Add loading spinner to dashboard"
```

Creates quick task in `.planning/quick/` with minimal overhead.

---

## Debugging

### Systematic Debug Session

```
/gsd:debug "Login fails intermittently"
```

Creates persistent debug session with:
- Hypothesis tracking
- Evidence collection
- Root cause analysis

Debug state survives context resets.

### Diagnose UAT Issues

When user testing finds issues:

```
/gsd:verify-work 2
    ↓ (issues found)
# Parallel debug agents diagnose each issue
# Root causes added to UAT.md
/gsd:plan-phase 2 --gaps
    ↓ (targeted fix plans)
```

---

## Milestone Management

### Complete Milestone

```
/gsd:audit-milestone
    ↓ (verify all requirements)
/gsd:complete-milestone
    ↓ (archive, tag, update PROJECT.md)
```

### Start New Milestone

After completing previous milestone:

```
/gsd:new-milestone "v1.1 Notifications"
    ↓ (gather goals, research, requirements, roadmap)
/gsd:plan-phase 5
    ↓ (continues phase numbering)
```

### Handle Milestone Gaps

```
/gsd:audit-milestone
    ↓ (status: gaps_found)
/gsd:plan-milestone-gaps
    ↓ (creates gap closure phases)
/gsd:plan-phase 7
/gsd:execute-phase 7
/gsd:audit-milestone
    ↓ (re-audit until passed)
```

---

## Configuration

### Change Model Profile

For cost/quality tradeoff:

```
/gsd:set-profile budget     # Faster, cheaper
/gsd:set-profile balanced   # Default
/gsd:set-profile quality    # Best quality
```

### Full Settings

```
/gsd:settings
```

Interactive configuration of:
- Model profile
- Research agent
- Plan checker
- Verifier
- Git branching strategy

---

## Research Workflows

### Force Re-Research

If research is outdated:

```
/gsd:plan-phase 3 --research
```

### Skip Research

For simple phases:

```
/gsd:plan-phase 3 --skip-research
```

### Standalone Research

Research without planning:

```
/gsd:research-phase 3
    ↓ (creates RESEARCH.md)
# Review research
/gsd:plan-phase 3
    ↓ (uses existing research)
```

---

## Phase Management

### Add Phase at End

```
/gsd:add-phase "Admin Dashboard"
```

Adds to end of current milestone.

### Remove Future Phase

```
/gsd:remove-phase 8
```

Removes unstarted phase, renumbers subsequent phases.

### Insert Urgent Phase

```
/gsd:insert-phase 5.1 "Critical Fix"
```

Creates decimal phase between 5 and 6.

---

## Git Branching Workflows

GSD supports three branching strategies. Configure via `/gsd:settings` or `.planning/config.json`.

### Branching Strategies

| Strategy | Branch Pattern | Best For |
|----------|---------------|----------|
| `none` (default) | All work on current branch | Solo dev, simple projects |
| `phase` | `gsd/phase-{phase}-{slug}` | Code review per phase, granular rollback |
| `milestone` | `gsd/{milestone}-{slug}` | Release branches, PR per version |

### Branch-Per-Milestone Workflow

For teams wanting each milestone on a separate feature branch:

```
# 1. Configure branching strategy
/gsd:settings
# Select "Per Milestone" for branching

# 2. Create branch BEFORE planning (recommended)
git checkout -b gsd/v2.0-feature-name

# 3. Run milestone setup on this branch
/gsd:new-milestone "v2.0 Feature Name"

# 4. Plan and execute phases (all commits stay on branch)
/gsd:plan-phase 5
/gsd:execute-phase 5
... phases 6-N ...

# 5. Complete milestone (offers merge options)
/gsd:complete-milestone
# Choose: squash merge, merge with history, or keep branch
```

**Why branch before `new-milestone`?**

Branch creation only happens at `execute-phase`. If you run `new-milestone` on `main`, the planning docs (ROADMAP.md, REQUIREMENTS.md) will be committed to `main` before the milestone branch exists.

| Workflow | Planning docs land on... |
|----------|-------------------------|
| `new-milestone` on main → `execute-phase` creates branch | `main` |
| Branch first → `new-milestone` → `execute-phase` | Feature branch |

### Branch-Per-Phase Workflow

For granular code review and rollback:

```
# 1. Configure branching strategy
/gsd:settings
# Select "Per Phase" for branching

# 2. Plan phase (still on main/current branch)
/gsd:plan-phase 3

# 3. Execute phase (creates gsd/phase-03-auth branch)
/gsd:execute-phase 3

# 4. Merge phase branch (manual or via PR)
git checkout main
git merge --squash gsd/phase-03-auth
git commit -m "feat: phase 3 authentication"

# 5. Repeat for next phase
/gsd:plan-phase 4
/gsd:execute-phase 4  # Creates gsd/phase-04-dashboard
```

### Merge Options at Milestone Completion

`/gsd:complete-milestone` offers these merge strategies:

| Option | Git Command | Result |
|--------|-------------|--------|
| Squash merge (recommended) | `git merge --squash` | Single clean commit |
| Merge with history | `git merge --no-ff` | Preserves all commits |
| Delete without merging | `git branch -D` | Discard branch work |
| Keep branches | (none) | Manual handling later |

### `.planning/` Across Branches

| Config | Behavior |
|--------|----------|
| `commit_docs: true` (default) | `.planning/` is branch-specific, follows git history |
| `.planning/` gitignored | Local-only, shared across branches in same worktree |

When `.planning/` is committed, each branch has its own version of STATE.md, ROADMAP.md, etc. Merging branches also merges planning docs.

---

## Git Worktree Workflows

Git worktrees allow parallel development on multiple branches simultaneously. Each worktree has its own working directory and `.planning/` folder.

### Using Worktrees with GSD

```bash
# Create worktree for a new milestone
git worktree add ../project-v2 -b gsd/v2.0-feature

# Work in that directory
cd ../project-v2
/gsd:new-milestone "v2.0 Feature"
/gsd:plan-phase 5
/gsd:execute-phase 5

# Meanwhile, in main worktree (../project)
# Continue with bug fixes or different work
```

### Worktree Considerations

1. **Separate `.planning/` directories** — Each worktree has its own `.planning/`. They don't sync automatically.

2. **No built-in worktree management** — GSD doesn't create or manage worktrees. Use `git worktree` commands directly or the `/pando` skill if available.

3. **Branch-per-milestone works well** — Create worktree with milestone branch, all planning stays isolated.

4. **Merging brings planning together** — When you merge the milestone branch back to main, planning docs merge too (if committed).

### Parallel Milestone Development

```
main-worktree/           # Production fixes, v1.x maintenance
├── .planning/           # v1.2 hotfix milestone
└── ...

feature-worktree/        # New feature development
├── .planning/           # v2.0 milestone (independent)
└── ...
```

Each worktree operates independently. When v2.0 is ready:

```bash
cd main-worktree
git merge --squash gsd/v2.0-feature
git worktree remove ../feature-worktree
```

### When Worktrees Help

- **Parallel milestones** — Work on v2.0 while maintaining v1.x
- **Context switching** — Keep multiple features in progress without stashing
- **Long-running experiments** — Isolate experimental work
- **Code review** — Check out PR branches without disrupting main work

### When to Avoid Worktrees

- **Simple linear development** — One milestone at a time doesn't need worktrees
- **Limited disk space** — Each worktree is a full checkout
- **Shared dependencies** — `node_modules` aren't shared (disk usage multiplies)

---

## Tips for Workflows

### When to Pause

- Context usage above 70%
- End of work session
- Before complex decisions
- When switching contexts

### When to Use Discussion

- Complex UI/UX decisions
- Multiple valid approaches
- Unclear requirements
- High-stakes phases

### When to Skip Verification

For low-risk phases, disable in settings:

```
/gsd:settings
# Toggle verifier off
```

### Parallel Execution

GSD automatically parallelizes where possible:
- Wave 1 plans with no dependencies
- Multiple debug sessions
- Research agents

No manual configuration needed.
