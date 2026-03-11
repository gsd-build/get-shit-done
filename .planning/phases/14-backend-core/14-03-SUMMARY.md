---
phase: 14-backend-core
plan: 03
subsystem: api
tags: [typescript, anthropic-sdk, streaming, socket.io, claude, agent-orchestrator]

# Dependency graph
requires:
  - phase: 14-backend-core/02
    provides: "@gsd/gsd-wrapper async wrappers"
  - phase: 13-foundation-infrastructure
    provides: "Socket.IO server, @gsd/gsd-core file locking"
provides:
  - "createOrchestrator factory for agent session management"
  - "runAgentLoop for Claude API streaming with tool execution"
  - "withRetry exponential backoff for 429 rate limit handling"
  - "Tool registry with read_file, write_file, gsd_health, gsd_state, gsd_phases"
  - "AGENT_PHASE, TOOL_START, TOOL_END events in @gsd/events"
affects: [14-rest-api-integration, dashboard, agent-execution]

# Tech tracking
tech-stack:
  added: ["@anthropic-ai/sdk ^0.61.0"]
  patterns: [agent-loop, parallel-tool-execution, discriminated-union-results]

key-files:
  created:
    - apps/server/src/orchestrator/index.ts
    - apps/server/src/orchestrator/claude.ts
    - apps/server/src/orchestrator/tools.ts
    - apps/server/src/orchestrator/retry.ts
    - apps/server/src/orchestrator/types.ts
  modified:
    - apps/server/package.json
    - packages/events/src/types.ts
    - packages/events/src/schemas.ts

key-decisions:
  - "Agent loop streams tokens then executes parallel tools, feeding results back to Claude"
  - "429 rate limit errors retry with exponential backoff (1s, 2s, 4s max 3 attempts)"
  - "Tool errors returned to Claude as is_error tool results for LLM reasoning"
  - "Session cleanup after 1 minute grace period for late checkpoint responses"
  - "exactOptionalPropertyTypes handled via conditional error event emission"

patterns-established:
  - "Agent loop pattern: stream -> check tools -> execute parallel -> feed results -> repeat"
  - "Tool registry pattern: GSD_TOOLS definitions + toolHandlers implementation map"
  - "withRetry wrapper for rate-limit resilient API calls"

requirements-completed: []

# Metrics
duration: 4m 8s
completed: 2026-03-11
---

# Phase 14 Plan 03: Agent Orchestrator Summary

**Claude API streaming orchestrator with parallel tool execution, 429 retry backoff, and real-time WebSocket event emission**

## Performance

- **Duration:** 4m 8s
- **Started:** 2026-03-11T11:26:26Z
- **Completed:** 2026-03-11T11:30:34Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Added @anthropic-ai/sdk for Claude API integration with streaming support
- Implemented agent loop that streams tokens and executes tools in parallel
- Created retry utility with exponential backoff for 429 rate limit errors
- Added AGENT_PHASE, TOOL_START, TOOL_END events to @gsd/events package
- Tool registry integrates @gsd/gsd-wrapper functions for GSD operations

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Claude SDK and create orchestrator types** - `87fee1d` (feat)
2. **Task 2: Implement tool execution registry** - `1accb06` (feat)
3. **Task 3: Implement Claude streaming agent loop** - `0d4c3a4` (feat)

## Files Created/Modified
- `apps/server/src/orchestrator/index.ts` - Orchestrator factory and session management
- `apps/server/src/orchestrator/claude.ts` - Claude API streaming with tool loop
- `apps/server/src/orchestrator/tools.ts` - Tool execution handlers with GSD wrapper integration
- `apps/server/src/orchestrator/retry.ts` - Exponential backoff for 429 errors
- `apps/server/src/orchestrator/types.ts` - AgentSession, ToolContext, ToolResult types
- `apps/server/package.json` - Added @anthropic-ai/sdk dependency
- `packages/events/src/types.ts` - Added tool and phase event interfaces
- `packages/events/src/schemas.ts` - Added Zod schemas for new event types

## Decisions Made
- **Agent loop pattern:** Stream first, check for tool calls, execute all tools in parallel via Promise.all, feed results back to Claude, repeat until no tool calls remain
- **Rate limit handling:** Only retry on 429 errors, with jitter to prevent thundering herd
- **Session lifecycle:** 1 minute grace period after completion for late checkpoint responses before cleanup
- **TypeScript exactOptionalPropertyTypes:** Conditional object spreading for optional stack property in error events

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed exactOptionalPropertyTypes violation in error emission**
- **Found during:** Task 3 (Claude streaming agent loop)
- **Issue:** TypeScript rejected `stack: undefined` with exactOptionalPropertyTypes enabled
- **Fix:** Conditionally emit error event with or without stack property
- **Files modified:** apps/server/src/orchestrator/claude.ts
- **Verification:** Build passes
- **Committed in:** 0d4c3a4

---

**Total deviations:** 1 auto-fixed (bug fix)
**Impact on plan:** Minor TypeScript strictness adjustment. No scope creep.

## Issues Encountered
None - plan executed with one minor TypeScript fix.

## User Setup Required
None - no external service configuration required. The orchestrator uses ANTHROPIC_API_KEY from environment which should already be configured.

## Next Phase Readiness
- Orchestrator module complete and ready for REST API integration in Plan 04
- createOrchestrator factory can be called from server routes
- WebSocket event streaming tested to compile; runtime integration test requires API key

---
*Phase: 14-backend-core*
*Completed: 2026-03-11*
