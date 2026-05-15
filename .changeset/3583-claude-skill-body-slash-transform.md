---
type: Fixed
issue: 3583
---
Claude global-skill install now rewrites `/gsd:<cmd>` body references to `/gsd-<cmd>` so the installed SKILL.md body matches the hyphen-form `name:` Claude Code surfaces in its slash-command picker. Previously, `convertClaudeCommandToClaudeSkill` rebuilt the frontmatter but emitted the body unchanged, leaving routing hints like "Next step: /gsd:discuss-phase" that Claude Code rejected as "Unknown command" on global skill installs. Mirrors the body rewrite the Copilot adapter has applied since #2858. Source files keep canonical `/gsd:<cmd>` per the #3443 invariant.
