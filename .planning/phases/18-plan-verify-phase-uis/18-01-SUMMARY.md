---
phase: 18-plan-verify-phase-uis
plan: 01
subsystem: frontend/planning-state
tags: [zustand, socket.io, hooks, tdd, timers]
dependency_graph:
  requires:
    - "@gsd/events"
  provides:
    - "apps/web/src/stores/planStore.ts"
    - "apps/web/src/hooks/useResearchStream.ts"
    - "apps/web/src/types/plan.ts"
  affects:
    - "packages/events/src/types.ts"
tech_stack:
  added:
    - "@dnd-kit/core"
    - "@dnd-kit/sortable"
    - "react-grid-heatmap"
    - "react-contenteditable"
    - "@radix-ui/react-checkbox"
  patterns:
    - "Zustand selectors"
    - "Socket.IO event handlers"
    - "Interval-based timers outside state"
key_files:
  created:
    - apps/web/src/types/plan.ts
    - apps/web/src/stores/planStore.ts
    - apps/web/src/stores/planStore.test.ts
    - apps/web/src/hooks/useResearchStream.ts
    - apps/web/src/hooks/useResearchStream.test.ts
  modified:
    - apps/web/package.json
    - packages/events/src/types.ts
    - packages/events/src/index.ts
    - apps/web/src/hooks/useVerification.ts
decisions:
  - Timer intervals stored outside Zustand to avoid serialization issues
  - 100ms timer update frequency for smooth elapsed time display
metrics:
  duration: 6m 57s
  completed: 2026-03-11T15:28:00Z
---

# Phase 18 Plan 01: Planning State Management & Research Streaming Summary

Zustand store and Socket.IO hook for research agent visualization with real-time elapsed time tracking.

## What Was Built

### Types (apps/web/src/types/plan.ts)

- `AgentStatus`: 'pending' | 'running' | 'complete' | 'error'
- `ResearchAgent`: State for each swimlane agent (id, name, status, currentAction, elapsedMs, summary, error)
- `PlanTask`: Task definition with wave, dependsOn, and checkpoint types
- `Plan`: Container with phaseId and task array

### Zustand Store (apps/web/src/stores/planStore.ts)

State management for research agent visualization:

| Action | Description |
|--------|-------------|
| `addAgent` | Add new agent with pending status and 0 elapsed time |
| `updateAgentStatus` | Change agent status (pending -> running -> complete) |
| `updateAgentAction` | Set current action text for display |
| `setAgentComplete` | Mark complete with summary, auto-stop timer |
| `setAgentError` | Mark error with message, auto-stop timer |
| `startAgentTimer` | Begin 100ms interval incrementing elapsedMs |
| `stopAgentTimer` | Clear interval, finalize elapsed time |
| `resetPlanState` | Clear all agents and stop all timers |

**Timer Design**: Interval IDs stored in external Map (not Zustand state) to avoid serialization issues and React re-render overhead.

### Socket.IO Hook (apps/web/src/hooks/useResearchStream.ts)

Subscribes to research agent events:

| Event | Handler |
|-------|---------|
| `agent:start` | Add agent to store, start timer |
| `agent:end` | Mark complete/error based on status |
| `agent:error` | Mark error with message |

Lifecycle:
- Mount: emit `research:subscribe` with phaseId
- Unmount: emit `research:unsubscribe`, clean up listeners

### Test Coverage

- 18 planStore tests (including 5 timer tests)
- 7 useResearchStream tests
- All 25 tests passing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added Socket.IO event types to @gsd/events**
- **Found during:** Task 3
- **Issue:** Build failed - `research:subscribe` and `research:unsubscribe` not in ClientToServerEvents
- **Fix:** Added events to packages/events/src/types.ts ClientToServerEvents interface
- **Files modified:** packages/events/src/types.ts, packages/events/src/index.ts

**2. [Rule 3 - Blocking] Added verification event types for useVerification.ts**
- **Found during:** Task 3
- **Issue:** Build failed - verification events used `as never` casts, types not exported
- **Fix:** Added VerificationTestStartEvent, VerificationTestResultEvent, VerificationGap, VerificationCompleteEvent types and exported them
- **Files modified:** packages/events/src/types.ts, packages/events/src/index.ts, apps/web/src/hooks/useVerification.ts

## Verification Checklist

- [x] Types defined in apps/web/src/types/plan.ts
- [x] Zustand store in apps/web/src/stores/planStore.ts with selectors
- [x] useResearchStream hook subscribes to Socket.IO events
- [x] Timer tracking for elapsed time works correctly
- [x] All tests pass with `pnpm vitest run`
- [x] Build succeeds with `pnpm run build`

## Commits

| Hash | Description |
|------|-------------|
| 68a636f | test(18-01): add failing tests for planStore and useResearchStream (RED) |
| bfb4ce9 | feat(18-01): implement planStore and useResearchStream (GREEN) |
| 06a5cbf | feat(18-01): add elapsed time tracking with interval timers |

## Next Steps

Plan 18-02 builds on this foundation to add verification state management for test result streaming and gap reporting.

## Self-Check: PASSED

All created files verified. All commits verified in git history.
