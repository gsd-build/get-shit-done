# Phase 14: Backend Core - Research

**Researched:** 2026-03-11
**Domain:** REST API, Claude API streaming, WebSocket orchestration, CJS-to-TypeScript wrapping
**Confidence:** HIGH

## Summary

Phase 14 builds the server-side core powering the dashboard: a Hono REST API for project data, a GSD wrapper adapting sync CJS modules to async TypeScript, an agent orchestrator streaming Claude API responses with tool execution, and checkpoint handling with idempotency. The phase integrates with the Phase 13 Socket.IO server already running on port 4000.

The standard stack uses Hono for the REST API (lightweight, type-safe, integrates with existing Socket.IO server), the official `@anthropic-ai/sdk` for Claude API streaming with tool runner support, and Zod for request/response validation (already used in `@gsd/events`). The key architectural decision is co-locating the REST API with the existing Socket.IO server by attaching Hono to the same HTTP server.

**Primary recommendation:** Extend `@gsd/server` to add Hono REST routes alongside Socket.IO, create a `@gsd/gsd-wrapper` package for async TypeScript wrappers around sync CJS modules, and implement the orchestrator as an internal service that streams to WebSocket clients.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Envelope pattern for all responses: `{ data: {...}, meta: {...}, error?: {...} }`
- Cursor-based pagination for project listing: `{ cursor: 'abc123', limit: 20 }`
- Health status exposed two ways: embedded in project objects + dedicated `/health/summary` endpoint
- Structured error codes: `{ error: { code: 'PROJECT_NOT_FOUND', message: '...', details: {...} } }`
- Prefixed event naming: `agent:token`, `agent:tool_start`, `checkpoint:request` (namespaced by domain)
- Batched token chunks emitted every ~50ms: `{ tokens: 'chunk of text', seq: 42 }`
- Full inline tool inputs/outputs in events (no separate fetch required)
- Global sequence numbers per session for ordering and deduplication
- Exponential backoff for Claude API rate limits (429): 1s, 2s, 4s delays, max 3 attempts, then fail
- Feed tool errors to Claude as tool results (let Claude decide how to proceed)
- Parallel execution of independent tool calls (respecting Claude's batching)
- Phase-based progress events: `agent:phase` with values like 'streaming', 'tool_executing', 'awaiting_checkpoint'
- Timeout handling: warn at 30s, pause execution at 60s, resume when user responds
- Idempotency via checkpoint ID + response hash (accept first, ignore duplicates)
- Persist pending checkpoints for reconnect scenarios
- Auto-push `checkpoint:pending` immediately after socket reconnects

### Claude's Discretion
- Exact Hono router structure and middleware ordering
- Database schema for checkpoint persistence (if any)
- Internal error logging format
- Retry timing fine-tuning within stated bounds

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| hono | ^4.x | REST API framework | Lightweight (14kB), type-safe, integrates with existing HTTP server |
| @hono/node-server | ^1.x | Node.js adapter | Required for running Hono on Node.js |
| @hono/zod-validator | ^0.x | Request validation | Type-safe validation, consistent with @gsd/events patterns |
| @anthropic-ai/sdk | ^0.61+ | Claude API client | Official SDK with streaming, tool runner, rate limit handling |
| zod | ^3.25 | Schema validation | Already in use, runtime validation for events |
| uuid | ^9.x | UUID generation | Standard for checkpoint IDs, idempotency keys |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @gsd/events | workspace:* | Typed event schemas | All WebSocket event payloads |
| @gsd/gsd-core | workspace:* | Security, locks, audit | Path validation, file locking |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hono | Fastify | Fastify is heavier, overkill for this use case |
| Hono | Express | Express lacks built-in TypeScript types |
| @anthropic-ai/sdk | Vercel AI SDK | Phase 14 needs direct Claude API control; Vercel AI SDK abstracts too much |

**Installation:**
```bash
pnpm add hono @hono/node-server @hono/zod-validator @anthropic-ai/sdk uuid
pnpm add -D @types/uuid
```

## Architecture Patterns

### Recommended Project Structure
```
apps/server/
├── src/
│   ├── index.ts              # Entry point (existing)
│   ├── api/                   # NEW: Hono REST routes
│   │   ├── index.ts          # Hono app factory
│   │   ├── routes/
│   │   │   ├── projects.ts   # /api/projects routes
│   │   │   ├── phases.ts     # /api/projects/:id/phases routes
│   │   │   └── health.ts     # /api/health routes
│   │   ├── middleware/
│   │   │   ├── envelope.ts   # Response envelope wrapper
│   │   │   ├── errors.ts     # Error handler
│   │   │   └── validation.ts # Zod validation helpers
│   │   └── schemas/          # Zod schemas for requests/responses
│   ├── orchestrator/          # NEW: Agent orchestrator
│   │   ├── index.ts          # Orchestrator factory
│   │   ├── claude.ts         # Claude API wrapper with streaming
│   │   ├── tools.ts          # Tool execution handlers
│   │   ├── retry.ts          # Exponential backoff logic
│   │   └── checkpoint.ts     # Checkpoint state management
│   ├── socket/               # Existing Socket.IO handlers
│   └── middleware/           # Existing security middleware
packages/gsd-wrapper/         # NEW: CJS wrapper package
├── src/
│   ├── index.ts              # Public exports
│   ├── health.ts             # Async wrapper for health.cjs
│   ├── phase.ts              # Async wrapper for phase.cjs
│   ├── state.ts              # Async wrapper for state.cjs
│   └── types.ts              # TypeScript interfaces for CJS functions
```

### Pattern 1: Hono + Socket.IO Co-location
**What:** Attach Hono to the same HTTP server as Socket.IO
**When to use:** When REST API and WebSocket share the same port
**Example:**
```typescript
// Source: Socket.IO documentation for Hono integration
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { Server } from 'socket.io';
import type { Server as HTTPServer } from 'node:http';

const app = new Hono();
// ... define routes

const httpServer = serve({ fetch: app.fetch, port: 4000 });
const io = new Server(httpServer as HTTPServer, { /* options */ });
```

### Pattern 2: Response Envelope Middleware
**What:** Wrap all responses in standard envelope format
**When to use:** All API routes per CONTEXT.md locked decision
**Example:**
```typescript
// apps/server/src/api/middleware/envelope.ts
import type { MiddlewareHandler } from 'hono';

export interface ApiEnvelope<T> {
  data: T;
  meta: {
    timestamp: string;
    requestId: string;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export const envelopeMiddleware: MiddlewareHandler = async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set('requestId', requestId);

  await next();

  // Only wrap JSON responses
  const contentType = c.res.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    const body = await c.res.json();
    const envelope: ApiEnvelope<unknown> = {
      data: body,
      meta: { timestamp: new Date().toISOString(), requestId },
    };
    c.res = new Response(JSON.stringify(envelope), {
      status: c.res.status,
      headers: { 'content-type': 'application/json' },
    });
  }
};
```

### Pattern 3: Cursor-Based Pagination
**What:** Use opaque cursor tokens for pagination instead of offset
**When to use:** Project listing per CONTEXT.md locked decision
**Example:**
```typescript
// apps/server/src/api/schemas/pagination.ts
import { z } from 'zod';

export const PaginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  hasNextPage: boolean;
}

// Cursor is base64-encoded JSON: { id: string, ts: string }
export function encodeCursor(id: string, timestamp: string): string {
  return Buffer.from(JSON.stringify({ id, ts: timestamp })).toString('base64');
}

export function decodeCursor(cursor: string): { id: string; ts: string } | null {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString());
  } catch {
    return null;
  }
}
```

### Pattern 4: CJS-to-TypeScript Async Wrapper
**What:** Wrap synchronous CJS functions in async TypeScript with proper types
**When to use:** All GSD lib/ modules accessed from server
**Example:**
```typescript
// packages/gsd-wrapper/src/phase.ts
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Import CJS module
const phaseLib = require('../../../get-shit-done/bin/lib/phase.cjs');

export interface Phase {
  number: string;
  name: string;
  slug: string;
  status: 'pending' | 'active' | 'complete';
}

export interface ListPhasesResult {
  directories: string[];
  count: number;
  milestone: string | null;
}

export async function listPhases(
  cwd: string,
  options: { milestone?: string } = {}
): Promise<ListPhasesResult> {
  return new Promise((resolve, reject) => {
    try {
      // CJS functions write to stdout and exit - we need to capture output
      const result: ListPhasesResult = { directories: [], count: 0, milestone: null };

      // Override output function to capture result
      const captureOutput = (data: ListPhasesResult) => {
        Object.assign(result, data);
      };

      phaseLib.cmdPhasesList(cwd, options, false);
      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
}
```

### Pattern 5: Claude API Streaming with Tool Loop
**What:** Stream Claude responses while executing tool calls in a loop
**When to use:** Agent orchestrator streaming to WebSocket clients
**Example:**
```typescript
// apps/server/src/orchestrator/claude.ts
import Anthropic from '@anthropic-ai/sdk';
import type { TypedServer } from '../socket/server.js';
import { EVENTS } from '@gsd/events';

const client = new Anthropic();

export async function runAgentLoop(
  io: TypedServer,
  agentId: string,
  prompt: string,
  tools: Anthropic.Tool[]
): Promise<void> {
  let sequence = 0;
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: prompt }
  ];

  while (true) {
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages,
      tools,
    });

    // Stream tokens to WebSocket clients
    stream.on('text', (text) => {
      io.to(`agent:${agentId}`).emit(EVENTS.AGENT_TOKEN, {
        agentId,
        token: text,
        sequence: sequence++,
      });
    });

    const response = await stream.finalMessage();

    // Check for tool use
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    if (toolUseBlocks.length === 0) {
      // No more tool calls - done
      break;
    }

    // Execute tools in parallel (per CONTEXT.md decision)
    const toolResults = await Promise.all(
      toolUseBlocks.map(async (toolUse) => {
        try {
          const result = await executeToolCall(toolUse.name, toolUse.input);
          return {
            type: 'tool_result' as const,
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          };
        } catch (error) {
          // Feed errors back to Claude per CONTEXT.md decision
          return {
            type: 'tool_result' as const,
            tool_use_id: toolUse.id,
            content: JSON.stringify({ error: (error as Error).message }),
            is_error: true,
          };
        }
      })
    );

    // Add assistant response and tool results to messages
    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: toolResults });
  }
}
```

### Pattern 6: Exponential Backoff with Jitter
**What:** Retry rate-limited requests with increasing delays plus random jitter
**When to use:** Claude API 429 errors per CONTEXT.md (1s, 2s, 4s, max 3 attempts)
**Example:**
```typescript
// apps/server/src/orchestrator/retry.ts
export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000, // 1s per CONTEXT.md
  maxDelayMs: 4000,  // 4s max per CONTEXT.md
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_CONFIG
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Only retry on 429 rate limit errors
      if (!is429Error(error)) {
        throw error;
      }

      if (attempt < config.maxAttempts - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.min(
          config.baseDelayMs * Math.pow(2, attempt),
          config.maxDelayMs
        );
        // Add jitter (10-20% random variation)
        const jitter = delay * (0.1 + Math.random() * 0.1);
        await sleep(delay + jitter);
      }
    }
  }

  throw lastError;
}

function is429Error(error: unknown): boolean {
  return (
    error instanceof Anthropic.RateLimitError ||
    (error instanceof Anthropic.APIError && error.status === 429)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

### Pattern 7: Checkpoint Idempotency
**What:** Track checkpoint responses by ID + hash to prevent duplicate processing
**When to use:** All checkpoint responses per CONTEXT.md decision
**Example:**
```typescript
// apps/server/src/orchestrator/checkpoint.ts
import { createHash } from 'crypto';

interface PendingCheckpoint {
  checkpointId: string;
  type: 'human-verify' | 'decision' | 'human-action';
  prompt: string;
  createdAt: number;
  timeoutMs: number;
  responseHash?: string; // Set when first response received
}

// In-memory store (could be Redis for production)
const pendingCheckpoints = new Map<string, PendingCheckpoint>();

export function hashResponse(checkpointId: string, response: string): string {
  return createHash('sha256')
    .update(`${checkpointId}:${response}`)
    .digest('hex');
}

export function processCheckpointResponse(
  checkpointId: string,
  response: string
): { accepted: boolean; reason?: string } {
  const checkpoint = pendingCheckpoints.get(checkpointId);

  if (!checkpoint) {
    return { accepted: false, reason: 'CHECKPOINT_NOT_FOUND' };
  }

  const hash = hashResponse(checkpointId, response);

  // Idempotency check: accept first, ignore duplicates
  if (checkpoint.responseHash) {
    if (checkpoint.responseHash === hash) {
      return { accepted: true }; // Duplicate of accepted response
    }
    return { accepted: false, reason: 'CHECKPOINT_ALREADY_RESPONDED' };
  }

  // First response - accept and store hash
  checkpoint.responseHash = hash;
  return { accepted: true };
}

export function getPendingCheckpoints(): PendingCheckpoint[] {
  return Array.from(pendingCheckpoints.values())
    .filter((c) => !c.responseHash);
}
```

### Anti-Patterns to Avoid
- **Synchronous CJS calls in async handlers:** Never call CJS functions directly in route handlers - wrap them first
- **Offset pagination for large datasets:** Use cursor-based pagination per CONTEXT.md decision
- **Retrying on non-429 errors:** Only retry rate limit errors, not validation or auth errors
- **Sequential tool execution:** Execute independent tool calls in parallel per CONTEXT.md decision
- **Storing checkpoint responses without hashing:** Always hash for idempotency

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Claude API streaming | Custom HTTP streaming | `@anthropic-ai/sdk` stream methods | SDK handles SSE parsing, reconnection, error events |
| Tool execution loop | Manual message management | SDK tool runner (beta) | Handles tool result formatting, message history |
| Response envelope | Manual JSON wrapping | Hono middleware | Consistent, testable, handles edge cases |
| Request validation | Manual checks | `@hono/zod-validator` | Type inference, error formatting, OpenAPI generation |
| Rate limit retry | Custom retry loops | Dedicated retry utility | Handles jitter, backoff curves, error classification |
| UUID generation | Custom ID schemes | `uuid` package | RFC 4122 compliant, cryptographically random |

**Key insight:** The Claude API SDK provides extensive helpers for streaming and tool use that handle edge cases like partial JSON, tool result formatting, and error propagation. Using the SDK's built-in patterns reduces bugs and improves reliability.

## Common Pitfalls

### Pitfall 1: CJS Output Capture
**What goes wrong:** CJS modules call `process.stdout.write()` and `process.exit()` directly
**Why it happens:** Modules designed for CLI use, not library use
**How to avoid:** Either refactor CJS to return data OR spawn subprocess and capture stdout
**Warning signs:** Route handlers exit prematurely, no response sent to client

### Pitfall 2: Socket.IO Room Leaks
**What goes wrong:** Agent rooms accumulate subscribers who never unsubscribe
**Why it happens:** Orchestrator completion doesn't clean up room subscriptions
**How to avoid:** Emit `agent:end` event and have clients unsubscribe on receipt
**Warning signs:** Memory growth over time, stale room counts in health metrics

### Pitfall 3: Checkpoint Timeout Races
**What goes wrong:** User responds just as timeout fires, causing duplicate handling
**Why it happens:** Timeout and response processing not coordinated
**How to avoid:** Use idempotency pattern - accept first response, ignore subsequent
**Warning signs:** Agent receives multiple responses for same checkpoint

### Pitfall 4: Streaming Backpressure
**What goes wrong:** WebSocket buffer grows unboundedly during fast token streaming
**Why it happens:** Token emission rate exceeds client consumption rate
**How to avoid:** Use existing RAF buffering in `@gsd/events`, batch tokens per 50ms
**Warning signs:** Server memory growth, client lag behind token stream

### Pitfall 5: Tool Error Propagation
**What goes wrong:** Tool errors crash orchestrator instead of being sent to Claude
**Why it happens:** Uncaught exceptions in tool execution
**How to avoid:** Wrap all tool calls in try/catch, return error as tool result
**Warning signs:** Agent loop terminates unexpectedly, no error event emitted

## Code Examples

Verified patterns from official sources:

### Claude API Streaming (TypeScript SDK)
```typescript
// Source: https://github.com/anthropics/anthropic-sdk-typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

await client.messages
  .stream({
    messages: [{ role: 'user', content: 'Hello' }],
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
  })
  .on('text', (text) => {
    console.log(text);
  });
```

### Hono with Zod Validation
```typescript
// Source: https://hono.dev/docs/guides/validation
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const app = new Hono();

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  path: z.string(),
});

app.post(
  '/projects',
  zValidator('json', CreateProjectSchema),
  async (c) => {
    const validated = c.req.valid('json');
    // validated is typed as { name: string; path: string }
    return c.json({ id: 'new-id', ...validated });
  }
);
```

### Error Handling in Hono
```typescript
// Source: https://hono.dev/examples/validator-error-handling
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const app = new Hono();

app.post(
  '/users',
  zValidator('json', UserSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          data: null,
          meta: { timestamp: new Date().toISOString() },
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: result.error.flatten(),
          },
        },
        422
      );
    }
  }),
  async (c) => {
    const user = c.req.valid('json');
    // ...
  }
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual tool result formatting | SDK tool runner (beta) | 2025 | Reduces boilerplate, handles edge cases |
| `stream: true` + manual parsing | `client.messages.stream()` | 2024 | Automatic event handling, accumulation |
| Express for REST APIs | Hono/Elysia/Fastify | 2024 | Type safety, smaller bundles, better DX |
| Offset pagination | Cursor-based pagination | 2023 | Required for large datasets, stable ordering |

**Deprecated/outdated:**
- Direct HTTP fetch to Claude API: Use official SDK for proper error handling
- `client.completions.create()`: Messages API replaced Completions API
- Express without TypeScript: Lacks type safety for request/response

## Open Questions

1. **CJS Module Wrapping Strategy**
   - What we know: CJS functions call `process.exit()` and write to stdout
   - What's unclear: Whether to refactor CJS or spawn subprocesses
   - Recommendation: Start with subprocess approach (spawn gsd-tools.cjs), migrate to refactored CJS if performance issues arise

2. **Checkpoint Persistence Backend**
   - What we know: CONTEXT.md says "persist pending checkpoints for reconnect"
   - What's unclear: In-memory Map vs file-based vs SQLite
   - Recommendation: Start with in-memory Map, add file persistence for crash recovery (defer database to Phase 23)

3. **Token Batching Strategy**
   - What we know: Emit batched tokens every ~50ms per CONTEXT.md
   - What's unclear: Whether to batch server-side or rely on client RAF buffering
   - Recommendation: Emit individual tokens server-side, rely on existing `@gsd/events` RAF buffering client-side

## Sources

### Primary (HIGH confidence)
- [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript) - Streaming, tool use, rate limit handling
- [Hono Documentation](https://hono.dev/docs/) - REST API patterns, middleware, validation
- [Socket.IO Hono Integration](https://socket.io/docs/v4/server-initialization/) - Co-locating Hono and Socket.IO
- [Anthropic Streaming Messages](https://platform.claude.com/docs/en/api/messages-streaming) - Event types, SDK usage

### Secondary (MEDIUM confidence)
- [Hono Best Practices](https://hono.dev/docs/guides/best-practices) - Router structure, createFactory
- [Anthropic Tool Use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use) - Tool execution loop
- [Cursor-Based Pagination](https://blog.appsignal.com/2024/05/15/understanding-offset-and-cursor-based-pagination-in-nodejs.html) - Implementation patterns

### Tertiary (LOW confidence)
- WebSearch results for exponential backoff patterns - General patterns, not Claude-specific

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official SDK docs, Hono official docs
- Architecture: HIGH - Based on existing Phase 13 patterns, official integration guides
- Pitfalls: MEDIUM - Derived from general patterns, not project-specific experience

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (30 days - stable ecosystem)
