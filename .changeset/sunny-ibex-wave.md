---
type: Removed
pr: 3299
---
**`gsd-intel-updater` no longer emits a vestigial "Layout detection returned 'unknown'" line on non-GSD-framework projects** — the layout-detection bash block is now gated on a positive framework-repo check (package.json name = "get-shit-done-cc"), so ordinary user projects skip the step silently.
