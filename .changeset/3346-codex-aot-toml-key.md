---
type: Fixed
pr: 3346
---
**Codex AoT hooks migration uses event-name leaf key, not location tuple** — `migrateCodexHooksMapFormat` in `bin/install.js` re-emitted the legacy `[hooks.<X>]` section's path segment verbatim as the leaf TOML key of the new `[[hooks.<EVENT>]]` two-level nested AoT block. When the legacy table key was a `<file>:<event>:<line>:<col>` location identifier (with the actual event name in an `event = "..."` body field), the migration produced a header like `[[hooks."C:\Users\helen\.codex\config.toml:session_start:0:0"]]`, which Codex 0.124.0+ refuses to load. The map-format and stale-namespaced-AoT branches now mirror the flat-AoT branch: when the section body declares `event = "..."`, that name wins as the leaf key (and `event` is excluded from the re-emitted handler body). `npx get-shit-done-cc@latest` no longer aborts the Codex runtime install on Windows configs that pre-date the AoT migration. (#3346)
