# Phase 18: Plan & Verify Phase UIs - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Provide UI for two major workflows: **Planning** (research streaming, plan preview, inline editing) and **Verification** (test results, gap analysis, approval/rejection). Users see researcher agents run in parallel, preview and edit generated plans, view verification reports with pass/fail status, and approve or reject completed work with gap-based planning flow.

</domain>

<decisions>
## Implementation Decisions

### Research & Agent Visualization
- Swimlanes layout for parallel researcher agents — each agent gets a horizontal lane showing timeline progress
- Medium detail level: show running/complete status, elapsed time, AND current action (e.g., "Reading src/api/...")
- Expandable summary in lane when agent completes — collapsed by default, click to expand full findings
- Red lane with inline error message for failures — immediate visibility, in context

### Plan Preview & Editing
- Kanban columns by wave — tasks grouped in columns (Wave 1, Wave 2, ...) emphasizing parallel execution
- Connecting lines between cards to show dependencies — visual arrows showing which tasks feed into others
- Click card to edit inline — card expands in-place with editable fields, quick edits stay in context
- Title and description only editable — wave assignment and dependencies stay as-is to prevent breaking dependencies

### Verification Report Display
- Header summary + drill-down list — big pass/fail summary at top, expandable list of requirements below
- Evidence trail for failed requirements — show what was checked, expected vs actual, relevant code snippets
- Heatmap grid for requirement coverage matrix — requirements vs phases matrix with color-coded coverage
- Live streaming with incremental results — show tests passing/failing as they run for immediate feedback

### Gap & Approval Workflow
- Color-coded severity badges: red (Blocking), orange (Major), yellow (Minor) — instant visual priority
- Checkboxes with optional notes for manual test checklist — simple pass/fail, optional note field for context
- Two-step confirmation for approval/rejection — click action, then confirm in modal to prevent accidents
- Auto-route to gap planning after gap selection — user selects gaps, clicks Reject, automatically spawns planning

### Claude's Discretion
- Exact swimlane animation and timing
- Card hover states and transitions
- Heatmap color gradients and thresholds
- Loading/skeleton states during streaming
- Error boundary and recovery UI

</decisions>

<specifics>
## Specific Ideas

- Swimlanes should feel like GitHub Actions or CI/CD pipelines — familiar parallel execution pattern
- Kanban wave columns similar to Linear's board view — clean, cards with clear boundaries
- Verification heatmap inspired by code coverage tools — green/red gradient, gaps stand out immediately

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-plan-verify-phase-uis*
*Context gathered: 2026-03-11*
