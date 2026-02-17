# Phase 8: Workflow Integration - Context

**Gathered:** 2026-02-17
**Status:** Ready for planning

<domain>
## Phase Boundary

External agents participate as co-planners at workflow checkpoints with clear, attributed feedback that Claude synthesizes. The draft-review-synthesize pattern works at all four checkpoint types (requirements, roadmap, plan, verification). Claude always makes the final decision — external input visibly informs but does not dictate the outcome. Multi-agent orchestration (parallel review, merged synthesis) is Phase 9.

</domain>

<decisions>
## Implementation Decisions

### Checkpoint scope & focus
- All four checkpoint types get external agent review: requirements, roadmap, plan, verification
- Tailored review prompt per checkpoint type:
  - Requirements: feasibility & gaps
  - Roadmap: ordering & risk distribution
  - Plan: completeness & wiring
  - Verification: coverage & blind spots
- Co-planners run first (refine), adversary runs second (challenge) — consistent with Phase 7 design

### Feedback display & attribution
- Per-agent blocks — each agent's feedback shown in its own attributed section
- Bordered sections with agent name header (e.g., `─── Codex Feedback ───`), consistent with existing GSD visual style
- Explicit accept/reject log — Claude shows which suggestions were accepted and which were rejected with brief reasoning

### Synthesis behavior
- All feedback is advisory — Claude always makes the final decision
- Modify artifact directly based on accepted feedback — no separate synthesis document
- Claude uses judgment to resolve conflicts between agents, explains reasoning in the accept/reject log

### Failure & degradation
- Continue with warning on agent failure — log the failure, show warning, proceed with Claude's own review
- No circuit breaker — each checkpoint invocation is independent, Phase 6 handles per-invocation errors
- Single global timeout from `co_planners.timeout_ms` (120s default) for all checkpoints

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

*Phase: 08-workflow-integration*
*Context gathered: 2026-02-17*
