# Grok Build: Documentation and User Experience Updates

## 1. Primary User-Facing Documentation

### README.md (and all 5 translated variants)
- Add "Grok Build" to the hero list: "...for Claude Code, OpenCode, Gemini CLI, Kilo, Codex, **Grok Build**, Copilot, Cursor, Windsurf, and more."
- Add `--grok` example in the install section (next to `--codex`, `--opencode`).
- Update the "Trusted by engineers at..." or any tool logos if Grok branding is desired (optional).
- Mention in "Why I Built This" or FAQ if Grok-specific praise appears (post-launch).

### docs/CLI-TOOLS.md
- Add Grok to the reviewer CLI routing example:
  ```bash
  gsd-sdk query config-set review.models.grok "grok exec --model grok-4"
  ```
- Document any Grok-specific `gsd-tools.cjs` behavior (likely none; the tools are runtime-agnostic once installed).

### docs/CONFIGURATION.md
- In the "Code Review CLI Routing" section, add `review.models.grok`.
- In the model profile / runtime table (generated from catalog), the new `grok` row will appear automatically after the JSON edit — just verify the rendered table looks good.
- Document `GROK_CONFIG_DIR` env var under "Runtime-specific environment variables".
- Add Grok to the "Multi-runtime installations" guidance.

### docs/manual-update.md
- Add a row for Grok Build:
  | Grok Build | `--grok` | `~/.grok/get-shit-done` |

### docs/USER-GUIDE.md and docs/FEATURES.md
- Mention Grok Build in the "supported environments" or "works with" lists.
- If there is a "slash command" or "skill" section, note that GSD skills become native `/gsd:*` commands under Grok as well.

### docs/COMMANDS.md
- No structural change; the command reference is generated from the skill frontmatter. Once Grok skills are installed they will be discovered by users running `/gsd:help` inside Grok.

## 2. In-Product / Workflow Documentation

Many workflows and the `claude-md.md` template contain phrases like:
- "Claude Code reads CLAUDE.md on every turn"
- "Spawn a subagent with the Task tool (Claude Code)"

**Strategy:**
- Use the new `convertClaudeToGrokMarkdown` at install time for Grok installs so that the *installed* copy says "Grok Build reads AGENTS.md..." and "use the `task` tool (Grok)".
- Keep the *source* files in `commands/gsd/` and `workflows/` as neutral or Claude-centric (they are the "Claude-first" canonical form).
- This is exactly how Windsurf and Trae already handle it.

Add a small section in the generated `CLAUDE.md` / `AGENTS.md` (the GSD-managed portion) that says:

> This project uses get-shit-done (GSD). The same `/.grok/get-shit-done` or `/.claude/get-shit-done` payload works for Grok Build, Claude Code, OpenCode, Codex, and 12 other CLIs.

## 3. First-Run & Install Experience

When a user runs `npx get-shit-done-cc --grok` for the first time:

- Banner / success message should say "Grok Build" not generic "your AI coding assistant".
- The post-install instructions should tell them to restart their Grok TUI (or run `grok` again) so the new skills/agents/hooks are picked up.
- `grok inspect` should now show the GSD `AGENTS.md` (or `CLAUDE.md`) and the skill count.

Update the interactive runtime selection prompt text.

## 4. Review Models & Integrations (`/gsd-config --integrations`)

Add `grok` to the documented list of valid keys for `review.models.<cli>`.

Default reviewer for Grok (if we want one) can be left empty (fall back to session model) or set to a strong Grok model string once we know the exact CLI invocation (`grok exec ...` or whatever the headless command is).

## 5. Chinese / Japanese / Korean / Portuguese / Spanish docs

All five `docs/*/README.md` and `docs/*/CLI-TOOLS.md` etc. must be updated in lockstep with the English originals. The project treats translated docs as first-class.

Look for existing patterns of how new runtime mentions were added in the zh-CN, ja-JP, etc. versions.

## 6. Internal / Contributor Docs

- `docs/ARCHITECTURE.md` — mention Grok as another supported runtime in the "multi-frontend" diagram or text (if it has one).
- `docs/AGENTS.md` and `docs/agents/domain.md` — no change needed unless we add a new GSD agent for "Grok-specific migration".
- `docs/adr/` — after implementation, write a short ADR (e.g. `0012-grok-build-runtime.md`) summarizing the integration approach, similar to past runtime additions.
- `CHANGELOG.md` — entry under the next release: "Add Grok Build (`--grok`) as a first-class runtime with native `.grok/skills/`, `.grok/agents/`, and hook JSON support."

## 7. Help Text & `/gsd:help`

The `help` workflow and `commands/gsd/help.md` are generic; they will automatically reflect the installed skill set. No hard-coded "Claude only" language should exist there.

## 8. Marketplace / Plugin Story (stretch)

Once GSD supports Grok natively, it becomes a candidate for submission to Grok's plugin/skill marketplace (under `~/.grok/marketplace-cache/...`). This is out of scope for the initial plan but noted for future.

## 9. Error Messages & Diagnostics

- `gsd-sdk` path resolution errors should mention `.grok/get-shit-done/bin/gsd-tools.cjs` as a possible location when `GSD_RUNTIME=grok`.
- The installer should emit clear "Grok Build detected via GROK_CONFIG_DIR or ~/.grok/auth.json" messages during auto flow.

## 10. Visual / Assets

No new logos required for v1. The existing terminal.svg and gsd-logo assets are runtime-neutral.

If later we want a Grok-themed install banner, that would be a follow-up polish task.

## Checklist for Docs PR

- [ ] All 6 English docs files updated
- [ ] All 5 translated READMEs + their local CLI-TOOLS/CONFIGURATION copies
- [ ] `docs/CONFIGURATION.md` model table renders correctly with new row
- [ ] `docs/manual-update.md` table includes Grok
- [ ] Internal references in `docs/INVENTORY.md` and generated files (run `scripts/gen-inventory-manifest.cjs` if needed)
- [ ] `CHANGELOG.md` entry + changeset fragment
