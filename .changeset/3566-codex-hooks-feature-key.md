---
type: Fixed
pr: 3570
---

**Codex installs use the canonical `[features].hooks` flag** — the Codex installer now writes `hooks = true` instead of the legacy `codex_hooks = true`, recognizes and migrates legacy `codex_hooks` entries on reinstall, and removes either key on uninstall when the hooks feature flag is GSD-owned. Existing user-owned `hooks = true` settings are preserved. (#3566)
