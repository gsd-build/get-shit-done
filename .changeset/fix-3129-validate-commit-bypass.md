---
type: Fixed
pr: 3141
---
**`gsd-validate-commit.sh` community hook now catches all git commit forms** — the previous `[[ "$CMD" =~ ^git[[:space:]]+commit ]]` bash regex silently bypassed Conventional Commits enforcement for `git -C /path commit`, `GIT_AUTHOR_NAME=x git commit`, and `/usr/bin/git commit`. Introduces `hooks/lib/git-cmd.js` — a token-walk classifier (`isGitSubcommand(cmd, sub)`) that correctly handles env-prefix assignments, `-C path` working-directory flags, full-path executables, `--git-dir=` options, and all git global boolean flags. The hook now delegates detection to this module — the single source of truth for all hooks that gate on git subcommands. Closes #3129.
