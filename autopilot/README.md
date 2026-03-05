# @nexeradigital/gsd-autopilot

Autonomous GSD workflow orchestrator — turns a PRD into a built project. Runs the full GSD lifecycle (discuss, plan, execute, verify) hands-free, with a live dashboard and multi-channel notifications.

## Prerequisites

- **Node.js** >= 20.0.0
- **GSD workflows** installed (`npx get-shit-done-cc@latest`)
- **Git** initialized in your project directory

## Installation

### One-liner

**macOS / Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/NexeraDigital/get-shit-done/main/autopilot/install.sh | bash
```

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/NexeraDigital/get-shit-done/main/autopilot/install.ps1 | iex
```

### Manual install

```bash
npm install -g @nexeradigital/gsd-autopilot
```

The postinstall script automatically registers the `/gsd:autopilot` slash command in Claude Code. Restart your Claude Code session to pick it up.

## Quick Start

### From Claude Code

```
/gsd:autopilot --prd ./idea.md    # New project from a PRD
/gsd:autopilot                     # Existing GSD project
```

If you run `/gsd:autopilot` in a directory with an existing GSD project (`.planning/ROADMAP.md`), it picks up where the project left off — no flags needed. If no roadmap exists and no `--prd` is provided, an interactive setup wizard will walk you through configuration.

## How It Works

The autopilot runs the complete GSD lifecycle for every phase in your roadmap:

```
Project Init (/gsd:new-project)
    |
    v
For each phase:
    discuss  ->  plan  ->  execute  ->  verify
                                          |
                                     Gap detected?
                                      yes -> re-plan -> re-execute -> re-verify (up to 3x)
                                      no  -> next phase
    |
    v
Build Complete
```

1. **Initialize** — Reads your PRD, runs `/gsd:new-project --auto` to generate `PROJECT.md`, `REQUIREMENTS.md`, and `ROADMAP.md`
2. **Discuss** — Runs `/gsd:discuss-phase` to capture your implementation preferences (skippable with `--skip-discuss`)
3. **Plan** — Runs `/gsd:plan-phase` to research and create atomic execution plans
4. **Execute** — Runs `/gsd:execute-phase` with fresh context per plan, parallel where possible
5. **Verify** — Runs `/gsd:verify-work` with automatic gap detection and re-planning (up to 3 iterations)

Each step produces atomic git commits. If something fails, it retries once then escalates for human input.

## CLI Reference

### `gsd-autopilot`

Main orchestrator command.

```
gsd-autopilot [options]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--prd <path>` | — | Path to your PRD or idea document |
| `--resume` | `false` | Resume from last checkpoint |
| `--phases <range>` | all | Run specific phases (e.g. `1-3,5,7-9`) |
| `--skip-discuss` | `false` | Skip the discuss step, let Claude decide |
| `--skip-verify` | `false` | Skip the verification step |
| `--depth <level>` | `standard` | Planning depth: `quick`, `standard`, `comprehensive` |
| `--model <profile>` | `balanced` | Model profile: `quality`, `balanced`, `budget` |
| `--notify <channel>` | `console` | Notification channel (see [Notifications](#notifications)) |
| `--webhook-url <url>` | — | Webhook URL for Teams/Slack notifications |
| `--adapter-path <path>` | — | Path to a custom notification adapter |
| `--port <number>` | `3847` | Dashboard server port |
| `--verbose` | `false` | Verbose output |
| `--quiet` | `false` | Suppress non-error output |

**Examples:**

```bash
# New project from a PRD
gsd-autopilot --prd ./idea.md

# Resume from last checkpoint
gsd-autopilot --resume

# Run specific phases with Teams notifications
gsd-autopilot --phases 1-3,5 --notify teams --webhook-url https://...

# Quality mode with comprehensive planning
gsd-autopilot --prd ./spec.md --model quality --depth comprehensive
```

### `gsd-dashboard`

Standalone dashboard server. Use this to monitor an autopilot session from another terminal or machine.

```bash
gsd-dashboard --project-dir /path/to/your/project --port 3847
```

| Flag | Default | Description |
|------|---------|-------------|
| `--project-dir <path>` | required | Path to the project directory |
| `--port <number>` | `3847` | Server port |

### `/gsd:autopilot` (Claude Code skill)

From within Claude Code:

```
/gsd:autopilot                          # Launch (wizard if no roadmap)
/gsd:autopilot --prd ./idea.md          # Launch with PRD
/gsd:autopilot status                   # Check if running
/gsd:autopilot stop                     # Graceful shutdown
```

The skill spawns the autopilot as a detached process (visible console window on Windows), auto-opens the dashboard in your browser, and reports back with the URL.

## Dashboard

The autopilot includes a live web dashboard (React SPA) that launches automatically at `http://localhost:3847`.

**Features:**
- Real-time phase and step progress via Server-Sent Events
- Answer pending questions through the web UI
- Activity feed with log entries
- Milestone lifecycle view
- Browser push notifications (auto-prompted on first visit)
- PWA support — install as a desktop app

**REST API** (all under `/api`):

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/status` | Progress %, project info, liveness |
| GET | `/api/phases` | All phases with step status |
| GET | `/api/questions` | Pending questions |
| POST | `/api/questions/:id` | Submit answer `{ answers: { "question": "answer" } }` |
| GET | `/api/activities` | Activity feed |
| GET | `/api/milestones` | Milestone data |
| GET | `/api/log/stream` | SSE event stream |

## Configuration

Configuration is loaded with this precedence: **CLI flags > environment variables > config file > defaults**.

### Config file

Create `.gsd-autopilot.json` in your project root:

```json
{
  "notify": "teams",
  "webhookUrl": "https://your-teams-webhook-url",
  "model": "quality",
  "depth": "comprehensive",
  "skipDiscuss": false,
  "skipVerify": false,
  "port": 3847,
  "questionReminderMs": 300000
}
```

The interactive wizard (`gsd-autopilot` with no args) offers to create this file for you.

### Environment variables

Prefix with `GSD_AUTOPILOT_` and use `UPPER_SNAKE_CASE`:

```bash
export GSD_AUTOPILOT_NOTIFY=slack
export GSD_AUTOPILOT_WEBHOOK_URL=https://hooks.slack.com/...
export GSD_AUTOPILOT_MODEL=budget
export GSD_AUTOPILOT_PORT=4000
export GSD_AUTOPILOT_SKIP_DISCUSS=true
```

### All options

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `notify` | string | `console` | `console`, `system`, `teams`, `slack`, `webhook` |
| `webhookUrl` | string | — | Required for `teams`, `slack`, `webhook` |
| `adapterPath` | string | — | Path to custom notification adapter |
| `model` | string | `balanced` | `quality`, `balanced`, `budget` |
| `depth` | string | `standard` | `quick`, `standard`, `comprehensive` |
| `skipDiscuss` | boolean | `false` | Skip the discuss phase step |
| `skipVerify` | boolean | `false` | Skip the verify phase step |
| `port` | number | `3847` | Dashboard port (1024-65535) |
| `questionReminderMs` | number | `300000` | Reminder interval for unanswered questions (ms) |
| `verbose` | boolean | `false` | Verbose output |
| `quiet` | boolean | `false` | Suppress non-error output |

## Notifications

The autopilot sends notifications for questions requiring human input, phase completion, errors, and build completion.

### Built-in channels

| Channel | Description | Setup |
|---------|-------------|-------|
| `console` | Colored terminal output with bell on questions | Always active (default) |
| `system` | OS-native toast notifications | Requires `node-notifier` (included as optional dep) |
| `teams` | Microsoft Teams via Adaptive Card | `--webhook-url <incoming-webhook-url>` |
| `slack` | Slack via Block Kit | `--webhook-url <incoming-webhook-url>` |
| `webhook` | Raw JSON POST to any URL | `--webhook-url <your-endpoint>` |

### Custom adapter

Create a module that exports a class with `name`, `init()`, `send(notification)`, and `close()`:

```javascript
// my-adapter.js
export default class MyAdapter {
  get name() { return 'my-custom'; }
  async init() { /* connect to service */ }
  async send(notification) {
    // notification: { id, type, title, body, severity, phase, step, ... }
    console.log(`[${notification.type}] ${notification.title}: ${notification.body}`);
  }
  async close() { /* cleanup */ }
}
```

```bash
gsd-autopilot --adapter-path ./my-adapter.js --prd ./idea.md
```

See `example-adapter.js` in the package for a full template.

## Programmatic API

The package exports its internals for custom integrations:

```javascript
import {
  Orchestrator,
  StateStore,
  ClaudeService,
  ResponseServer,
  NotificationManager,
  loadConfig,
} from '@nexeradigital/gsd-autopilot';
```

See the TypeScript declarations (`dist/**/*.d.ts`) for the full API surface.

## File Structure

During operation, the autopilot manages these files in your project:

```
.planning/
  autopilot/
    state.json           # Current orchestrator state
    heartbeat.json       # PID and liveness (updated every 5s)
    shutdown             # Marker file to request graceful stop
    answers/             # Dashboard -> autopilot question answers
    log/
      autopilot.log      # Structured log (pino)
      events.ndjson      # Event stream for dashboard SSE
.gsd-autopilot.json      # Optional config file (project root)
```

## License

MIT License. See [LICENSE](./LICENSE) for details.

Base GSD framework by TACHES. Autopilot by NexeraDigital.
