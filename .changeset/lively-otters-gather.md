---
type: Fixed
pr: 3011
---
**Actionable diagnostic when `gsd-sdk` is not on PATH after install** — Windows users (and others on multi-shell setups) reported that the previous "GSD SDK files are present but `gsd-sdk` is not on your PATH" warning gave them no way to fix it: no path to look at, no shell-specific commands, no mention of the npx-cache caveat. New `formatSdkPathDiagnostic({ shimDir, platform, runDir })` helper returns a typed IR with the resolved shim location, platform-specific PATH-export commands (PowerShell / cmd.exe / Git Bash on Windows; `export PATH` on POSIX), and an npx-specific note when running under an `_npx` cache segment (where the shim may be written to a temp dir that won't persist). The console renderer in `bin/install.js` emits the lines from the IR; tests assert on the typed fields directly. (#3011)
