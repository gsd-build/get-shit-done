# Phase 04: Real-time Features — Research

## WebSocket Implementation Patterns

### Server Setup with Express
```typescript
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
```

### JWT Authentication on Upgrade
Best practice: Validate JWT during HTTP upgrade, before WebSocket handshake completes.

```typescript
wss.on('connection', (ws, req) => {
  const token = new URL(req.url, 'http://localhost').searchParams.get('token');
  // Verify JWT...
});
```

### Redis Pub/Sub for Scaling
- Use separate Redis connections for publish and subscribe
- Channel per event type: `ws:connect`, `ws:disconnect`, `ws:message`
- Include instance ID to prevent echo

### Connection Manager Patterns
- Map<userId, Set<WebSocket>> for O(1) lookup
- WeakRef for automatic cleanup (Node 14+)
- Periodic sweep for stale connections

## Key Dependencies
- ws: ^8.16.0 (WebSocket server)
- ioredis: ^5.3.0 (Redis client with pub/sub)

## Performance Considerations
- ws handles 50k+ concurrent connections per instance
- Redis pub/sub adds ~1ms latency per message
- Heartbeat interval affects memory (each timer = 1 timer object)
- Consider using a single setInterval for all heartbeats vs per-connection

## Error Handling
- Connection errors: close with appropriate WebSocket close code
- Auth errors: 4001 (unauthorized), 4003 (forbidden)
- Rate limit: 4029 (too many requests)
- Server errors: 1011 (unexpected condition)

## Testing Strategy
- Unit tests: Mock WebSocket, test connection manager logic
- Integration tests: Real WebSocket server, test full flow
- Load tests: Artillery or k6 for concurrent connections
- Use ws client library for test connections
