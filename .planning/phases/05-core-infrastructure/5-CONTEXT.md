# Phase 5 Context: Core Infrastructure

**Created:** 2026-02-24
**Phase Goal:** Establish upstream remote management with fetch, status, and proactive notifications

## Scope Clarification

This is a **fork maintainer tool** specifically for this GSD fork repository. It is NOT for end-users/clients.

- **This repo:** Syncs with upstream GSD (`https://github.com/gsd-build/get-shit-done`)
- **Clients:** Use `/gsd:upgrade` to update from this fork — they don't need sync tooling
- **Deep-dive merge features:** Only relevant for maintaining this fork

## Status Display Format

**Decision: Count + file summary with contextual details**

| Aspect | Decision |
|--------|----------|
| Primary info | Commit count + file summary (directories affected) |
| Baseline comparison | Upstream GSD main vs this fork's local state |
| File detail level | Full file list if ≤10 files, else "N files across M directories" |
| Freshness indicator | Show date of latest upstream commit |
| Local state warnings | Yes — warn about uncommitted/unpushed local changes |
| Zero state | "Up to date with upstream (last synced: Feb 20)" |

**Example output:**
```
5 commits behind upstream (latest: Feb 21)
12 files changed in lib/, commands/, templates/

⚠ Local has uncommitted changes — commit before sync
```

## Commit Log Presentation

**Decision: Grouped by conventional commit type with emoji headers**

| Aspect | Decision |
|--------|----------|
| Default count | All pending commits (since last sync) |
| Per-line format | Hash + title only, truncated at ~60 chars |
| Grouping | By conventional commit type (feat/fix/refactor/docs) |
| Fallback grouping | Flat chronological list if no conventional commits |
| Group headers | Emoji + label: "✨ Features (3 commits)" |
| File details | No — keep log clean, drill down separately |

**Example output:**
```
✨ Features (3 commits)
  a1b2c3d feat: add sync status command
  d4e5f6g feat: implement upstream fetch
  h7i8j9k feat: add notification system

🐛 Fixes (2 commits)
  l0m1n2o fix: handle network timeout gracefully
  p3q4r5s fix: correct path resolution in worktrees
```

## Notification UX

**Decision: Integrated banner with background check and caching**

| Aspect | Decision |
|--------|----------|
| Location | In session banner (alongside version, etc.) |
| Content | Count + hint: "5 upstream commits available. Run /gsd:sync-status" |
| Timing | Background (non-blocking) — session starts immediately |
| Cache duration | 24 hours — daily check is sufficient |
| Network errors | Silent skip — don't block or warn on failures |
| Quiet mode | Config toggle: `upstream_notifications: false` in config.json |
| Zero state | "Fork is up to date with upstream" (positive confirmation) |

**Example banner addition:**
```
GSD v1.1.0 | Fork: mauricevdm/get-shit-done
↳ 5 upstream commits available. Run /gsd:sync-status for details
```

## Configuration Experience

**Decision: Auto-detect with immediate validation**

| Aspect | Decision |
|--------|----------|
| Initial setup | Auto-detect from git remotes, present list if multiple |
| Storage | Both config.json (primary) and git config (mirrored) |
| Validation | Test fetch immediately — fail fast on bad URL |
| Reconfigure | Show current URL, offer to change |
| Unreachable handling | Cache last-known state, warn that fetch failed |
| Remove option | Not needed — manual edit if ever necessary |

**Config structure (config.json):**
```json
{
  "upstream": {
    "url": "https://github.com/gsd-build/get-shit-done",
    "last_fetch": "2026-02-24T10:30:00Z",
    "commits_behind": 5
  },
  "upstream_notifications": true
}
```

## Command Structure

Based on decisions above, Phase 5 commands:

| Command | Purpose |
|---------|---------|
| `/gsd:sync-configure` | Set up upstream remote (auto-detect + validate) |
| `/gsd:sync-fetch` | Fetch upstream changes (update cache, no merge) |
| `/gsd:sync-status` | Show commits behind with file summary |
| `/gsd:sync-log` | Show grouped commit log |

Notifications happen automatically at session start (integrated into existing banner).

## Deferred Ideas

Captured during discussion but out of scope for Phase 5:

- None captured

---
*Context created: 2026-02-24*
