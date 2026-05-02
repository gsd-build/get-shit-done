---
type: Added
pr: 3032
---
**Documentation: MCP tool schema as a context-budget concern (#3025).** Adds new sections to `get-shit-done/references/context-budget.md` and `docs/USER-GUIDE.md` explaining that every enabled MCP server injects its tool schema into every turn — heavyweight servers (browser/playwright, Mac-tools, Windows-tools) can cost 20k+ tokens each, often dwarfing what `model_profile` tuning saves. The toggle lives in `.claude/settings.json` (`enabledMcpjsonServers` / `disabledMcpjsonServers`) and is a Claude Code harness concern, not a GSD concern. Includes a pre-phase audit checklist (browser, platform-specific, cross-project, duplicates) and notes the multiplier interaction with `model_profile`. Companion to #3023 (per-phase-type model map) and #3024 (dynamic routing); together they cover the three biggest cost levers.
