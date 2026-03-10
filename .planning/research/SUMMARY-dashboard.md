# Project Research Summary

**Project:** GSD Web Dashboard
**Domain:** Real-time AI agent orchestration dashboard
**Researched:** 2026-03-10
**Confidence:** HIGH

## Executive Summary

The GSD Web Dashboard is a real-time streaming interface for AI agent orchestration that bridges the existing GSD CLI ecosystem with a web-based UI. Research confirms this is a well-understood domain with mature tooling: Next.js 15 + React 19 for the frontend, Hono + Socket.IO for the backend, and direct integration with existing GSD library modules (bypassing MCP's stdio transport limitations). The recommended approach uses a hybrid adapter pattern where the Express backend wraps existing `gsd-tools.cjs` modules directly while exposing WebSocket endpoints for browser clients.

The core architectural challenge is bidirectional communication for checkpoint handling - HTTP/SSE cannot send data back mid-stream, making WebSockets mandatory. Research corrected several PRD/Spec assumptions: Socket.IO v5 does not exist (use v4.8.x), React 18 is incompatible with Next.js 15 (use React 19), and Tailwind CSS v4 is 5x faster than v3. The recommendation is to start without BullMQ/Redis complexity and add them only if execution timeouts become problematic.

The most critical risks are WebSocket state desynchronization on reconnect, streaming backpressure overwhelming UI rendering, and file system race conditions between the web server and CLI. All three must be addressed in the foundation phase before building feature-specific UIs. The investment in proper event handling, token buffering, and file locking early will prevent costly refactoring later.

## Key Findings

### Recommended Stack

Research verified current stable versions and identified several PRD corrections. The stack prioritizes streaming-first architecture, TypeScript throughout, and zero changes to existing GSD modules.

**Core technologies:**
- **Next.js 15.5.x + React 19.2.x**: Required pairing for App Router, Turbopack, and streaming support
- **Hono 4.x**: 3x faster than Express, TypeScript-first, modern async handlers
- **Socket.IO 4.8.x**: Auto-reconnect, room support, fallback to long-polling (v5 does not exist)
- **Zustand 5.x**: Minimal state management with React 19 concurrency support
- **better-sqlite3 + Drizzle**: Zero-config database, can migrate to PostgreSQL later
- **Vercel AI SDK 6**: Streaming helpers with useChat hooks (call Anthropic SDK directly for tools)

**Avoid:** Express (too slow), React 18 (incompatible), Tailwind v3 (5x slower), BullMQ initially (premature complexity), PostgreSQL initially (needs Docker).

### Expected Features

Research categorized features by user expectations and implementation priority.

**Must have (table stakes):**
- Real-time token streaming (users trained by ChatGPT/Claude to expect immediate response)
- Project listing with health status (basic dashboard requirement)
- Chat-style conversation UI (standard pattern since 2023)
- Pause/abort execution (essential escape hatch for HITL systems)
- Error display with context (not generic "error occurred")
- Syntax highlighting (Monaco is standard; plain text looks broken)
- Dark mode (72% of developers prefer it)

**Should have (differentiators):**
- Inline tool visualization (Chainlit step pattern - collapsible cards)
- CONTEXT.md live preview (unique to GSD workflow)
- Checkpoint dialog modal (HITL done right)
- Wave-based execution progress (maps to GSD's core value prop)
- File diff viewer (Monaco DiffEditor)

**Defer (v2+):**
- Gantt roadmap visualization (complex, validate simpler progress first)
- Dependency graph (React Flow, high effort)
- Full verification UI (can use CLI initially)
- Settings management UI (config files work)
- Real-time collaboration (GSD is single-developer by design)

### Architecture Approach

The recommended architecture uses a hybrid adapter where the backend server imports GSD lib modules directly (not via HTTP or MCP), wrapping them with async/Promise patterns and emitting typed events through WebSocket. This maximizes code reuse and avoids rewriting the MCP server.

**Major components:**
1. **Browser Client (Next.js)** — UI rendering, real-time updates, Zustand stores
2. **WebSocket Handler (Socket.IO)** — Connection management, event routing, checkpoint relay
3. **Agent Orchestrator** — Claude API streaming, tool execution loop, message history
4. **GSD Wrapper** — Thin adapter converting sync CJS modules to async TypeScript
5. **REST API (Hono)** — Project CRUD, health checks, static queries

**Anti-patterns to avoid:**
- MCP-over-WebSocket bridge (stdio is single-client, incompatible)
- Polling for agent progress (creates load, adds latency, cannot handle checkpoints)
- Serverless backend (agent execution takes minutes, WebSocket needs persistence)

### Critical Pitfalls

Research identified 10 pitfalls, with these 5 being most critical for the foundation phase:

1. **WebSocket state desynchronization on reconnect** — Emit `state:sync` request on reconnect, use monotonic sequence numbers, store authoritative state server-side
2. **Streaming backpressure overwhelms UI** — Buffer tokens outside React state, use requestAnimationFrame to flush at display rate, virtualize long outputs
3. **File system race conditions (CLI vs web)** — Use advisory file locking (proper-lockfile), implement read-modify-write with retry
4. **Agent memory leaks from unfinished conversations** — Set maximum lifetime, implement heartbeat cleanup, register disconnect handlers
5. **Symlink escape vulnerability** — Use fs.realpathSync, validate resolved path not requested path

**Phase mapping:** Pitfalls 1-5 must be addressed in Foundation; Monaco memory leaks in Plan/Execute phase; stale closures and infinite loops in Discuss phase.

## Implications for Roadmap

Based on research, suggested phase structure follows the dependency graph: WebSocket infrastructure first, then backend core, then frontend foundation, then feature-specific UIs.

### Phase 1: Foundation Infrastructure

**Rationale:** All real-time features depend on WebSocket infrastructure. Cannot build streaming UI without event system. File locking prevents corruption when CLI and dashboard run concurrently.

**Delivers:**
- Turborepo monorepo with pnpm workspaces
- packages/shared with typed WebSocket events
- packages/server skeleton with Hono + Socket.IO
- GSD Wrapper for state/health/roadmap (direct module imports)
- File access security layer (symlink protection, locking)
- SQLite + Drizzle schema for session/project data

**Addresses features:** None directly (infrastructure layer)

**Avoids pitfalls:**
- WebSocket desync (#1) via state:sync protocol
- File race conditions (#4) via locking
- Symlink escape (#8) via path validation
- Memory leaks (#5) via cleanup architecture

### Phase 2: Backend Core

**Rationale:** REST API and agent orchestrator must exist before frontend can consume them. Checkpoint handling requires bidirectional WebSocket.

**Delivers:**
- REST API for project listing, health checks, phase data
- WebSocket connection management with reconnection handling
- Agent orchestrator with Claude API streaming
- Tool execution framework
- Checkpoint handling with idempotency (unique IDs, version numbers)
- Rate limit handling with exponential backoff

**Addresses features:** Project list, health status, pause/abort, error display

**Avoids pitfalls:**
- Checkpoint race conditions (#2) via idempotent responses
- Rate limit mishandling (#7) via proper 429 handling

### Phase 3: Frontend Foundation

**Rationale:** Depends on Phase 2 API. Establishes React patterns used by all subsequent feature UIs.

**Delivers:**
- Next.js 15 app with App Router
- Socket.IO client hook with reconnection
- Zustand stores for project/execution state
- Dashboard with project list and health indicators
- Token buffering architecture (RAF-based, prevents backpressure)
- Dark mode support via Tailwind v4

**Addresses features:** Project dashboard, dark mode, keyboard shortcuts foundation

**Avoids pitfalls:**
- Backpressure (#3) via token buffering
- Stale closures (#9) via getState() pattern
- Infinite loops (#10) via client ID echo suppression

### Phase 4: Discuss Phase UI

**Rationale:** First streaming interface validates the token buffering architecture. Simpler than Execute (no waves/checkpoints).

**Delivers:**
- Chat conversation interface with streaming
- CONTEXT.md live preview panel
- Message persistence across reconnects
- Basic tool call visualization (text output)

**Addresses features:** Chat UI, streaming, CONTEXT.md preview, session persistence

**Avoids pitfalls:** Validates backpressure handling, stale closure patterns

### Phase 5: Execute Phase UI

**Rationale:** Most complex UI. Depends on all prior phases. Introduces checkpoint modals, wave visualization, diff viewer.

**Delivers:**
- Execution log streaming with tool call cards
- Wave progress visualization
- Checkpoint dialog modal (blocking, with timeout warning)
- File diff viewer (Monaco DiffEditor)
- Git commit timeline
- Abort/pause controls

**Addresses features:** Tool visualization, checkpoint dialogs, wave viz, diff viewer, git timeline, pause/abort

**Avoids pitfalls:**
- Checkpoint race (#2) at UI level
- Monaco memory leaks (#6) via proper dispose

### Phase 6: Plan & Verify Phase UIs

**Rationale:** Lower priority than Execute. Plan research can stream; Verify is simpler checklist UI.

**Delivers:**
- Plan phase with research streaming
- Requirement coverage display
- Decision locking UI
- Verify phase with gap highlighting
- Approval workflow

**Addresses features:** Research streaming, decision locking, verification UI

### Phase 7: Roadmap Visualization

**Rationale:** Complex visualization deferred to validate core workflow first. Dependencies on roadmap parsing API.

**Delivers:**
- Dependency graph (React Flow / @xyflow/react)
- Gantt-style timeline (SVAR Gantt or DHTMLX)
- Progress tracking across phases

**Addresses features:** Dependency graph, Gantt roadmap

**Research flag:** May need deeper research on large graph performance

### Phase 8: Polish & Production

**Rationale:** Final polish after feature-complete.

**Delivers:**
- Settings management UI
- Error boundary polish
- Performance optimization
- 24-hour soak testing for memory leaks
- Documentation

### Phase Ordering Rationale

- **Foundation before features:** WebSocket infrastructure, file locking, and security are prerequisites for all streaming UIs
- **Backend before frontend:** REST API and WebSocket handlers must exist for React to consume
- **Discuss before Execute:** Simpler streaming validates architecture before adding checkpoint complexity
- **Roadmap visualization last:** High effort, low initial value; core workflow works without it
- **Grouping by feature completeness:** Each phase delivers usable functionality, not partial features

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (Execute Phase UI):** Checkpoint timeout handling, wave visualization layout, Monaco integration
- **Phase 7 (Roadmap Visualization):** React Flow performance with 100+ nodes, Gantt library comparison

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Standard Turborepo + Socket.IO setup, well-documented
- **Phase 3 (Frontend Foundation):** Standard Next.js 15 patterns
- **Phase 4 (Discuss Phase UI):** Standard chat interface patterns (llm-ui, Chainlit references)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified via npm, official docs, release blogs |
| Features | MEDIUM | Based on competitor analysis and AI interface patterns; validate with users |
| Architecture | HIGH | Direct module import proven in existing MCP code; hybrid adapter is conservative |
| Pitfalls | HIGH | Multiple sources confirm WebSocket/streaming issues; Node.js security CVEs documented |

**Overall confidence:** HIGH

### Gaps to Address

- **Multi-project concurrent execution:** Research assumes single-project focus; need to validate queue behavior if user switches projects mid-execution
- **Authentication:** PRD shows auth in sitemap but research didn't deep-dive; defer or use NextAuth/Clerk
- **Offline behavior:** Research confirms offline mode is anti-feature; need clear "offline" error states
- **Performance benchmarks:** No concrete numbers for "large" projects; define thresholds during planning (e.g., 50 phases, 1000 plans)

## Sources

### Primary (HIGH confidence)
- [Next.js 15 Release Blog](https://nextjs.org/blog/next-15) — App Router, React 19 requirement
- [React 19 Release Blog](https://react.dev/blog/2024/12/05/react-19) — Stable features
- [Socket.IO npm](https://www.npmjs.com/package/socket.io) — v4.8.3 is latest (no v5)
- [Tailwind CSS v4](https://tailwindcss.com/blog/tailwindcss-v4) — 5x performance improvement
- [Claude API Streaming](https://platform.claude.com/docs/en/build-with-claude/streaming) — SSE patterns
- [MCP Transports Documentation](https://modelcontextprotocol.io/docs/concepts/transports) — stdio limitations
- [Node.js Security Releases](https://nodejs.org/en/blog/vulnerability/december-2025-security-releases) — CVE-2025-55130

### Secondary (MEDIUM confidence)
- [Ably: WebSockets vs HTTP for AI](https://ably.com/blog/websockets-vs-http-for-ai-streaming-and-agents) — Architecture patterns
- [Chainlit Step Pattern](https://deepwiki.com/Chainlit/chainlit/4-step-and-message-system) — Tool visualization
- [React Monaco Editor Issues](https://github.com/react-monaco-editor/react-monaco-editor/issues/110) — Memory leak patterns

### Tertiary (LOW confidence)
- Developer preference surveys (72% dark mode) — May vary by audience
- Hono vs Express benchmarks — Synthetic benchmarks, real-world may differ

---
*Research completed: 2026-03-10*
*Ready for roadmap: yes*
