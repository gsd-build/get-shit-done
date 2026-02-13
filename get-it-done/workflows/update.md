<purpose>
Check for GID updates via npm, display changelog for versions between installed and latest, obtain user confirmation, and execute clean installation with cache clearing.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="get_installed_version">
Detect whether GID is installed locally or globally by checking both locations:

```bash
# Check local first (takes priority)
if [ -f "./.claude/get-it-done/VERSION" ]; then
  cat "./.claude/get-it-done/VERSION"
  echo "LOCAL"
elif [ -f ~/.claude/get-it-done/VERSION ]; then
  cat ~/.claude/get-it-done/VERSION
  echo "GLOBAL"
else
  echo "UNKNOWN"
fi
```

Parse output:
- If last line is "LOCAL": installed version is first line, use `--local` flag for update
- If last line is "GLOBAL": installed version is first line, use `--global` flag for update
- If "UNKNOWN": proceed to install step (treat as version 0.0.0)

**If VERSION file missing:**
```
## GID Update

**Installed version:** Unknown

Your installation doesn't include version tracking.

Running fresh install...
```

Proceed to install step (treat as version 0.0.0 for comparison).
</step>

<step name="check_latest_version">
Check npm for latest version:

```bash
npm view get-it-done-cc version 2>/dev/null
```

**If npm check fails:**
```
Couldn't check for updates (offline or npm unavailable).

To update manually: `npx get-it-done-cc --global`
```

Exit.
</step>

<step name="compare_versions">
Compare installed vs latest:

**If installed == latest:**
```
## GID Update

**Installed:** X.Y.Z
**Latest:** X.Y.Z

You're already on the latest version.
```

Exit.

**If installed > latest:**
```
## GID Update

**Installed:** X.Y.Z
**Latest:** A.B.C

You're ahead of the latest release (development version?).
```

Exit.
</step>

<step name="show_changes_and_confirm">
**If update available**, fetch and show what's new BEFORE updating:

1. Fetch changelog from GitHub raw URL
2. Extract entries between installed and latest versions
3. Display preview and ask for confirmation:

```
## GID Update Available

**Installed:** 1.5.10
**Latest:** 1.5.15

### What's New
────────────────────────────────────────────────────────────

## [1.5.15] - 2026-01-20

### Added
- Feature X

## [1.5.14] - 2026-01-18

### Fixed
- Bug fix Y

────────────────────────────────────────────────────────────

⚠️  **Note:** The installer performs a clean install of GID folders:
- `commands/gid/` will be wiped and replaced
- `get-it-done/` will be wiped and replaced
- `agents/gid-*` files will be replaced

(Paths are relative to your install location: `~/.claude/` for global, `./.claude/` for local)

Your custom files in other locations are preserved:
- Custom commands not in `commands/gid/` ✓
- Custom agents not prefixed with `gid-` ✓
- Custom hooks ✓
- Your CLAUDE.md files ✓

If you've modified any GID files directly, they'll be automatically backed up to `gid-local-patches/` and can be reapplied with `/gid:reapply-patches` after the update.
```

Use AskUserQuestion:
- Question: "Proceed with update?"
- Options:
  - "Yes, update now"
  - "No, cancel"

**If user cancels:** Exit.
</step>

<step name="run_update">
Run the update using the install type detected in step 1:

**If LOCAL install:**
```bash
npx get-it-done-cc --local
```

**If GLOBAL install (or unknown):**
```bash
npx get-it-done-cc --global
```

Capture output. If install fails, show error and exit.

Clear the update cache so statusline indicator disappears:

**If LOCAL install:**
```bash
rm -f ./.claude/cache/gid-update-check.json
```

**If GLOBAL install:**
```bash
rm -f ~/.claude/cache/gid-update-check.json
```
</step>

<step name="display_result">
Format completion message (changelog was already shown in confirmation step):

```
╔═══════════════════════════════════════════════════════════╗
║  GID Updated: v1.5.10 → v1.5.15                           ║
╚═══════════════════════════════════════════════════════════╝

⚠️  Restart Claude Code to pick up the new commands.

[View full changelog](https://github.com/glittercowboy/get-it-done/blob/main/CHANGELOG.md)
```
</step>


<step name="check_local_patches">
After update completes, check if the installer detected and backed up any locally modified files:

Check for gid-local-patches/backup-meta.json in the config directory.

**If patches found:**

```
Local patches were backed up before the update.
Run /gid:reapply-patches to merge your modifications into the new version.
```

**If no patches:** Continue normally.
</step>
</process>

<success_criteria>
- [ ] Installed version read correctly
- [ ] Latest version checked via npm
- [ ] Update skipped if already current
- [ ] Changelog fetched and displayed BEFORE update
- [ ] Clean install warning shown
- [ ] User confirmation obtained
- [ ] Update executed successfully
- [ ] Restart reminder shown
</success_criteria>
