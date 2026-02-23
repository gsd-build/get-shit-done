---
phase: "04"
plan: "01"
name: websocket-server
wave: 1
depends_on: []
type: tdd
files_modified:
  - src/websocket/server.ts
  - src/websocket/connection-manager.ts
  - src/websocket/auth-middleware.ts
  - src/types/websocket.ts
  - tests/websocket/server.test.ts
  - tests/websocket/connection.test.ts
autonomous: false
user_setup:
  - service: redis
    env_vars:
      - REDIS_URL
    local_dev:
      - "docker run -d --name redis-dev -p 6379:6379 redis:7-alpine"
---

# Phase 04 Plan 01: WebSocket Server Setup (TDD)

<objective>
Implement WebSocket server with JWT authentication, connection lifecycle management, and Redis pub/sub for horizontal scaling. Use TDD approach.
</objective>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/02-auth/02-01-SUMMARY.md
@.planning/phases/03-payments/03-01-SUMMARY.md
@.planning/phases/04-realtime/04-CONTEXT.md
</context>

<behavior>
The WebSocket server should:
1. Accept WebSocket connections on /ws endpoint
2. Authenticate connections using JWT from query parameter or first message
3. Track active connections per user (support multiple tabs/devices)
4. Publish connection events to Redis for multi-instance awareness
5. Handle graceful disconnection and cleanup
6. Support heartbeat/ping-pong for connection health
7. Reject unauthenticated connections after 5-second timeout
</behavior>

<implementation>
- Use ws library (not socket.io — lighter, standard WebSocket)
- Integrate with existing Express server
- Use ioredis for Redis pub/sub
- Connection manager as singleton service
- Type-safe message protocol with discriminated unions
</implementation>

<tasks>

<task id="1" type="checkpoint:human-action">
<name>Verify Redis is running</name>
<what>Ensure Redis is available for pub/sub testing</what>
<verify>
1. Run: redis-cli ping
2. Should return PONG
</verify>
<resume_signal>Type "done" when Redis is running</resume_signal>
</task>

<task id="2" type="auto" tdd="true">
<name>RED: Write failing tests for connection manager</name>
<what>
Test cases:
- Connection manager tracks connections by user ID
- Adding connection increments count
- Removing connection decrements count
- Getting connections for user returns correct set
- Cleanup removes all connections for a user
</what>
<files>tests/websocket/connection.test.ts</files>
<verification>npm test -- --grep "connection manager" fails</verification>
<done>5+ test cases exist and fail</done>
</task>

<task id="3" type="auto" tdd="true">
<name>GREEN: Implement connection manager</name>
<what>Create ConnectionManager class that passes all tests.</what>
<files>src/websocket/connection-manager.ts, src/types/websocket.ts</files>
<verification>npm test -- --grep "connection manager" passes</verification>
<done>All connection manager tests pass</done>
</task>

<task id="4" type="auto" tdd="true">
<name>RED: Write failing tests for WebSocket auth</name>
<what>
Test cases:
- Valid JWT in query param authenticates successfully
- Expired JWT is rejected
- Missing JWT triggers 5-second timeout then disconnect
- Invalid JWT format is rejected immediately
</what>
<files>tests/websocket/server.test.ts</files>
<verification>npm test -- --grep "websocket auth" fails</verification>
<done>4 test cases exist and fail</done>
</task>

<task id="5" type="auto" tdd="true">
<name>GREEN: Implement WebSocket server with auth</name>
<what>Create WebSocket server, integrate auth middleware, wire up connection manager.</what>
<files>src/websocket/server.ts, src/websocket/auth-middleware.ts</files>
<verification>npm test -- --grep "websocket" passes</verification>
<done>All WebSocket tests pass</done>
</task>

<task id="6" type="checkpoint:human-verify">
<name>Verify WebSocket server works</name>
<what>Confirm WebSocket connections work with real JWT.</what>
<verify>
1. Start server: npm run dev
2. Get a JWT: curl -X POST localhost:3000/auth/login -d '{"email":"test@test.com","password":"test123"}'
3. Connect: wscat -c "ws://localhost:3000/ws?token=YOUR_JWT"
4. Should see "Connected" message
5. Open second tab with same token — both should stay connected
</verify>
<resume_signal>Type "approved" or describe issues</resume_signal>
</task>

<task id="7" type="auto">
<name>Add Redis pub/sub for multi-instance support</name>
<what>Publish connection/disconnection events to Redis channel. Subscribe to events from other instances.</what>
<files>src/websocket/server.ts, src/websocket/connection-manager.ts</files>
<verification>Two server instances share connection state via Redis</verification>
<done>Connection events visible across instances</done>
</task>

<task id="8" type="checkpoint:decision">
<name>Decide heartbeat interval</name>
<what>Choose ping/pong interval for connection health checking.</what>
<options>
- 15s: More responsive disconnect detection, slightly more network traffic
- 30s: Standard interval, good balance
- 60s: Less traffic, slower disconnect detection
</options>
<resume_signal>Select: 15s, 30s, or 60s</resume_signal>
</task>

</tasks>

<must_haves>
- WebSocket server accepts authenticated connections
- JWT authentication on connection
- Connection tracking per user
- Redis pub/sub for horizontal scaling
- Graceful disconnection handling
- TDD cycle completed for all core logic
</must_haves>

<success_criteria>
- [ ] TDD RED phase: all tests written and failing
- [ ] TDD GREEN phase: all tests passing
- [ ] WebSocket connections authenticated via JWT
- [ ] Multiple connections per user tracked
- [ ] Redis pub/sub distributes events
- [ ] Heartbeat keeps connections alive
</success_criteria>
