# Phase 8: Multi-Phase Orchestration & Lifecycle - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase completes the autonomous workflow by adding lifecycle automation (audit→complete→cleanup after all phases finish), fixing progress bar calculations on resume, and ensuring the system only pauses for explicit user decisions. The multi-phase loop and per-phase execution chain already exist from Phases 5-7.
</domain>

<decisions>
## Implementation Decisions

### Lifecycle Sequence (ORCH-04)
- After all phases complete, **automatically invoke audit→complete→cleanup** via Skill() flat calls
- **audit-milestone**: `Skill(skill="gsd:audit-milestone")` — reads all phase verifications, produces audit report
- **Audit result routing** — 3 outcomes:
  - `passed` → auto-continue to complete-milestone
  - `gaps_found` → AskUserQuestion: fix gaps / continue anyway / stop
  - `tech_debt` → show debt summary, ask if continue
- **complete-milestone**: `Skill(skill="gsd:complete-milestone")` — evolves PROJECT.md, reorganizes ROADMAP, archives milestone. Interactions surface naturally through Skill()
- **cleanup**: `Skill(skill="gsd:cleanup")` — cleanup shows dry-run and asks user for approval internally (this pause is acceptable per CTRL-01 since it's an explicit decision)
- Display lifecycle banner before starting: "All phases complete → Starting lifecycle: audit → complete → cleanup"

### Smart Discuss & CTRL-03
- **Smart discuss inline is NOT a CTRL-03 violation** — CTRL-03 means "don't modify existing skill files (discuss-phase.md, plan-phase.md, execute-phase.md)." Smart discuss is new code in autonomous.md that produces identical CONTEXT.md output
- **Keep inline in v1.24** — extraction to separate skill deferred to future milestone if needed
- **Document the relationship** — add comment in smart_discuss step noting it's an autonomous-optimized variant of discuss-phase

### Progress & Resume (CTRL-01/02)
- **Fix progress bar on resume** — calculate progress relative to total milestone phases (e.g., "Phase 6/8"), not just remaining incomplete phases
- **Gap closure auto-retry (1 attempt) is acceptable** — it's a technical retry, not an unnecessary confirmation. After 1 retry, if still failing, user decides
- **No CTRL+C trap needed** — handle_blocker's "Stop autonomous mode" + terminal's natural CTRL+C are sufficient
- **Lifecycle banner**: Show transition banner when moving from phases to lifecycle

### Claude's Discretion
- Exact lifecycle banner wording and formatting
- How to detect audit result (parse audit output or read audit file)
- Final completion banner design after lifecycle completes
- Whether to show timing summary (elapsed time for full run)
</decisions>

<code_context>
## Existing Code Insights

### Current Workflow Structure (630 lines)
1. `initialize` — parse args, bootstrap, startup banner
2. `discover_phases` — roadmap analyze, filter incomplete
3. `execute_phase` — smart discuss (3a) → plan (3b) → execute+verify (3c) → transition (3d)
4. `smart_discuss` — analyze, propose, accept, write CONTEXT.md
5. `iterate` — re-read ROADMAP, check blockers, loop or completion banner
6. `handle_blocker` — retry/skip/stop options

### iterate Step Completion Banner (lines 487-498)
Currently displays "All phases executed successfully" and suggests manual "/gsd:complete-milestone". This needs to be replaced with automatic lifecycle invocation.

### Skill Signatures for Lifecycle
- `gsd:audit-milestone` — no required args, reads `.planning/` state
- `gsd:complete-milestone` — no required args, uses current milestone context
- `gsd:cleanup` — no required args, shows dry-run and asks confirmation

### Progress Bar Calculation (execute_phase step, line ~115)
Currently: N = position among incomplete phases, T = count of incomplete phases
Should be: N = current phase number's position in all milestone phases, T = total milestone phases
</code_context>

<specifics>
## Specific References
- autonomous.md:487-498 — current completion banner (to be replaced with lifecycle)
- autonomous.md:115-119 — progress bar calculation (to be fixed for resume)
- audit-milestone.md — 331-line skill, produces audit report
- complete-milestone.md — 763-line skill, evolves PROJECT.md, archives
- cleanup.md — 153-line skill, archives phase directories
</specifics>

<deferred>
## Deferred Ideas
- Extract smart_discuss to separate skill (possible future milestone)
- CTRL+C trap with state persistence (unnecessary complexity for v1.24)
- Timing summary (elapsed time tracking — not requested by user)
</deferred>
