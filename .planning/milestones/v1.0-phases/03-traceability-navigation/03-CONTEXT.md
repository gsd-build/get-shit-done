# Phase 3: Traceability + Navigation - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can understand, trace, and prioritize the derivation structure. This means: tracing any action back through milestones to its source declaration ("why am I doing this?"), visualizing the full graph as ASCII/text, and ordering actions by causal contribution. No new graph mutations, execution, or integrity tracking — those are later phases.

</domain>

<decisions>
## Implementation Decisions

### Why-chain output
- Full chain always: Action → Milestone → Declaration, every trace shows the complete path
- Show names + summaries at each level (ID and title), keep it scannable
- When an action traces to multiple declarations through different milestones, show all paths
- Tree connectors (├── and └── style) for visual structure

### Graph visualization
- Default scope: full graph (all declarations → milestones → actions in one view)
- Top-down orientation: declarations at top flowing down to milestones then actions (cause flows downward)
- Status markers on nodes: [✓] done, [○] pending, [!] blocked — inline with node names
- Unicode box-drawing characters (┌─┐ │ └─┘ style) for cleaner look
- Optional scope argument: `/declare:visualize D-01` zooms into that declaration's subtree; no arg = full graph

### Prioritization model
- Priority = dependency weight: actions that block the most other actions rank highest (unblocking power)
- Pure structure ranking: based only on graph topology, ignore completion state
- Display: ranked list with priority score visible so user understands the ranking
- Filter by declaration: flag to scope priority list to a specific declaration's subtree

### Command design
- Three separate slash commands: `/declare:trace`, `/declare:visualize`, `/declare:prioritize`
- `/declare:trace`: accepts node ID as argument; if no argument, shows interactive picker
- `/declare:visualize`: optional scope argument (declaration/milestone ID) to zoom into subtree
- `/declare:prioritize`: optional declaration filter flag
- All commands support `--output` flag to write to file (useful for sharing visualizations)
- Terminal output by default

### Claude's Discretion
- Exact tree layout algorithm for visualization
- Priority score formula details (how to compute dependency weight)
- Interactive picker implementation for trace command
- Color usage in terminal output (if any)

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

*Phase: 03-traceability-navigation*
*Context gathered: 2026-02-16*
