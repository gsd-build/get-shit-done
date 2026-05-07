---
type: Fixed
pr: 3163
---
**`generate-claude-md` now writes to `AGENTS.md` on Codex runtime** — when `config.runtime` is `codex` (or `GSD_RUNTIME=codex`), the handler overrides the output target to `AGENTS.md` regardless of `claude_md_path`, so Codex projects no longer have GSD sections written to `CLAUDE.md` by mistake.
