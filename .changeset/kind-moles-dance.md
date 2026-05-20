---
type: Fixed
pr: 3762
---
**Repo-local Claude agents now detected on --local installs** — `resolveAgentsDir()` was checking only `~/.claude/agents`, so `init.new-project` reported `agents_installed: false` and `init-complex` skipped initialization despite a valid repo-local install.
