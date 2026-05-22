---
type: Fixed
pr: 3799
---
project-local agents now detected correctly in init.* queries — resolveAgentsDir() checks `<projectDir>/.claude/agents` before the global runtime dir, matching Claude Code's own local-first agent resolution at spawn. Previously an empty auto-created `~/.claude/agents` caused agents_installed: false for project-local installs. (#3799)
