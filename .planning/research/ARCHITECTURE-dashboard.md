# Architecture Research: GSD Web Dashboard Integration

**Domain:** Real-time AI agent orchestration dashboard
**Researched:** 2026-03-10
**Confidence:** HIGH

## Executive Summary

The GSD Web Dashboard requires integrating a new web-based UI with the existing GSD CLI ecosystem. The key architectural challenge is bridging the stdio-based MCP server (designed for local CLI use) with a WebSocket-based web client that needs real-time streaming, checkpoint handling, and agent orchestration.

**Recommendation:** Use a hybrid adapter approach where the backend server acts as an MCP client that wraps the existing `gsd-tools.cjs` modules directly, while exposing WebSocket endpoints for browser clients. This avoids rewriting the MCP server and maximizes code reuse.

---

## System Overview

```
+------------------------------------------------------------------+
|                         Browser Client                            |
|  Next.js App with Zustand stores, Socket.IO client                |
+----------------------------------+-------------------------------+
                                   |
                           WebSocket (Socket.IO)
                                   |
+----------------------------------v-------------------------------+
|                       Express Backend Server                      |
|  packages/server/                                                 |
|  +--------------------+  +--------------------+  +--------------+ |
|  | WebSocket Handler  |  | Agent Orchestrator |  | REST API     | |
|  | (ws/handlers.ts)   |  | (agents/*.ts)      |  | (api/*.ts)   | |
|  +--------+-----------+  +--------+-----------+  +-------+------+ |
|           |                       |                      |        |
|           +----------+------------+----------------------+        |
|                      |                                            |
|           +----------v-----------+                                |
|           | GSD Wrapper Layer    |  <-- NEW: Thin adapter         |
|           | (gsd/wrapper.ts)     |                                |
|           +----------+-----------+                                |
|                      |                                            |
+----------------------|--------------------------------------------+
                       | Direct require()
+----------------------v--------------------------------------------+
|                    Existing GSD Modules                           |
|  bin/lib/state.cjs, bin/lib/phase.cjs, bin/lib/roadmap.cjs, etc. |
+------------------------------------------------------------------+
                       |
                       | File system
+----------------------v--------------------------------------------+
|                    Project File System                            |
|  .planning/STATE.md, ROADMAP.md, phases/*, etc.                   |
+------------------------------------------------------------------+
```

### Component Responsibilities

| Component | Responsibility | Integration Point |
|-----------|----------------|-------------------|
| **Browser Client** | UI rendering, real-time updates, user input | Socket.IO client to backend |
| **WebSocket Handler** | Connection management, event routing, checkpoint relay | Socket.IO server |
| **Agent Orchestrator** | Claude API calls, streaming, tool execution loop | Anthropic SDK + GSD Wrapper |
| **REST API** | Project CRUD, health checks, static queries | Express routes + GSD Wrapper |
| **GSD Wrapper** | Adapts gsd-tools modules for async/Promise use | Direct require() of existing .cjs |
| **Existing GSD Modules** | Core business logic (state, phase, roadmap, health) | Unchanged (filesystem + stdout) |

---

## Integration Strategy: Wrapper vs. MCP Client

### Option A: Wrap MCP Server (NOT recommended)

The existing MCP server uses stdio transport, which is fundamentally incompatible with HTTP/WebSocket:

```javascript
// Existing: bin/gsd-mcp-server.cjs
const transport = new StdioServerTransport();
await server.connect(transport);
```

Creating an MCP-over-WebSocket adapter would require:
- New MCP transport implementation (SEP-1288 is still a proposal)
- Session management for stateless HTTP
- Complexity of bridging JSON-RPC over WebSocket

### Option B: Direct Module Integration (RECOMMENDED)

The GSD modules are already well-structured with clean exports:

```javascript
// Existing: bin/lib/state.cjs exports
module.exports = {
  cmdStateSnapshot,
  cmdStateGet,
  cmdStateUpdate,
  // ... etc
};
```

**Create a thin wrapper that:**
1. Requires existing modules directly
2. Captures output (many use `output()` callback pattern)
3. Returns Promises instead of callbacks
4. Emits events for streaming operations

```typescript
// NEW: packages/server/src/gsd/wrapper.ts
import { state, health, phase, roadmap } from './modules';

export class GsdWrapper {
  constructor(private projectPath: string) {}

  async getState(): Promise<StateData> {
    return captureOutput(() => state.cmdStateSnapshot(this.projectPath, true));
  }

  async getHealth(): Promise<HealthData> {
    return health.runQuickHealthCheck(this.projectPath);
  }

  // Long-running operations emit progress
  async *streamPhaseExecution(phaseNum: string): AsyncGenerator<ExecutionEvent> {
    // Yield events as execution proceeds
  }
}
```

**Why this works:**
- Existing modules already support `raw=true` for JSON output
- `captureOutput()` pattern is already used in MCP resources (see `resources.cjs`)
- No changes to existing code required
- TypeScript types can wrap the JSON output formats

---

## Data Flow Patterns

### Pattern 1: Query Operations (REST)

```
Browser                    Server                      GSD Modules
   |                          |                            |
   |-- GET /api/projects/X -->|                            |
   |                          |-- wrapper.getState() ----->|
   |                          |<---- { phase, status } ----|
   |<-- 200 { state } --------|                            |
```

### Pattern 2: Agent Execution (WebSocket Streaming)

```
Browser                    Server                   Claude API      GSD Modules
   |                          |                          |              |
   |-- ws:execute:start ----->|                          |              |
   |                          |-- messages.stream() ---->|              |
   |                          |<---- text_delta ---------|              |
   |<-- ws:agent:output ------|                          |              |
   |                          |<---- tool_use ------------|              |
   |                          |-- wrapper.executeTask() ------------->|
   |                          |<---- { success } ----------------------|
   |<-- ws:agent:tool --------|                          |              |
   |                          |-- tool_result ---------->|              |
   |                          |<---- message_stop -------|              |
   |<-- ws:agent:complete ----|                          |              |
```

### Pattern 3: Checkpoint Handling (WebSocket Bidirectional)

```
Browser                    Server                   Claude API
   |                          |                          |
   |                          |<---- checkpoint tool ----|
   |<-- ws:checkpoint --------|                          |
   |                          |  (awaits response)       |
   |-- ws:checkpoint:resp --->|                          |
   |                          |-- tool_result ---------->|
   |                          |<---- continues... -------|
```

This bidirectional flow is why WebSockets are essential - HTTP/SSE cannot send data back mid-stream.

---

## Recommended Project Structure

```
gsd-dashboard/
+-- packages/
|   +-- web/                        # Next.js frontend
|   |   +-- src/
|   |   |   +-- app/                # App router pages
|   |   |   +-- components/
|   |   |   |   +-- discuss/        # Chat UI components
|   |   |   |   +-- execute/        # Execution monitoring
|   |   |   |   +-- roadmap/        # Visualization
|   |   |   +-- hooks/
|   |   |   |   +-- useSocket.ts    # Socket.IO hook
|   |   |   |   +-- useProject.ts   # Project data hook
|   |   |   +-- stores/             # Zustand stores
|   |   |   +-- lib/
|   |   |       +-- socket.ts       # Socket.IO client setup
|   |   +-- package.json
|   |
|   +-- server/                     # Express backend
|   |   +-- src/
|   |   |   +-- index.ts            # Entry point
|   |   |   +-- app.ts              # Express + Socket.IO setup
|   |   |   +-- api/                # REST routes
|   |   |   |   +-- projects.ts
|   |   |   |   +-- phases.ts
|   |   |   +-- ws/                 # WebSocket handlers
|   |   |   |   +-- handlers.ts     # Event handlers
|   |   |   |   +-- events.ts       # Event types
|   |   |   +-- agents/             # Agent orchestration
|   |   |   |   +-- orchestrator.ts # Claude API + tool loop
|   |   |   |   +-- tools.ts        # Tool implementations
|   |   |   +-- gsd/                # GSD integration layer
|   |   |   |   +-- wrapper.ts      # Module wrapper (NEW)
|   |   |   |   +-- types.ts        # TypeScript types for GSD data
|   |   |   +-- services/
|   |   |       +-- claude.ts       # Anthropic SDK wrapper
|   |   +-- package.json
|   |
|   +-- shared/                     # Shared types
|       +-- src/
|       |   +-- types.ts            # Project, Phase, Event types
|       |   +-- events.ts           # WebSocket event definitions
|       +-- package.json
|
+-- turbo.json                      # Turborepo config
+-- package.json                    # Root workspace
+-- pnpm-workspace.yaml
```

### Structure Rationale

- **packages/web/:** Next.js handles UI, auth (if needed), and initial page loads. Stateless for scaling.
- **packages/server/:** Express holds WebSocket connections and orchestrates long-running agent sessions.
- **packages/shared/:** TypeScript types shared between frontend and backend prevent drift.
- **gsd/ layer:** Thin adapter that bridges CommonJS GSD modules to TypeScript async patterns.

---

## Architectural Patterns

### Pattern 1: Event-Driven Agent Orchestration

**What:** Agent execution emits typed events through WebSocket, allowing UI to react in real-time.

**When to use:** All agent operations (discuss, plan, execute, verify).

**Trade-offs:**
- (+) Real-time updates, interruptible, checkpoint support
- (-) More complex than REST, requires WebSocket infrastructure

**Example:**

```typescript
// packages/shared/src/events.ts
export interface ServerToClientEvents {
  'agent:thinking': () => void;
  'agent:output': (data: { content: string }) => void;
  'agent:tool': (data: { tool: string; input: any; output: any }) => void;
  'checkpoint': (data: { type: string; details: any }) => void;
  'agent:complete': (data: { status: 'success' | 'error' }) => void;
  'wave:start': (data: { wave: number; plans: string[] }) => void;
  'wave:complete': (data: { wave: number; status: string }) => void;
}

export interface ClientToServerEvents {
  'discuss:start': (data: { projectId: string; phase: number }) => void;
  'discuss:message': (data: { message: string }) => void;
  'execute:start': (data: { projectId: string; phase: number }) => void;
  'execute:checkpoint': (data: { response: string }) => void;
  'execute:abort': () => void;
}
```

### Pattern 2: GSD Module Wrapper

**What:** Async wrapper around sync GSD modules with output capture.

**When to use:** All GSD operations from the backend.

**Trade-offs:**
- (+) Zero changes to existing GSD code
- (+) TypeScript types for all operations
- (-) Need to maintain wrapper as GSD evolves

**Example:**

```typescript
// packages/server/src/gsd/wrapper.ts
import * as stateModule from '../../../../get-shit-done/bin/lib/state.cjs';

export function captureOutput<T>(fn: (output: (data: T) => void) => void): T {
  let captured: T | null = null;
  const outputFn = (data: T) => { captured = data; };
  fn(outputFn);
  if (captured === null) throw new Error('No output captured');
  return captured;
}

export async function getProjectState(projectPath: string): Promise<StateData> {
  return captureOutput((out) => {
    stateModule.cmdStateSnapshot(projectPath, out, true);
  });
}
```

### Pattern 3: Agentic Tool Loop with Streaming

**What:** Claude API streaming with tool use, forwarding events to WebSocket.

**When to use:** Discuss, Plan, Execute phases.

**Trade-offs:**
- (+) User sees response immediately
- (+) Checkpoints interrupt naturally at tool_use boundaries
- (-) Must handle connection drops mid-stream

**Example:**

```typescript
// packages/server/src/agents/orchestrator.ts
export async function runAgentLoop(
  prompt: string,
  tools: Tool[],
  socket: Socket,
  context: AgentContext
): Promise<void> {
  const messages: MessageParam[] = [{ role: 'user', content: prompt }];

  while (true) {
    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: context.systemPrompt,
      messages,
      tools,
    });

    let toolUses: ToolUseBlock[] = [];

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        socket.emit('agent:output', { content: event.delta.text });
      }
      // ... handle tool_use, collect for tool execution
    }

    if (toolUses.length === 0) break; // No tools = end turn

    // Execute tools, emit events, append results
    for (const toolUse of toolUses) {
      if (isCheckpoint(toolUse)) {
        socket.emit('checkpoint', toolUse.input);
        const response = await waitForCheckpointResponse(socket);
        messages.push(/* tool_result with response */);
      } else {
        const result = await executeTool(toolUse, context);
        socket.emit('agent:tool', { tool: toolUse.name, input: toolUse.input, output: result });
        messages.push(/* tool_result */);
      }
    }
  }

  socket.emit('agent:complete', { status: 'success' });
}
```

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-10 concurrent users | Single Express instance, SQLite, local file access |
| 10-100 concurrent users | Add Redis for session state, consider PostgreSQL |
| 100+ concurrent users | Horizontal scaling with sticky sessions or Redis pub/sub for WebSocket |

### Scaling Priorities

1. **First bottleneck: WebSocket connections** - Express can handle ~1K connections per instance. At 100+ active users with long-running agent sessions, consider Socket.IO with Redis adapter for horizontal scaling.

2. **Second bottleneck: Claude API rate limits** - The Anthropic API has rate limits per organization. Queue agent requests with priority handling to avoid 429 errors during peak usage.

---

## Anti-Patterns

### Anti-Pattern 1: MCP-over-WebSocket Bridge

**What people do:** Try to wrap the existing MCP stdio server with a WebSocket transport.

**Why it's wrong:** MCP's stdio transport is inherently single-client. The protocol's session model assumes one client. Multiplexing multiple browser clients through one MCP connection creates complex state management.

**Do this instead:** Use the GSD modules directly, bypassing MCP entirely for the web dashboard.

### Anti-Pattern 2: Polling for Agent Progress

**What people do:** Use REST polling to check if agent execution has completed.

**Why it's wrong:** Creates unnecessary load, adds latency, and cannot handle checkpoints (which require bidirectional communication).

**Do this instead:** Use WebSocket for all agent operations. The bidirectional channel naturally supports streaming output and checkpoint responses.

### Anti-Pattern 3: Serverless Backend

**What people do:** Deploy the backend on Vercel Functions or AWS Lambda.

**Why it's wrong:** Serverless functions are stateless with short timeouts (10-30s). Agent execution can take minutes. WebSocket connections cannot persist across function invocations.

**Do this instead:** Use a persistent Node.js server (Docker, Railway, Render, DigitalOcean App Platform) that can maintain long-lived WebSocket connections.

---

## Integration Points with Existing Code

### Unchanged Components

| Component | Path | Notes |
|-----------|------|-------|
| gsd-tools.cjs | bin/gsd-tools.cjs | CLI entry point, no changes needed |
| State module | bin/lib/state.cjs | Called via wrapper |
| Phase module | bin/lib/phase.cjs | Called via wrapper |
| Roadmap module | bin/lib/roadmap.cjs | Called via wrapper |
| Health module | bin/lib/health.cjs | Called via wrapper |
| Agent prompts | agents/gsd-*.md | Loaded as system prompts |
| Workflows | get-shit-done/workflows/*.md | Referenced for orchestration logic |

### New Components

| Component | Path | Purpose |
|-----------|------|---------|
| GSD Wrapper | packages/server/src/gsd/wrapper.ts | Async adapter for GSD modules |
| Agent Orchestrator | packages/server/src/agents/orchestrator.ts | Claude API + tool loop |
| WebSocket Handlers | packages/server/src/ws/handlers.ts | Socket.IO event handlers |
| Event Types | packages/shared/src/events.ts | Typed WebSocket events |
| React Hooks | packages/web/src/hooks/*.ts | useSocket, useProject |
| Zustand Stores | packages/web/src/stores/*.ts | Client state management |

### Modified Components

| Component | Path | Change |
|-----------|------|--------|
| MCP Server | bin/gsd-mcp-server.cjs | **No change** - remains for CLI use |
| MCP Tools | bin/lib/mcp/tools.cjs | **No change** - wrapper uses lib modules directly |

---

## Build Order (Suggested Phases)

Based on dependencies, the suggested implementation order:

### Phase 1: Foundation
- Monorepo setup (Turborepo, pnpm workspaces)
- packages/shared with event types
- packages/server skeleton with Express + Socket.IO
- GSD Wrapper for state/health/roadmap operations
- **Deliverable:** Backend can return project state via REST

### Phase 2: Backend Core
- REST API for project listing, health checks
- WebSocket connection management
- Basic agent orchestrator (no tools yet)
- **Deliverable:** WebSocket connects, emits test events

### Phase 3: Frontend Foundation
- packages/web with Next.js
- Socket.IO hook and connection
- Zustand stores for project state
- Dashboard with project list
- **Deliverable:** UI shows live project list

### Phase 4: Agent Integration
- Tool execution in orchestrator
- Checkpoint handling (WebSocket bidirectional)
- Streaming output to UI
- **Deliverable:** Simple discuss flow works end-to-end

### Phase 5: Phase UIs
- Discuss phase (chat interface)
- Execute phase (log streaming, wave progress)
- Roadmap visualizer
- **Deliverable:** All phase UIs functional

### Phase 6: Polish
- Error handling, reconnection logic
- Settings/configuration UI
- Performance optimization
- **Deliverable:** Production-ready dashboard

---

## MCP Server Coexistence

The existing MCP server (Phase 12) and web dashboard can coexist:

```
                   +---------------+
                   |   User        |
                   +-------+-------+
                           |
          +----------------+----------------+
          |                                 |
          v                                 v
+------------------+               +------------------+
| Claude Code CLI  |               | Web Browser      |
| (MCP Client)     |               | (Dashboard)      |
+--------+---------+               +--------+---------+
         |                                  |
         | stdio (JSON-RPC)                 | WebSocket
         |                                  |
+--------v---------+               +--------v---------+
| gsd-mcp-server   |               | Express Server   |
| (MCP Protocol)   |               | (Dashboard BE)   |
+--------+---------+               +--------+---------+
         |                                  |
         +----------------+----------------+
                          |
                          v
                 +--------+---------+
                 | GSD Lib Modules  |
                 | (state, phase,   |
                 |  roadmap, etc.)  |
                 +------------------+
```

Both access the same underlying modules. The MCP server is for CLI integration (Claude Code), while the dashboard backend is for web UI.

---

## Sources

- [Ably: WebSockets vs HTTP for AI Applications](https://ably.com/blog/websockets-vs-http-for-ai-streaming-and-agents) - Comparison of streaming approaches
- [Render: Real-Time AI Chat Infrastructure](https://render.com/articles/real-time-ai-chat-websockets-infrastructure) - WebSocket architecture patterns
- [MCP Transports Documentation](https://modelcontextprotocol.io/docs/concepts/transports) - Official MCP transport options
- [MCP WebSocket Transport Proposal (SEP-1288)](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1288) - Future WebSocket support
- [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript) - Streaming and tool use
- [Claude API Streaming Docs](https://platform.claude.com/docs/en/build-with-claude/streaming) - SSE streaming patterns
- [Turborepo Next.js Guide](https://turborepo.dev/docs/guides/frameworks/nextjs) - Monorepo setup
- [Express + Next.js Monorepo Template](https://github.com/ivesfurtado/next-express-turborepo) - Reference architecture
- Existing GSD codebase: `bin/lib/mcp/server.cjs`, `bin/lib/mcp/tools.cjs`, `bin/lib/mcp/resources.cjs` (Phase 12 worktree)

---
*Architecture research for: GSD Web Dashboard Integration*
*Researched: 2026-03-10*
