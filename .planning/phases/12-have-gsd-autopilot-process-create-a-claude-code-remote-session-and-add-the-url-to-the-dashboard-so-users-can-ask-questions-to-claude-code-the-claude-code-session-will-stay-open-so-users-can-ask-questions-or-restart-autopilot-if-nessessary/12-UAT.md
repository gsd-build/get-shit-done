---
status: testing
phase: 12-claude-code-remote-session
source: 12-01-SUMMARY.md, 12-02-SUMMARY.md
started: 2026-02-26T22:00:00Z
updated: 2026-02-26T22:00:00Z
---

## Current Test

number: 1
name: Remote Session Starts on Autopilot Launch
expected: |
  When autopilot starts (without --no-remote), a `claude remote-control` process spawns automatically. The terminal output shows a line like "Claude remote session: https://claude.ai/code/sessions/..." with the captured URL.
awaiting: user response

## Tests

### 1. Remote Session Starts on Autopilot Launch
expected: When autopilot starts (without --no-remote), a `claude remote-control` process spawns automatically. The terminal output shows a line like "Claude remote session: https://claude.ai/code/sessions/..." with the captured URL.
result: [pending]

### 2. --no-remote Flag Disables Remote Session
expected: Running autopilot with `--no-remote` flag skips remote session startup entirely. No "Claude remote session" line appears in terminal output. `--help` shows the `--no-remote` option.
result: [pending]

### 3. Remote Session URL Card in Dashboard
expected: Opening the dashboard in a browser shows a blue card near the top of the Overview page displaying the Claude Code remote session URL. The card has a clickable link that opens the session in a new tab and a copy-to-clipboard button.
result: [pending]

### 4. RemoteSessionCard Positioned Below TunnelBanner
expected: On the dashboard Overview page, the blue Remote Session card appears immediately below the purple Tunnel URL banner (if tunnel is active). Both remote access URLs are visually grouped at the top.
result: [pending]

### 5. Graceful Degradation on Remote Session Failure
expected: If `claude remote-control` fails to start (e.g., Claude CLI not installed or not authenticated), the autopilot continues running normally with a warning message. The dashboard loads without the remote session card.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0

## Gaps

[none yet]
