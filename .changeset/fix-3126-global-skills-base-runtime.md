---
type: Fixed
pr: 3126
---
**`global:` skill resolution now uses the correct runtime home directory** — `buildAgentSkillsBlock()` hardcoded `globalSkillsBase` to `~/.claude/skills` regardless of the active runtime, causing every `global:` skill lookup to silently fail on non-Claude runtimes (Cursor, Gemini, Codex, Windsurf, etc.). Introduces `get-shit-done/bin/lib/runtime-homes.cjs` — a first-class runtime→directory mapping module covering all 15 supported runtimes with their canonical env-var overrides. Notable specifics: Hermes Agent uses a nested `skills/gsd/<skillName>/` layout (#2841); Cline is rules-based and returns `null` (no skills directory); `CLAUDE_CONFIG_DIR` env var was previously missing for Claude. Warning messages now show the actual runtime-specific path. Closes #3126.
