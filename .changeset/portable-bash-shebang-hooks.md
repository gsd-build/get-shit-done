---
type: Fixed
pr: 3194
---
**Community .sh hooks now use `#!/usr/bin/env bash` for cross-distro portability.** The three opt-in bash hooks (`gsd-phase-boundary.sh`, `gsd-session-state.sh`, `gsd-validate-commit.sh`) shipped with `#!/bin/bash`, which fails on distros that don't ship bash at `/bin/bash` (NixOS, minimal Alpine images, some container runtimes). POSIX guarantees `/bin/sh` but not `/bin/bash`. The fix matches the convention already used in `scripts/*.sh`. Latent in the default install path because Claude Code wires hooks as `bash <path>` from `settings.json` (PATH-resolved — the script's own shebang is read as a comment), but the bug surfaces immediately if a hook is run directly (tests, future installer changes, manual debugging). Comment in `bin/install.js::buildHookCommand` updated to clarify that the runner is PATH-resolved bare `bash`, not `/bin/bash` — POSIX std PATH guarantee was the wrong rationale.
