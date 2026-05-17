---
type: Fixed
pr: 3677
---
Agent install for hyphen-`name:` runtimes (Claude default, Qwen, Hermes) now normalizes retired `/gsd:<cmd>` references in `agents/gsd-*.md` bodies to the canonical `gsd-<cmd>` hyphen form, using the shared `transformContentToHyphen` transformer behind a runtime gate in `bin/install.js`. This is the agent-surface analogue of the SKILL.md body fix (#3629) and the user-facing emission fix (#3606). Gemini (intentionally colon-namespaced) and the self-converting adapter runtimes (Copilot, Codex, Cursor, Windsurf, Augment, Trae, Codebuddy, Cline, OpenCode, Kilo) are excluded from the rewrite. Frontmatter `name:` was already correct since #2808; the agent-body colon leakage is now eliminated. Fixes #3677.
