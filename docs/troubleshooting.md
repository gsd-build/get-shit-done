---
layout: default
title: Troubleshooting
---

# Troubleshooting

Common issues and how to fix them.

---

## Installation Issues

### Commands not found after install

- Restart Claude Code to reload slash commands
- Verify files exist in `~/.claude/commands/gsd/` (global) or `./.claude/commands/gsd/` (local)

### Commands not working as expected

- Run `/gsd:help` to verify installation
- Re-run `npx get-shit-done-cc` to reinstall

### Using Docker or containerized environments

If file reads fail with tilde paths (`~/.claude/...`), set `CLAUDE_CONFIG_DIR` before installing:

```bash
CLAUDE_CONFIG_DIR=/home/youruser/.claude npx get-shit-done-cc --global
```

This ensures absolute paths are used instead of `~` which may not expand correctly in containers.

---

## Workflow Issues

### "Claude seems confused about the project"

Check your `.planning/PROJECT.md`. Is it accurate? Run `/gsd:progress` to see what Claude thinks the current state is.

### Plans are too big

GSD plans should have 2-3 tasks max. If you're seeing more, your phases might be too large. Consider splitting them:

```
/gsd:add-phase
```

### Context seems degraded

This shouldn't happen with GSD, but if it does:

```
/gsd:pause-work
```

Then start a fresh session and:

```
/gsd:resume-work
```

---

## Updating

### Updating to the latest version

```bash
npx get-shit-done-cc@latest
```

### Checking what's new

```
/gsd:whats-new
```

---

## Still stuck?

- [Open an issue on GitHub](https://github.com/glittercowboy/get-shit-done/issues)
- Check existing issues for similar problems
- Include your GSD version and error messages when reporting
