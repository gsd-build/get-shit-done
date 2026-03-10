# Pitfalls Research

**Domain:** Real-time AI Agent Dashboard with WebSocket Streaming
**Researched:** 2026-03-10
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: WebSocket State Desynchronization on Reconnect

**What goes wrong:**
After a network disconnection, the client reconnects but misses events that occurred during the outage. The UI shows stale state (e.g., a phase appears "executing" when it completed minutes ago), checkpoint dialogs appear for already-resolved checkpoints, or progress percentages jump backwards.

**Why it happens:**
Socket.IO's automatic reconnection restores the connection but not application state. Developers assume reconnection = full state recovery. The server's "connection state recovery" feature only works within a limited time window (default 2 minutes) and doesn't capture application-level state like execution progress or checkpoint status.

**How to avoid:**
1. On reconnect, emit a `state:sync` request to fetch full current state
2. Use a monotonic sequence number on all events; client discards out-of-order events
3. Store authoritative state server-side (Redis or database), not in WebSocket handlers
4. Implement optimistic UI updates with server reconciliation

**Warning signs:**
- Progress bars jumping or resetting
- Duplicate checkpoint dialogs
- UI showing "executing" when server shows "complete"
- Tests passing locally but failing with network throttling

**Phase to address:**
Foundation Phase (WebSocket infrastructure setup)

---

### Pitfall 2: Checkpoint Race Conditions Across Browser/Server Boundary

**What goes wrong:**
User clicks "approve" on a checkpoint, but before the server processes it, the agent times out or another user (in future multi-user scenario) responds. The server accepts both responses, or the wrong response is applied. Alternatively, the checkpoint dialog appears twice because the WebSocket event was duplicated during reconnection.

**Why it happens:**
Checkpoints are inherently stateful interactions that span async boundaries. The browser doesn't know if the server already moved past the checkpoint. Without idempotency, the same checkpoint can be "responded to" multiple times.

**How to avoid:**
1. Assign unique IDs to each checkpoint instance
2. Server validates checkpoint ID is still pending before accepting response
3. Return explicit acknowledgment with checkpoint status (accepted/stale/superseded)
4. UI immediately disables buttons after click, shows "submitting" state
5. Use optimistic locking: checkpoint includes a version number

**Warning signs:**
- Checkpoint dialogs not dismissing after response
- Agents receiving multiple answers to same checkpoint
- "Stale checkpoint" errors in production logs

**Phase to address:**
Execute Phase UI (checkpoint handling implementation)

---

### Pitfall 3: Streaming Backpressure Overwhelms UI Rendering

**What goes wrong:**
Claude streams tokens faster than React can render them. The browser accumulates a massive backlog of pending state updates. Memory usage spikes, the UI freezes, and eventually the tab crashes. This is especially bad for long code generation or verbose explanations.

**Why it happens:**
LLM token generation (50-100 tokens/sec) is faster than DOM update cycles (~60fps). Naive implementations call `setState` for every token, triggering reconciliation each time. The render queue grows unbounded.

**How to avoid:**
1. Buffer incoming tokens outside React state (in a ref or external store)
2. Use `requestAnimationFrame` to flush buffer at display rate, not token rate
3. Implement bounded buffer with overflow handling (drop oldest tokens from display buffer)
4. Use virtualized rendering for long outputs (react-window or @tanstack/virtual)
5. Batch tokens into chunks (e.g., 10 tokens per setState)

**Warning signs:**
- Browser dev tools showing 100%+ CPU during streaming
- "Maximum update depth exceeded" React errors
- Tab becoming unresponsive during long generations
- Memory growth that doesn't stabilize after streaming ends

**Phase to address:**
Discuss Phase UI (first streaming interface)

---

### Pitfall 4: File System Race Conditions Between Web Server and CLI

**What goes wrong:**
A user runs `/gsd:execute` from Claude Code CLI while the web dashboard is also monitoring the same project. Both try to update STATE.md simultaneously. One write is lost, corrupting the state file. Or worse, the web server reads a partially-written file and crashes trying to parse malformed markdown.

**Why it happens:**
GSD's existing CLI tools don't use file locking. The web server adds a second concurrent accessor. File operations aren't atomic on most systems. The state-merge.cjs tool wasn't designed for concurrent external modification.

**How to avoid:**
1. Use advisory file locking (fs-ext flock or proper-lockfile npm package)
2. Implement read-modify-write with retry on conflict
3. Consider single-writer architecture: all writes go through web server
4. Use file watching with debounce to detect external changes
5. Store web server state separately from CLI state, merge on read

**Warning signs:**
- Corrupted STATE.md or ROADMAP.md files
- "Unexpected token" JSON/markdown parse errors
- State appearing to "revert" after external CLI operations

**Phase to address:**
Foundation Phase (file system access layer)

---

### Pitfall 5: Agent Orchestration Memory Leaks from Unfinished Conversations

**What goes wrong:**
Each agent conversation creates Claude API client instances, message history arrays, and streaming response handlers. If a user abandons a session (closes browser, navigates away) without explicit cleanup, these resources stay allocated. After running for days, the server exhausts memory and crashes.

**Why it happens:**
Claude API SDK clients hold references to in-flight requests. Response stream handlers maintain closures over conversation state. Browser disconnection events don't reliably fire (network failures vs explicit close). BullMQ jobs can become zombies if worker crashes mid-execution.

**How to avoid:**
1. Set maximum conversation lifetime with automatic cleanup
2. Use WeakRef for non-critical references where possible
3. Implement heartbeat system: client pings every 30s, server cleans up silent sessions after 2 minutes
4. Register 'disconnect' event cleanup for Socket.IO, but also run periodic sweep
5. BullMQ: set job timeout and stall interval appropriately

**Warning signs:**
- Memory usage growing linearly with uptime
- Old sessions appearing in debug tools
- "Heap out of memory" crashes after 24-48 hours
- Redis memory growing from abandoned BullMQ jobs

**Phase to address:**
Foundation Phase (agent orchestration layer)

---

### Pitfall 6: Monaco Editor Memory Leaks on Component Unmount

**What goes wrong:**
Navigating between views creates new Monaco editor instances. The old instances aren't properly disposed, leaving worker threads running and models allocated. After switching views several times, the browser tab uses gigabytes of memory.

**Why it happens:**
Monaco's completion providers, worker threads (graphql, typescript, etc.), and diff models aren't automatically garbage collected. React's cleanup lifecycle doesn't call Monaco's dispose methods by default. The `@monaco-editor/react` wrapper handles basic cleanup but not language-specific workers.

**How to avoid:**
1. Call `editor.dispose()` in useEffect cleanup
2. Dispose completion providers explicitly
3. Use a single Monaco instance and swap models instead of creating/destroying editors
4. Monitor worker count in dev tools; should stay constant
5. Use `@monaco-editor/react` v4.7+ which handles more cleanup automatically

**Warning signs:**
- Multiple `monaco.worker.js` instances in dev tools
- Memory usage growing on each view navigation
- Completion provider registrations accumulating
- Editor becoming sluggish after extended use

**Phase to address:**
Plan Phase UI or Execute Phase UI (wherever diff viewer is implemented)

---

### Pitfall 7: Claude API Rate Limits Interpreted as Outages

**What goes wrong:**
The web server hammers the Claude API during concurrent plan executions. Rate limit responses (429) start returning. The naive error handler treats these as "service down" and fails the entire operation. Users see "Claude is unavailable" when it's actually just rate-limited.

**Why it happens:**
Rate limiting is sophisticated: per-minute, per-day, and concurrent request limits. Different limits have different recovery strategies. Generic error handling doesn't distinguish 429 from 500.

**How to avoid:**
1. Parse Claude API error responses for rate limit headers
2. Implement token bucket or leaky bucket rate limiter client-side
3. Queue requests through BullMQ with rate limiting configuration
4. Exponential backoff specifically for 429s (not generic retry)
5. Show "rate limited, retrying in Xs" UI feedback, not "service down"

**Warning signs:**
- "Service unavailable" errors that resolve by waiting
- Bursts of failures during parallel execution
- Different behavior between single-plan and wave execution

**Phase to address:**
Foundation Phase (Claude API integration layer)

---

### Pitfall 8: Node.js File System Sandbox Escape via Symlinks

**What goes wrong:**
The web server is configured to only access files within project directories. An attacker creates a project with a symlink: `.planning/STATE.md -> /etc/passwd`. The server follows the symlink and serves sensitive system files. Or worse, writes malicious content to system locations.

**Why it happens:**
Node.js fs module follows symlinks by default. Path validation checks the requested path, not the resolved target. The recent Node.js CVE-2025-55130 demonstrates this exact vulnerability in the --allow-fs-read sandbox.

**How to avoid:**
1. Use `fs.realpathSync` to resolve symlinks before access
2. Validate resolved path, not requested path
3. Use `O_NOFOLLOW` flag where possible
4. Run server in container with limited filesystem view
5. Maintain allowlist of project directories

**Warning signs:**
- Server accessing files outside project directories in logs
- Requests for `..` path segments succeeding
- Symlinks in project directories pointing outside

**Phase to address:**
Foundation Phase (file system security layer)

---

### Pitfall 9: Zustand Store Stale Closures with WebSocket Callbacks

**What goes wrong:**
A WebSocket event handler closes over an old version of Zustand state. When the handler fires, it reads stale values and makes incorrect decisions. For example, the progress handler adds to an old snapshot of the progress array, losing recent updates.

**Why it happens:**
JavaScript closures capture values at definition time, not execution time. Zustand selectors return values, not references. WebSocket handlers are registered once at connection time. React useEffect dependencies are often incomplete.

**How to avoid:**
1. Use refs for values accessed in callbacks, or use Zustand's getState()
2. Re-register handlers when critical state changes (sparingly)
3. Use Zustand subscribe() for non-React code
4. Pattern: `socket.on('event', () => { const current = useStore.getState(); ... })`
5. Prefer `useCallback` with correct dependencies for handlers

**Warning signs:**
- State updates appearing to "not work" intermittently
- Handler using outdated values visible in console.log
- Race conditions appearing only under fast event sequences

**Phase to address:**
Discuss Phase UI (first Zustand + WebSocket integration)

---

### Pitfall 10: Infinite Re-render Loop in Real-time State Sync

**What goes wrong:**
User types in an input. Local state updates. Component sends update to server via WebSocket. Server broadcasts back to all clients (including sender). Client receives its own update and triggers local state update. Component re-renders and sends update again. Infinite loop.

**Why it happens:**
Standard real-time sync pattern without "echo suppression." Every change creates a feedback loop. The circuit breaker pattern isn't implemented.

**How to avoid:**
1. Tag outgoing updates with client ID; ignore echoes
2. Use a ref flag to mute incoming updates during local edits
3. Implement "ownership" model: only accept external updates for state you don't own
4. Debounce sends, but accept receives immediately
5. Use CRDTs (Y.js) for complex collaborative state

**Warning signs:**
- Input fields "fighting" the user
- CPU spikes during typing
- Network tab showing rapid repeated WebSocket messages

**Phase to address:**
Discuss Phase UI (CONTEXT.md live preview sync)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Polling instead of WebSocket | Simpler implementation | High server load, battery drain, latency | Never for AI streaming; OK for rare status checks |
| setState per token | Simplest streaming code | UI freezes, memory spikes | Never |
| Global singleton stores | Easy access anywhere | Testing nightmare, memory leaks | MVP only, refactor in foundation phase |
| No file locking | Works in single-user | Corruption with concurrent access | Never once dashboard ships |
| Raw fs module access | No extra deps | Security vulnerabilities | Never; wrap in security layer |
| Synchronous file reads | Simpler code flow | Blocks event loop during large files | Small config files only |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Claude API | Not setting stream: true | Always stream for UI responsiveness |
| Claude API | Ignoring thinking signatures | Verify thinking block integrity |
| Socket.IO | Registering handlers in connect callback | Register once at component mount, use refs |
| BullMQ | Sharing Redis connection between Queue and Worker | Use separate connections for each |
| BullMQ | Default maxRetriesPerRequest | Set to null for Workers |
| Redis | Default memory policy (allkeys-lru) | Set maxmemory-policy to noeviction |
| Monaco | Trusting auto-cleanup | Explicitly dispose on unmount |
| GSD State | Direct file writes | Use state-merge.cjs patterns for consistency |
| GSD MCP | Logging to stdout | Always use stderr (stdout is JSON-RPC) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unbounded token buffer | Memory growth during streaming | Bounded buffer + virtualized list | 10K+ tokens per message |
| DOM nodes per message | Sluggish scroll, high memory | Virtual scrolling | 100+ messages in chat history |
| Re-renders on every token | CPU spikes, frozen UI | RAF batching | Any streaming response |
| Large file diffs | Hang on file comparison | Truncate or lazy-load diffs | Files >10KB |
| WebSocket message size | Failed sends, memory pressure | Chunk large payloads | Payloads >1MB |
| Concurrent agent workers | Redis connection exhaustion | Connection pooling, limits | 10+ concurrent executions |
| Monaco syntax highlighting | Jank during scroll | Limit editor height, defer highlighting | Files >5000 lines |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| API keys in frontend code | Key theft, billing abuse | Server-side only, ephemeral tokens if needed |
| Following symlinks | File system escape, data theft | Resolve paths, validate real path |
| Unsanitized file paths | Directory traversal attack | Whitelist allowed directories, reject `..` |
| Raw bash execution | Command injection | Use spawn with array args, not shell strings |
| No CORS configuration | CSRF attacks | Strict origin policy |
| WebSocket without auth | Unauthorized access | Validate session before accepting WebSocket |
| Storing session in localStorage | XSS theft | HttpOnly cookies for sensitive tokens |
| No rate limiting | DoS attacks | Apply rate limits at API gateway level |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No streaming feedback | User thinks nothing is happening | Show "Claude is thinking..." immediately |
| Checkpoint timeout without warning | Lost work when user steps away | Visual countdown, audio alert at 30s |
| Silent reconnection | User sends messages into void | "Reconnecting..." banner with status |
| Progress bar jumps | Feels unreliable/broken | Smooth transitions, explain recalculations |
| Error messages with codes | User can't self-remedy | Human-readable message + suggested action |
| Modal blocking streaming | Can't see AI output while responding | Side panel or inline for checkpoints |
| No keyboard shortcuts | Power users frustrated | Cmd+Enter to send, Esc to cancel |
| Full page refresh on error | Lost conversation context | Inline error recovery |

## "Looks Done But Isn't" Checklist

- [ ] **Streaming:** Often missing token buffering - verify memory stable during long responses
- [ ] **WebSocket:** Often missing reconnection handling - verify behavior after network blip
- [ ] **Checkpoints:** Often missing timeout handling - verify checkpoint doesn't hang forever
- [ ] **File watching:** Often missing debounce - verify no event storms on save
- [ ] **Error boundaries:** Often missing at stream level - verify partial failure handling
- [ ] **Progress tracking:** Often missing wave-level granularity - verify shows plan-level progress
- [ ] **BullMQ jobs:** Often missing stalled job handling - verify recovery after server restart
- [ ] **Monaco:** Often missing dispose cleanup - verify no worker leak after navigation
- [ ] **Auth:** Often missing WebSocket auth - verify unauthenticated connections rejected
- [ ] **State sync:** Often missing conflict resolution - verify CLI+dashboard concurrent use

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| State desync | LOW | Force full state refresh from server |
| Checkpoint race | LOW | Re-fetch checkpoint status, show correct state |
| Backpressure crash | MEDIUM | Clear buffer, show "output truncated" message |
| File corruption | HIGH | Restore from git, may lose recent changes |
| Memory leak | MEDIUM | Restart server, implement cleanup |
| Monaco leak | LOW | Full page refresh, fix dispose code |
| Rate limit | LOW | Exponential backoff, queue requests |
| Symlink escape | HIGH | Audit logs for breach, patch immediately |
| Stale closure | LOW | Refresh component, fix refs/getState pattern |
| Infinite loop | LOW | Identify echo source, add client ID filter |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| WebSocket desync | Foundation | Test: disconnect during stream, verify resync |
| Checkpoint race | Execute Phase | Test: double-click approve, verify single response |
| Backpressure | Discuss Phase | Test: stream 50K token response, verify stable memory |
| File race conditions | Foundation | Test: concurrent CLI + dashboard writes |
| Memory leaks | Foundation | Test: 24-hour soak test with activity |
| Monaco leaks | Plan/Execute Phase | Test: navigate 50 times, verify worker count |
| Rate limits | Foundation | Test: burst 100 requests, verify graceful degradation |
| Symlink escape | Foundation | Test: create malicious symlink, verify access denied |
| Stale closures | Discuss Phase | Test: rapid state changes during WebSocket events |
| Infinite loops | Discuss Phase | Test: collaborative editing scenario |

## Sources

- [Building Real-Time AI Chat Infrastructure](https://render.com/articles/real-time-ai-chat-websockets-infrastructure) - HIGH confidence
- [SSE vs WebSockets for AI Chat](https://www.sniki.dev/posts/sse-vs-websockets-for-ai-chat/) - MEDIUM confidence
- [Socket.IO Connection State Recovery](https://socket.io/docs/v4/connection-state-recovery) - HIGH confidence
- [Socket.IO Real-Time Dashboards (2026)](https://oneuptime.com/blog/post/2026-01-26-socketio-realtime-dashboards/view) - MEDIUM confidence
- [Human-in-the-Loop Best Practices](https://www.permit.io/blog/human-in-the-loop-for-ai-agents-best-practices-frameworks-use-cases-and-demo) - HIGH confidence
- [NVIDIA Sandboxing for Agentic Workflows](https://developer.nvidia.com/blog/practical-security-guidance-for-sandboxing-agentic-workflows-and-managing-execution-risk/) - HIGH confidence
- [LLM Sandbox Documentation](https://vndee.github.io/llm-sandbox/) - MEDIUM confidence
- [Node.js Security Releases (January 2026)](https://nodejs.org/en/blog/vulnerability/december-2025-security-releases) - HIGH confidence
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html) - HIGH confidence
- [OWASP Node.js Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html) - HIGH confidence
- [BullMQ Production Guide](https://docs.bullmq.io/guide/going-to-production) - HIGH confidence
- [BullMQ Connection Guide](https://docs.bullmq.io/guide/connections) - HIGH confidence
- [React Monaco Editor Memory Issues](https://github.com/react-monaco-editor/react-monaco-editor/issues/110) - MEDIUM confidence
- [Rate Limiting for LLM APIs (2026)](https://dasroot.net/posts/2026/02/rate-limiting-backpressure-llm-apis/) - MEDIUM confidence
- [Streaming Backends & React Re-render Chaos](https://www.sitepoint.com/streaming-backends-react-controlling-re-render-chaos/) - HIGH confidence
- [AI Agent Orchestration (Deloitte 2026)](https://www.deloitte.com/us/en/insights/industry/technology/technology-media-and-telecom-predictions/2026/ai-agent-orchestration.html) - MEDIUM confidence
- [Claude API Streaming Documentation](https://platform.claude.com/docs/en/build-with-claude/streaming) - HIGH confidence
- [Zustand State Management (2026)](https://viprasol.com/blog/state-management-react-2026/) - MEDIUM confidence
- [Y.js for Collaborative React Apps](https://medium.com/@t.bendallah/taming-real-time-state-why-y-js-is-the-ultimate-tool-for-collaborative-react-apps-922630e9659f) - MEDIUM confidence

---
*Pitfalls research for: GSD Web Dashboard - Real-time AI Agent Orchestration*
*Researched: 2026-03-10*
