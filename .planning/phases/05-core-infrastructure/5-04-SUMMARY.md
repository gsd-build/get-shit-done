---
phase: 05-core-infrastructure
plan: 04
subsystem: upstream-sync
tags: [core, upstream, notifications, cache, session-banner]
dependency_graph:
  requires:
    - phase: 5-01
      provides: upstream.cjs module with configure/fetch, loadUpstreamConfig
  provides:
    - checkUpstreamNotification function for session-start notification state
    - formatNotificationBanner function for banner text formatting
    - gsd-tools upstream notification command
  affects: [session-start-workflow, banner-display]
tech_stack:
  added: []
  patterns: [cache-first-check, silent-network-errors, config-toggle]
key_files:
  created: []
  modified:
    - get-shit-done/bin/lib/upstream.cjs
    - get-shit-done/bin/gsd-tools.cjs
key_decisions:
  - "Cache-first approach for notification check (24-hour cache duration)"
  - "Silent network error handling - return cached value with fetch_failed flag"
  - "Config toggle at root level (upstream_notifications) not inside upstream object"
patterns_established:
  - "Notification check pattern: cache-first, never throw, return structured result"
  - "Banner formatting pattern: return null for disabled/unknown, string for actionable"
requirements_completed:
  - NOTIF-01
  - NOTIF-02
  - NOTIF-03
duration: 3min
completed: 2026-02-24
---

# Phase 5 Plan 04: Notification Check Summary

**Session-start notification functions with 24-hour cache, silent error handling, and gsd-tools CLI integration**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-24T10:30:51Z
- **Completed:** 2026-02-24T10:34:00Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- checkUpstreamNotification returns notification state using cache, never throws
- formatNotificationBanner produces correct text for 0, 1, N commits behind
- Config toggle `upstream_notifications: false` properly disables notifications
- gsd-tools upstream notification command available for session integration

## Task Commits

Each task was committed atomically:

1. **Task 1: Add notification check function to upstream.cjs** - `c1d7917` (feat)
2. **Task 2: Add notification command to gsd-tools.cjs** - `247a691` (feat)
3. **Task 3: Add config toggle for notifications** - (included in Task 1, no separate commit needed)

## Files Created/Modified
- `get-shit-done/bin/lib/upstream.cjs` - Added checkUpstreamNotification, formatNotificationBanner, updated loadUpstreamConfig
- `get-shit-done/bin/gsd-tools.cjs` - Added upstream notification subcommand with --refresh flag

## Technical Details

### checkUpstreamNotification(cwd, options)

Returns structured notification state:
```javascript
{
  enabled: true,
  commits_behind: 5,
  cached: true,
  fetch_failed: false,
  last_fetch: "2026-02-24T...",
  notifications_enabled: true,
}
```

Behaviors:
- If no upstream configured: `{ enabled: false, reason: 'not_configured' }`
- If notifications disabled: `{ enabled: true, notifications_enabled: false, reason: 'disabled_by_user' }`
- If cache valid (<24 hours): Returns cached commits_behind immediately
- If `options.fetch === true`: Attempts fetch, updates cache
- On network error: Returns cached value with `fetch_failed: true`

### formatNotificationBanner(result)

- 0 commits: "Fork is up to date with upstream"
- 1 commit: "1 upstream commit available. Run /gsd:sync-status for details"
- N commits: "N upstream commits available. Run /gsd:sync-status for details"
- Disabled/unknown: null

### CLI Command

```bash
# Cached check (fast, no network)
gsd-tools upstream notification --raw

# Force refresh
gsd-tools upstream notification --refresh --raw
```

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Cache-first by default | Fast response for session start, no blocking network calls |
| Silent network errors | Session start should never fail due to network issues |
| Config toggle at root level | Follows config.json structure, easier to toggle |
| Return structured result object | Enables both raw JSON and banner mode in CLI |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

1. checkUpstreamNotification returns cached value within 24 hours: PASS
2. formatNotificationBanner produces correct text for 0, 1, N commits: PASS
3. Network errors return cached value with fetch_failed flag: PASS (code path verified)
4. `upstream_notifications: false` disables notifications: PASS
5. gsd-tools command works with --raw and --refresh flags: PASS

## Issues Encountered

None - implementation straightforward.

## Next Steps

Plan 5-05 will integrate:
- Workflow integration for session start
- Automatic notification display in session banner

## Self-Check: PASSED

- [x] File exists: get-shit-done/bin/lib/upstream.cjs
- [x] File exists: get-shit-done/bin/gsd-tools.cjs
- [x] Commit exists: c1d7917
- [x] Commit exists: 247a691
- [x] checkUpstreamNotification exported
- [x] formatNotificationBanner exported
- [x] upstream notification command works

---
*Phase: 05-core-infrastructure*
*Completed: 2026-02-24*
