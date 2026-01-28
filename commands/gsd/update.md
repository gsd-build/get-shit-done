---
name: gsd:update
description: Update GSD to latest version with intelligent local patch integration
author: Simon Formanowski
---

<objective>
Check for GSD updates, install if available, and intelligently integrate local modifications.

**This is NOT the standard GSD update!** This command:
1. Shows version diff and changelog
2. Applies local patches from `~/.claude/scripts/gsd-patches/`
3. Uses `gsd-update-agent` for semantic merge (not blind patching)

See: `~/.claude/agents/gsd-update-agent.md` for full integration logic.
</objective>

<local_patches>
Our local modifications (maintained separately from upstream):

**PR #335 Features:**
- Session Continuity Check
- Scope Conflict Detection + Defer Logic
- YAML Frontmatter in STATE.md
- Stable Directory Naming
- /gsd:redefine-scope Command

**Local Bugfixes (not in PR):**
- STATE/SUMMARY Konsistenz-Check (execute-phase.md)
- SUMMARY-Gate vor STATE-Update (gsd-executor.md)
- /gsd:recover-summary Command (NEU)
- Erweiterte STATE.md YAML-Frontmatter
- /gsd:pause-work Konsistenz-Integration (NEU)

Patches: `~/.claude/scripts/gsd-patches/`
- 001-plan-phase-improvements.patch
- 002-state-yaml-frontmatter.patch
- 003-redefine-scope-command.patch
- 004-summary-consistency-check.patch
- 005-summary-gate.patch
- 006-state-yaml-extended.patch
- 007-pause-work-consistency.patch
</local_patches>

<process>

<step name="get_installed_version">
Read installed version:

```bash
cat ~/.claude/get-shit-done/VERSION 2>/dev/null
```

**If VERSION file missing:**
```
## GSD Update

**Installed version:** Unknown

Your installation doesn't include version tracking.

Running fresh install...
```

Proceed to install step (treat as version 0.0.0 for comparison).
</step>

<step name="check_latest_version">
Check npm for latest version:

```bash
npm view get-shit-done-cc version 2>/dev/null
```

**If npm check fails:**
```
Couldn't check for updates (offline or npm unavailable).

To update manually: `npx get-shit-done-cc --global`
```

STOP here if npm unavailable.
</step>

<step name="compare_versions">
Compare installed vs latest:

**If installed == latest:**
```
## GSD Update

**Installed:** X.Y.Z
**Latest:** X.Y.Z

You're already on the latest version.
```

STOP here if already up to date.

**If installed > latest:**
```
## GSD Update

**Installed:** X.Y.Z
**Latest:** A.B.C

You're ahead of the latest release (development version?).
```

STOP here if ahead.
</step>

<step name="show_changes_and_confirm">
**If update available**, fetch and show what's new BEFORE updating:

1. Fetch changelog (same as fetch_changelog step)
2. Extract entries between installed and latest versions
3. Display preview and ask for confirmation:

```
## GSD Update Available

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

⚠️  **Note:** The installer performs a clean install of GSD folders:
- `~/.claude/commands/gsd/` will be wiped and replaced
- `~/.claude/get-shit-done/` will be wiped and replaced
- `~/.claude/agents/gsd-*` files will be replaced

Your custom files in other locations are preserved:
- Custom commands in `~/.claude/commands/your-stuff/` ✓
- Custom agents not prefixed with `gsd-` ✓
- Custom hooks ✓
- Your CLAUDE.md files ✓

If you've modified any GSD files directly, back them up first.
```

Use AskUserQuestion:
- Question: "Proceed with update?"
- Options:
  - "Yes, update now"
  - "No, cancel"

**If user cancels:** STOP here.
</step>

<step name="run_update">
Run the upstream update:

```bash
npx get-shit-done-cc --global
```

Capture output. If install fails, show error and STOP.

Clear the update cache so statusline indicator disappears:

```bash
rm -f ~/.claude/cache/gsd-update-check.json
```
</step>

<step name="apply_local_patches">
**Apply local modifications using gsd-update-agent for intelligent merging.**

Spawn the gsd-update-agent:

```
Task(
  prompt="New GSD version installed. Intelligently integrate our local patches.

  Upstream version: {NEW_VERSION}
  Previous version: {OLD_VERSION}

  Apply patches from ~/.claude/scripts/gsd-patches/:
  - 001-plan-phase-improvements.patch (Session Continuity, Defer Logic)
  - 002-state-yaml-frontmatter.patch (YAML in STATE.md)
  - 003-redefine-scope-command.patch (New command)
  - 004-summary-consistency-check.patch (Konsistenz-Check)
  - 005-summary-gate.patch (SUMMARY Gate)
  - 006-state-yaml-extended.patch (Extended YAML)
  - 007-pause-work-consistency.patch (pause-work YAML Integration)

  Use semantic merge - understand the changes, find appropriate locations in new version.

  Report: What was merged, what conflicts need resolution.",
  subagent_type="gsd-update-agent",
  model="sonnet"
)
```

**After agent returns:**
- Review merge report
- If conflicts: Present to user for resolution
- If clean: Continue to display_result
</step>

<step name="display_result">
Format completion message:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► INTELLIGENT UPDATE COMPLETE ✓
 Agent by Simon Formanowski (@simfor99)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Upstream: v{OLD} → v{NEW}
PR #335 Status: {status from agent}
Local patches applied: {count}

| Modification | Action | Result |
|--------------|--------|--------|
| Session Continuity | {ACTION} | {result} |
| Scope Conflict | {ACTION} | {result} |
| YAML Frontmatter | {ACTION} | {result} |
| Consistency Check | {ACTION} | {result} |
| SUMMARY Gate | {ACTION} | {result} |
| recover-summary | {ACTION} | {result} |
| pause-work Integration | {ACTION} | {result} |

⚠️  Restart Claude Code to pick up the new commands.

[View upstream changelog](https://github.com/glittercowboy/get-shit-done/blob/main/CHANGELOG.md)
[View our PR #335](https://github.com/glittercowboy/get-shit-done/pull/335)
```
</step>

<step name="offer_fork_sync">
After successful update, offer to sync fork:

Use AskUserQuestion:
- Question: "Auch deine Fork (simfor99/get-shit-done) aktualisieren?"
- Options:
  - "Ja, Fork aktualisieren" - Push changes to github.com/simfor99/get-shit-done
  - "Nein, nur lokal" - Keep changes local only
  - "Später" - Skip for now

**If yes:** Run fork sync from gsd-update-agent.
</step>

</process>

<success_criteria>
- [ ] Installed version read correctly
- [ ] Latest version checked via npm
- [ ] Update skipped if already current
- [ ] Changelog fetched and displayed BEFORE update
- [ ] Clean install warning shown
- [ ] User confirmation obtained
- [ ] Upstream update executed successfully
- [ ] gsd-update-agent invoked for patch integration
- [ ] Local patches applied (or conflicts reported)
- [ ] Fork sync offered
- [ ] Restart reminder shown
</success_criteria>
