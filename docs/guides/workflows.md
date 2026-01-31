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
