# Operational Components Reference

> **Scope:** Installation and runtime hooks that power GSD behavior in Claude Code.
> **Source files:** `bin/install.js`, `hooks/statusline.js`, `hooks/gsd-check-update.js`.

---

## bin/install.js

### Purpose
Installs GSD into a Claude Code configuration directory (global or project-local), wires hooks and statusline configuration, and writes version metadata for update detection.

### Install flow (high level)
1. **Parse CLI flags** (`--global`, `--local`, `--config-dir`, `--force-statusline`, `--help`).
2. **Resolve install target**:
   - Global: `~/.claude` (or `CLAUDE_CONFIG_DIR` / `--config-dir`).
   - Local: `./.claude` in current working directory.
3. **Copy assets with path replacement**:
   - `commands/gsd` and `get-shit-done` directories are copied wholesale (clean install) and `.md` files have `~/.claude/` rewritten to the target prefix.
4. **Install agents**: delete existing `gsd-*.md` files in target agents directory, then copy new agents.
5. **Write metadata**: copy `CHANGELOG.md`, write `VERSION` file, copy `hooks/`.
6. **Configure hooks and statusline**:
   - Ensure SessionStart hook includes `gsd-check-update.js`.
   - Optionally set `settings.statusLine` to use `hooks/statusline.js` (prompted when interactive, or forced via flag).
7. **Write `settings.json`** and print completion message.

### Filesystem changes
- **Creates/updates:**
  - `commands/gsd/` (GSD command definitions)
  - `get-shit-done/` (workflows/templates/refs)
  - `agents/gsd-*.md` (GSD agents; only these are removed/replaced)
  - `hooks/` (statusline and update hook scripts)
  - `get-shit-done/CHANGELOG.md`
  - `get-shit-done/VERSION` (current package version)
  - `settings.json` (statusline config and SessionStart hook)

### CLI wiring
- Published as a binary via `package.json` `bin` mapping: `get-shit-done-cc → bin/install.js`.
- Installed/used via `npx get-shit-done-cc ...`.

### Expected side effects
- Removes existing destination directories for `commands/gsd` and `get-shit-done` to prevent orphaned files.
- Removes only `gsd-*.md` agents (leaves custom agents intact).
- Adds SessionStart hook entry for update checks (if missing).
- Optionally replaces existing statusline configuration (interactive prompt or `--force-statusline`).

### Key env/version checks
- **Config directory resolution:** `--config-dir` > `CLAUDE_CONFIG_DIR` > `~/.claude`.
- **Version source:** reads `package.json` version for banner and writes it to `get-shit-done/VERSION`.
- **Node version requirement:** enforced by package metadata (`engines.node >=16.7.0`).

### Reads/Writes/Triggers/Consumers

| Category | Details |
| --- | --- |
| **Reads** | `package.json` (version), `settings.json` (existing hooks/statusline), local `commands/`, `get-shit-done/`, `agents/`, `hooks/` directories. |
| **Writes** | `settings.json`, `commands/gsd/`, `get-shit-done/`, `agents/gsd-*.md`, `hooks/`, `get-shit-done/CHANGELOG.md`, `get-shit-done/VERSION`. |
| **Triggers** | Statusline hook (`hooks/statusline.js`) and update check hook (`hooks/gsd-check-update.js`) via `settings.json`. |
| **Consumers** | Claude Code loads `settings.json` (statusline + SessionStart hooks); GSD commands read installed assets from `.claude/`. |

---

## hooks/statusline.js

### Purpose
Outputs a compact statusline for Claude Code showing model name, current task, directory name, context usage, and update availability.

### How status is computed
- **Model name**: `data.model.display_name` (fallback: `Claude`).
- **Workspace directory**: `data.workspace.current_dir` (fallback: `process.cwd()`), displayed as basename.
- **Context usage**: takes `data.context_window.remaining_percentage`, converts to used %, renders a 10-segment bar, and color-codes by usage threshold.
- **Current task**: reads latest todo file for current session from `~/.claude/todos/` and picks the `in_progress` item’s `activeForm`.
- **Update indicator**: reads `~/.claude/cache/gsd-update-check.json` and shows `⬆ /gsd:update` when `update_available` is true.

### Where it is called
- Wired in `settings.json` as `statusLine` command (`node .../hooks/statusline.js`).
- Executed by Claude Code to render the statusline on each UI refresh.

### State it reads
- **stdin JSON payload** from Claude Code (model, workspace, context window, session id).
- **Filesystem**:
  - `~/.claude/todos/` for per-session task state.
  - `~/.claude/cache/gsd-update-check.json` for update availability.

### Reads/Writes/Triggers/Consumers

| Category | Details |
| --- | --- |
| **Reads** | stdin JSON payload, `~/.claude/todos/*.json`, `~/.claude/cache/gsd-update-check.json`. |
| **Writes** | None. |
| **Triggers** | None (invoked by Claude Code statusline runner). |
| **Consumers** | Claude Code UI consumes stdout to render statusline. |

---

## hooks/gsd-check-update.js

### Purpose
Checks for newer `get-shit-done-cc` versions in the background and writes results to a cache file that the statusline reads.

### Update detection logic
- Ensures cache directory exists: `~/.claude/cache/`.
- Spawns a detached Node process to avoid blocking session start.
- In the child process:
  - Reads installed version from `~/.claude/get-shit-done/VERSION` (fallback `0.0.0`).
  - Fetches latest published version via `npm view get-shit-done-cc version` (10s timeout).
  - Writes `gsd-update-check.json` with `{ update_available, installed, latest, checked }`.

### Data sources
- Local version file: `~/.claude/get-shit-done/VERSION`.
- NPM registry metadata: `npm view get-shit-done-cc version`.

### When it runs
- Registered as a **SessionStart hook** in `settings.json` by the installer.
- Runs once per session; actual check work happens in a detached background process.

### Reads/Writes/Triggers/Consumers

| Category | Details |
| --- | --- |
| **Reads** | `~/.claude/get-shit-done/VERSION`, `npm view get-shit-done-cc version`. |
| **Writes** | `~/.claude/cache/gsd-update-check.json`. |
| **Triggers** | SessionStart hook entry in `settings.json` created by installer. |
| **Consumers** | `hooks/statusline.js` reads cache; users act on `/gsd:update`. |

---

## Related references
- `docs/GSD_DOCUMENTATION_INDEX.md` (document map and load guidance)
- `hooks/statusline.js`
- `hooks/gsd-check-update.js`
- `bin/install.js`
