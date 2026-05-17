---
type: Fixed
pr: 3641
---
**Install-time warning when a stale `@gsd-build/sdk` shadows the bundled `gsd-sdk` shim** — global installs now run `npm ls -g @gsd-build/sdk` and, if the standalone 0.1.0 package is present (it never received `query` subcommand support), print a clear remediation block before the install completes. Detection is fail-closed: any npm/exec error silently returns no-stale. Gated by `GSD_SKIP_STALE_SDK_CHECK=1` for CI/test environments. Resolves #3406.
