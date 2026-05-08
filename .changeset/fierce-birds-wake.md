---
type: Fixed
pr: 3254
---
**`get-shit-done-cc --codex` no longer rejects valid TOML floats** — `tool_timeout_sec = 20.0` (which Codex CLI's serde schema actually requires) is now preserved instead of triggering a half-rolled-back install. Rollback also covers skills/, agents/, and VERSION on validation failure.
