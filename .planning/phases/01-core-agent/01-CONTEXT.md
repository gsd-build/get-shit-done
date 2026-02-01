# Phase 1: Core Agent - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement gsd-adversary agent that can be spawned via Task tool to challenge artifacts (requirements, roadmaps, plans, verification reports) with structured, constructive feedback. Returns severity-classified challenges and convergence recommendations.

</domain>

<decisions>
## Implementation Decisions

### Challenge Structure
- Severity semantics: BLOCKING = cannot proceed (hard stop), must be resolved before moving forward
- Challenge volume: No limit — surface everything found, let the debate filter importance
- Structure format: Claude's discretion based on existing agent patterns
- Output format: Claude's discretion based on how other GSD agents return output

### Checkpoint Adaptation
- Requirements checkpoint: Challenge both feasibility AND completeness
- Roadmap checkpoint: Challenge both phase ordering AND requirement coverage
- Plan checkpoint: Challenge both task completeness AND risk/edge cases
- Verification checkpoint: Challenge both conclusions AND blind spots
- Challenge categories: Checkpoint-specific (not universal categories across all checkpoints)
- Memory model: Stateless — each round is fresh, sees only current artifact and defense
- Context & intensity per checkpoint: Claude's discretion

### Convergence Logic
- Decision authority: Adversary recommends converge/continue, spawning command decides
- Recommendation format: Include rationale explaining why continue or converge
- Convergence signals: Claude's discretion on what indicates readiness
- Empty challenge handling: Always find at least one challenge — nothing is perfect

### Tone & Intensity
- Role: Pure adversary — only surface problems, never acknowledge strengths
- Suggestions: Issues only — surface the problem, let defender figure out fix
- Constructive criteria: Challenges must be BOTH specific AND grounded in artifact evidence
- Aggression level: Claude's discretion

### Claude's Discretion
- Challenge structure format (title + description + severity, or other pattern)
- Output format returned to spawner (markdown vs structured)
- Intensity distribution across checkpoints
- What project context to provide per checkpoint type
- Specific convergence signals

</decisions>

<specifics>
## Specific Ideas

- BLOCKING severity is a hard gate — work cannot proceed until resolved
- Adversary is stateless across debate rounds — simpler implementation, forces artifact/defense to be self-contained
- Should always find at least one challenge — embodies the adversarial role fully
- No suggested fixes in challenges — separation of concerns between problem-finding and problem-solving

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-core-agent*
*Context gathered: 2026-01-31*
