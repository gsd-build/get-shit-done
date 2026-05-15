# Grok Build: Runtime Detection and Configuration

## 1. Runtime Identifier

**Canonical slug:** `grok`

- Used in:
  - `config.json` → `runtime: "grok"`
  - `GSD_RUNTIME=grok` (env precedence, see `sdk/src/query/helpers.ts:detectRuntime`)
  - `bin/install.js` flag `--grok`
  - All switch/case and `isGrok` helpers
  - Model catalog key under `runtimeTierDefaults`

**Human label:** "Grok Build" (or "Grok" for short in tables).

**Dir name for local installs:** `.grok` (i.e. `./.grok/get-shit-done/...`)

**Global config base:** `~/.grok` (honoring `GROK_CONFIG_DIR` env var, matching Grok's own convention and the `~/.grok` already present on developer machines).

## 2. Path Resolution (add to `bin/install.js:getGlobalDir` and `get-shit-done/bin/lib/runtime-homes.cjs`)

```js
if (runtime === 'grok') {
  if (explicitDir) return expandTilde(explicitDir);
  if (process.env.GROK_CONFIG_DIR) return expandTilde(process.env.GROK_CONFIG_DIR);
  return path.join(os.homedir(), '.grok');
}
```

Add matching entry in `getConfigDirFromHome` (for hook templating):

```js
if (runtime === 'grok') return "'.grok'";
```

Also add `getDirName('grok') === '.grok'`.

**Local vs global distinction** (same as others):
- `--local` / `-l` → `./.grok/get-shit-done/`
- `--global` / `-g` (default for most) → `~/.grok/get-shit-done/`

Grok Build itself supports both project-local `.grok/` and user-global `~/.grok/`, with local taking precedence for skills/agents/hooks (see `~/.grok/docs/user-guide/08-skills.md`).

## 3. Detection & Auto-Selection

In `bin/install.js` interactive prompt / auto-detect block (around lines 181–200):

- Add `const hasGrok = args.includes('--grok');`
- Push `'grok'` when `hasGrok` (and when `--all`).
- Update the "both" / legacy paths if needed (probably not; `--both` stays Claude+OpenCode).

Update the usage banner / help text that lists `--claude --opencode --gemini ... --cline`.

**Auto-detect heuristic** (optional nice-to-have, low priority): scan for `grok` binary in PATH or presence of `~/.grok/auth.json` and default to suggesting Grok when only Grok is installed. Current behavior for other tools is mostly flag-driven or "all".

## 4. Environment Variable

**Primary:** `GROK_CONFIG_DIR` (consistent with `WINDSURF_CONFIG_DIR`, `CODEX_HOME`, `CLINE_CONFIG_DIR`, etc.).

Grok Build itself may document its own env var for home (if it follows XDG or has `GROK_HOME`); we should honor the most common one. Start with `GROK_CONFIG_DIR` and fall back to `~/.grok`. Document the var in `CONFIGURATION.md`.

## 5. Runtime in `.planning/config.json`

When a user runs `/gsd-config` or `gsd-sdk query config-set runtime grok`, it should accept the value because it will be in `SUPPORTED_RUNTIMES` (derived from the catalog).

For users who primarily use Grok Build but previously installed GSD under Claude, the installer `--grok` should be able to coexist (multiple runtimes can be installed side-by-side; GSD supports multi-runtime installs via `--all`).

## 6. Skill Surface & Profile Interaction

Grok Build will use the same `--profile=core|standard|full` logic. No change to `install-profiles.cjs`.

Because Grok's skill surface budget is unknown (but likely similar to Claude's), the tiered profiles remain valuable.

## 7. File Placement Summary (for Grok)

| Artifact | Global Path | Local Path | Notes |
|----------|-------------|------------|-------|
| GSD payload | `~/.grok/get-shit-done/` | `./.grok/get-shit-done/` | Self-contained tools + workflows |
| Skills | `~/.grok/skills/gsd-*/SKILL.md` | `./.grok/skills/gsd-*/SKILL.md` | Must be converted from Claude frontmatter |
| Agents | `~/.grok/agents/gsd-*.md` | `./.grok/agents/gsd-*.md` | Converted frontmatter + permission_mode |
| Hooks (JSON) | `~/.grok/hooks/*.json` | `./.grok/hooks/*.json` | New generation logic (see 04) |
| Hook scripts (JS) | `~/.grok/hooks/gsd-*.js` or `~/.grok/get-shit-done/hooks/` | same local | Re-used Node hooks |
| Project rules | `AGENTS.md` (root) or `Claude.md` | same | Grok reads AGENTS.md first; we can install/update AGENTS.md with GSD section or keep CLAUDE.md for compat |
| Config / settings | `~/.grok/config.toml` | `./.grok/config.toml` | May need light updates for statusLine / hooks |

**Important:** Grok discovers `~/.claude/skills/` as a fallback. A minimal "works today" path is possible by installing skills/agents only to the Claude side even for Grok users, but the plan calls for **native** paths so that `grok inspect`, marketplace, and Grok-native tooling see GSD cleanly under the `.grok` tree.

## 8. Open Questions for Implementation

- Does Grok Build expose a `grok config set hooks ...` or must we write JSON directly? (Plan assumes direct write + `grok inspect` verification.)
- Exact model IDs for Grok coding tiers (see 03).
- Does Grok have a statusline equivalent today, or do we rely solely on `SessionStart` + `gsd-statusline.js` output injection?
- Permission mode mapping for agents (Grok has `permission_mode: plan | workspace-write | read-only` in frontmatter).

These will be answered during the first implementation spike on the `grok-build` branch.
