# Phase 6: Alignment + Performance - Context

**Gathered:** 2026-02-17
**Status:** Ready for planning

<domain>
## Phase Boundary

The system actively detects drift from declared futures, performs occurrence checks, and computes performance as alignment × integrity. Drift is surfaced during execution, performance is visible in status output, and renegotiation happens when declarations no longer hold.

</domain>

<decisions>
## Implementation Decisions

### Drift surfacing
- Drift checks run automatically during /declare:execute (not on-demand)
- Soft block on drift: show warning + ask "continue anyway?" before proceeding with drifted action
- Contextual detail: show drifted node + parent milestone + suggestion ("connect to declaration X or remove")
- Scope covers both orphaned actions AND orphaned milestones (anything without a causation path to a declaration)

### Performance display
- Performance score appears in /declare:status output (no standalone command)
- Per-declaration granularity: each declaration gets its own alignment × integrity score, plus a project rollup
- Alignment assessed via hybrid approach: structural causation coverage as baseline, AI assessment to catch semantic drift (actions exist but don't actually serve the declaration)
- Plain text labels: "Performance: HIGH (alignment: HIGH × integrity: HIGH)" format
- Integrity component uses factual counts from Phase 5 (verified/kept/honored)

### Renegotiation flow
- Triggered as part of occurrence checks — when "no longer true" → automatically enters renegotiation flow
- Archive + replace: old declaration archived with date, new one created, history preserved
- Archived declarations live in a separate file (e.g., FUTURE-ARCHIVE.md) keeping FUTURE.md clean with only active declarations
- Orphaned milestones from replaced declarations flagged for manual user review (reassign, archive, or delete)

### Claude's Discretion
- Occurrence check trigger mechanism (how/when checks are prompted)
- Exact AI assessment prompting for semantic drift detection
- Archive file format and naming
- How orphaned node review is presented to the user

</decisions>

<specifics>
## Specific Ideas

- FUTURE.md is the shared future document — source of truth referenced by all agents
- Occurrence checks ask "does this still occur as what we declared?" — the philosophical core
- Performance formula: alignment × integrity (qualitative HIGH/MEDIUM/LOW, never numeric scores)

</specifics>

<deferred>
## Deferred Ideas

- **Visual UI for the declaration graph** — A visual/web interface that makes the futures, milestones, and actions browsable and interactive. The future + milestones structure IS the living requirements document — no one has made this visible before. This deserves its own phase as a protagonist feature, not a bolt-on.

</deferred>

---

*Phase: 06-alignment-performance*
*Context gathered: 2026-02-17*
