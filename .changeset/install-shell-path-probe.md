---
type: Fixed
pr: 3028
---
**Installer no longer prints `✓ GSD SDK ready` when the shim is unreachable from the user's runtime shells.** The previous check used `process.env.PATH` from the install subprocess, which often differs from the user's later interactive shells (POSIX `~/.local/bin` not in login shell, node-version-manager PATH shims). Added `getUserShellPath()` helper that probes `$SHELL -lc 'printf %s "$PATH"'` and `isGsdSdkOnPath(pathString?)` overload that accepts an explicit PATH; the install-time check now downgrades to the actionable `⚠` diagnostic from PR #3014 when install-PATH and user-shell-PATH disagree. Windows cross-shell support tracked separately. See #3020.
