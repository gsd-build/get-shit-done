# Phase 13: Foundation Infrastructure - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the infrastructure layer required for all real-time streaming and concurrent file access. This includes WebSocket server, token buffering, file locking, and security layer. All downstream dashboard features (Phases 14-20) depend on this foundation.

</domain>

<decisions>
## Implementation Decisions

### Monorepo Structure
- Feature-based organization: apps/web, apps/server, packages/events, packages/gsd-core
- Full SDK in shared package: typed client/server wrappers, connection helpers, retry logic
- GSD integration: Wrapper package defining v3.0 API, implemented with current CJS modules (temporary until v3.0 replaces)
- Build tooling: Turborepo + pnpm workspaces
- TypeScript: Strict everywhere (strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes)

### WebSocket Protocol
- Namespacing: Rooms within single namespace + prefixed event names (agent:token, checkpoint:request)
- Reconnection: Full replay from checkpoint (v2.0); evolves to Snapshot + Bounded Replay in v3.0
- Token buffering: requestAnimationFrame batching with render-time telemetry; evolve to adaptive throttling in v3.0 if metrics warrant
- Heartbeat: Both Socket.IO built-in (pingInterval/pingTimeout) + app-level health metrics
- Error verbosity: Environment-aware (full stack traces in dev, structured codes + messages in prod)

### File Locking
- Scope: Advisory locks on main worktree only (agents work in isolated worktrees, no cross-worktree conflicts)
- Stale locks: TTL-based expiry (30s), auto-cleanup on next access
- Lock API: Internal auto-locking for standard ops + exposed acquireLock()/releaseLock() for advanced cases
- Lock failures: Structured errors with context { code, file, holder, age }

### Security Boundaries
- Path security: Project root only + hardcoded denylist (.env*, *.pem, *.key, secrets/**); evolve to configurable boundaries in v3.0
- Symlinks: Resolve and validate target is within boundaries + configurable policy (allow/deny/project-only, default: allow)
- Audit logging: Structured logs { path, reason, timestamp } + metrics counter for blocked access
- Security implementation: Shared in packages/gsd-core for consistent CLI/dashboard behavior

### Claude's Discretion
- Exact package naming conventions
- Turborepo pipeline configuration details
- Socket.IO version and configuration specifics
- Lock file format and location
- Metrics storage and aggregation approach

</decisions>

<specifics>
## Specific Ideas

- gsd-core wrapper API should be designed as the v3.0 target API — implement with current CJS modules as temporary bridge
- Token buffering should collect slow-frame telemetry to inform v3.0 adaptive throttling decision
- Security layer is defense-in-depth for single-user local tool, not protection against active threats

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-foundation-infrastructure*
*Context gathered: 2026-03-11*
