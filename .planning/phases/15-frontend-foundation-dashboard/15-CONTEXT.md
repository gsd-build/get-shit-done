# Phase 15: Frontend Foundation & Dashboard - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver project dashboard with health status, progress tracking, and navigation. Users can view all GSD projects with health indicators, see current phase and progress, view recent activity, search/filter projects, and navigate to project detail view. This is the foundational frontend that later phases (Discuss UI, Execute UI, etc.) will build upon.

</domain>

<decisions>
## Implementation Decisions

### Project Card Layout
- Card grid layout (responsive) — not table/list view
- Progress-forward hierarchy: progress bar as hero element, health badge and phase name secondary
- Standard density: show project name, progress bar, status badge, current phase, and 1-2 recent actions inline
- Hover reveals action buttons (open, archive, settings)

### Health Indicators
- Color-coded badge with text label (green = healthy, yellow = degraded, red = error)
- Degraded status triggers when: stale activity (no actions in X days) OR planning issues (missing CONTEXT.md, incomplete plans, failed verification)
- Click badge shows diagnostic popover/tooltip explaining why degraded/error
- Badge only — no extra card styling (border tint, dimming) for problem states

### Activity Feed
- Compact list: 1-2 actions visible inline, expand to reveal all 5
- Each action shows: action description + agent name + relative time ("gsd-executor ran plan 12-01 • 2h ago")
- Icons per action type (plan, execute, verify, discuss) for quick visual scanning
- Click action navigates directly to that execution's detail/log view

### Search & Filter
- Instant filtering as you type — results filter live
- Filter chips for status (Healthy, Degraded, Error) — toggle on/off
- Clear all button to reset filters
- Filters reset on page load — no localStorage persistence

### Testing Methodology
- Both component tests (Vitest + Testing Library) AND E2E tests (Playwright)
- 80% minimum coverage target for component tests
- E2E tests cover all DASH requirements (DASH-01 through DASH-05)
- Mock API responses using MSW for deterministic test data

### Claude's Discretion
- Exact card dimensions and spacing
- Animation/transition details for hover states
- Specific icon choices for action types
- Filter chip styling and colors
- Popover positioning and timing

</decisions>

<specifics>
## Specific Ideas

- Progress bar as hero element — user wants to see at a glance how far along each project is
- Action buttons on hover keeps cards clean until interaction
- Clicking actions deep-links to execution logs for quick context

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-frontend-foundation-dashboard*
*Context gathered: 2026-03-11*
