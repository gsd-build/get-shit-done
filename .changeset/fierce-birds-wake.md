---
type: Fixed
pr: 3254
---
**`get-shit-done-cc --codex` no longer rejects valid TOML floats** — `tool_timeout_sec = 20.0` (which Codex CLI's serde schema actually requires) is now preserved instead of triggering a half-rolled-back install. On any post-install validation failure, rollback now covers all five mutation surfaces: `skills/` (gsd-* skill dirs), `agents/` (gsd-*.md/.toml files), `VERSION`, `config.toml`, and any orphaned atomic-write temp files left by an aborted write.
