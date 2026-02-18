# Phase 1: Foundation - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Graph engine, artifact layer, CLI entry points, and fork boundary are operational. Users can invoke `/declare:*` slash commands, `.planning/` contains FUTURE.md and MILESTONES.md in specified formats, and the graph engine can create, persist, and reload a three-layer graph. All state changes produce atomic git commits. FORK-BOUNDARY.md defines the relationship to GSD.

</domain>

<decisions>
## Implementation Decisions

### Slash command design
- Colon-separated namespace: `/declare:init`, `/declare:status`, `/declare:help`
- Phase 1 commands: init (setup), status (graph state), help (discoverability)
- Re-init behavior: detect existing `.planning/`, offer to keep/replace each artifact individually (merge approach)
- Status command shows rich visual summary: graph stats, layer counts, health indicators, last activity

### Artifact formats
- FUTURE.md uses sectioned cards: each declaration gets its own section with ID, statement, status, and linked milestones
- Node IDs use semantic prefixes: D-01 (Declaration), M-01 (Milestone), A-01 (Action)
- Artifacts are human-editable: users can edit FUTURE.md and MILESTONES.md directly; system validates on next load

### Fork boundary
- Fork and diverge: copy GSD patterns into Declare's codebase, then evolve independently. No upstream dependency on GSD.
- Carry forward full agent stack: planner, executor, researcher, verifier — adapted to work with graph structure
- FORK-BOUNDARY.md is a living document: tracks ongoing divergence from GSD, updated as Declare evolves
- Own tooling: `declare-tools.cjs` — Declare's own CLI tooling, forked from gsd-tools patterns

### Graph model
- Many-to-many relationships: actions can serve multiple milestones, milestones can link to multiple declarations. Full graph, not a tree.
- Three node states: PENDING, ACTIVE, DONE — tracks what's being worked on
- Markdown-only persistence: parse on load, write on save. No JSON cache. Simple and transparent.
- Validation on command: `/declare:status` runs structural validation (no orphans, no cycles, valid edges); normal operations trust the data

### Claude's Discretion
- Graph engine internal architecture and data structures
- Exact markdown parsing/writing implementation
- MILESTONES.md structure (single file vs two files for milestones and actions)
- Status command layout and formatting details
- Error message wording and help text content

</decisions>

<specifics>
## Specific Ideas

- Status command should feel like GSD's progress view — rich, informative, at-a-glance
- Fork boundary is a living document, not a one-time snapshot
- Human-editability of artifacts is important: the system validates on load, doesn't gatekeep edits

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-02-16*
