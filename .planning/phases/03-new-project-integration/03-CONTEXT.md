# Phase 3: New-Project Integration - Context

**Gathered:** 2026-02-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Integrate adversary checkpoints into the `/gsd:new-project` workflow at two points: after REQUIREMENTS.md creation and after ROADMAP.md creation. The adversary challenges each artifact, the orchestrator resolves challenges, and the user sees a summary before their existing approval step. No new UI capabilities — this hooks into the existing flow.

</domain>

<decisions>
## Implementation Decisions

### Debate Loop UX
- Debate runs silently behind a dedicated `GSD > ADVERSARY REVIEW` banner with spinner
- After debate completes, show consolidated summary with each challenge raised, whether it was accepted/rejected, and what changed
- Summary appears *before* the existing approval step — user sees adversary-driven changes before committing
- Each checkpoint (requirements, roadmap) gets its own banner + summary cycle

### Challenge Resolution
- BLOCKING challenges always auto-revise the artifact
- MAJOR and MINOR challenges are at Claude's discretion — may revise or just note, case by case
- If max rounds (3) reached with unresolved challenges, proceed to user approval with unresolved challenges noted in summary

### User Control
- No per-challenge dismissal — existing approval step (approve/adjust/review) is sufficient for user control
- No skip option — if adversary is enabled in config, it runs. Users disable globally via `/gsd:settings`
- Adversary runs once per artifact — if user selects "Adjust" after approval, the adjusted version is final (no re-run)

### Output Integration
- Clean artifacts — REQUIREMENTS.md and ROADMAP.md contain no trace of the adversary review process
- Debate summary uses bullet list format with addressed/noted markers
- Completion banner includes brief mention: "Adversary reviewed: requirements, roadmap"

### Claude's Discretion
- Exact spinner messaging during debate
- How to structure the defense prompts to the orchestrator
- Whether to show round count in the summary ("Resolved in 2 rounds")
- MAJOR/MINOR challenge handling (revise vs. note) on a case-by-case basis

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-new-project-integration*
*Context gathered: 2026-02-13*
