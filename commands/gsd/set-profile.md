---
name: gsd:set-profile
description: Switch model profile for GSD agents (quality/balanced/budget/inherit)
argument-hint: <profile (quality|balanced|budget|inherit)>
model: haiku
allowed-tools:
  - Bash
---

Show the following output to the user verbatim, with no extra commentary:

!`if ! command -v gsd-sdk >/dev/null 2>&1; then printf '⚠ gsd-sdk not found in PATH — /gsd:set-profile requires it.\n\nInstall the GSD SDK:\n  npm install -g @gsd-build/sdk\n\nOr update GSD to get the latest packages:\n  /gsd:update\n'; exit 1; fi; gsd-sdk query config-set-model-profile $ARGUMENTS --raw`
