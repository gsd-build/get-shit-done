# Phase 13: Add gsd:autopilot login command - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a `login` subcommand to `/gsd:autopilot` that runs the devtunnel browser-based authentication flow from within Claude Code, so users can authenticate for remote dashboard access without leaving the session. The bundled devtunnel.exe in the autopilot directory is used — no external CLI install required.

</domain>

<decisions>
## Implementation Decisions

### Subcommand design
- Add `login` as a subcommand to existing `/gsd:autopilot` (alongside status, stop)
- Login only — no logout or auth-status subcommands
- Pre-check: run `devtunnel user show` first; if already authenticated, offer re-login choice before proceeding
- Devtunnel executable is bundled in the autopilot code directory — no external install check needed

### Interactive auth flow
- Spawn `devtunnel user login` and let the OS handle opening the browser
- 5-minute timeout for the user to complete browser authentication
- Support two auth providers: Microsoft account (default) and GitHub via argument (`/gsd:autopilot login github` maps to `-g` flag)
- On auth failure (denied, network error): show the error message and suggest running the command again — no auto-retry

### Feedback and confirmation
- While waiting: simple static message "Waiting for browser authentication... (Press Ctrl+C to cancel)"
- On success: show account name from devtunnel output + "Dev tunnels are ready" confirmation
- Trust the exit code — no additional token validation after login
- No next-steps hint after success — just the confirmation message

### Auth method scope
- Only wraps `devtunnel user login` — no guided setup for GITHUB_TOKEN or DEVTUNNEL_TOKEN env vars
- Users who want token-based auth can set env vars manually (existing error messages already guide them)
- No check for running autopilot instances — login is independent
- If devtunnel.exe is missing from expected location: clear error message with reinstall instructions

### Claude's Discretion
- Exact output formatting and color scheme
- How to parse account name from devtunnel login output
- Error message wording details
- How the re-login prompt is presented (could use AskUserQuestion or simple confirmation)

</decisions>

<specifics>
## Specific Ideas

- The devtunnel.exe is already bundled in the autopilot code directory (resolved via `resolveDevTunnelExe()` in TunnelManager)
- Follows existing `/gsd:autopilot` SKILL.md pattern: launcher.js routes subcommands
- Pre-check uses same `devtunnel user show -v` approach already in TunnelManager's `getDevTunnelCliToken()`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-add-gsd-autopilot-command-to-run-devtunnel-user-login-process-so-the-user-can-do-that-all-from-claude-code*
*Context gathered: 2026-02-26*
