# Copilot Instructions — GSD Copilot Port

This repo is a fork of gsd-build/get-shit-done.

## Maintain a derived compatibility layer
Do not rewrite upstream content. Instead:
- Generate VS Code prompt files and agents by running: `node bin/install.js --copilot --local`
- Keep custom agent profiles in .github/agents minimal and stable

## When working on sync PRs
- Prefer fixing the generator over hand-editing many prompt files.
- Keep diffs minimal and easy to review.

## When upstream changes break the generator
If a sync PR fails validation:
- Invoke `@gsd-upstream-sync` agent
- Agent will diagnose what broke and fix `bin/install-copilot.js`
- Never manually edit upstream content (`commands/gsd/`, `get-shit-done/workflows/`, `agents/`)
- See `.github/instructions/upstream-sync-guide.md` for details

