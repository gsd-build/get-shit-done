# Phase 13: Foundation Infrastructure - Research

**Researched:** 2026-03-11
**Domain:** Real-time infrastructure (WebSocket, file locking, path security, monorepo setup)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Monorepo Structure:**
- Feature-based organization: apps/web, apps/server, packages/events, packages/gsd-core
- Full SDK in shared package: typed client/server wrappers, connection helpers, retry logic
- GSD integration: Wrapper package defining v3.0 API, implemented with current CJS modules (temporary until v3.0 replaces)
- Build tooling: Turborepo + pnpm workspaces
- TypeScript: Strict everywhere (strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes)

**WebSocket Protocol:**
- Namespacing: Rooms within single namespace + prefixed event names (agent:token, checkpoint:request)
- Reconnection: Full replay from checkpoint (v2.0); evolves to Snapshot + Bounded Replay in v3.0
- Token buffering: requestAnimationFrame batching with render-time telemetry; evolve to adaptive throttling in v3.0 if metrics warrant
- Heartbeat: Both Socket.IO built-in (pingInterval/pingTimeout) + app-level health metrics
- Error verbosity: Environment-aware (full stack traces in dev, structured codes + messages in prod)

**File Locking:**
- Scope: Advisory locks on main worktree only (agents work in isolated worktrees, no cross-worktree conflicts)
- Stale locks: TTL-based expiry (30s), auto-cleanup on next access
- Lock API: Internal auto-locking for standard ops + exposed acquireLock()/releaseLock() for advanced cases
- Lock failures: Structured errors with context { code, file, holder, age }

**Security Boundaries:**
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

### Deferred Ideas (OUT OF SCOPE)

None - discussion stayed within phase scope

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | WebSocket server supports bidirectional communication with auto-reconnect and state sync on reconnection | Socket.IO 4.x connection state recovery, rooms/namespace patterns, reconnection configuration |
| INFRA-02 | Token buffering system batches streaming output using requestAnimationFrame to prevent UI backpressure | RAF batching patterns, ref-based buffering, render-time telemetry collection |
| INFRA-03 | File locking prevents race conditions when CLI and dashboard access the same .planning/ files concurrently | proper-lockfile TTL patterns, existing worktree.cjs lock architecture |
| INFRA-04 | Security layer validates file paths, resolves symlinks, and restricts access to project directories only | Path traversal prevention, fs.realpath() symlink resolution, allowlist/denylist patterns |

</phase_requirements>

## Summary

Phase 13 establishes the infrastructure foundation for all real-time streaming and concurrent file access in the GSD dashboard. The phase is well-scoped with clear decisions from CONTEXT.md, requiring implementation of four core subsystems: WebSocket server with connection state recovery, requestAnimationFrame-based token buffering, advisory file locking, and path security with symlink validation.

The monorepo structure (Turborepo + pnpm workspaces) provides the organizational foundation for separating apps (web, server) from shared packages (events, gsd-core). Socket.IO 4.x provides production-ready connection state recovery out-of-the-box, with `maxDisconnectionDuration` and `skipMiddlewares` configuration handling the reconnection semantics. The existing GSD codebase patterns (CJS modules in lib/, error envelope pattern from MCP) provide clear templates for implementation.

**Primary recommendation:** Start with monorepo scaffold and shared type definitions, then implement WebSocket server with Socket.IO connection state recovery, token buffering with RAF batching, file locking extending existing worktree.cjs patterns, and security layer using fs.realpath() with allowlist validation.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| socket.io | 4.8.x | WebSocket server with connection state recovery | Production-ready reconnection, rooms, namespaces, built-in heartbeat |
| socket.io-client | 4.8.x | WebSocket client for dashboard | Matches server version, typed events support |
| proper-lockfile | 4.x | Advisory file locking with TTL | mkdir-based atomic locks, network filesystem safe, stale detection |
| turborepo | 2.x | Monorepo build orchestration | Caching, parallel execution, pnpm-native |
| pnpm | 9.x | Package manager with workspaces | Fast installs, strict dependency resolution, workspace protocol |
| typescript | 5.4+ | Type-safe development | Strict mode with noUncheckedIndexedAccess support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 3.x | Runtime type validation | Already in project dependencies, use for event payload validation |
| tsx | 4.x | TypeScript execution | Development mode, no build step required |
| vitest | 2.x | Unit/integration testing | New packages use modern test runner; existing CJS uses Node test runner |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Socket.IO | ws + custom | Socket.IO adds ~30KB but provides reconnection, rooms, namespaces built-in |
| proper-lockfile | lockfile | proper-lockfile uses mkdir (atomic on NFS), lockfile uses O_EXCL (broken on NFS) |
| Turborepo | Nx | Turborepo is lighter, pnpm-native; Nx has more features but heavier |

**Installation:**
```bash
# Root package.json setup
pnpm add -D turbo typescript vitest tsx

# Server dependencies
pnpm add -F @gsd/server socket.io proper-lockfile zod

# Client dependencies
pnpm add -F @gsd/web socket.io-client

# Shared packages
pnpm add -F @gsd/events zod
pnpm add -F @gsd/gsd-core # wraps existing CJS modules
```

## Architecture Patterns

### Recommended Project Structure
```
.
├── apps/
│   ├── web/                    # Next.js/Vite dashboard
│   │   ├── src/
│   │   │   ├── hooks/          # useSocket, useTokenStream
│   │   │   └── lib/            # Client utilities
│   │   └── package.json
│   └── server/                 # Express + Socket.IO
│       ├── src/
│       │   ├── socket/         # Socket.IO handlers
│       │   ├── security/       # Path validation
│       │   └── locks/          # File locking
│       └── package.json
├── packages/
│   ├── events/                 # Shared event types
│   │   ├── src/
│   │   │   ├── types.ts        # Event payload types
│   │   │   ├── schemas.ts      # Zod schemas
│   │   │   └── index.ts
│   │   └── package.json
│   └── gsd-core/               # GSD library wrapper
│       ├── src/
│       │   ├── api.ts          # v3.0 API surface
│       │   ├── adapters/       # CJS module adapters
│       │   └── index.ts
│       └── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json          # Shared strict config
└── package.json                # Root workspace
```

### Pattern 1: Socket.IO Connection State Recovery
**What:** Server stores session state for disconnected clients, replays missed events on reconnection
**When to use:** All WebSocket connections to maintain checkpoint state across network interruptions
**Example:**
```typescript
// Source: https://socket.io/docs/v4/connection-state-recovery
import { Server } from 'socket.io';

const io = new Server(httpServer, {
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true, // Skip auth middleware on recovery
  },
  pingInterval: 25000,
  pingTimeout: 20000,
});

io.on('connection', (socket) => {
  if (socket.recovered) {
    // socket.id, socket.rooms, socket.data restored
    // Missed packets already replayed by Socket.IO
    console.log('Recovered session:', socket.id);
  } else {
    // New session - initialize state
    initializeSession(socket);
  }
});
```

### Pattern 2: requestAnimationFrame Token Buffering
**What:** Buffer incoming tokens in a ref, flush to state on RAF cadence
**When to use:** High-frequency streaming to prevent render thrashing
**Example:**
```typescript
// Source: https://www.sitepoint.com/streaming-backends-react-controlling-re-render-chaos/
import { useRef, useState, useEffect, useCallback } from 'react';

interface UseTokenBufferOptions {
  onRenderTelemetry?: (frameTime: number, tokenCount: number) => void;
}

function useTokenBuffer(socket: Socket, options: UseTokenBufferOptions = {}) {
  const bufferRef = useRef<string[]>([]);
  const [tokens, setTokens] = useState<string[]>([]);
  const frameIdRef = useRef<number>();

  const flush = useCallback(() => {
    if (bufferRef.current.length > 0) {
      const frameStart = performance.now();
      setTokens(prev => [...prev, ...bufferRef.current]);
      bufferRef.current = [];

      // Collect render telemetry for v3.0 adaptive throttling
      if (options.onRenderTelemetry) {
        requestAnimationFrame(() => {
          const frameTime = performance.now() - frameStart;
          options.onRenderTelemetry?.(frameTime, bufferRef.current.length);
        });
      }
    }
    frameIdRef.current = requestAnimationFrame(flush);
  }, [options]);

  useEffect(() => {
    socket.on('agent:token', (token: string) => {
      bufferRef.current.push(token);
    });

    frameIdRef.current = requestAnimationFrame(flush);
    return () => cancelAnimationFrame(frameIdRef.current!);
  }, [socket, flush]);

  return tokens;
}
```

### Pattern 3: Advisory File Locking with TTL
**What:** mkdir-based locks with automatic stale detection and cleanup
**When to use:** .planning/ file writes from CLI and dashboard
**Example:**
```typescript
// Source: https://github.com/moxystudio/node-proper-lockfile
import lockfile from 'proper-lockfile';

interface LockOptions {
  stale: number;        // TTL in ms (default: 30000)
  update: number;       // mtime refresh interval (stale/2)
  retries: number;      // Retry attempts
}

const DEFAULT_LOCK_OPTIONS: LockOptions = {
  stale: 30000,         // 30s TTL per CONTEXT.md
  update: 15000,        // Refresh every 15s
  retries: 3,
};

async function withFileLock<T>(
  filePath: string,
  operation: () => Promise<T>,
  options: Partial<LockOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_LOCK_OPTIONS, ...options };

  let release: (() => Promise<void>) | undefined;
  try {
    release = await lockfile.lock(filePath, {
      stale: opts.stale,
      update: opts.update,
      retries: opts.retries,
      onCompromised: (err) => {
        console.error('Lock compromised:', err);
      },
    });

    return await operation();
  } finally {
    if (release) {
      await release();
    }
  }
}
```

### Pattern 4: Path Security with Symlink Resolution
**What:** Validate paths are within project root after resolving symlinks
**When to use:** All file operations before read/write
**Example:**
```typescript
// Source: https://nodejsdesignpatterns.com/blog/nodejs-path-traversal-security/
import { resolve, relative, isAbsolute } from 'path';
import { realpath, lstat } from 'fs/promises';

interface SecurityConfig {
  projectRoot: string;
  symlinkPolicy: 'allow' | 'deny' | 'project-only';
  denylist: string[];  // Patterns: ['.env*', '*.pem', '*.key', 'secrets/**']
}

interface ValidationResult {
  valid: boolean;
  resolvedPath: string;
  reason?: string;
  isSymlink: boolean;
}

async function validatePath(
  requestedPath: string,
  config: SecurityConfig
): Promise<ValidationResult> {
  const { projectRoot, symlinkPolicy, denylist } = config;

  // Normalize to absolute path
  const absolutePath = isAbsolute(requestedPath)
    ? requestedPath
    : resolve(projectRoot, requestedPath);

  // Check denylist BEFORE resolving symlinks
  for (const pattern of denylist) {
    if (matchesPattern(absolutePath, pattern)) {
      return {
        valid: false,
        resolvedPath: absolutePath,
        reason: `Path matches denylist pattern: ${pattern}`,
        isSymlink: false,
      };
    }
  }

  // Check if symlink and resolve
  let resolvedPath = absolutePath;
  let isSymlink = false;

  try {
    const stats = await lstat(absolutePath);
    isSymlink = stats.isSymbolicLink();

    if (isSymlink) {
      if (symlinkPolicy === 'deny') {
        return {
          valid: false,
          resolvedPath: absolutePath,
          reason: 'Symlinks are denied by policy',
          isSymlink: true,
        };
      }

      // Resolve symlink to actual target
      resolvedPath = await realpath(absolutePath);
    }
  } catch (err) {
    // File doesn't exist yet - validate requested path
    resolvedPath = absolutePath;
  }

  // Validate resolved path is within project root
  const relativePath = relative(projectRoot, resolvedPath);
  const escapesRoot = relativePath.startsWith('..') || isAbsolute(relativePath);

  if (escapesRoot) {
    return {
      valid: false,
      resolvedPath,
      reason: `Path escapes project root: ${resolvedPath}`,
      isSymlink,
    };
  }

  // For project-only symlink policy, target must also be in project
  if (isSymlink && symlinkPolicy === 'project-only') {
    const targetRelative = relative(projectRoot, resolvedPath);
    if (targetRelative.startsWith('..') || isAbsolute(targetRelative)) {
      return {
        valid: false,
        resolvedPath,
        reason: 'Symlink target is outside project root',
        isSymlink: true,
      };
    }
  }

  return { valid: true, resolvedPath, isSymlink };
}
```

### Anti-Patterns to Avoid
- **setState on every token:** Causes 20+ renders/second; use RAF buffering instead
- **String-based blocklists for paths:** `replace(/\.\.\//g, '')` is bypassable with `..././`; use fs.realpath()
- **Relying on O_EXCL for locks:** Broken on NFS; use mkdir-based locks (proper-lockfile)
- **Single namespace per concern:** Creates connection overhead; use rooms within single namespace
- **Skipping symlink resolution:** CVE-2026-24842 shows symlinks bypass path checks; always resolve first

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket reconnection | Custom retry logic | Socket.IO connection state recovery | Handles edge cases (buffered packets, room restoration, middleware skip) |
| File locking | flock() wrapper | proper-lockfile | mkdir is atomic on NFS, handles stale detection, cross-platform |
| Path validation | regex blocklist | fs.realpath() + relative path check | Blocklists miss edge cases (../, null bytes, double encoding) |
| Token batching | setInterval batching | requestAnimationFrame | RAF syncs with display refresh, auto-pauses on tab switch |
| Monorepo orchestration | Custom build scripts | Turborepo | Caching, dependency graph, remote caching support |

**Key insight:** Each of these problems has subtle edge cases that only manifest in production. Socket.IO's recovery handles packet ordering. proper-lockfile handles NFS atomicity. fs.realpath() follows symlink chains. RAF handles display throttling. Turborepo handles incremental builds.

## Common Pitfalls

### Pitfall 1: Socket.IO Version Mismatch
**What goes wrong:** Client and server on different major versions fail to connect
**Why it happens:** socket.io and socket.io-client installed separately, drift over time
**How to avoid:** Use workspace protocol `"socket.io-client": "workspace:*"` in shared events package
**Warning signs:** "invalid namespace" or "packet parsing" errors in console

### Pitfall 2: Lock Starvation Under Load
**What goes wrong:** Many concurrent writers timeout waiting for lock
**Why it happens:** TTL too short, retry count too low, no backoff
**How to avoid:** 30s TTL, exponential backoff with jitter, queue writes if needed
**Warning signs:** "ELOCKED" errors, file writes silently dropped

### Pitfall 3: Symlink Time-of-Check-Time-of-Use (TOCTOU)
**What goes wrong:** Symlink target changes between validation and access
**Why it happens:** Validating symlink then opening separately
**How to avoid:** Open with O_NOFOLLOW when policy is deny, or resolve in same operation
**Warning signs:** Security audit failures, unexpected file access in logs

### Pitfall 4: RAF Buffer Memory Leak
**What goes wrong:** Tokens accumulate in buffer when tab is backgrounded
**Why it happens:** RAF stops firing but socket keeps receiving
**How to avoid:** Cap buffer size, drop oldest tokens when full, flush on visibility change
**Warning signs:** Memory usage grows over time, OOM on long sessions

### Pitfall 5: TypeScript Strict Mode Breaking Existing CJS
**What goes wrong:** Importing existing GSD CJS modules fails type checks
**Why it happens:** CJS modules don't have strict typing, noUncheckedIndexedAccess adds undefined
**How to avoid:** Use adapter pattern in gsd-core package with explicit type annotations
**Warning signs:** "Object is possibly 'undefined'" errors when accessing lib/ functions

## Code Examples

### Monorepo Configuration Files

**pnpm-workspace.yaml:**
```yaml
# Source: https://pnpm.io/pnpm-workspace_yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

**turbo.json:**
```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "globalDependencies": ["tsconfig.base.json"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    }
  }
}
```

**tsconfig.base.json:**
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

### Socket.IO Server Setup with Rooms

```typescript
// Source: https://socket.io/docs/v4/rooms/
import { Server, Socket } from 'socket.io';
import type { ServerEvents, ClientEvents } from '@gsd/events';

// Prefixed event names per CONTEXT.md
const EVENTS = {
  AGENT_TOKEN: 'agent:token',
  AGENT_START: 'agent:start',
  AGENT_END: 'agent:end',
  CHECKPOINT_REQUEST: 'checkpoint:request',
  CHECKPOINT_RESPONSE: 'checkpoint:response',
} as const;

function setupSocketHandlers(io: Server<ClientEvents, ServerEvents>) {
  io.on('connection', (socket) => {
    // Join project room
    const projectId = socket.handshake.query.projectId as string;
    if (projectId) {
      socket.join(`project:${projectId}`);
    }

    // Join agent room for streaming
    socket.on('agent:subscribe', (agentId: string) => {
      socket.join(`agent:${agentId}`);
    });

    // Broadcast token to agent room
    // Called from agent execution context
    socket.on(EVENTS.AGENT_TOKEN, (data: { agentId: string; token: string }) => {
      io.to(`agent:${data.agentId}`).emit(EVENTS.AGENT_TOKEN, data.token);
    });
  });
}
```

### Environment-Aware Error Handling

```typescript
// Following MCP error envelope pattern from existing codebase
interface ErrorEnvelope {
  success: false;
  data: null;
  error: {
    code: string;
    message: string;
    recovery?: string;
    stack?: string;  // Only in development
  };
  next_actions: string[];
}

function createErrorResponse(
  err: Error,
  recovery?: string
): ErrorEnvelope {
  const isDev = process.env.NODE_ENV === 'development';

  return {
    success: false,
    data: null,
    error: {
      code: err.name,
      message: err.message,
      recovery,
      stack: isDev ? err.stack : undefined,
    },
    next_actions: [],
  };
}
```

### Structured Audit Logging

```typescript
// Per CONTEXT.md: Structured logs { path, reason, timestamp } + metrics counter
interface AuditLogEntry {
  timestamp: string;
  path: string;
  reason: string;
  action: 'blocked' | 'allowed';
  isSymlink: boolean;
  resolvedPath?: string;
}

interface SecurityMetrics {
  blockedCount: number;
  allowedCount: number;
  symlinkCount: number;
}

class SecurityAuditLog {
  private metrics: SecurityMetrics = {
    blockedCount: 0,
    allowedCount: 0,
    symlinkCount: 0,
  };

  log(entry: Omit<AuditLogEntry, 'timestamp'>) {
    const logEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    // Update metrics
    if (entry.action === 'blocked') {
      this.metrics.blockedCount++;
    } else {
      this.metrics.allowedCount++;
    }
    if (entry.isSymlink) {
      this.metrics.symlinkCount++;
    }

    // Structured JSON log
    console.error(JSON.stringify(logEntry));
  }

  getMetrics(): SecurityMetrics {
    return { ...this.metrics };
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual reconnection | Socket.IO connection state recovery | v4.6.0 (Feb 2023) | Built-in packet replay, room restoration |
| setInterval for streaming | requestAnimationFrame batching | ~2022 | Sync with display, auto-pause on background |
| flock() file locks | mkdir-based advisory locks | proper-lockfile v3 | NFS-safe, stale detection |
| Blocklist path validation | Allowlist + fs.realpath() | Node.js 2026 security fixes | CVE-resistant symlink handling |
| Multi-repo or Lerna | Turborepo + pnpm workspaces | ~2023 | Faster builds, better caching |

**Deprecated/outdated:**
- socket.io-redis for sticky sessions: Use Socket.IO 4.x adapter directly
- lockfile npm package: Use proper-lockfile (better stale detection)
- Lerna: Turborepo provides better caching and is lighter

## Open Questions

1. **Lock file location**
   - What we know: proper-lockfile creates .lock files next to locked files
   - What's unclear: Should locks be in .planning/locks/ directory or next to files?
   - Recommendation: Next to files (default proper-lockfile behavior) for simplicity

2. **Metrics storage approach**
   - What we know: Need render telemetry and blocked access counters
   - What's unclear: In-memory vs persisted, aggregation interval
   - Recommendation: In-memory with periodic flush to .planning/metrics.json

3. **gsd-core API surface**
   - What we know: Wrap existing CJS modules with TypeScript types
   - What's unclear: Which functions to expose in v3.0 API
   - Recommendation: Start with phase, state, roadmap modules used by dashboard

## Sources

### Primary (HIGH confidence)
- [Socket.IO Connection State Recovery](https://socket.io/docs/v4/connection-state-recovery) - maxDisconnectionDuration, skipMiddlewares, recovery detection
- [Socket.IO Rooms](https://socket.io/docs/v4/rooms/) - Room patterns, prefixed events
- [proper-lockfile GitHub](https://github.com/moxystudio/node-proper-lockfile) - mkdir strategy, stale detection, TTL configuration
- [pnpm Workspaces](https://pnpm.io/workspaces) - pnpm-workspace.yaml configuration
- [Turborepo Structuring](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository) - apps/ vs packages/ structure

### Secondary (MEDIUM confidence)
- [Streaming Backends & React RAF Batching](https://www.sitepoint.com/streaming-backends-react-controlling-re-render-chaos/) - useServerStream hook pattern, ref-based buffering
- [TypeScript Strict Mode Guide](https://oneuptime.com/blog/post/2026-02-20-typescript-strict-mode-guide/view) - noUncheckedIndexedAccess, exactOptionalPropertyTypes
- [Node.js Path Traversal Security](https://nodejsdesignpatterns.com/blog/nodejs-path-traversal-security/) - allowlist patterns, fs.realpath() usage
- [Node.js January 2026 Security Releases](https://nodesource.com/blog/nodejs-security-release-january-2026) - Symlink traversal CVE context

### Tertiary (LOW confidence)
- Nhost Turborepo blog post - Real-world monorepo patterns (needs validation)
- Medium articles on pnpm workspaces - Configuration examples (verify against official docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official docs, stable versions, production-proven
- Architecture: HIGH - Patterns from Socket.IO and Turborepo official sources
- Pitfalls: HIGH - CVE data, official documentation, established best practices

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (30 days - stable technologies)
