# Phase 12: Claude Code Remote Session Integration - Research

**Researched:** 2026-02-26
**Domain:** Claude CLI remote-control process management and dashboard integration
**Confidence:** HIGH

## Summary

Claude Code Remote Control is a feature that allows users to connect to a local Claude Code session from any device (browser at claude.ai/code or mobile app). When you run `claude remote-control` in a project directory, it spawns a persistent local process that registers with the Anthropic API and displays a session URL for remote access. The session URL is written to stdout and can be parsed for programmatic use. The process stays running until explicitly terminated, making it suitable for long-running autopilot scenarios where users may want to ask Claude questions about the build progress or completed build.

For this phase, the autopilot CLI needs to spawn `claude remote-control` as a child process on startup (following the same pattern as dev-tunnels in Phase 11), capture the session URL from stdout, store it in AutopilotState alongside tunnelUrl, and display it prominently in the dashboard Overview page. The implementation follows the existing graceful degradation pattern: if `claude remote-control` fails (no Max plan, not logged in, process error), log a warning and continue without it. The remote session lifecycle is independent of the autopilot build lifecycle—it stays alive after builds complete so users can continue asking questions.

**Primary recommendation:** Spawn `claude remote-control` via Node.js `spawn()` with `cwd` set to project directory, parse stdout line-by-line to extract the session URL (matches pattern `https://claude.ai/code/sessions/[id]`), store in AutopilotState as `remoteSessionUrl: string | undefined`, register cleanup in ShutdownManager, add `--no-remote` CLI flag following `--no-tunnel` pattern, display URL in dashboard using a new `RemoteSessionCard` component on Overview page (positioned below TunnelBanner).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Session creation:**
- Spawn `claude remote-control` as a child process from the project directory
- The project directory must match the autopilot's working directory so the session has full filesystem context
- Session name should be branded and identifiable (e.g., "GSD Autopilot - [project/branch]") for easy discovery in Claude's session list
- Use whatever `claude` CLI authentication the user already has — no special auth handling

**Session lifecycle:**
- Automatically start the remote session when autopilot starts (alongside tunnel, dashboard, etc.)
- `--no-remote` CLI flag to opt out (consistent with `--no-tunnel` pattern)
- Session stays alive even after autopilot build completes — users can still ask questions about the finished build
- If `claude remote-control` fails (no Max plan, auth issues, etc.), warn and continue without it — non-fatal, graceful degradation (same pattern as tunnel)
- Register cleanup in ShutdownManager for process termination

**Dashboard integration:**
- Prominent card on the Overview page with the remote session URL and copy-to-clipboard button
- Similar treatment to how tunnel URL is displayed
- Clicking the URL opens claude.ai/code in a new tab (external link, no iframe)
- No live status indicator needed — just show the URL and copy button
- Remote session URL also printed in terminal startup banner alongside dashboard URL and tunnel URL

**Session context:**
- No custom system prompt or pre-loaded context — just run `claude remote-control` in the project directory and let Claude Code pick up CLAUDE.md and project context naturally
- Use local CLI auth — no special token handling

### Claude's Discretion

- Recovery strategy when remote-control process dies unexpectedly (auto-restart vs notify)
- Exact URL parsing approach from `claude remote-control` stdout
- Card visual design and layout on Overview page
- How to handle the URL in notifications (if at all)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js child_process | Built-in | Spawn `claude remote-control` process | Standard library for process spawning, no dependencies |
| Node.js readline | Built-in | Parse stdout line-by-line for URL extraction | Standard library for stream parsing |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (existing) AutopilotState | N/A | Persist remote session URL across tools | Already used for tunnelUrl |
| (existing) ShutdownManager | N/A | Register cleanup for process termination | Already used for tunnel cleanup |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Spawn claude CLI | Use Claude SDK directly | No SDK exists for remote-control sessions; CLI is the only interface |
| Parse stdout with regex | Wait for JSON output mode | CLI currently outputs human-readable text; regex is sufficient |
| Custom auth handling | Pass credentials to CLI | CLI uses cached credentials from `claude login`; custom auth adds complexity |

**Installation:**
```bash
# No new dependencies — uses built-in Node.js modules
# Requires claude CLI installed: npm install -g claude
```

## Architecture Patterns

### Recommended Project Structure
```
autopilot/src/
├── server/
│   ├── tunnel/              # Existing (Phase 11)
│   │   └── manager.ts
│   └── remote-session/      # NEW: Claude remote-control integration
│       ├── index.ts         # Export RemoteSessionManager
│       └── manager.ts       # RemoteSessionManager class
├── state/
│   └── index.ts             # Extend StateStore with remoteSessionUrl field
├── types/
│   └── state.ts             # Add remoteSessionUrl?: string to AutopilotState
├── cli/
│   └── index.ts             # Add --no-remote flag, spawn remote-control, parse URL
└── dashboard/
    └── src/
        ├── components/
        │   ├── TunnelBanner.tsx        # Existing (Phase 11)
        │   └── RemoteSessionCard.tsx   # NEW: Display remote session URL
        ├── pages/
        │   └── Overview.tsx            # Add RemoteSessionCard below TunnelBanner
        └── store/
            └── index.ts                # Add remoteSessionUrl to DashboardState
```

### Pattern 1: RemoteSessionManager Lifecycle

**What:** RemoteSessionManager as a service that spawns `claude remote-control`, parses stdout for session URL, and manages process lifecycle

**When to use:** For managing remote-control process alongside autopilot startup/shutdown

**Example:**
```typescript
// Source: Node.js child_process documentation + existing TunnelManager pattern
import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';

export interface RemoteSessionManagerOptions {
  logger?: {
    info(msg: string): void;
    warn(msg: string): void;
    error(msg: string): void;
  };
  onUrlDetected?: (url: string) => void;
}

export class RemoteSessionManager {
  private process: ChildProcess | null = null;
  private sessionUrl: string | null = null;
  private logger?: RemoteSessionManagerOptions['logger'];
  private onUrlDetected?: (url: string) => void;

  constructor(options: RemoteSessionManagerOptions = {}) {
    this.logger = options.logger;
    this.onUrlDetected = options.onUrlDetected;
  }

  /**
   * Start claude remote-control process and capture session URL from stdout.
   * @param projectDir - Project directory to run the command in
   * @param sessionName - Optional branded session name
   * @returns Promise<string> - Session URL for remote access
   * @throws Error if process fails or URL not captured within timeout
   */
  async start(projectDir: string, sessionName?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = ['remote-control'];

      // Note: Session naming via CLI is not documented in official docs.
      // If supported in future, add: if (sessionName) args.push('--name', sessionName);

      this.process = spawn('claude', args, {
        cwd: projectDir,
        stdio: ['ignore', 'pipe', 'pipe'], // stdin ignored, stdout/stderr piped
      });

      // Parse stdout line-by-line for session URL
      const rl = createInterface({ input: this.process.stdout! });

      const urlPattern = /https:\/\/claude\.ai\/code\/sessions\/[a-zA-Z0-9_-]+/;
      let urlCaptured = false;

      rl.on('line', (line: string) => {
        this.logger?.info(`[remote-control] ${line}`);

        const match = line.match(urlPattern);
        if (match && !urlCaptured) {
          this.sessionUrl = match[0];
          urlCaptured = true;
          this.onUrlDetected?.(this.sessionUrl);
          resolve(this.sessionUrl);
        }
      });

      // Capture stderr for error logging
      this.process.stderr?.on('data', (data: Buffer) => {
        this.logger?.warn(`[remote-control stderr] ${data.toString()}`);
      });

      // Handle process exit (error or premature termination)
      this.process.on('exit', (code: number | null) => {
        if (!urlCaptured) {
          const msg = `claude remote-control exited (code ${code}) before URL was captured`;
          this.logger?.error(msg);
          reject(new Error(msg));
        } else {
          this.logger?.info(`claude remote-control process exited (code ${code})`);
        }
      });

      // Handle spawn errors (command not found, etc.)
      this.process.on('error', (err: Error) => {
        this.logger?.error(`Failed to spawn claude remote-control: ${err.message}`);
        reject(err);
      });

      // Timeout after 30 seconds if URL not captured
      setTimeout(() => {
        if (!urlCaptured) {
          reject(new Error('Timeout waiting for remote-control session URL'));
        }
      }, 30000);
    });
  }

  /**
   * Stop the remote-control process.
   * Safe to call multiple times.
   */
  async stop(): Promise<void> {
    if (this.process && !this.process.killed) {
      this.logger?.info('Terminating claude remote-control process');
      this.process.kill('SIGTERM');

      // Give process time to gracefully shut down, then force kill
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.logger?.warn('Force killing remote-control process');
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        this.process?.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
    this.process = null;
    this.sessionUrl = null;
  }

  /**
   * Get the current session URL, or null if not started/failed.
   */
  get url(): string | null {
    return this.sessionUrl;
  }
}
```

### Pattern 2: CLI Integration with Graceful Degradation

**What:** Spawn remote-control on autopilot startup, handle failures gracefully, persist URL to state

**When to use:** In `autopilot/src/cli/index.ts` alongside tunnel startup

**Example:**
```typescript
// Source: Existing tunnel lifecycle pattern from cli/index.ts
import { RemoteSessionManager } from '../server/remote-session/index.js';

// In CLI action handler, after tunnel setup:
const enableRemote = options.remote !== false; // --no-remote sets to false
let remoteSessionManager: RemoteSessionManager | null = null;

if (enableRemote) {
  remoteSessionManager = new RemoteSessionManager({
    logger: {
      info: (msg: string) => logger.log('info', 'remote-session', msg),
      warn: (msg: string) => logger.log('warn', 'remote-session', msg),
      error: (msg: string) => logger.log('error', 'remote-session', msg),
    },
    onUrlDetected: (url: string) => {
      // Persist to state for cross-tool access
      void stateStore.setState({ remoteSessionUrl: url });
    },
  });

  try {
    // Derive session name from git info
    const branch = await getCurrentBranch(projectDir); // Helper function
    const sessionName = `GSD Autopilot - ${branch}`;

    const url = await remoteSessionManager.start(projectDir, sessionName);
    await stateStore.setState({ remoteSessionUrl: url });

    if (!options.quiet) {
      console.log(`Claude remote session: ${url}`);
      console.log(`Dashboard local:        http://localhost:${config.port}`);
    }

    // Register cleanup in ShutdownManager
    shutdown.register(async () => {
      logger.log('info', 'cli', 'Stopping remote session');
      await remoteSessionManager!.stop();
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.log('warn', 'remote-session', `Failed to start remote session: ${message}`);

    if (!options.quiet) {
      console.log('Claude remote session unavailable (continuing without it)');
      console.log('  To enable remote access:');
      console.log('    claude login                    (sign in with Max plan)');
      console.log('    npm install -g claude           (if claude command not found)');
      console.log('  Use --no-remote to suppress this message.');
    }

    await stateStore.setState({ remoteSessionUrl: undefined });
  }
} else {
  await stateStore.setState({ remoteSessionUrl: undefined });
}
```

### Pattern 3: Dashboard RemoteSessionCard Component

**What:** React component to display remote session URL with copy-to-clipboard, following TunnelBanner pattern

**When to use:** In Overview page, below TunnelBanner

**Example:**
```typescript
// Source: Existing TunnelBanner.tsx pattern
import { useState } from 'react';
import { useDashboardStore } from '../store/index.js';

export function RemoteSessionCard() {
  const remoteSessionUrl = useDashboardStore((s) => s.remoteSessionUrl);
  const [copied, setCopied] = useState(false);

  // If remoteSessionUrl is null/undefined, render nothing
  if (!remoteSessionUrl) {
    return null;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(remoteSessionUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API failed — non-fatal
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {/* Robot/code icon */}
        <div className="text-blue-500 text-xl flex-shrink-0 mt-0.5">🤖</div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-blue-900 mb-1">
            Claude Code remote session
          </div>
          <a
            href={remoteSessionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-700 hover:text-blue-900 underline break-all"
          >
            {remoteSessionUrl}
          </a>
          <p className="text-xs text-blue-600 mt-1">
            Ask Claude questions about your project from any device
          </p>
        </div>
      </div>
      <button
        onClick={handleCopy}
        className="flex-shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
      >
        {copied ? '✓ Copied!' : 'Copy URL'}
      </button>
    </div>
  );
}
```

### Anti-Patterns to Avoid

- **Hard-failing on remote-control errors:** The session is a convenience feature, not a requirement. Always use graceful degradation.
- **Polling claude.ai/code API for session status:** The local process is the source of truth. If it's running, the session is active.
- **Custom authentication logic:** The `claude` CLI handles all auth via `claude login`. Don't attempt to manage credentials.
- **Parsing QR codes from stdout:** Only parse the session URL text. QR codes (shown with spacebar) are for terminal users only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Claude remote sessions | Custom WebSocket bridge to claude.ai | `claude remote-control` CLI | Official interface, handles authentication, session routing, connection resilience |
| URL extraction from CLI output | Complex state machine parser | Simple regex match on stdout lines | CLI output is stable; session URLs follow predictable pattern |
| Process lifecycle management | Custom process supervisor | Node.js spawn + ShutdownManager | Already proven pattern with TunnelManager |
| Session naming | Custom API calls to set session title | CLI flags (if/when supported) or let Claude derive from context | Session names visible in claude.ai session list; CLI may add flag in future |

**Key insight:** The `claude remote-control` command is a complete solution for remote sessions. Don't try to replicate its functionality or work around it—just spawn it, parse the URL, and let it run.

## Common Pitfalls

### Pitfall 1: Assuming URL Appears Immediately

**What goes wrong:** The session URL may not appear on the first stdout line. The process takes a few seconds to register with the API.

**Why it happens:** Remote-control performs authentication handshake and session registration before emitting the URL.

**How to avoid:** Use line-by-line parsing with a reasonable timeout (30 seconds). Don't assume URL is in first N lines.

**Warning signs:** Premature timeout rejections, URL never captured despite successful process spawn.

### Pitfall 2: Not Handling Max Plan Requirement

**What goes wrong:** Users without Max plans see cryptic errors or silent failures.

**Why it happens:** Remote Control requires Max plan (or Pro when rolled out). CLI exits with error if user doesn't have access.

**How to avoid:** Catch process errors and exit events, log clear messages about plan requirements in graceful degradation warning.

**Warning signs:** Process exits with code 1, stderr mentions "Max plan required" or "not available".

### Pitfall 3: Killing Process Too Aggressively

**What goes wrong:** SIGKILL sent immediately on shutdown, preventing graceful session cleanup.

**Why it happens:** Treating remote-control like a disposable process instead of a session with remote clients.

**How to avoid:** Send SIGTERM first, wait 5 seconds for graceful shutdown, only then send SIGKILL if needed. Follow existing TunnelManager pattern.

**Warning signs:** Remote users see "session disconnected" abruptly without cleanup; orphaned sessions in claude.ai session list.

### Pitfall 4: Hardcoding Session URL Pattern

**What goes wrong:** URL parsing breaks when Claude changes session ID format or URL structure.

**Why it happens:** Relying on specific character sets or lengths in regex instead of general pattern.

**How to avoid:** Use flexible regex: `/https:\/\/claude\.ai\/code\/sessions\/[a-zA-Z0-9_-]+/`. Allow for future variations.

**Warning signs:** URL detection stops working after Claude CLI update; regex fails on valid URLs.

### Pitfall 5: Assuming Process Stays Alive Forever

**What goes wrong:** No handling for unexpected process exits (network outage >10 min, laptop sleep, etc.).

**Why it happens:** Treating spawn() as fire-and-forget instead of monitoring process lifecycle.

**How to avoid:** Listen for 'exit' event after URL is captured. Log warning if process dies unexpectedly. Document in UI that sessions may disconnect.

**Warning signs:** Users report "remote session stopped working" with no visible error; process.killed is false but process is actually dead.

## Code Examples

Verified patterns from official sources and existing codebase:

### Spawning with Stdout Parsing

```typescript
// Source: Node.js child_process documentation + readline module
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const child = spawn('claude', ['remote-control'], {
  cwd: projectDir,
  stdio: ['ignore', 'pipe', 'pipe'],
});

const rl = createInterface({ input: child.stdout });

rl.on('line', (line: string) => {
  console.log(`Output: ${line}`);

  // Pattern match for session URL
  const match = line.match(/https:\/\/claude\.ai\/code\/sessions\/[a-zA-Z0-9_-]+/);
  if (match) {
    const sessionUrl = match[0];
    console.log(`Captured session URL: ${sessionUrl}`);
  }
});

child.stderr.on('data', (data) => {
  console.error(`stderr: ${data}`);
});

child.on('exit', (code) => {
  console.log(`Process exited with code ${code}`);
});
```

### State Persistence

```typescript
// Source: Existing AutopilotState pattern from types/state.ts
export interface AutopilotState {
  status: AutopilotStatus;
  currentPhase: number;
  currentStep: PhaseStep;
  phases: PhaseState[];
  pendingQuestions: PendingQuestion[];
  errorHistory: ErrorRecord[];
  startedAt: string;
  lastUpdatedAt: string;
  tunnelUrl?: string;          // Existing (Phase 11)
  remoteSessionUrl?: string;   // NEW (Phase 12)
}

// Persist URL to state file
await stateStore.setState({ remoteSessionUrl: capturedUrl });
```

### Dashboard Store Integration

```typescript
// Source: Existing dashboard/src/store/index.ts pattern
export interface DashboardState {
  // ... existing fields
  tunnelUrl: string | null;
  remoteSessionUrl: string | null;  // NEW

  // Actions
  setTunnelUrl: (url: string | null) => void;
  setRemoteSessionUrl: (url: string | null) => void;  // NEW
}

export const useDashboardStore = create<DashboardState>()((set) => ({
  // Initial state
  tunnelUrl: null,
  remoteSessionUrl: null,

  // Actions
  setTunnelUrl: (url) => set({ tunnelUrl: url }),
  setRemoteSessionUrl: (url) => set({ remoteSessionUrl: url }),
}));
```

### SSE/API Response Extension

```typescript
// Source: Existing API client pattern from dashboard/src/api/client.ts
export interface StatusResponse {
  status: AutopilotStatus;
  currentPhase: number;
  currentStep: string;
  progress: number;
  startedAt: string;
  lastUpdatedAt: string;
  alive: boolean;
  projectName?: string;
  projectDescription?: string;
  tunnelUrl?: string;
  remoteSessionUrl?: string;  // NEW
}

// In SSE handler (dashboard/src/hooks/useSSE.ts):
// Poll /api/status and update store with remoteSessionUrl
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A (new feature) | `claude remote-control` command | Released Feb 2026 | Enables remote access to local Claude Code sessions from any device |
| Manual QR code scanning | Direct URL access | Built-in since release | Users can paste URL or click link instead of scanning |
| Single-device sessions | Multi-device sync | Built-in since release | Conversation stays in sync across terminal, browser, mobile |

**Deprecated/outdated:**
- None (this is a new capability, no prior versions to deprecate)

**Current limitations (per official docs):**
- Max plan required (Pro support coming soon)
- Team/Enterprise plans not supported
- One remote session per Claude Code instance
- Process must stay running (closing terminal ends session)
- Extended network outage (>10 min) times out session

## Open Questions

1. **Session naming via CLI**
   - What we know: `/rename` command exists within sessions, but `claude remote-control` doesn't document a `--name` flag
   - What's unclear: Whether session naming is supported at spawn time or requires in-session command
   - Recommendation: Don't attempt session naming at spawn time. Let Claude derive name from project context or first message. Document as future enhancement if `--name` flag becomes available.

2. **Recovery strategy for process death**
   - What we know: Process can exit due to network timeout (>10 min), SIGTERM, or errors
   - What's unclear: Should autopilot auto-restart the session, or just log and continue?
   - Recommendation: Log warning but don't auto-restart. Remote sessions are convenience features, not critical to builds. Auto-restart adds complexity and may conflict with intentional shutdowns (e.g., Max plan expired). Leave as Claude's Discretion.

3. **Notification integration**
   - What we know: Tunnel URL appears in all notifications (questions, errors, etc.)
   - What's unclear: Should remote session URL also appear in notifications, or only in dashboard/startup banner?
   - Recommendation: Don't add to notifications. Tunnel URL is for dashboard access; remote session URL is for Claude Code access. Including both in every notification adds clutter. Show in dashboard card and startup banner only. Leave as Claude's Discretion.

## Sources

### Primary (HIGH confidence)
- [Claude Code Remote Control Official Documentation](https://code.claude.com/docs/en/remote-control) - Complete feature documentation including requirements, usage, and limitations
- [Node.js child_process API Documentation](https://nodejs.org/api/child_process.html) - Official docs for spawn() and process management
- Existing codebase patterns: `autopilot/src/server/tunnel/manager.ts`, `autopilot/src/cli/index.ts`, `autopilot/dashboard/src/components/TunnelBanner.tsx`

### Secondary (MEDIUM confidence)
- [MacStories Hands-On with Claude Code Remote Control](https://www.macstories.net/stories/hands-on-with-claude-code-remote-control/) - Real-world usage examples and workflow patterns
- [Simon Willison: Claude Code Remote Control](https://simonwillison.net/2026/Feb/25/claude-code-remote-control/) - Technical analysis and use cases
- [NxCode Setup Guide](https://www.nxcode.io/resources/news/claude-code-remote-control-mobile-terminal-handoff-guide-2026) - Real-world tips and setup guidance

### Tertiary (LOW confidence)
- [Working with stdout and stdin of a child process in Node.js](https://2ality.com/2018/05/child-process-streams.html) - General Node.js patterns (not specific to this use case)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Built-in Node.js modules, proven patterns from existing codebase
- Architecture: HIGH - Direct parallel to Phase 11 tunnel implementation, clear integration points
- Pitfalls: MEDIUM-HIGH - Based on official docs and reasonable inference from CLI behavior; actual edge cases TBD

**Research date:** 2026-02-26
**Valid until:** 2026-03-28 (30 days — stable feature, unlikely to change significantly)
