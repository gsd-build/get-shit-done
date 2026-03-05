# GSD Autopilot

## What This Is

A local Node.js command-line tool that runs the entire Get Shit Done (GSD) workflow autonomously — from PRD to working code — without requiring manual CLI interaction. When the system needs a human decision (like implementation choices during discuss-phase, or failure triage), it sends a notification through a configurable channel and waits for the human to respond through a simple local web interface before continuing.

Think of it as a CI/CD pipeline for AI-assisted development that lives on your machine, with pluggable notifications as the human-in-the-loop channel.

## Core Value

Turn a PRD document into a fully built project by running one command, with human decisions collected asynchronously through notifications instead of synchronous CLI prompts.

## How It Works

### User Experience

1. User runs: `npx gsd-autopilot --prd ./my-idea.md --notify console`
2. The tool initializes a GSD project from the PRD (using `/gsd:new-project --auto`)
3. For each phase in the roadmap, it automatically runs plan → execute → verify
4. When a question needs human input:
   - A notification appears through the configured channel (console, system toast, Teams, Slack, etc.)
   - The notification includes a link to `http://localhost:3847/respond/[id]`
   - The human clicks the link, sees a clean web page with the options, clicks one
   - The tool receives the response and continues building
5. When all phases complete, it runs milestone completion
6. The human gets a final notification: "Build complete — X phases, Y commits"

### Architecture

```
┌─────────────────────────────────────────────────────┐
│  GSD Autopilot (Node.js)                            │
│                                                     │
│  ┌─────────────┐    ┌───────────────────────────┐  │
│  │ Orchestrator │───>│ Claude Code CLI (claude -p)│  │
│  │ (main loop)  │<───│ Runs GSD slash commands    │  │
│  └──────┬──────┘    └───────────────────────────┘  │
│         │                                           │
│         │ Intercepts questions:                     │
│         │                                           │
│  ┌──────▼──────┐    ┌───────────────────────────┐  │
│  │ Notification │───>│ Notification Adapters      │  │
│  │ Manager      │    │ (console, system, webhook) │  │
│  └──────┬──────┘    └───────────────────────────┘  │
│         │                                           │
│  ┌──────▼──────┐    ┌───────────────────────────┐  │
│  │ Response     │<───│ Local Web UI (Express)     │  │
│  │ Listener     │    │ localhost:3847              │  │
│  └─────────────┘    └───────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Components

### 1. CLI Entry Point

The main command that starts the autopilot process.

```
npx gsd-autopilot --prd <path>         # Required: PRD/idea document
                  --notify <channel>   # Optional: notification channel (default: "console")
                  --webhook-url <url>  # Optional: webhook URL (for teams/slack/custom channels)
                  --port 3847          # Optional: local web server port (default 3847)
                  --depth standard     # Optional: planning depth (quick/standard/comprehensive)
                  --model balanced     # Optional: model profile (quality/balanced/budget)
                  --skip-discuss       # Optional: skip discuss-phase, let Claude decide everything
                  --skip-verify        # Optional: skip verify-work phase
                  --phases 1-5         # Optional: only run specific phases
                  --resume             # Optional: resume from where it left off
```

The `--notify` flag accepts a channel name. Built-in channels:

| Channel    | Description                                      | Requires              |
|------------|--------------------------------------------------|-----------------------|
| `console`  | Prints to terminal with a link to the web UI     | Nothing (default)     |
| `system`   | OS-native toast notifications (via `node-notifier`) | Nothing             |
| `teams`    | Microsoft Teams Adaptive Cards via webhook       | `--webhook-url`       |
| `slack`    | Slack messages via webhook                        | `--webhook-url`       |
| `custom`   | HTTP POST to any URL with a standard JSON payload | `--webhook-url`      |

Multiple channels can be combined: `--notify console,system` sends to both.

Configuration can also be provided via a `.gsd-autopilot.json` file in the project root or via environment variables (`GSD_NOTIFY_CHANNEL`, `GSD_WEBHOOK_URL`, `GSD_PORT`).

### 2. Orchestrator

The core state machine that sequences GSD commands. It reads `.planning/STATE.md` and `.planning/ROADMAP.md` to determine what to do next.

**Lifecycle:**

```
Initialize Project (claude -p "/gsd:new-project --auto @prd.md")
  │
  ▼
Read ROADMAP.md → extract phase list
  │
  ▼
For each phase N:
  ├── [Optional] Discuss Phase → may trigger notification questions
  ├── Plan Phase (claude -p "/gsd:plan-phase N")
  ├── Execute Phase (claude -p "/gsd:execute-phase N")
  ├── Check VERIFICATION.md status
  │   ├── passed → next phase
  │   ├── gaps_found → plan gaps → execute gaps → re-verify
  │   └── human_needed → notify human, wait for response
  └── Update progress
  │
  ▼
Complete Milestone (claude -p "/gsd:complete-milestone")
  │
  ▼
Send "Build Complete" notification
```

**State persistence:** The orchestrator saves its own state to `.planning/autopilot-state.json` after each step so it can resume if interrupted. This file tracks: current phase, current step within phase, pending questions, completed phases, error history.

**Error handling:**
- If a `claude -p` call fails (non-zero exit), the orchestrator retries once
- If retry fails, it sends an error notification and waits for human guidance (retry / skip phase / abort)
- All `claude -p` output is logged to `.planning/autopilot-log/phase-N-step.log`

### 3. Notification System

A pluggable notification system built around a simple adapter interface. The Notification Manager dispatches messages to one or more configured adapters. All adapters receive the same structured notification object; each adapter formats and delivers it according to its channel.

#### Adapter Interface

Every notification adapter implements this interface:

```typescript
interface NotificationAdapter {
  /** Human-readable name for logs */
  name: string;

  /** Initialize the adapter (validate config, open connections) */
  init(config: AdapterConfig): Promise<void>;

  /** Send a notification. Returns true if delivered successfully. */
  send(notification: Notification): Promise<boolean>;

  /** Clean up resources on shutdown */
  shutdown(): Promise<void>;
}
```

#### Notification Object

All adapters receive the same structured payload:

```typescript
interface Notification {
  id: string;                           // Unique notification ID
  type: 'question' | 'progress' | 'error' | 'complete';
  title: string;                        // Short summary
  body: string;                         // Detailed message (markdown)
  phase?: number;                       // Current phase number
  phaseTitle?: string;                  // Current phase name
  severity: 'info' | 'warning' | 'error';
  respondUrl?: string;                  // URL to the local web UI response page
  options?: NotificationOption[];       // For question type: the choices
  metadata?: Record<string, unknown>;   // Extra data adapters can use
}

interface NotificationOption {
  label: string;
  value: string;
  description?: string;
}
```

#### Notification Types

1. **Question** — When human input is needed
   - Includes: phase context, question text, available options, link to web UI
   - Severity: info

2. **Progress** — Phase completed successfully
   - Includes: phase name, what was built, commits made
   - No response needed
   - Severity: info

3. **Error** — Something failed
   - Includes: phase name, error summary, suggested actions, link to respond
   - Severity: error

4. **Complete** — Build finished
   - Includes: total phases, total commits, files created
   - Severity: info

#### Built-in Adapters

**Console Adapter** (default)
- Prints formatted, colored messages to the terminal
- For questions: displays the web UI URL prominently so the user can click it
- For progress: prints a summary line with phase number and status
- Zero dependencies, always available

**System Notification Adapter**
- Sends OS-native toast notifications via `node-notifier`
- Clicking the toast opens the web UI response URL in the default browser
- Works on Windows (Windows toast), macOS (Notification Center), and Linux (notify-send)
- Falls back to console if the notification daemon is unavailable

**Teams Adapter**
- Sends Adaptive Cards to Microsoft Teams via an Incoming Webhook URL
- Card includes question/status, phase context, and a prominent link to the local response web UI
- Requires `--webhook-url` pointing to a Teams incoming webhook

**Slack Adapter**
- Sends Block Kit messages to Slack via an Incoming Webhook URL
- Message includes question/status, phase context, and a link to the local response web UI
- Requires `--webhook-url` pointing to a Slack incoming webhook

**Custom Webhook Adapter**
- Sends an HTTP POST with the raw `Notification` object as JSON to any URL
- Useful for integrating with custom dashboards, bots, or other tooling
- Requires `--webhook-url`

#### Writing a Custom Adapter

Custom adapters can be loaded from a local file:

```
npx gsd-autopilot --prd ./idea.md --notify custom-adapter --adapter-path ./my-adapter.js
```

The file should export a default object implementing the `NotificationAdapter` interface. This allows teams to integrate with any internal notification system without modifying autopilot core.

### 4. Web Dashboard & Response Server

A local Express.js API server paired with a React SPA that serves as both the human response interface and a real-time project dashboard. This is the single source of truth for collecting human responses — all notification channels link back here.

**API Routes (Express backend):**

- `GET /api/status` — Current autopilot state (phase, step, progress percentage)
- `GET /api/phases` — All phases with status (pending, in-progress, completed, failed)
- `GET /api/questions` — List of pending questions awaiting human input
- `GET /api/questions/:questionId` — Single question with options
- `POST /api/questions/:questionId` — Submit a response, unblocks the orchestrator
- `GET /api/log` — Recent autopilot log output (supports `?since=` for polling)
- `GET /api/log/stream` — SSE endpoint for real-time log streaming
- `GET /api/health` — Health check endpoint
- `GET /*` — Serves the React SPA for all other routes

**React SPA Pages:**

1. **Dashboard** (`/`)
   - Overall progress bar showing phases completed vs total
   - Current phase card with name, description, and active step
   - Pending questions count with prominent call-to-action if any are waiting
   - Recent activity feed (phase completions, errors, commits)
   - Live log stream (collapsible, auto-scrolling)

2. **Question Response** (`/respond/:questionId`)
   - Phase context header (which phase, what's being decided)
   - Question text with markdown rendering
   - Options as large, clickable card-style buttons with descriptions
   - Freeform text input for "Other" responses
   - Confirmation state after selection with option to change before the orchestrator picks it up

3. **Phase Detail** (`/phases/:phaseNumber`)
   - Phase description from ROADMAP.md
   - Step-by-step progress within the phase (plan → execute → verify)
   - Commits made during this phase
   - Log output filtered to this phase
   - Verification status and any gaps found

4. **Log Viewer** (`/log`)
   - Full autopilot log with phase/step filtering
   - Search within logs
   - Auto-scroll with pause-on-hover
   - Color-coded by log level (info, warning, error)

**Tech stack:**
- React 18 with React Router for client-side routing
- Vite for build tooling (dev server during development, static build for production)
- Tailwind CSS for styling
- SSE (Server-Sent Events) for real-time updates from the backend
- The Express server serves the built React app as static files in production

**Real-time updates:**
- The backend pushes state changes via SSE to connected dashboard clients
- Events: `phase-started`, `phase-completed`, `question-pending`, `question-answered`, `error`, `log-entry`, `build-complete`
- The dashboard reconnects automatically if the SSE connection drops

The server shuts down automatically when the autopilot completes.

### 5. Claude Code Integration

The module that executes GSD commands via Claude Code's pipe mode.

**Execution pattern:**

```javascript
// Each GSD command runs in a fresh context (equivalent to /clear)
function runGsdCommand(command, projectDir) {
  // claude -p sends a prompt in non-interactive pipe mode
  // --project-dir ensures GSD reads the right .planning/ files
  const result = spawnSync('claude', ['-p', command], {
    cwd: projectDir,
    encoding: 'utf8',
    timeout: 600000 // 10 minute timeout per command
  });
  return { stdout: result.stdout, stderr: result.stderr, exitCode: result.status };
}
```

**Output parsing:** The module parses `claude -p` stdout for key patterns:
- `"PROJECT INITIALIZED"` — new-project succeeded
- `"PHASE X PLANNED"` — plan-phase succeeded
- `"Phase X: Complete"` — execute-phase succeeded
- `"GAPS_FOUND"` or `"gaps_found"` — verification found issues
- `"VERIFICATION PASSED"` or `"passed"` — verification succeeded

**GSD config setup:** Before running commands, the integration module writes a `.planning/config.json` with all gates disabled and YOLO mode enabled, so GSD commands run without interactive prompts:

```json
{
  "mode": "yolo",
  "depth": "standard",
  "workflow": { "research": true, "plan_check": true, "verifier": true },
  "parallelization": { "enabled": true, "plan_level": true, "skip_checkpoints": true },
  "gates": {
    "confirm_project": false,
    "confirm_phases": false,
    "confirm_roadmap": false,
    "confirm_breakdown": false,
    "confirm_plan": false,
    "execute_next_plan": false,
    "issues_review": false,
    "confirm_transition": false
  }
}
```

### 6. Discuss-Phase Handler

The discuss-phase is the one workflow that is inherently conversational and produces the highest-value human decisions. The autopilot handles it specially:

**When `--skip-discuss` is NOT set:**
1. Orchestrator reads the phase description from ROADMAP.md
2. Identifies the gray areas Claude would ask about (by running a lightweight analysis prompt via `claude -p`)
3. For each gray area, creates a question notification with the options
4. Batches related questions together (sends 2-3 at a time, not one by one)
5. Collects all responses via the local web UI
6. Writes a CONTEXT.md file with the human's decisions in the standard GSD format
7. Proceeds to plan-phase with the context locked

**When `--skip-discuss` IS set:**
- Generates a CONTEXT.md marking all areas as "Claude's Discretion"
- No notification, no human input needed

## Technical Constraints

- **Node.js >= 18** (for native fetch, stable async patterns)
- **Claude Code CLI** must be installed and authenticated (`claude` command available in PATH)
- **GSD** must be installed globally (`~/.claude/get-shit-done/` exists)
- **No external database** — all state lives in `.planning/` files (JSON + markdown)
- **No cloud services** — everything runs locally except outbound webhook POSTs when using webhook-based adapters
- **Single project at a time** — the orchestrator manages one GSD project per invocation

## Out of Scope

- Running in CI/CD (GitHub Actions) — designed for local execution only
- Modifying GSD's core workflows or agents — the autopilot wraps GSD, it does not fork it
- Authentication on the local web server — it runs on localhost, accessible only to the local machine
- Bidirectional communication through notification channels — all responses come through the local web UI, notifications are outbound-only
