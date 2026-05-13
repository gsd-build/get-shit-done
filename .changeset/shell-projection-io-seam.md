---
type: Changed
pr: 3470
---
Add subprocess dispatch (`execGit`, `execNpm`, `execTool`, `probeTty`) and platform file I/O seam (`platformWriteSync`, `platformReadSync`, `platformEnsureDir`, `normalizeContent`) to `shell-command-projection.cjs`. Single seam for all OS-facing I/O — phase 1 of cross-platform hardening. See #3465.
