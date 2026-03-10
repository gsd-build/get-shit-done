# GSD User Guide

A detailed reference for workflows, troubleshooting, and configuration. For quick-start setup, see the [README](../README.md).

---

## Table of Contents

- [Workflow Diagrams](#workflow-diagrams)
- [Command Reference](#command-reference)
  - [GSD Enhancements](#gsd-enhancements)
- [Configuration Reference](#configuration-reference)
- [Usage Examples](#usage-examples)
- [Troubleshooting](#troubleshooting)
- [Recovery Quick Reference](#recovery-quick-reference)

---

## Workflow Diagrams

### Full Project Lifecycle

```
  ┌──────────────────────────────────────────────────┐
  │                   NEW PROJECT                    │
  │  /gsd:new-project                                │
  │  Questions -> Research -> Requirements -> Roadmap│
  └─────────────────────────┬────────────────────────┘
                            │
             ┌──────────────▼─────────────┐
             │      FOR EACH PHASE:       │
             │                            │
             │  ┌────────────────────┐    │
             │  │ /gsd:discuss-phase │    │  <- Lock in preferences
             │  └──────────┬─────────┘    │
             │             │              │
             │  ┌──────────▼─────────┐    │
             │  │ /gsd:plan-phase    │    │  <- Research + Plan + Verify
             │  └──────────┬─────────┘    │
             │             │              │
             │  ┌──────────▼─────────┐    │
             │  │ /gsd:execute-phase │    │  <- Parallel execution
             │  └──────────┬─────────┘    │
             │             │              │
             │  ┌──────────▼─────────┐    │
             │  │ /gsd:verify-work   │    │  <- Manual UAT
             │  └──────────┬─────────┘    │
             │             │              │
             │     Next Phase?────────────┘
             │             │ No
             └─────────────┼──────────────┘
                            │
            ┌───────────────▼──────────────┐
            │  /gsd:audit-milestone        │
            │  /gsd:complete-milestone     │
            └───────────────┬──────────────┘
                            │
                   Another milestone?
                       │          │
                      Yes         No -> Done!
                       │
               ┌───────▼──────────────┐
               │  /gsd:new-milestone  │
               └──────────────────────┘
```

### Planning Agent Coordination

```
  /gsd:plan-phase N
         │
         ├── Phase Researcher (x4 parallel)
         │     ├── Stack researcher
         │     ├── Features researcher
         │     ├── Architecture researcher
         │     └── Pitfalls researcher
         │           │
         │     ┌──────▼──────┐
         │     │ RESEARCH.md │
         │     └──────┬──────┘
         │            │
         │     ┌──────▼──────┐
         │     │   Planner   │  <- Reads PROJECT.md, REQUIREMENTS.md,
         │     │             │     CONTEXT.md, RESEARCH.md
         │     └──────┬──────┘
         │            │
         │     ┌──────▼───────────┐     ┌────────┐
         │     │   Plan Checker   │────>│ PASS?  │
         │     └──────────────────┘     └───┬────┘
         │                                  │
         │                             Yes  │  No
         │                              │   │   │
         │                              │   └───┘  (loop, up to 3x)
         │                              │
         │                        ┌─────▼──────┐
         │                        │ PLAN files │
         │                        └────────────┘
         └── Done
```

### Validation Architecture (Nyquist Layer)

During plan-phase research, GSD now maps automated test coverage to each phase
requirement before any code is written. This ensures that when Claude's executor
commits a task, a feedback mechanism already exists to verify it within seconds.

The researcher detects your existing test infrastructure, maps each requirement to
a specific test command, and identifies any test scaffolding that must be created
before implementation begins (Wave 0 tasks).

The plan-checker enforces this as an 8th verification dimension: plans where tasks
lack automated verify commands will not be approved.

**Output:** `{phase}-VALIDATION.md` -- the feedback contract for the phase.

**Disable:** Set `workflow.nyquist_validation: false` in `/gsd:settings` for
rapid prototyping phases where test infrastructure isn't the focus.

### Execution Wave Coordination

```
  /gsd:execute-phase N
         │
         ├── Analyze plan dependencies
         │
         ├── Wave 1 (independent plans):
         │     ├── Executor A (fresh 200K context) -> commit
         │     └── Executor B (fresh 200K context) -> commit
         │
         ├── Wave 2 (depends on Wave 1):
         │     └── Executor C (fresh 200K context) -> commit
         │
         └── Verifier
               └── Check codebase against phase goals
                     │
                     ├── PASS -> VERIFICATION.md (success)
                     └── FAIL -> Issues logged for /gsd:verify-work
```

### Brownfield Workflow (Existing Codebase)

```
  /gsd:map-codebase
         │
         ├── Stack Mapper     -> codebase/STACK.md
         ├── Arch Mapper      -> codebase/ARCHITECTURE.md
         ├── Convention Mapper -> codebase/CONVENTIONS.md
         └── Concern Mapper   -> codebase/CONCERNS.md
                │
        ┌───────▼──────────┐
        │ /gsd:new-project │  <- Questions focus on what you're ADDING
        └──────────────────┘
```

---

## Command Reference

### Core Workflow

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/gsd:new-project` | Full project init: questions, research, requirements, roadmap | Start of a new project |
| `/gsd:new-project --auto @idea.md` | Automated init from document | Have a PRD or idea doc ready |
| `/gsd:discuss-phase [N]` | Capture implementation decisions | Before planning, to shape how it gets built |
| `/gsd:plan-phase [N]` | Research + plan + verify | Before executing a phase |
| `/gsd:execute-phase <N>` | Execute all plans in parallel waves | After planning is complete |
| `/gsd:verify-work [N]` | Manual UAT with auto-diagnosis | After execution completes |
| `/gsd:audit-milestone` | Verify milestone met its definition of done | Before completing milestone |
| `/gsd:complete-milestone` | Archive milestone, tag release | All phases verified |
| `/gsd:new-milestone [name]` | Start next version cycle | After completing a milestone |

### Navigation

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/gsd:progress` | Show status and next steps | Anytime -- "where am I?" |
| `/gsd:resume-work` | Restore full context from last session | Starting a new session |
| `/gsd:pause-work` | Save context handoff | Stopping mid-phase |
| `/gsd:help` | Show all commands | Quick reference |
| `/gsd:update` | Update GSD with changelog preview | Check for new versions |
| `/gsd:join-discord` | Open Discord community invite | Questions or community |

### Phase Management

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/gsd:add-phase` | Append new phase to roadmap | Scope grows after initial planning |
| `/gsd:insert-phase [N]` | Insert urgent work (decimal numbering) | Urgent fix mid-milestone |
| `/gsd:remove-phase [N]` | Remove future phase and renumber | Descoping a feature |
| `/gsd:list-phase-assumptions [N]` | Preview Claude's intended approach | Before planning, to validate direction |
| `/gsd:plan-milestone-gaps` | Create phases for audit gaps | After audit finds missing items |
| `/gsd:research-phase [N]` | Deep ecosystem research only | Complex or unfamiliar domain |

### Brownfield & Utilities

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/gsd:map-codebase` | Analyze existing codebase | Before `/gsd:new-project` on existing code |
| `/gsd:quick` | Ad-hoc task with GSD guarantees | Bug fixes, small features, config changes |
| `/gsd:debug [desc]` | Systematic debugging with persistent state | When something breaks |
| `/gsd:add-todo [desc]` | Capture an idea for later | Think of something during a session |
| `/gsd:check-todos` | List pending todos | Review captured ideas |
| `/gsd:settings` | Configure workflow toggles and model profile | Change model, toggle agents |
| `/gsd:set-profile <profile>` | Quick profile switch | Change cost/quality tradeoff |
| `/gsd:reapply-patches` | Restore local modifications after update | After `/gsd:update` if you had local edits |

### GSD Enhancements

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/gsd:health` | Diagnose and fix worktree health issues | Orphaned worktrees, stale locks, incomplete finalization |
| `/gsd:finalize-phase <N>` | Merge phase branch to main, cleanup worktree | After phase verification with worktree isolation enabled |
| `/gsd:sync-analyze` | Show upstream commits grouped by directory or feature | Before syncing to understand what changed |
| `/gsd:sync-preview` | Preview merge conflicts and risk assessment | Before attempting merge |
| `/gsd:sync-resolve` | Address structural conflicts (renames/deletes) | When preview shows structural issues |

**Worktree Isolation Features:**

| Feature | Description |
|---------|-------------|
| Phase Worktrees | Each phase gets its own isolated worktree with a dedicated branch |
| Lock Management | Prevents concurrent execution of the same phase across sessions |
| State Reconciliation | STATE.md merges correctly when finalizing (phase-specific changes preserved) |
| Health Monitoring | Detects orphaned worktrees, stale locks, incomplete finalization |
| Interactive Repair | Doctor-pattern diagnosis with one-at-a-time fix confirmation |
| CI Mode | `--quiet`/`--ci` returns exit codes without interactive prompts |

**Exit Codes** (for `/gsd:health --ci`):
- `0` — Healthy
- `1` — Orphaned worktrees found
- `2` — Incomplete finalization found
- `3` — Both types found
- `4+` — Runtime errors

**Upstream Sync Features (v1.1):**

| Feature | Description |
|---------|-------------|
| **Remote Configuration** | Auto-detects existing `upstream` remote or lets you configure one |
| **Cached Fetch** | 24-hour cache prevents redundant network calls; configurable via `upstream.fetch_interval` |
| **Commit Grouping** | Group by directory (default) or by conventional commit type (--by-feature) |
| **Conflict Preview** | Uses git merge-tree to predict conflicts with risk scoring (EASY/MODERATE/HARD) |
| **Binary Detection** | Categorizes binary changes as safe (images), review (archives), or dangerous (executables) |
| **Structural Conflicts** | Detects rename/delete conflicts requiring explicit acknowledgment |
| **Backup Branches** | Auto-creates `backup/pre-sync-YYYY-MM-DD-HHMMSS` before merge |
| **Atomic Rollback** | Merge failures automatically restore pre-merge state |
| **Post-Merge Verification** | Runs tests on fork-modified files to catch regressions |
| **Sync History** | All sync events logged to STATE.md with timestamps |

**Upstream Sync Workflow:**

```mermaid
flowchart LR
    subgraph Configure
        A[upstream configure] --> B[Set remote URL]
    end
    subgraph Analyze
        C[upstream fetch] --> D[upstream status]
        D --> E[/gsd:sync-analyze]
        E --> F[/gsd:sync-preview]
    end
    subgraph Resolve
        F --> G{Conflicts?}
        G -->|Yes| H[/gsd:sync-resolve]
        H --> I{All acknowledged?}
        I -->|No| H
        I -->|Yes| J[Ready to merge]
        G -->|No| J
    end
    subgraph Merge
        J --> K[upstream merge]
        K --> L[Post-merge verification]
        L --> M[Complete]
    end

    Configure --> Analyze
```

**Typical workflow:**

1. Check status: `gsd-tools upstream status`
2. Analyze changes: `/gsd:sync-analyze`
3. Preview conflicts: `/gsd:sync-preview`
4. Resolve structural issues: `/gsd:sync-resolve --ack-all` (if any)
5. Merge: `gsd-tools upstream merge`
6. Verify tests pass, or rollback if prompted

---

## Configuration Reference

GSD stores project settings in `.planning/config.json`. Configure during `/gsd:new-project` or update later with `/gsd:settings`.

### Full config.json Schema

```json
{
  "mode": "interactive",
  "depth": "standard",
  "model_profile": "balanced",
  "planning": {
    "commit_docs": true,
    "search_gitignored": false
  },
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "nyquist_validation": true
  },
  "git": {
    "branching_strategy": "phase",
    "phase_branch_template": "gsd/phase-{phase}-{slug}",
    "milestone_branch_template": "gsd/{milestone}-{slug}"
  }
}
```

### Core Settings

| Setting | Options | Default | What it Controls |
|---------|---------|---------|------------------|
| `mode` | `interactive`, `yolo` | `interactive` | `yolo` auto-approves decisions; `interactive` confirms at each step |
| `depth` | `quick`, `standard`, `comprehensive` | `standard` | Planning thoroughness: 3-5, 5-8, or 8-12 phases |
| `model_profile` | `quality`, `balanced`, `budget` | `balanced` | Model tier for each agent (see table below) |

### Planning Settings

| Setting | Options | Default | What it Controls |
|---------|---------|---------|------------------|
| `planning.commit_docs` | `true`, `false` | `true` | Whether `.planning/` files are committed to git |
| `planning.search_gitignored` | `true`, `false` | `false` | Add `--no-ignore` to broad searches to include `.planning/` |

> **Note:** If `.planning/` is in `.gitignore`, `commit_docs` is automatically `false` regardless of the config value.

### Workflow Toggles

| Setting | Options | Default | What it Controls |
|---------|---------|---------|------------------|
| `workflow.research` | `true`, `false` | `true` | Domain investigation before planning |
| `workflow.plan_check` | `true`, `false` | `true` | Plan verification loop (up to 3 iterations) |
| `workflow.verifier` | `true`, `false` | `true` | Post-execution verification against phase goals |
| `workflow.nyquist_validation` | `true`, `false` | `true` | Validation architecture research during plan-phase; 8th plan-check dimension |

Disable these to speed up phases in familiar domains or when conserving tokens.

### Git Branching

| Setting | Options | Default | What it Controls |
|---------|---------|---------|------------------|
| `git.branching_strategy` | `none`, `phase`, `milestone` | `phase` | When and how branches are created (enables worktree isolation) |
| `git.phase_branch_template` | Template string | `gsd/phase-{phase}-{slug}` | Branch name for phase strategy |
| `git.milestone_branch_template` | Template string | `gsd/{milestone}-{slug}` | Branch name for milestone strategy |

**Branching strategies explained:**

| Strategy | Creates Branch | Scope | Best For |
|----------|---------------|-------|----------|
| `none` | Never | N/A | Simple projects, when worktree isolation not needed |
| `phase` | At each `execute-phase` | One phase per branch | **Default.** Parallel execution, code review per phase, granular rollback |
| `milestone` | At first `execute-phase` | All phases share one branch | Release branches, PR per version |

**Template variables:** `{phase}` = zero-padded number (e.g., "03"), `{slug}` = lowercase hyphenated name, `{milestone}` = version (e.g., "v1.0").

### Model Profiles (Per-Agent Breakdown)

| Agent | `quality` | `balanced` | `budget` |
|-------|-----------|------------|----------|
| gsd-planner | Opus | Opus | Sonnet |
| gsd-roadmapper | Opus | Sonnet | Sonnet |
| gsd-executor | Opus | Sonnet | Sonnet |
| gsd-phase-researcher | Opus | Sonnet | Haiku |
| gsd-project-researcher | Opus | Sonnet | Haiku |
| gsd-research-synthesizer | Sonnet | Sonnet | Haiku |
| gsd-debugger | Opus | Sonnet | Sonnet |
| gsd-codebase-mapper | Sonnet | Haiku | Haiku |
| gsd-verifier | Sonnet | Sonnet | Haiku |
| gsd-plan-checker | Sonnet | Sonnet | Haiku |
| gsd-integration-checker | Sonnet | Sonnet | Haiku |

**Profile philosophy:**
- **quality** -- Opus for all decision-making agents, Sonnet for read-only verification. Use when quota is available and the work is critical.
- **balanced** -- Opus only for planning (where architecture decisions happen), Sonnet for everything else. The default for good reason.
- **budget** -- Sonnet for anything that writes code, Haiku for research and verification. Use for high-volume work or less critical phases.

---

## Usage Examples

### New Project (Full Cycle)

```bash
claude --dangerously-skip-permissions
/gsd:new-project            # Answer questions, configure, approve roadmap
/clear
/gsd:discuss-phase 1        # Lock in your preferences
/gsd:plan-phase 1           # Research + plan + verify
/gsd:execute-phase 1        # Parallel execution
/gsd:verify-work 1          # Manual UAT
/clear
/gsd:discuss-phase 2        # Repeat for each phase
...
/gsd:audit-milestone        # Check everything shipped
/gsd:complete-milestone     # Archive, tag, done
```

### New Project from Existing Document

```bash
/gsd:new-project --auto @prd.md   # Auto-runs research/requirements/roadmap from your doc
/clear
/gsd:discuss-phase 1               # Normal flow from here
```

### Existing Codebase

```bash
/gsd:map-codebase           # Analyze what exists (parallel agents)
/gsd:new-project            # Questions focus on what you're ADDING
# (normal phase workflow from here)
```

### Quick Bug Fix

```bash
/gsd:quick
> "Fix the login button not responding on mobile Safari"
```

### Resuming After a Break

```bash
/gsd:progress               # See where you left off and what's next
# or
/gsd:resume-work            # Full context restoration from last session
```

### Preparing for Release

```bash
/gsd:audit-milestone        # Check requirements coverage, detect stubs
/gsd:plan-milestone-gaps    # If audit found gaps, create phases to close them
/gsd:complete-milestone     # Archive, tag, done
```

### Speed vs Quality Presets

| Scenario | Mode | Depth | Profile | Research | Plan Check | Verifier |
|----------|------|-------|---------|----------|------------|----------|
| Prototyping | `yolo` | `quick` | `budget` | off | off | off |
| Normal dev | `interactive` | `standard` | `balanced` | on | on | on |
| Production | `interactive` | `comprehensive` | `quality` | on | on | on |

### Mid-Milestone Scope Changes

```bash
/gsd:add-phase              # Append a new phase to the roadmap
# or
/gsd:insert-phase 3         # Insert urgent work between phases 3 and 4
# or
/gsd:remove-phase 7         # Descope phase 7 and renumber
```

---

## Troubleshooting

### "Project already initialized"

You ran `/gsd:new-project` but `.planning/PROJECT.md` already exists. This is a safety check. If you want to start over, delete the `.planning/` directory first.

### Context Degradation During Long Sessions

Clear your context window between major commands: `/clear` in Claude Code. GSD is designed around fresh contexts -- every subagent gets a clean 200K window. If quality is dropping in the main session, clear and use `/gsd:resume-work` or `/gsd:progress` to restore state.

### Plans Seem Wrong or Misaligned

Run `/gsd:discuss-phase [N]` before planning. Most plan quality issues come from Claude making assumptions that `CONTEXT.md` would have prevented. You can also run `/gsd:list-phase-assumptions [N]` to see what Claude intends to do before committing to a plan.

### Execution Fails or Produces Stubs

Check that the plan was not too ambitious. Plans should have 2-3 tasks maximum. If tasks are too large, they exceed what a single context window can produce reliably. Re-plan with smaller scope.

### Lost Track of Where You Are

Run `/gsd:progress`. It reads all state files and tells you exactly where you are and what to do next.

### Need to Change Something After Execution

Do not re-run `/gsd:execute-phase`. Use `/gsd:quick` for targeted fixes, or `/gsd:verify-work` to systematically identify and fix issues through UAT.

### Model Costs Too High

Switch to budget profile: `/gsd:set-profile budget`. Disable research and plan-check agents via `/gsd:settings` if the domain is familiar to you (or to Claude).

### Working on a Sensitive/Private Project

Set `commit_docs: false` during `/gsd:new-project` or via `/gsd:settings`. Add `.planning/` to your `.gitignore`. Planning artifacts stay local and never touch git.

### GSD Update Overwrote My Local Changes

Since v1.17, the installer backs up locally modified files to `gsd-local-patches/`. Run `/gsd:reapply-patches` to merge your changes back.

### Subagent Appears to Fail but Work Was Done

A known workaround exists for a Claude Code classification bug. GSD's orchestrators (execute-phase, quick) spot-check actual output before reporting failure. If you see a failure message but commits were made, check `git log` -- the work may have succeeded.

### "Upstream not configured"

Run `/gsd:sync-analyze` and see "No upstream configured"? You need to set the upstream remote first:

```bash
gsd-tools upstream configure https://github.com/original/repo.git
```

If you already have an `upstream` remote in git, it will be auto-detected on next command.

### Sync preview shows conflicts

The `/gsd:sync-preview` command shows what would conflict if you merged now. Options:

1. **EASY conflicts:** Usually auto-resolvable, proceed with merge
2. **MODERATE conflicts:** Review the conflict regions shown, decide if you can handle
3. **HARD conflicts:** Consider cherry-picking specific commits instead, or prepare for manual resolution

After merge, if conflicts occur, resolve them normally with git tools, then `git commit`.

### Structural conflicts blocking merge

Structural conflicts (renames/deletes) require explicit acknowledgment because they can cause silent data loss.

1. Run `/gsd:sync-resolve` to see all structural conflicts
2. For each conflict, decide if you need to extract changes first
3. Acknowledge: `/gsd:sync-resolve --ack 1` (or `--ack-all` if you've reviewed all)
4. Check status: `/gsd:sync-resolve --status` confirms ready to merge

### Sync aborted or merge failed

If a sync was interrupted or merge failed, GSD automatically rolls back. To verify state:

```bash
gsd-tools upstream abort --status    # Check for in-progress merge
```

If a merge is stuck:

```bash
gsd-tools upstream abort             # Abort and restore clean state
```

To restore from a specific backup branch:

```bash
gsd-tools upstream abort --restore backup/pre-sync-2026-02-24-143052
```

### Post-merge tests failing

After merge, GSD runs verification tests on files your fork modified. If tests fail:

1. You're prompted to rollback or keep changes
2. If you rollback, state returns to pre-merge backup
3. If you keep, fix the test failures manually before committing

To see which tests would run:

```bash
gsd-tools test-discovery
```

### "Cannot sync with active worktrees"

GSD blocks sync when phase worktrees are active to protect in-progress work. Options:

1. **Complete the worktrees:** `/gsd:finalize-phase N` for each active phase
2. **Force sync (dangerous):** Use `--force` flag if you're sure worktree work won't conflict

---

## Recovery Quick Reference

| Problem | Solution |
|---------|----------|
| Lost context / new session | `/gsd:resume-work` or `/gsd:progress` |
| Phase went wrong | `git revert` the phase commits, then re-plan |
| Need to change scope | `/gsd:add-phase`, `/gsd:insert-phase`, or `/gsd:remove-phase` |
| Milestone audit found gaps | `/gsd:plan-milestone-gaps` |
| Something broke | `/gsd:debug "description"` |
| Quick targeted fix | `/gsd:quick` |
| Plan doesn't match your vision | `/gsd:discuss-phase [N]` then re-plan |
| Costs running high | `/gsd:set-profile budget` and `/gsd:settings` to toggle agents off |
| Update broke local changes | `/gsd:reapply-patches` |

---

## Project File Structure

For reference, here is what GSD creates in your project:

```
.planning/
  PROJECT.md              # Project vision and context (always loaded)
  REQUIREMENTS.md         # Scoped v1/v2 requirements with IDs
  ROADMAP.md              # Phase breakdown with status tracking
  STATE.md                # Decisions, blockers, session memory
  config.json             # Workflow configuration
  MILESTONES.md           # Completed milestone archive
  research/               # Domain research from /gsd:new-project
  todos/
    pending/              # Captured ideas awaiting work
    done/                 # Completed todos
  debug/                  # Active debug sessions
    resolved/             # Archived debug sessions
  codebase/               # Brownfield codebase mapping (from /gsd:map-codebase)
  phases/
    XX-phase-name/
      XX-YY-PLAN.md       # Atomic execution plans
      XX-YY-SUMMARY.md    # Execution outcomes and decisions
      CONTEXT.md          # Your implementation preferences
      RESEARCH.md         # Ecosystem research findings
      VERIFICATION.md     # Post-execution verification results
```
