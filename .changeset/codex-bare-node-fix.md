---
type: Fixed
pr: 3022
---
**Codex SessionStart hook now uses absolute Node binary path** — closes the gap left after #3002. The Codex install path wrote `command = "node ${path}"` directly into config.toml, bypassing `resolveNodeRunner()`. Under GUI/minimal-PATH runtimes (`/usr/bin:/bin:/usr/sbin:/sbin`), bare `node` failed to resolve, exit 127. Now routed through new `buildCodexHookBlock()` helper. Reinstall path migrates legacy bare-node entries via new `rewriteLegacyCodexHookBlock()`. See #3017.
