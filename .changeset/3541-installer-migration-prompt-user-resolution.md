---
type: Fixed
pr: 0
---

**Installer migration no longer hangs `/gsd-update` on leftover GSD-looking files** — non-TTY installer runs now default-resolve `prompt-user` migration actions by classification (stale SDK build artifacts under `get-shit-done/sdk/{dist,src}/gsd-*` default to `remove`; user-facing `skills/gsd-*/SKILL.md` defaults to `keep`) and log each resolution. Anything that cannot be safely defaulted still blocks, but the error message now groups blocked paths by reason, lists the documented choices, and names the `GSD_INSTALLER_MIGRATION_RESOLVE` env var as the non-interactive resolution surface. (#0)
