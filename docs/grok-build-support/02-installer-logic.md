# Grok Build: Installer Logic Changes

## Overview

`bin/install.js` (11,231 LOC) is the single source of truth for multi-runtime installation. It must be extended in a similar style to the 15 existing runtimes (Claude is default, others are explicit branches).

## 1. CLI Flags & Parsing (near top of file)

Add:
```js
const hasGrok = args.includes('--grok');
```

Update the big list:
```js
if (hasAll) {
  selectedRuntimes = [..., 'grok'];
}
...
if (hasGrok) selectedRuntimes.push('grok');
```

Update the usage / help text block that enumerates all `--xxx` flags (appears in several console.log blocks).

Add `grok` to the "choose runtimes" interactive prompt options (the readline menu when no flags given).

## 2. getGlobalDir / getDirName / getConfigDirFromHome

Add dedicated `if (runtime === 'grok')` branches in all three functions (modeled exactly on `trae`, `qwen`, `codebuddy`, `cline` — the simpler XDG-style ones).

## 3. Per-Runtime Install Functions

Most runtimes share the bulk of `installRuntime` logic. Differences are isolated in a few call sites:

- `installForRuntime(configDir, runtime, options)` or the big switch inside `install()`.
- Specific functions:
  - `installClaudeConfig`
  - `installCodexConfig` (TOML + features + hooks)
  - `installCopilotInstructions`
  - `installGeminiSettings`
  - `installOpencode...`
  - `installWindsurf...` (uses conversion layer)
  - `installTrae...`
  - Hook registration helpers (`writeClaudeHooksSettings`, `writeCodexHooksToml`, etc.)

**For Grok we will need (new or extended):**

- `installGrokConfig(targetDir, agentsSrc)` — writes or merges `~/.grok/config.toml` sections for GSD (hooks, statusline if supported, MCP if relevant).
- Hook JSON writer: `writeGrokHookManifests(hooksDir, portableBase, gsdInstalledPath)` — generates one or more `*.json` files under `.grok/hooks/` that declare matchers for `SessionStart`, `PreToolUse`, `PostToolUse`, `UserPromptSubmit`, etc. and point `command: "node /abs/path/to/gsd-foo.js"`.
- Skill/agent staging call using the existing `stageSkillsForProfile` + a new `convertClaudeToGrokSkill` / `convertClaudeAgentToGrokAgent` (see 04).
- Possibly a light `installGrokProjectRules` that ensures an `AGENTS.md` (or appends to existing) contains the GSD context header, or simply relies on the user running `/gsd-new-project` which creates `CONTEXT.md` + updates `CLAUDE.md` / `AGENTS.md`.

Because many Grok users will also have Claude Code, the installer should **not** delete or clobber `.claude/` artifacts when `--grok` is used. Coexistence is already supported for other pairs (e.g. `--both`).

## 4. Uninstall Path

Extend `uninstall(isGlobal, runtime)` with `isGrok` checks, proper label "Grok Build", and removal of `.grok/skills/gsd-*`, `.grok/agents/gsd-*`, `.grok/hooks/gsd-*` (or the JSON manifests), and the `get-shit-done/` payload.

Manifest cleanup in `writeManifest` / `readManifest` must recognize `grok` so that `gsd update` and re-installs correctly diff and repair only Grok-owned files.

## 5. Skill & Agent Installation (profile-aware)

The call chain `stageSkillsForProfile` → `convertClaudeCommandTo*` already exists for Windsurf/Trae. We will add:

```js
const isGrok = runtime === 'grok';
if (isGrok) {
  content = convertClaudeCommandToGrokSkill(content, skillName);
  // also rewrite @~/.claude/get-shit-done/... references
}
writeFile(path.join(skillsDir, skillName, 'SKILL.md'), content);
```

Same for agents (they go into `agents/` not `skills/` for Grok).

The 33 agents + 60+ commands must all be staged (subject to `--profile`).

## 6. Hook Script Placement for Grok

Current pattern for most runtimes: copy `hooks/*.js` + `hooks/*.sh` into `<configDir>/hooks/`.

For Codex it is special (TOML projection + sometimes JSON).

For Grok we will copy the JS hooks into `<configDir>/hooks/` (or `<configDir>/get-shit-done/hooks/` for cleanliness) and generate companion JSON files in `<configDir>/hooks/` that register them.

Example generated hook (illustrative):

```json
// ~/.grok/hooks/gsd-session-start.json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          { "type": "command", "command": "node ~/.grok/hooks/gsd-session-state.sh" }
        ]
      }
    ]
  }
}
```

The existing `projectPortableHookBaseDir`, `projectShellCommandText`, and the Codex-specific `projectCodexHookTomlCommand` helpers in `shell-command-projection.cjs` give us the pattern. We will likely add `projectGrokHookJson` or a generic `projectHookForRuntime('grok', ...)`.

## 7. Windows / Shim / PATH Considerations

Grok Build on Windows uses `%USERPROFILE%\.grok\bin`. The existing Windows shim logic (`buildWindowsShimTriple`) and portable hook path handling should be exercised for `grok` the same way as `codex` / `claude`. No special code expected, but add `grok` to any platform-specific test matrices.

## 8. Manifest & Ownership

GSD writes a `.gsd-install-manifest.json` (or similar) inside the `get-shit-done/` payload so that re-runs of the installer can detect "this file was written by GSD for runtime X" and safely upgrade/remove.

Ensure the manifest writer tags files under the `grok` runtime correctly.

## 9. Update Flow (`/gsd-update` and `gsd update`)

The `gsd-check-update.js` hook and `update` workflow must continue to work when the active runtime is `grok`. Because the payload lives at `~/.grok/get-shit-done/`, the version check and self-replace logic already use runtime-aware paths via the catalog / runtime-homes, so once `grok` is in the homes map it should light up.

## 10. Risk / Edge Cases

- Users with both Claude Code + Grok Build will see duplicate `/gsd:*` commands if they install to both (skill deduping in Grok may help; document the recommended "install once to your primary runtime").
- `grok` binary name collision with other tools? Unlikely.
- TOML vs JSON config for Grok — start by writing JSON hooks; if Grok also supports a central `hooks.json` or `config.toml [hooks]`, prefer the canonical Grok style (research during impl).
- First-time `grok` launch creates `~/.grok/` — installer should be idempotent and not race.

## Files Touched (high level)

- `bin/install.js` (primary)
- `get-shit-done/bin/lib/runtime-homes.cjs` (pure mirror)
- `get-shit-done/bin/lib/shell-command-projection.cjs` (likely)
- Possibly `get-shit-done/bin/lib/installer-migrations.cjs` (new migration if we introduce a Grok-specific legacy format later)

All changes must keep the "GSD is installed under the runtime's tree" invariant so that `gsd-sdk` path resolution (sdk-package-compatibility.ts) continues to find the tools.
