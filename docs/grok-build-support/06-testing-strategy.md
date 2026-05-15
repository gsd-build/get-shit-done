# Grok Build: Testing Strategy

## 1. Philosophy

GSD has extremely high test coverage on the installer and runtime matrix because a broken install for any supported CLI is a support nightmare. Grok must be added with the same rigor as Codex, Windsurf, Trae, and Hermes.

## 2. New Test Files (recommended)

### `tests/grok-install.test.cjs`
Mirror the structure of `tests/windsurf-install.test.cjs` and `tests/trae-install.test.cjs`:
- `getGlobalDir('grok')` returns `~/.grok` (and respects `GROK_CONFIG_DIR`)
- Local vs global dir names (`.grok` vs `~/.grok`)
- Basic install smoke (creates `skills/`, `agents/`, `get-shit-done/`)
- Manifest ownership lines contain `grok`
- Uninstall removes only Grok-owned artifacts

### `tests/grok-conversion.test.cjs`
Unit tests for the three new conversion functions:
- `convertClaudeCommandToGrokSkill` produces valid YAML frontmatter with `name`, `description>`, `metadata`
- Path rewriting: `~/.claude/get-shit-done` → `~/.grok/get-shit-done`
- `convertClaudeAgentToGrokAgent` injects `prompt_mode`, `permission_mode`, `agents_md`
- Brand substitution works (optional, depending on final decision)
- Round-trip safety (idempotent on already-Grok content)

### `sdk/src/runtime-gate.test.ts` and `session-runner.test.ts`
Add cases:
```ts
process.env.GSD_RUNTIME = 'grok';
// expect(detectRuntime(...)).toBe('grok');
```
- Model resolution returns Grok-tier models (or nulls) when runtime=grok
- No accidental injection of Claude model IDs into Grok runs

## 3. Existing Test Updates

- `tests/windsurf-install.test.cjs` and sibling install tests that assert `getGlobalDir('claude')` / `getGlobalDir('codex')` — add `getGlobalDir('grok')` assertions for completeness.
- `tests/model-catalog-runtime-defaults.test.cjs` — the catalog snapshot test will now see one more runtime; update the expected count or make it dynamic.
- `tests/skill-manifest.test.cjs` — add a Grok-scoped skill directory in the fixture and verify discovery still works (Grok skills live in `.grok/skills/`).
- Any test that hard-codes the full list of runtimes (rare; most use the catalog) must be updated.
- `tests/package-legitimacy-gate.test.cjs` and tarball verification — ensure the new docs/ files and any new test files don't accidentally ship in the wrong place.

## 4. Integration / Manual Test Matrix

After `npm link` or `npx get-shit-done-cc@local` on the `grok-build` branch:

| Scenario | Command | Verification |
|----------|---------|--------------|
| Fresh global Grok install | `npx get-shit-done-cc --grok --global` | `ls ~/.grok/skills/gsd-new-project/SKILL.md`, `ls ~/.grok/agents/gsd-planner.md`, `ls ~/.grok/hooks/gsd-*.json`, `grok inspect` shows GSD AGENTS.md |
| Local install | `npx ... --grok --local` | Same under `./.grok/` |
| Profile install | `--grok --profile=core` | Only 6 core skills present |
| Coexistence | Install `--grok` then `--claude` | Both trees populated; no cross-clobber |
| Re-install / update | Run installer again | Manifest diff only touches GSD files, no duplicates |
| Hook firing | Start `grok`, run a write | Verify `gsd-workflow-guard` or `gsd-prompt-guard` logs appear |
| SDK under Grok | `GSD_RUNTIME=grok gsd-sdk query state json` | Works, uses the Grok-side get-shit-done payload |
| Model resolution | `gsd-sdk query resolve-model gsd-planner --runtime grok` | Emits a grok-* model id |

**Manual verification script** (to be added to `scripts/` or just documented in the plan):
```bash
#!/bin/bash
set -e
GROK_TMP=$(mktemp -d)
export GROK_CONFIG_DIR="$GROK_TMP"
npx get-shit-done-cc --grok --global --profile=standard
node -e '
  const {getGlobalConfigDir} = require("./get-shit-done/bin/lib/runtime-homes.cjs");
  console.log(getGlobalConfigDir("grok"));
'
# then inspect the dir contents
rm -rf "$GROK_TMP"
```

## 5. Golden Parity & Contract Tests

- The `sdk/src/query/QUERY-HANDLERS.md` golden matrix does not need Grok entries (it is about `gsd-sdk query` commands, not the outer runtime).
- `command-contract` lints and `lint-skill-deps` already work because they are runtime-agnostic.
- Ensure that after Grok install, `skill-manifest` still produces a correct `.grok/skills/...` manifest if the surface command is invoked inside Grok.

## 6. CI Impact

- All existing test jobs (vitest, c8 coverage on `get-shit-done/bin/lib/*.cjs`) will automatically exercise the new branches once the code is added.
- No new GitHub Actions matrix entry required unless we want an explicit "install on Grok" job (overkill for now).
- The `verify-tarball-sdk-dist.sh` script must continue to pass (it checks that the shipped `model-catalog.json` and CJS artifacts are intact).

## 7. Regression Guards

- Add a simple snapshot or `assert` in one of the install tests that the full list of supported runtimes (from catalog) is >= 16 (the current count +1 for grok).
- `runtime-homes.cjs` and `bin/install.js:getGlobalDir` must stay in sync — add a cross-file test or a comment-enforced parity check (existing pattern for other runtimes).

## 8. Performance / Scale

No new concerns: conversion is O(1) per file at install time. ~100 files × small string replaces is negligible.

## 9. Security / Secret Scanning

The new Grok hook JSON files will contain absolute paths to `node` and hook scripts — same as Codex TOML and Claude settings. The existing `secret-scan.sh` and base64 scanner already ignore our own hook ownership lines. No change needed.

## 10. Documentation of Tests

Update `docs/CONTRIBUTOR-STANDARDS.md` or the testing section of `CONTRIBUTING.md` (if present) with the note that every new runtime must have an `*install.test.cjs` and a `*conversion.test.cjs`.

This level of test investment is why GSD has such high reliability across 15+ frontends.
