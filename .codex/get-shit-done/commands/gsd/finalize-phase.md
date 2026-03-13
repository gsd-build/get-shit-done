---
name: gsd:finalize-phase
description: Finalize a phase: verify gates (UAT, tests, verification), merge to main, cleanup worktree
argument-hint: "<phase-number>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - AskUserQuestion
---
<objective>
Finalize a completed phase by verifying all quality gates, merging the phase branch to main, and cleaning up the git worktree.

**Quality Gates:**
1. UAT passed (or verification-only for infra phases)
2. Tests pass (if test suite exists)
3. Verification passed (no gaps)

**Actions:**
1. Merge phase branch to main (no-ff)
2. Remove worktree directory
3. Release phase lock
4. Update STATE.md
</objective>

<execution_context>
@gsd/get-shit-done/workflows/finalize-phase.md
@gsd/get-shit-done/references/ui-brand.md
</execution_context>

<context>
Phase: {{GSD_ARGS}}

@.planning/ROADMAP.md
@.planning/STATE.md
</context>

<process>
Execute the finalize-phase workflow from @gsd/get-shit-done/workflows/finalize-phase.md end-to-end.

**Gate Order:**
1. Check UAT status -> must be "passed"
2. Check Verification status -> must be "passed"
3. Run tests -> must pass (or not exist)
4. Merge to main -> must succeed
5. Cleanup worktree -> remove and release lock
6. Update state -> record finalization

Stop at first gate failure and report what needs to be fixed.
</process>
