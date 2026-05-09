---
type: Fixed
pr: 3289
---
**`get-shit-done-cc --codex` no longer rejects valid Codex `hooks.state` trust-persistence entries** — the schema validator was over-classifying every `hooks.*` table as an event-handler array-of-tables, breaking installs against Codex CLI 0.130.0+ where `hooks.state.<project>/...` stores per-hook trust state. Regular-table shape is now accepted for `hooks.state.*` while `hooks.<EVENT>` still requires AoT.
