# Phase 17: Execute Phase UI - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Real-time execution interface showing wave progress, tool calls, checkpoints, file diffs, git commits, and TDD workflow — with pause/resume/abort controls. Requirements: EXEC-01 through EXEC-08, QUAL-01 through QUAL-04.

</domain>

<decisions>
## Implementation Decisions

### Execution Progress Display
- Horizontal pipeline visualization — waves flow left-to-right like CI, each wave is a column with plans stacked vertically
- Inline expandable logs — click a plan card to expand and see live streaming logs below it
- Auto-expand active plans, auto-collapse completed plans
- Plan cards show: name, status indicator, and elapsed time (live timer while running, "completed in Xs" when done)

### Tool Call Cards
- Collapsible cards with icons for each tool type (📄 Read, ✏️ Write, 💻 Bash, etc.)
- Syntax-highlighted code preview for file operations (Read/Write/Edit), truncated with "show more"
- Live streaming with auto-scroll for Bash output — user can scroll up to pause auto-scroll
- Live elapsed timer while tool runs, final duration shown on completion

### Checkpoint & Control UX
- Modal overlay for checkpoint dialogs — blocks interaction until answered, shows timeout countdown
- Fixed header bar for pause/resume/abort controls — always visible at top of execution panel
- Confirmation dialog for abort — shows files modified and commits made, offers rollback option
- Visual countdown with color change for timeouts — normal, yellow at 30s, red/pulsing at 10s

### Diff Viewer & Commit Timeline
- Toggle between unified and side-by-side (Monaco) diff views — default to unified
- Right sidebar for diff panel — updates based on selected file from tool cards
- Collapsible section for commits — "X commits made [View]", hidden by default
- Files grouped by directory tree in diff panel
- TDD phase shown in execution header as 3-step progress: Red → Green → Refactor

### Claude's Discretion
- Exact spacing, typography, and color values within the design system
- Loading skeleton design for initial state
- Error state handling beyond what's specified
- Exact icons for each tool type

</decisions>

<specifics>
## Specific Ideas

- Wave visualization should feel like a CI pipeline (GitHub Actions, CircleCI style)
- Plan cards should show enough info at a glance without expanding
- Checkpoint modals should demand attention — user needs to respond before timeout
- TDD indicator in header gives quick visibility into which phase of the cycle we're in

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 17-execute-phase-ui*
*Context gathered: 2026-03-11*
