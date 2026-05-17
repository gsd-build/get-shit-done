---
type: Changed
pr: 3663
---
**`gsd-surface profile` no longer leaves stale skill directories on disk** — `applySurface` migrates to a typed per-runtime artifact layout, so switching profiles now correctly prunes `skills/gsd-*/` directories across every runtime that materializes them (Claude global, Codex, Cursor, Windsurf, Trae, CodeBuddy, Copilot, Antigravity, Hermes, Qwen). Closes the structural gap behind #3659. Internal: introduces the Runtime Artifact Layout Module (`get-shit-done/bin/lib/runtime-artifact-layout.cjs`); `applySurface(runtimeConfigDir, layout, manifest, clusterMap)` is the new signature for internal callers. (#3663)
