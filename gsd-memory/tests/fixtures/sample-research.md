---
researched: 2025-01-20
domain: WebSocket and Server-Sent Events for real-time updates
confidence: HIGH
---

# Phase 2: Real-time Features - Research

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use Server-Sent Events (not WebSockets) for dashboard updates
- Must work behind Cloudflare proxy

### Claude's Discretion
- Choice of SSE library
- Event structure and naming

### Deferred Ideas (OUT OF SCOPE)
- Bi-directional chat feature (future milestone)
- Push notifications
</user_constraints>

<research_summary>
## Summary

Researched Server-Sent Events for real-time dashboard updates in Next.js. SSE is simpler than WebSockets for unidirectional server-to-client streaming and works reliably behind Cloudflare.

Key finding: Next.js App Router supports SSE via ReadableStream in route handlers. No additional libraries needed - native EventSource on client, ReadableStream on server.

**Primary recommendation:** Use native SSE with Next.js route handlers. Implement heartbeat to detect disconnections. Use EventSource with reconnection logic on client.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Native EventSource | - | Client-side SSE | Built into browsers, no deps |
| ReadableStream | - | Server-side SSE | Built into Next.js/Node |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| eventsource | 2.0.2 | Node SSE client | If testing SSE endpoints |
| reconnecting-eventsource | 1.6.2 | Auto-reconnect | Production client resilience |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native SSE | socket.io | Socket.io if bidirectional needed, heavier |
| Native SSE | Pusher | Pusher for scale, but adds dependency |

**Installation:**
```bash
npm install reconnecting-eventsource
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/api/events/
│   └── route.ts        # SSE endpoint
├── hooks/
│   └── useSSE.ts       # Client hook
└── lib/
    └── events.ts       # Event types and helpers
```

### Pattern 1: SSE Route Handler
**What:** Next.js route handler returning SSE stream
**When to use:** Any server-to-client streaming
**Example:**
```typescript
// Source: Next.js App Router docs
export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Heartbeat every 30s
      const heartbeat = setInterval(() => send({ type: 'heartbeat' }), 30000);

      // Cleanup on close
      return () => clearInterval(heartbeat);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
```

### Pattern 2: Client Hook with Reconnection
**What:** React hook that manages SSE connection lifecycle
**When to use:** Any component consuming SSE
**Example:**
```typescript
// Source: Community pattern, verified
function useSSE<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const es = new EventSource(url);

    es.onmessage = (e) => setData(JSON.parse(e.data));
    es.onerror = () => setError(new Error('SSE connection failed'));

    return () => es.close();
  }, [url]);

  return { data, error };
}
```

### Anti-Patterns to Avoid
- **Polling instead of SSE:** SSE is more efficient for real-time
- **No heartbeat:** Connections die silently without heartbeat
- **Missing reconnection:** EventSource auto-reconnects but custom logic may be needed
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE parsing | Custom parser | Native EventSource | Browser handles format |
| Reconnection | setTimeout loops | reconnecting-eventsource | Handles edge cases |
| Event typing | Inline types | Shared types file | Type safety across client/server |

**Key insight:** SSE is standardized. The browser's EventSource handles parsing, reconnection, and error recovery. Custom implementations miss edge cases.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Cloudflare Buffering
**What goes wrong:** Events don't arrive in real-time, come in batches
**Why it happens:** Cloudflare buffers responses by default
**How to avoid:** Set `Cache-Control: no-cache` and `X-Accel-Buffering: no`
**Warning signs:** Events arrive in bursts, not individually

### Pitfall 2: Connection Limits
**What goes wrong:** Browser limits SSE connections to same origin
**Why it happens:** Browsers limit ~6 concurrent connections per domain
**How to avoid:** Single SSE connection multiplexing multiple event types
**Warning signs:** Later connections fail or queue

### Pitfall 3: Memory Leaks
**What goes wrong:** Server memory grows over time
**Why it happens:** Event handlers not cleaned up on disconnect
**How to avoid:** Track connections, clean up on close/error
**Warning signs:** Server memory increases with usage
</common_pitfalls>

<code_examples>
## Code Examples

### Complete SSE Endpoint
```typescript
// Source: Next.js docs + community best practices
import { NextRequest } from 'next/server';

export const runtime = 'edge'; // Better for SSE

export async function GET(req: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      // Initial data
      send('init', { connected: true });

      // Heartbeat
      const interval = setInterval(() => send('heartbeat', {}), 30000);

      // Simulate updates
      const updates = setInterval(() => {
        send('update', { timestamp: Date.now() });
      }, 5000);

      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        clearInterval(updates);
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
}
```
</code_examples>

<sota_updates>
## State of the Art (2024-2025)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages API SSE | App Router + ReadableStream | 2023 | Cleaner API, Edge support |
| socket.io default | SSE for unidirectional | 2022 | Simpler, less overhead |

**New tools/patterns to consider:**
- **Edge Runtime:** Better for long-lived connections
- **React Server Components:** Can coexist with SSE for initial data

**Deprecated/outdated:**
- **res.write() in Pages API:** Use ReadableStream in App Router
</sota_updates>

<open_questions>
## Open Questions

1. **Connection cleanup on Vercel**
   - What we know: Vercel has function timeout limits
   - What's unclear: Exact behavior of long-lived SSE on serverless
   - Recommendation: Test with 10-minute connections, implement client reconnection
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- /vercel/next.js - App Router streaming, route handlers
- MDN EventSource - Browser API reference

### Secondary (MEDIUM confidence)
- Next.js GitHub discussions on SSE - verified against docs

### Tertiary (LOW confidence - needs validation)
- None
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Server-Sent Events
- Ecosystem: Next.js App Router, Edge Runtime
- Patterns: SSE routes, client hooks, reconnection
- Pitfalls: Buffering, connection limits, memory

**Confidence breakdown:**
- Standard stack: HIGH - native browser/server APIs
- Architecture: HIGH - verified with Next.js docs
- Pitfalls: HIGH - documented in production apps
- Code examples: HIGH - from official sources

**Research date:** 2025-01-20
**Valid until:** 2025-02-20 (30 days - stable tech)
</metadata>

---

*Phase: 02-realtime*
*Research completed: 2025-01-20*
*Ready for planning: yes*
