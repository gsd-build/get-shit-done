---
type: Fixed
pr: 3282
---
**`gsd-sdk` now installs reliably on Windows** — the Windows installer now probes the user-level registry Path via PowerShell (the same source PowerShell, cmd.exe, and Git Bash inherit) to verify persistent reachability, instead of skipping the cross-shell check entirely. Applies the same npx-PATH filter as the Linux fix from #3249, and replaces stale `gsd-sdk.cmd` shims pointing at the deprecated `gsd-tools.cjs`. Emits an actionable warning instead of a false-positive ready signal when the npm-prefix bin dir is not on the user's persistent Path.
