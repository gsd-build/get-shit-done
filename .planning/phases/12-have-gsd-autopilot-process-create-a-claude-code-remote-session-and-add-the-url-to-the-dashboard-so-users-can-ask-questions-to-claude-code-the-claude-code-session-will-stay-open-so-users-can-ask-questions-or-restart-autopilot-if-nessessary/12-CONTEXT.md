# Phase 12: Claude Code Remote Session - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Create a Claude Code remote session via `claude remote-control` when autopilot starts and surface the session URL in the dashboard. This phase handles spawning the process, capturing the URL, storing it in state, and displaying it. What users do inside the remote session is Claude Code's concern — not ours.

</domain>

<decisions>
## Implementation Decisions

### Session creation
- Spawn `claude remote-control` as a child process from the project directory
- The project directory must match the autopilot's working directory so the session has full filesystem context
- Session name should be branded and identifiable (e.g., "GSD Autopilot - [project/branch]") for easy discovery in Claude's session list
- Use whatever `claude` CLI authentication the user already has — no special auth handling

### Session lifecycle
- Automatically start the remote session when autopilot starts (alongside tunnel, dashboard, etc.)
- `--no-remote` CLI flag to opt out (consistent with `--no-tunnel` pattern)
- Session stays alive even after autopilot build completes — users can still ask questions about the finished build
- If `claude remote-control` fails (no Max plan, auth issues, etc.), warn and continue without it — non-fatal, graceful degradation (same pattern as tunnel)
- Register cleanup in ShutdownManager for process termination

### Dashboard integration
- Prominent card on the Overview page with the remote session URL and copy-to-clipboard button
- Similar treatment to how tunnel URL is displayed
- Clicking the URL opens claude.ai/code in a new tab (external link, no iframe)
- No live status indicator needed — just show the URL and copy button
- Remote session URL also printed in terminal startup banner alongside dashboard URL and tunnel URL

### Session context
- No custom system prompt or pre-loaded context — just run `claude remote-control` in the project directory and let Claude Code pick up CLAUDE.md and project context naturally
- Use local CLI auth — no special token handling

### Claude's Discretion
- Recovery strategy when remote-control process dies unexpectedly (auto-restart vs notify)
- Exact URL parsing approach from `claude remote-control` stdout
- Card visual design and layout on Overview page
- How to handle the URL in notifications (if at all)

</decisions>

<specifics>
## Specific Ideas

- Follow the exact same graceful degradation pattern as dev-tunnels (Phase 11): try to start, warn if it fails, continue without it
- URL stored in AutopilotState (like tunnelUrl) for persistence and cross-tool access
- The `claude remote-control` command outputs a session URL to stdout — parse and capture it
- Remote session should use the same project directory as autopilot's cwd

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-claude-code-remote-session*
*Context gathered: 2026-02-26*
