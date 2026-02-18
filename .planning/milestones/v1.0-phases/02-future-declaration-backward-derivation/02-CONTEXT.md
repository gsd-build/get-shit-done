# Phase 2: Future Declaration + Backward Derivation - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can declare a set of futures as present-tense truth statements through a guided flow. The system detects past-derived and goal-based language and responds with Socratic questions. It then derives milestones and actions backward from those declarations by asking "what must be true?" at each level. Declarations are stored in FUTURE.md; milestones and actions populate MILESTONES.md.

</domain>

<decisions>
## Implementation Decisions

### Declaration Flow
- Guided prompts to draw out declarations (e.g., "What's true when this project succeeds?") — not blank canvas
- Target 3-5 declarations per session — focused set, enough to define the future without overwhelm
- Refine inline: each declaration gets refined through dialogue before moving to the next
- Declarations can be added or modified anytime after the initial session — system re-derives affected milestones

### Socratic Correction
- Persistent guide: keep reframing until declaration is future-stated (2-3 attempts before accepting)
- Explain the philosophy: brief explanation of why reframing matters ("Declarations work from the future, not against the past")
- Show before/after comparison only when the change is significant enough to warrant it
- Detect both problem-reactive language ("I want X because Y is broken") AND goal language ("I want to achieve X") — both are past-derived, not declared futures

### Backward Derivation
- Collaborative: system proposes milestones, user confirms/adjusts each one before moving deeper
- Derive until atomic: keep deriving until actions are small enough to execute directly (not fixed at two levels)
- Show the backward logic explicitly: "For X to be true, what must be true?" — makes the thinking visible, teaches the user
- Merge shared milestones: when milestones from different declarations overlap, merge into single milestones with multiple parent declarations (leveraging the graph structure)

### Declaration Quality
- Present tense fact: "Our deployment pipeline delivers zero-downtime releases" — stated as already true
- Declarations must be fully independent — relationships emerge through shared milestones, not explicit references
- NSR criteria: every declaration must be Necessary, Sufficient, and Relevant
- Active NSR validation during the flow — system checks each declaration as it's captured and flags issues
- When NSR fails: explain which criteria failed and help the user rewrite (Socratic approach, not auto-correction)

### Claude's Discretion
- Exact guided prompt questions and sequencing
- How to determine "atomic enough" for action derivation depth
- Internal detection patterns for past-derived and goal language
- Graph merge algorithm for overlapping milestones

</decisions>

<specifics>
## Specific Ideas

- NSR (Necessary, Sufficient, and Relevant) as the quality bar — borrowed from logical reasoning, not invented jargon
- Declarations are MECE-like: independent, non-overlapping, collectively covering the declared future
- The "what must be true?" question is the engine — it should be visible and teachable, not hidden

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-future-declaration-backward-derivation*
*Context gathered: 2026-02-16*
