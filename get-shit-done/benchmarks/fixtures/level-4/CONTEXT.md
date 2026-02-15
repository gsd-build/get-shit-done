# Phase 04: Real-time Features — Context

## Decisions (LOCKED)

- **WebSocket library:** ws (not socket.io — we want standard WebSocket, not a framework)
- **Scaling strategy:** Redis pub/sub for cross-instance message distribution
- **Auth on connect:** JWT from query parameter, validated on upgrade
- **Message protocol:** JSON with discriminated union types (type field)
- **Presence model:** User can have multiple active connections (tabs/devices)
- **Heartbeat:** Server-initiated ping, client responds with pong
- **Testing:** TDD for all business logic, integration tests for WebSocket server

## Claude's Discretion

- Connection manager data structure (Map, WeakMap, custom)
- Redis channel naming convention
- Message serialization format (JSON vs MessagePack)
- Reconnection backoff strategy
- Error message format to clients

## Deferred Ideas

- Binary message support (v2)
- WebSocket compression (v2)
- Room/channel abstraction (v2)
- Message persistence/history (Phase 06)
- WebRTC signaling (v3)
