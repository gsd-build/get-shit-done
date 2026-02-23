---
description: Diagnose Codex+Claude GSD installation (engine, prompts, versions)
argument-hint: [none]
---

$ARGUMENTS

## Objective
Diagnose whether this project is set up to run GSD prompts in Codex while remaining compatible with Claude workflows on the same `.planning/` milestone/phases.

## Compatibility
- Use .codex/skills/get-shit-done-codex semantics.
- Do not modify files (read-only diagnostics).
- Prefer PowerShell commands; no jq.

## Checks to run
Run these checks and then present a compact table: `check | status | details | fix`.

### Versions
- Codex fork installed version (first match wins):
  - `.codex/gsd/VERSION`
  - `~/.codex/gsd/VERSION`
- Claude engine installed version (first match wins):
  - `.claude/get-shit-done/VERSION`
  - `~/.claude/get-shit-done/VERSION`

### Engine presence (required for Codex prompts)
- `.claude/get-shit-done/bin/gsd-tools.cjs` OR `.claude/get-shit-done/bin/gsd-tools.js`
- If only `gsd-tools.test.js` exists, treat engine as missing/incomplete.

### Codex agent roles (recommended for model routing)
- Role registrations exist (first match wins):
  - `.codex/config.toml` contains `[agents.gsd-planner]`
  - `~/.codex/config.toml` contains `[agents.gsd-planner]`
- Role config layers exist (first match wins):
  - `.codex/agents/gsd-planner.toml`
  - `~/.codex/agents/gsd-planner.toml`

### Project state
- `.planning/` exists (if missing, user hasn’t initialized a project).

## Update check
- Best-effort only; do not fail if offline.
### Update availability (best-effort)
- Latest Codex fork version (do not fail if offline):
  - `npm view gsd-codex-cli version`
- If installed Codex fork version is known and differs from latest, surface:
  - `Update available: {installed} -> {latest}`
  - Next: `/prompts:gsd-update` (Codex) / `/gsd:update` (Claude) or re-run `npx gsd-codex-cli@latest`.

## Recommended fixes (use the minimum)
- If engine missing: `npx gsd-codex-cli@latest --path .` (or `--global`)
- If only Claude engine exists and Codex prompts are desired in-project: `npx gsd-codex-cli@latest --path .`
- If `.planning/` missing: run `/prompts:gsd-new-project` (Codex) / `/gsd:new-project` (Claude)

## Completion output
- Print the table and a single “Next recommended command”:
  - If engine missing: `npx gsd-codex-cli@latest --path .`
  - Else if `.planning/` missing: `gsd-new-project` / `/gsd:new-project`
  - Else: `gsd-progress` / `/gsd:progress`
