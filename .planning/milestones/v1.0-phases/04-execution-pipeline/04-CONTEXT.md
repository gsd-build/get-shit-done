# Phase 4: Execution Pipeline - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

The system executes actions respecting topological order derived from the milestone structure, with parallel wave scheduling and upward verification after each wave. Execution scope is per-milestone. Integrity tracking and alignment monitoring are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Execution Model
- Same as GSD — full orchestration via `/declare:execute` slash command that spawns agents
- Slash command .md file + declare-tools.cjs subcommands, consistent with all existing Declare commands
- Execution scope is per-milestone: user picks a milestone, system runs its actions
- Atomic commits per task within a plan, exactly like GSD's executor

### Wave Scheduling
- Waves derived automatically from the action dependency graph (topological layers = execution waves)
- Independent actions within a wave execute in parallel (multiple agents spawned simultaneously)
- Auto-advance between waves by default; `--confirm` flag to pause between waves for user review
- GSD-style banners with progress indicators for wave status display

### Upward Verification
- Two-layer verification: automated checks first, then AI review for higher-level milestone advancement assessment
- Verification happens per-wave (after all actions in a wave complete), not per-action
- On failure: retry with feedback sent back to executor (max 2 retries), then surface to user
- When a milestone's last action completes and verification passes, milestone status auto-updates to DONE in MILESTONES.md

### PLAN.md Generation
- Generate full GSD-style execution plans from the action descriptions in milestone PLAN.md files
- Generated plans include GSD frontmatter (wave, depends_on, files_modified, autonomous), tasks in XML format, verification criteria
- Execution plans written to milestone folders alongside existing PLAN.md (e.g., EXEC-PLAN-01.md)
- Planner has access to full Declare DAG context (trace to declaration) so plans are grounded in purpose

### Claude's Discretion
- Plan timing: whether to generate all plans upfront or on-demand per wave
- Exact executor agent configuration and spawning patterns
- Retry strategy details within the 2-retry limit
- Verification criteria specifics for automated checks

</decisions>

<specifics>
## Specific Ideas

- "Same as GSD" — execution model, commit strategy, and visual patterns should all follow GSD's established patterns
- Planner should see the action's why-chain (declaration → milestone → action) to produce purpose-grounded plans

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-execution-pipeline*
*Context gathered: 2026-02-16*
