---
phase: 13-add-gsd-autopilot-command-to-run-devtunnel-user-login-process-so-the-user-can-do-that-all-from-claude-code
plan: 01
subsystem: autopilot-launcher
tags:
  - authentication
  - devtunnel
  - cli
  - user-experience
dependency_graph:
  requires:
    - autopilot/workflows/gsd-autopilot/launcher.js (existing routing)
    - devtunnel.exe (bundled binary)
  provides:
    - /gsd:autopilot login (Microsoft account)
    - /gsd:autopilot login github (GitHub account)
  affects:
    - autopilot/workflows/gsd-autopilot/SKILL.md (documentation)
tech_stack:
  added:
    - devtunnel user login command integration
    - readline-based re-authentication prompt
  patterns:
    - Promise timeout wrapping with timer.unref()
    - Interactive subprocess spawning with stdio: 'inherit'
    - Exit code-based success detection
key_files:
  created: []
  modified:
    - autopilot/workflows/gsd-autopilot/launcher.js (login handler + helpers)
    - autopilot/workflows/gsd-autopilot/SKILL.md (login documentation)
decisions:
  - Login subcommand is independent of autopilot instances (no branch/projectDir dependencies)
  - GitHub provider uses -g flag (devtunnel CLI convention)
  - 5-minute timeout for browser authentication (reasonable for manual user action)
  - Re-authentication prompt when already logged in (prevents accidental re-auth)
  - Missing devtunnel.exe shows reinstall instructions (recovery guidance)
metrics:
  duration: 1min
  completed: 2026-02-27
---

# Phase 13 Plan 01: Add gsd:autopilot login subcommand Summary

**One-liner:** Browser-based devtunnel authentication via `/gsd:autopilot login` with GitHub provider support and re-login confirmation.

## What Was Built

Added a `login` subcommand to `/gsd:autopilot` that runs the devtunnel browser-based authentication flow directly from within Claude Code, eliminating the need for users to switch to a separate terminal for authentication.

### Core Implementation

**launcher.js:**
- Added `login` routing in `main()` for subcommand dispatch to `handleLogin()`
- Implemented `resolveDevTunnelExe()` to locate the bundled devtunnel binary at package root
- Added `checkAuthStatus()` to query current authentication state via `devtunnel user show`
- Implemented `confirmReLogin()` for interactive re-authentication prompt when already logged in
- Created `withTimeout()` helper for Promise timeout wrapping with timer.unref()
- Added `spawnDevTunnelLogin()` to run interactive login with `stdio: 'inherit'`
- Implemented `handleLogin()` orchestrating: pre-check → prompt → spawn → timeout → confirmation

**SKILL.md:**
- Updated frontmatter description to include "authenticate"
- Added `login [github]` to argument-hint
- Added login usage section documenting both Microsoft (default) and GitHub authentication

### User Experience Flow

1. User runs `/gsd:autopilot login` or `/gsd:autopilot login github`
2. Pre-check queries existing auth status via `devtunnel user show`
3. If already logged in, prompts: "Already logged in as: {account}. Re-authenticate? (y/N)"
4. If user confirms or not logged in, spawns interactive `devtunnel user login` with stdio inheritance
5. Browser opens for OAuth flow (Microsoft or GitHub)
6. Login waits up to 5 minutes with clear message: "Waiting for browser authentication... (Press Ctrl+C to cancel)"
7. On success, displays: "Logged in as: {account}. Dev tunnels are ready."
8. On failure or timeout, shows clear error with retry suggestion

### Edge Cases Handled

- **Missing devtunnel.exe:** Shows error with reinstall instructions: `npm install -g get-shit-done-cc`
- **Invalid provider:** Shows usage help if provider is not 'github'
- **Timeout:** 5-minute timeout with clear error message
- **Spawn failure:** Catches spawn errors and shows actionable error message
- **Already logged in:** Prompts for confirmation before proceeding with re-authentication

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All verification steps passed:

1. **Syntax check:** `node -c launcher.js` passed
2. **Routing present:** `grep -n "handleLogin\|login" launcher.js` shows 11 login-related lines
3. **Documentation present:** `grep -n "login" SKILL.md` shows 4 references (frontmatter + usage section)
4. **Success criteria met:**
   - ✅ launcher.js routes 'login' to handleLogin() without affecting existing routing
   - ✅ handleLogin pre-checks auth and prompts for re-login
   - ✅ Login spawns with stdio: 'inherit' and windowsHide: false
   - ✅ GitHub provider maps to -g flag
   - ✅ 5-minute timeout with clear error message
   - ✅ Success shows account name + "Dev tunnels are ready."
   - ✅ Missing devtunnel.exe shows reinstall instructions
   - ✅ SKILL.md documents both login variants

## Technical Notes

### Provider Argument Handling

The `provider` argument is read from `process.argv[4]` (after branch and 'login' subcommand). Unlike `status` and `stop`, the `login` subcommand does NOT require branch or projectDir parameters since authentication is global to the devtunnel CLI, not per-branch.

### Timeout Implementation

Uses `Promise.race()` with `timer.unref()` to prevent blocking Node.js exit. The 5-minute timeout is generous for browser-based OAuth flows that may involve 2FA or account selection.

### Interactive Spawn

Uses `stdio: 'inherit'` to pass stdin/stdout/stderr to the child process, enabling the devtunnel CLI to display prompts and open the browser. `windowsHide: false` ensures the spawned process is visible on Windows.

### Exit Code Detection

Trusts devtunnel's exit code (0 = success, non-zero = failure) rather than parsing output, which is more robust across devtunnel CLI versions.

## Self-Check: PASSED

**Created files:** (none - all modifications)

**Modified files:**
- ✅ C:/GitHub/GetShitDone/get-shit-done/autopilot/workflows/gsd-autopilot/launcher.js (exists)
- ✅ C:/GitHub/GetShitDone/get-shit-done/autopilot/workflows/gsd-autopilot/SKILL.md (exists)

**Commits:**
- ✅ bff0914 (feat(13-01): implement login subcommand handler in launcher.js)
- ✅ 68d1b48 (docs(13-01): update SKILL.md with login subcommand documentation)

All claims verified.
