---
type: Fixed
pr: 3584
---
**Runtime emitters now produce routable slash-command form** — `init manager` recommended actions, `phase add/insert` ROADMAP entries, `validate health` fix hints, `milestone complete` Operator Next Steps, `validate context` warnings, and `generate-claude-md` workflow blocks now emit `/gsd-<cmd>` for skills-based runtimes (Claude/Cursor/OpenCode/Kilo/etc.) and `$gsd-<cmd>` for Codex. The deprecated `/gsd:<cmd>` colon form is no longer emitted — pasting a recommended-action command into Claude Code now routes successfully instead of failing with "Unknown command".
