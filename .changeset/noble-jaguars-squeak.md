---
type: Fixed
pr: 3110
---
**Stale `/gsd:<cmd>` references no longer leak into model context on non-Gemini runtimes** — `scripts/fix-slash-commands.cjs` SEARCH_DIRS did not cover `agents/`, `sdk/src/`, or top-level files, so 9 colon-form references survived in 6 files. The hit at `agents/gsd-codebase-mapper.md:105` propagated into `~/.claude/agents/` at install time (the fixer is not wired into install) and produced unrunnable `/gsd:<cmd>` suggestions in agent output on Claude Code, Cursor, Windsurf, etc. Closes #3100.
