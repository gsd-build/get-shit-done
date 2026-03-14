# Phase 19: Roadmap Visualization - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Visualize project progress with dependency graphs, Gantt timelines, progress tracking, and milestone grouping. Users can view phase relationships, track completion status, and navigate to phase details from the visualization. Editing roadmap content or adding new phases is out of scope.

</domain>

<decisions>
## Implementation Decisions

### Graph Layout
- All 3 orientations available as user preference: left-to-right, top-to-bottom, force-directed
- Phase nodes displayed as cards with details (name, progress %, plan count)
- Both edge styles available: smooth bezier curves and straight lines with elbows (user can toggle)
- Completed phases shown with muted styling (reduced opacity) to focus on active work

### Timeline Design
- Both time scales available: phase-based sequence and calendar dates (toggle between them)
- Calendar view only shown when time estimates exist for phases
- Parallel phases (same wave) displayed as stacked rows, aligned vertically
- Gantt bars are rich cards showing phase name, plan count, status badge
- Current phase highlighted with vertical "today" line and glow/accent border

### Progress Indicators
- Fill progress bar for phase completion (plans completed / total plans)
- 4 distinct phase states: Not started (gray), In progress (blue), Complete (green), Blocked (red/orange)
- Milestone-level progress shown as aggregate bar (combined progress of child phases)
- Plan-level detail available via expandable section on phase cards

### Navigation & Interaction
- Clicking a phase navigates to full phase detail page
- Large roadmaps (20+ phases) handled with zoom + pan, minimap in corner, fit-to-screen button
- Full keyboard navigation: arrow keys traverse phases, Enter opens detail, Tab cycles views
- Tab bar toggle between Graph and Timeline views at top of visualization

### Claude's Discretion
- Specific graph library choice (React Flow suggested in roadmap)
- Exact color palette for phase states
- Animation and transition timing
- Responsive breakpoints and mobile adaptation

</decisions>

<specifics>
## Specific Ideas

No specific product references mentioned. Open to standard visualization patterns.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope

</deferred>

---

*Phase: 19-roadmap-visualization*
*Context gathered: 2026-03-11*
