---
type: Fixed
pr: 3568
---

**Codex global install now produces discoverable `$gsd-*` skill surface** — `npx get-shit-done-cc@latest --codex --global` was leaving Codex CLI users with `get-shit-done/workflows/*.md` and `agents/gsd-*` on disk but no `~/.codex/skills/gsd-*/SKILL.md` files, so Codex 0.130.0 silently exposed zero `$gsd-*` commands after restart. The installer had been bypassing skill generation under the assumption that Codex auto-discovers from workflow/agent files; that assumption does not hold for the current Codex CLI. Re-wired the existing `copyCommandsAsCodexSkills()` helper into the Codex install dispatch path so it produces the same skill-shape as the Claude / Copilot / Antigravity / Cursor / Windsurf / Augment / Trae installs already do (one `skills/gsd-<name>/SKILL.md` per `commands/gsd/*.md`). Pre-existing user-owned non-`gsd-*` skill directories are preserved. Closes #3562.
