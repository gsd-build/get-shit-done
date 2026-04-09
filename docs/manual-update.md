# Manual Update (Non-npm Install)

Use this procedure when `npx get-shit-done-cc@latest` is unavailable — e.g. during a publish outage or if you are working directly from the source repo.

## Prerequisites

- Node.js installed
- This repo cloned locally (`git clone https://github.com/gsd-build/get-shit-done`)

## Steps

```bash
# 1. Pull latest code
git pull --rebase origin main

# 2. Build the hooks dist (required — hooks/dist/ is generated, not checked in as source)
node scripts/build-hooks.js

# 3. Run the installer directly
node bin/install.js --claude --global

# 4. Clear the update cache so the statusline indicator resets
rm -f ~/.cache/gsd/gsd-update-check.json
```

**Step 5 — Restart your runtime** to pick up the new commands and agents.

## Runtime flags

Replace `--claude` with the flag for your runtime:

| Runtime | Flag |
|---|---|
| Claude Code | `--claude` |
| Gemini CLI | `--gemini` |
| OpenCode | `--opencode` |
| Kilo | `--kilo` |
| Codex | `--codex` |
| Copilot | `--copilot` |
| Cursor | `--cursor` |
| Windsurf | `--windsurf` |
| Augment | `--augment` |
| All runtimes | `--all` |

Use `--local` instead of `--global` for a project-scoped install.

## What the installer replaces

The installer performs a clean wipe-and-replace of GSD-managed directories only:

- `~/.claude/get-shit-done/` — workflows, references, templates
- `~/.claude/commands/gsd/` — slash commands
- `~/.claude/agents/gsd-*.md` — GSD agents
- `~/.claude/hooks/dist/` — compiled hooks

**What is preserved:**
- Custom agents not prefixed with `gsd-`
- Custom commands outside `commands/gsd/`
- Your `CLAUDE.md` files
- Custom hooks

Locally modified GSD files are automatically backed up to `gsd-local-patches/` before the install. Run `/gsd-reapply-patches` after updating to merge your modifications back in.
