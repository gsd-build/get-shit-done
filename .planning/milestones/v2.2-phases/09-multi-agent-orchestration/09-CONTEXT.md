# Phase 9: Multi-Agent Orchestration - Context

**Gathered:** 2026-02-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Multiple external agents review the same artifact in parallel at workflow checkpoints, producing a single merged synthesis with source attribution. Extends Phase 8's single-agent draft-review-synthesize pattern to N agents. The workflow invokes all configured agents simultaneously, collects responses, and Claude produces a unified synthesis.

</domain>

<decisions>
## Implementation Decisions

### Parallel Invocation
- True parallel invocation via Promise.all() — all configured agents called simultaneously
- Per-agent timeouts (each agent has own timeout from config, default 120s) — one slow agent doesn't block others
- JSON array return format: `[{agent, status, response}]` — consistent with existing `--raw` pattern in gsd-tools.cjs

### Feedback Synthesis Strategy
- Per-agent blocks displayed first (same format as Phase 8), followed by a merged synthesis section
- Synthesis organized by theme (e.g., "Missing requirements", "Scope concerns") not by agent
- Bracket tag attribution inline: `[Codex, Gemini]` after each point in synthesis

### Conflict Resolution
- Claude's judgment — agents advise, Claude decides (matches Phase 8 philosophy)
- Disagreements highlighted explicitly in synthesis with resolution: "Codex suggested X but Gemini flagged scope creep — accepted with narrowed scope"
- Brief one-line rationale per override when Claude rejects an agent's suggestion

### Failure & Partial Response Handling
- Partial failure: proceed with available responses, note failures
- Total failure: skip review entirely, continue workflow with warning (graceful degradation from Phase 6)
- Inline warning at top of synthesis: "⚠ 1 of 3 agents failed (Gemini CLI: timeout)"

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

*Phase: 09-multi-agent-orchestration*
*Context gathered: 2026-02-17*
