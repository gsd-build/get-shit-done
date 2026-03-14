# Phase 14: Backend Core - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Provide REST API for project data and agent orchestrator for Claude API streaming. This phase builds the server-side core that powers the dashboard: endpoints returning project/phase/health data, and the orchestrator that streams Claude responses while managing tool execution and checkpoints.

</domain>

<decisions>
## Implementation Decisions

### REST API Design
- Envelope pattern for all responses: `{ data: {...}, meta: {...}, error?: {...} }`
- Cursor-based pagination for project listing: `{ cursor: 'abc123', limit: 20 }`
- Health status exposed two ways: embedded in project objects + dedicated `/health/summary` endpoint
- Structured error codes: `{ error: { code: 'PROJECT_NOT_FOUND', message: '...', details: {...} } }`

### WebSocket Events
- Prefixed event naming: `agent:token`, `agent:tool_start`, `checkpoint:request` (namespaced by domain)
- Batched token chunks emitted every ~50ms: `{ tokens: 'chunk of text', seq: 42 }`
- Full inline tool inputs/outputs in events (no separate fetch required)
- Global sequence numbers per session for ordering and deduplication

### Orchestration Behavior
- Exponential backoff for Claude API rate limits (429): 1s, 2s, 4s delays, max 3 attempts, then fail
- Feed tool errors to Claude as tool results (let Claude decide how to proceed)
- Parallel execution of independent tool calls (respecting Claude's batching)
- Phase-based progress events: `agent:phase` with values like 'streaming', 'tool_executing', 'awaiting_checkpoint'

### Checkpoint Protocol
- Timeout handling: warn at 30s, pause execution at 60s, resume when user responds
- Idempotency via checkpoint ID + response hash (accept first, ignore duplicates)
- Persist pending checkpoints for reconnect scenarios
- Auto-push `checkpoint:pending` immediately after socket reconnects

### Claude's Discretion
- Exact Hono router structure and middleware ordering
- Database schema for checkpoint persistence (if any)
- Internal error logging format
- Retry timing fine-tuning within stated bounds

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Follow patterns established in Phase 13 (Socket.IO server, typed events package).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-backend-core*
*Context gathered: 2026-03-11*
