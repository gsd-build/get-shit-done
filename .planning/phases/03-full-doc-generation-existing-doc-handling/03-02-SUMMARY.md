---
phase: 03-full-doc-generation-existing-doc-handling
plan: 02
subsystem: docs
tags: [docs-update, workflow, preservation, monorepo, flags]

requires:
  - phase: 02-workflow-orchestration
    provides: 13-step docs-update.md workflow with wave-based dispatch and sequential fallback

provides:
  - commands/gsd/docs-update.md command entry point with --force and --verify-only flags
  - preservation_check step in workflow for per-file hand-written doc handling
  - dispatch_monorepo_packages step for per-package README generation
  - verify_only_report early-exit step with VERIFY marker audit
  - preservation_mode field in all doc_assignment blocks flowing to agents

affects:
  - 03-03 (agent template content — agents receive preservation_mode field)
  - Phase 4 (verify_only_report stub defers full verification)

tech-stack:
  added: []
  patterns:
    - "AskUserQuestion for per-file preservation choice with safe fallback to preserve"
    - "Literal-token flag enforcement pattern (same as execute-phase.md) for --force and --verify-only"
    - "Early-exit workflow branch for --verify-only with VERIFY marker count"
    - "Workspace glob expansion via Bash for monorepo per-package dispatch"

key-files:
  created:
    - commands/gsd/docs-update.md
    - get-shit-done/workflows/docs-update.md
  modified: []

key-decisions:
  - "preservation_check defaults to preserve when AskUserQuestion unavailable — safest default, user can use --force to override"
  - "--force takes precedence over --verify-only when both flags present in ARGUMENTS"
  - "verify_only_report is a Phase 3 stub — counts VERIFY markers only, defers full fact-checking to Phase 4 gsd-doc-verifier"
  - "dispatch_monorepo_packages runs after collect_wave_2 — per-package READMEs are post-wave work, not inline with main waves"
  - "preservation_mode field is null for new files, set to the user choice for hand-written docs"

patterns-established:
  - "Pattern: Command entry point follows execute-phase.md YAML frontmatter + XML body schema exactly"
  - "Pattern: Flag handling uses 'literal token' enforcement — flag active only when its string appears in ARGUMENTS"
  - "Pattern: Early-exit workflow branches (verify_only_report) skip all downstream steps cleanly"

requirements-completed:
  - INFRA-03
  - EXIST-01
  - EXIST-02
  - EXIST-04

duration: 8min
completed: 2026-03-30
---

# Phase 3 Plan 2: Command Entry Point, Preservation Check, and Monorepo Dispatch Summary

**docs-update command entry point with --force/--verify-only flags, per-file hand-written doc preservation choice via AskUserQuestion, and monorepo per-package README dispatch**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-30T20:12:00Z
- **Completed:** 2026-03-30T20:20:37Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `commands/gsd/docs-update.md` command entry point following execute-phase.md YAML frontmatter pattern with --force and --verify-only flag documentation using literal-token enforcement
- Extended `get-shit-done/workflows/docs-update.md` with `preservation_check` step (between resolve_modes and detect_runtime_capabilities) that prompts users per hand-written file with preserve/supplement/regenerate choice
- Added `dispatch_monorepo_packages` step (after collect_wave_2) that expands workspace globs and spawns per-package README agents with `scope: per_package`
- Added `verify_only_report` early-exit step that counts VERIFY markers across existing docs and displays Phase 4 deferral message
- Updated `preservation_mode` field into all doc_assignment blocks in dispatch_wave_1, dispatch_wave_2, and sequential_generation
- Extended sequential_generation with monorepo per-package section for Task-unavailable runtimes

## Task Commits

1. **Task 1: Create command entry point commands/gsd/docs-update.md** - `4823d28` (feat)
2. **Task 2: Add preservation_check, flag handling, and monorepo dispatch to workflow** - `f650909` (feat)

## Files Created/Modified

- `commands/gsd/docs-update.md` - Command entry point for /gsd:docs-update with YAML frontmatter, argument-hint, allowed-tools, and flag semantics
- `get-shit-done/workflows/docs-update.md` - Extended 13-step workflow + 3 new steps (preservation_check, dispatch_monorepo_packages, verify_only_report) + updated doc_assignment blocks + extended sequential path + updated success_criteria

## Decisions Made

- `preservation_check` falls back to `preserve` for all hand-written docs when AskUserQuestion is unavailable — safest default that protects user content; --force is the escape hatch
- `--force` takes precedence over `--verify-only` when both appear — documented explicitly in the objective block
- `verify_only_report` is a stub in Phase 3: counts existing VERIFY markers only, does not do full codebase fact-checking (deferred to Phase 4 gsd-doc-verifier)
- `dispatch_monorepo_packages` runs after Wave 2 collection — per-package dispatch is post-wave work, not interleaved with root-level doc generation
- `preservation_mode` is set to `null` for docs without a preservation decision (new files or GSD-generated files)

## Deviations from Plan

None — plan executed exactly as written. The workflow file did not exist in the worktree (it was in the feat/docs branch history but not merged), so it was created fresh incorporating all content from the Phase 2 baseline plus the three new additions from this plan.

## Issues Encountered

The `get-shit-done/workflows/docs-update.md` file was not present in the worktree (the worktree branch diverged from `feat/docs` before Phase 2 commits). The file content was read from the main repo and used as the base for creating the extended version in the worktree. This is expected behavior for parallel worktree execution.

## Next Phase Readiness

- Command entry point complete — users can invoke `/gsd:docs-update`, `/gsd:docs-update --force`, and `/gsd:docs-update --verify-only`
- Workflow has all 15 steps including 3 new ones for preservation, monorepo, and verify-only
- `preservation_mode` field is wired through doc_assignment blocks — Phase 3 agent template work (plan 03-01 / 03-03) can reference it
- Phase 4 verifier stub is in place — when gsd-doc-verifier is built, verify_only_report step can be extended

---
*Phase: 03-full-doc-generation-existing-doc-handling*
*Completed: 2026-03-30*
