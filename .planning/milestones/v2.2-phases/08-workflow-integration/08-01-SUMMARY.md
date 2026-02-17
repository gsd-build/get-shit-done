---
phase: 08-workflow-integration
plan: 01
subsystem: workflows
tags: [co-planner, review, requirements, roadmap, new-project, draft-review-synthesize]

# Dependency graph
requires:
  - phase: 06-foundation
    provides: coplanner invoke and coplanner agents subcommands in gsd-tools.cjs
  - phase: 07-configuration
    provides: co_planners config resolution with checkpoint-specific agent lists
provides:
  - Co-planner review sections at requirements checkpoint (Phase 7.3) in new-project.md
  - Co-planner review sections at roadmap checkpoint (Phase 8.3) in new-project.md
affects: [plan-phase, execute-phase, adversary review]

# Tech tracking
tech-stack:
  added: []
  patterns: [draft-review-synthesize, temp-file prompt construction, bordered attributed feedback blocks, accept/reject synthesis log]

key-files:
  created: []
  modified: [commands/gsd/new-project.md]

key-decisions:
  - "Used temp file approach for prompt construction to avoid shell quoting issues with multi-line artifact content"
  - "Write tool for artifact modification (not Edit) consistent with new-project.md allowed-tools"
  - "Display name mapping for agent attribution: codex->Codex, gemini->Gemini CLI, opencode->OpenCode"
  - "Acceptance criteria framework: accept (gaps, contradictions, feasibility), reject (stylistic, speculative), note (deferred, captured)"

patterns-established:
  - "Co-planner review section structure: resolve agents, skip if none, banner, per-agent loop, feedback display, synthesis, conditional commit"
  - "Three-section response format for co-planner feedback: Suggestions, Challenges, Endorsements"
  - "Checkpoint-tailored review prompts with domain-specific focus areas"

# Metrics
duration: 2min
completed: 2026-02-17
---

# Phase 8 Plan 01: Co-Planner Review in new-project.md Summary

**Draft-review-synthesize pattern at requirements and roadmap checkpoints with agent resolution, bordered feedback display, and explicit accept/reject synthesis log**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-17T15:47:42Z
- **Completed:** 2026-02-17T15:50:11Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added Phase 7.3 co-planner review section before Phase 7.5 adversary review at requirements checkpoint
- Added Phase 8.3 co-planner review section before Phase 8.5 adversary review at roadmap checkpoint
- Both sections follow identical structure with checkpoint-tailored review prompts (requirements: feasibility/gaps/conflicts/scope; roadmap: ordering/risk distribution/scope/coverage)
- Each section includes: agent resolution, skip logic, banner, per-agent invocation via temp file, error handling, bordered attributed feedback display, synthesis with accept/reject/note criteria, and conditional commit

## Task Commits

Each task was committed atomically:

1. **Task 1: Add co-planner review at requirements checkpoint (Phase 7.3)** - `84a5cf9` (feat)
2. **Task 2: Add co-planner review at roadmap checkpoint (Phase 8.3)** - `68e27de` (feat)

## Files Created/Modified
- `commands/gsd/new-project.md` - Added ~262 lines: Phase 7.3 (co-planner requirements review) and Phase 8.3 (co-planner roadmap review) sections

## Decisions Made
- Used temp file approach (`mktemp` + `cat > "$PROMPT_FILE"`) for prompt construction -- avoids shell injection and quoting issues when artifact content contains quotes, backticks, or dollar signs
- Write tool (not Edit) for artifact modification -- consistent with new-project.md's allowed-tools list which does not include Edit
- Agent display name mapping (`codex` -> "Codex", `gemini` -> "Gemini CLI", `opencode` -> "OpenCode") with title-case fallback for future adapters
- Same acceptance criteria framework for both checkpoints -- accept for gaps/contradictions/feasibility evidence, reject for stylistic/speculative/scope-expanding, note for deferred/already-captured

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 02 can proceed: plan-phase.md and execute-phase.md still need co-planner review sections at plan and verification checkpoints
- The Phase 7.3 and 8.3 pattern established here serves as the template for plan and verification checkpoints

## Self-Check: PASSED

- FOUND: 08-01-SUMMARY.md
- FOUND: 84a5cf9 (Task 1 commit)
- FOUND: 68e27de (Task 2 commit)
- FOUND: commands/gsd/new-project.md (modified file)

---
*Phase: 08-workflow-integration*
*Completed: 2026-02-17*
