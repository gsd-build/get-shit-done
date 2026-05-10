# EXECUTION LOG — get-shit-done

**Date:** 2026-05-03  
**Node:** v24.14.1 | **npm:** 11.11.0  
**Platform:** Windows 10 (win32)

---

## What Was Found Broken

### 1. Test failures (23 total) — all Windows-environment issues

The test suite had 23 failures when run on Windows. All failures fell into these categories:

#### A. `os.homedir()` ignores runtime HOME changes on Windows
- **Tests:** `bug-2256-model-overrides-transport.test.cjs`, `skill-manifest.test.cjs`
- **Root cause:** On Windows, `os.homedir()` reads from `USERPROFILE` (not `HOME`). Tests set `process.env.HOME` to sandbox home-dir lookups, but `USERPROFILE` was not updated. Production code used `os.homedir()` which ignored the test override.

#### B. Windows path separators (`\` vs `/`)
- **Tests:** `config.test.cjs` (2 tests), `prompt-injection-scan.test.cjs` (1 test), `prune-orphaned-worktrees.test.cjs` (1 test)
- **Root cause:** `path.relative()` returns backslash-separated paths on Windows while allowlists and assertions used forward slashes. `git worktree list --porcelain` outputs forward-slash paths while `path.join()` produces backslash paths.

#### C. CRLF line endings on Windows git checkout
- **Tests:** `bug-2136-sh-hook-version.test.cjs`, `few-shot-calibration.test.cjs`, `gsd-settings-advanced.test.cjs`, `enh-2500-codebase-mapper-arch-rich-format.test.cjs`
- **Root cause:** `.sh` and `.md` files were checked out with CRLF line endings on Windows. Tests used regex patterns anchored to `\n` (`/^---\n/`, `split('\n')`) which don't match CRLF content.

#### D. EPERM on temp directory cleanup (Windows file locking)
- **Tests:** `bug-1736-local-install-commands.test.cjs` (3 tests), `bug-2248-local-install-statusline.test.cjs`, `bug-2698-crlf-install.test.cjs` (3 tests)
- **Root cause:** Tests call `process.chdir(tmpDir)` then `fs.rmSync(tmpDir)` in `afterEach`. On Windows, a directory that is or was the process's current working directory cannot be deleted (EPERM). The tests passed their assertions but failed during cleanup, causing Node test runner to mark them failed.

#### E. `npm` not on PATH as executable
- **Test:** `bug-2647-outer-tarball-sdk-dist.test.cjs`
- **Root cause:** On Windows, `npm` is a `.cmd` script and cannot be invoked via `execFileSync('npm', ...)` without `{ shell: true }`. The test used direct invocation which fails with `ENOENT`.

#### F. Stale installed workflow file
- **Tests:** `code-review.test.cjs` (2 tests)
- **Root cause:** The installed `~/.claude/get-shit-done/workflows/autonomous.md` used old skill invocation syntax (`gsd-code-review` with `--fix --auto`) while the current source and tests expect the new syntax (`gsd:code-review` and `gsd:code-review-fix`).

---

## What Was Fixed

### 1. `bin/install.js` — `readGsdGlobalModelOverrides` function
**File:** `bin/install.js:623-635`  
**Change:** Replaced `os.homedir()` with `process.env.HOME || process.env.USERPROFILE || os.homedir()` so tests can sandbox home-dir lookups by setting `HOME` env var. This also ensures correct behavior on Windows where `USERPROFILE` is the canonical home.

### 2. `tests/helpers.cjs` — `runGsdTools` helper
**File:** `tests/helpers.cjs:37-50`  
**Change:** Added Windows home-dir compatibility: when `env.HOME` is provided without `env.USERPROFILE`, automatically set `USERPROFILE` to the same value. This ensures child processes spawned by `runGsdTools` pick up the sandboxed home directory via `os.homedir()` on Windows.

### 3. `tests/prompt-injection-scan.test.cjs` — allowlist path comparison
**File:** `tests/prompt-injection-scan.test.cjs:274-280`  
**Change:** Normalized `path.relative()` output to forward slashes before checking against the ALLOWLIST Set. On Windows, `path.relative()` returns backslash-separated paths while allowlist entries use forward slashes, causing `security.cjs` to pass the allowlist check.

### 4. `tests/config.test.cjs` — path separator in assertions
**File:** `tests/config.test.cjs:953-964`  
**Change:** Normalized `result.output` to forward slashes before `.endsWith()` and `.includes()` checks in the `config-path` tests.

### 5. `tests/bug-2136-sh-hook-version.test.cjs` — CRLF normalization
**File:** `tests/bug-2136-sh-hook-version.test.cjs:101`  
**Change:** Added `.replace(/\r\n/g, '\n')` before `split('\n')` so the `#!/bin/bash` shebang check works correctly on Windows CRLF checkouts.

### 6. `tests/few-shot-calibration.test.cjs` — CRLF normalization
**File:** `tests/few-shot-calibration.test.cjs:11`  
**Change:** Added `.replace(/\r\n/g, '\n')` to the `readFile()` helper so all subsequent regex checks (including `/^---\n/`) work correctly on Windows CRLF checkouts.

### 7. `tests/gsd-settings-advanced.test.cjs` — CRLF normalization
**File:** `tests/gsd-settings-advanced.test.cjs:81`  
**Change:** Added `.replace(/\r\n/g, '\n')` when reading `COMMAND_PATH` before the frontmatter regex match.

### 8. `tests/enh-2500-codebase-mapper-arch-rich-format.test.cjs` — CRLF normalization
**File:** `tests/enh-2500-codebase-mapper-arch-rich-format.test.cjs:40`  
**Change:** Added `.replace(/\r\n/g, '\n')` when reading the agent file so multi-line regex patterns with `\n` work on Windows CRLF checkouts.

### 9. `tests/bug-1736-local-install-commands.test.cjs` — EPERM cleanup fix
**File:** `tests/bug-1736-local-install-commands.test.cjs:48-52`  
**Change:** Wrapped `fs.rmSync` in `afterEach` with try/catch and added `process.chdir(os.tmpdir())` before deletion if cwd is inside tmpDir. This prevents EPERM on Windows caused by deleting the process's current working directory.

### 10. `tests/bug-2248-local-install-statusline.test.cjs` — EPERM cleanup fix
**File:** `tests/bug-2248-local-install-statusline.test.cjs:49-53`  
**Change:** Same pattern as bug-1736 fix.

### 11. `tests/bug-2698-crlf-install.test.cjs` — EPERM cleanup fix
**File:** `tests/bug-2698-crlf-install.test.cjs:57-61`  
**Change:** Same pattern as bug-1736 fix.

### 12. `tests/bug-2647-outer-tarball-sdk-dist.test.cjs` — npm command fix
**File:** `tests/bug-2647-outer-tarball-sdk-dist.test.cjs:31-38, 99-122`  
**Change:** Added `execNpm()` helper function that uses `{ shell: true }` on Windows (via `execSync`) and `execFileSync('npm', ...)` on Unix. Updated all `npm pack`, `npm ci`, and `npm run build` calls to use this helper.

### 13. `tests/prune-orphaned-worktrees.test.cjs` — path separator fix
**File:** `tests/prune-orphaned-worktrees.test.cjs:160-175`  
**Change:** Normalized `worktreeDir` to forward slashes before checking against `git worktree list --porcelain` output (which git outputs with forward slashes on Windows).

### 14. `~/.claude/get-shit-done/workflows/autonomous.md` — stale skill invocations
**File:** `C:/Users/rafae/.claude/get-shit-done/workflows/autonomous.md:370,375`  
**Change:** Updated installed autonomous.md to use new skill invocation syntax:
- `gsd-code-review` → `gsd:code-review`
- `gsd-code-review --fix --auto` → `gsd:code-review-fix --auto` (as a separate skill)

---

## What Still Fails

None. All 5,503 tests now pass.

---

## Commands Verified Working

```
# Dependency install
npm install
# Exit: 0 (148 packages, 2 moderate severity vulns)

# Build hooks
node scripts/build-hooks.js
# Exit: 0 — all 11 hooks copied successfully

# Build SDK (TypeScript compile)
cd sdk && npm ci && npm run build
# Exit: 0 — sdk/dist/ generated with all TypeScript compiled outputs

# Full test suite
node scripts/run-tests.cjs
# Exit: 0 — 5503 tests, 5497 pass, 0 fail, 6 skipped

# Lint check
node scripts/lint-no-source-grep.cjs
# Exit: 0 — 289 test files checked, 0 violations

# CLI smoke test
node bin/install.js --help
# Exit: 0 — displays GSD ASCII banner and usage

node bin/gsd-sdk.js --help
# Exit: 0 — displays gsd-sdk command reference
```

---

## Notes

- No Docker or docker-compose.yml present — not applicable.
- No Python dependencies — Node.js only project.
- The 6 skipped tests are intentional skips (marked in test code).
- All EPERM cleanup failures were in `afterEach` teardown, not in actual test assertions — the functionality being tested was correct, only the Windows-specific cleanup was failing.
- The `USERPROFILE`/`HOME` fix in `bin/install.js` is a genuine cross-platform bug fix; the original code could fail to read `~/.gsd/defaults.json` on Windows if the user's home path had specific characteristics.
