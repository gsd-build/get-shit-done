---
name: gsd:set-profile
description: Switch model profile for GSD agents (quality/balanced/budget/inherit)
argument-hint: <profile (quality|balanced|budget|inherit)>
allowed-tools:
  - Bash
---

Run this command and display its output to the user verbatim. Do not add any extra commentary:

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-set-model-profile $ARGUMENTS --raw
```

If the command exits with an error, show the error message to the user.
