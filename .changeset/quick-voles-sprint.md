---
type: Fixed
pr: 3249
---
**`✓ GSD SDK ready` no longer prints when no persistent `gsd-sdk` shim exists** — the installer now requires durable reachability (not just transient npx PATH) and replaces stale legacy symlinks pointing at deprecated `gsd-tools.cjs`. Falls back to an actionable warning when login-shell PATH probing fails.
