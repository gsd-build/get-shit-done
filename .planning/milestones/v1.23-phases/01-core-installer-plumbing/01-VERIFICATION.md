---
phase: 01-core-installer-plumbing
verified: 2026-03-02T23:52:03Z
status: passed
score: 6/6 must-haves verified
re_verification: false
notes:
  - "CLI-04 requirement text in REQUIREMENTS.md is stale — says 'rejected with error' but implementation correctly supports global per CONTEXT.md correction"
  - "REQUIREMENTS.md Out of Scope table also stale — says 'Global installation for Copilot' is out of scope but it IS in scope per CONTEXT.md"
---

# Phase 1: Core Installer Plumbing Verification Report

**Phase Goal:** Users can select Copilot as a runtime through the installer CLI, with correct directory resolution for both local and global modes.
**Verified:** 2026-03-02T23:52:03Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running `node bin/install.js --copilot --local` targets `.github/` directory | ✓ VERIFIED | `getDirName('copilot')` returns `.github` (line 65); test passes; smoke test confirms |
| 2 | Running `node bin/install.js --copilot --global` targets `~/.copilot/` directory | ✓ VERIFIED | `getGlobalDir('copilot')` returns `~/.copilot` with `COPILOT_CONFIG_DIR` override (lines 156-164); test passes; smoke test outputs `/Users/rodolfo/.copilot` |
| 3 | Running `node bin/install.js --all` includes copilot in the runtime array (5 runtimes) | ✓ VERIFIED | Line 52: `selectedRuntimes = ['claude', 'opencode', 'gemini', 'codex', 'copilot']`; test confirms |
| 4 | Interactive prompt shows Copilot as option 5 and All as option 6 | ✓ VERIFIED | Line 2250: `5) Copilot (~/.copilot)`; line 2258: `choice === '6'` → all 5 runtimes; line 2260: `choice === '5'` → `['copilot']` |
| 5 | `--help` output includes --copilot flag, Copilot examples, and banner mentions Copilot | ✓ VERIFIED | Line 221: help text has `--copilot` option + global/local examples + `COPILOT_CONFIG_DIR` note; Line 187: banner says "Copilot by TÂCHES" |
| 6 | Copilot skips hooks and settings.json (same as Codex pattern) | ✓ VERIFIED | Line 1994: `if (!isCodex && !isCopilot)` skips hooks; Line 2052: `if (isCopilot) { return early }` before settings; Line 2150: `if (!isCodex && !isCopilot)` skips writeSettings in finishInstall |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bin/install.js` | Copilot as 5th runtime in ~17+ locations, contains `hasCopilot` | ✓ VERIFIED | 2410 lines, 22 copilot references across arg parsing, directory resolution, banner, help, install/uninstall/finishInstall, prompt, test exports |
| `tests/copilot-install.test.cjs` | Unit tests for Copilot plumbing, min 50 lines | ✓ VERIFIED | 172 lines, 19 tests in 4 describe blocks, all passing. Covers getDirName, getGlobalDir (5 tests incl env var), getConfigDirFromHome, source code integration |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `bin/install.js` arg parsing (line 44) | `selectedRuntimes` array | `hasCopilot` flag → `push('copilot')` | ✓ WIRED | Line 44: `const hasCopilot = args.includes('--copilot')` → Line 60: `if (hasCopilot) selectedRuntimes.push('copilot')` |
| `bin/install.js` getDirName (line 65) | `.github` | `runtime === 'copilot'` check | ✓ WIRED | `if (runtime === 'copilot') return '.github'` — first check in function |
| `bin/install.js` getGlobalDir (line 156) | `~/.copilot` | copilot branch with `COPILOT_CONFIG_DIR` fallback | ✓ WIRED | Full cascade: explicitDir > `COPILOT_CONFIG_DIR` env var > `path.join(os.homedir(), '.copilot')` |
| `bin/install.js` promptRuntime (line 2260) | `callback(['copilot'])` | `choice === '5'` mapping | ✓ WIRED | `if (choice === '5') { callback(['copilot']) }` and `if (choice === '6') { callback([...all 5...]) }` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CLI-01 | 01-01-PLAN | `--copilot` flag to select Copilot runtime | ✓ SATISFIED | Line 44: `args.includes('--copilot')`; line 60: pushes to selectedRuntimes |
| CLI-02 | 01-01-PLAN | Interactive prompt includes Copilot option | ✓ SATISFIED | Option 5 = Copilot, option 6 = All (lines 2250, 2258-2261) |
| CLI-03 | 01-01-PLAN | `--all` includes Copilot (5 runtimes) | ✓ SATISFIED | Line 52: `['claude', 'opencode', 'gemini', 'codex', 'copilot']` |
| CLI-04 | 01-01-PLAN | Global directory resolution for Copilot | ✓ SATISFIED | `getGlobalDir('copilot')` returns `~/.copilot` with env var override. **Note:** REQUIREMENTS.md text is stale — says "rejected with error" but CONTEXT.md (source of truth) corrected this to support global. Implementation matches CONTEXT.md. |
| CLI-05 | 01-01-PLAN | `getDirName('copilot')` returns `.github` | ✓ SATISFIED | Line 65: `if (runtime === 'copilot') return '.github'` |
| CLI-06 | 01-01-PLAN | Banner, help text, examples include Copilot | ✓ SATISFIED | Banner (line 187), help options (line 221), examples (global + local), COPILOT_CONFIG_DIR note |

**Orphaned requirements:** None. All 6 Phase 1 requirements (CLI-01 through CLI-06) are claimed by 01-01-PLAN and verified.

**Documentation note:** REQUIREMENTS.md needs updating:
- CLI-04 text: Change from "rejected with clear error (Copilot is local-only)" to "getGlobalDir resolves to ~/.copilot with COPILOT_CONFIG_DIR override"
- Out of Scope table: Remove "Global installation for Copilot" row (global IS supported per CONTEXT.md)

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `bin/install.js` | 2054 | "Content conversion handled in Phase 2" | ℹ️ Info | Intentional deferred work comment — not a placeholder. Copilot early return is functional, Phase 2 adds conversion logic. |

No blockers or warnings found. No TODOs, FIXMEs, or stub implementations.

### Test Results

| Suite | Tests | Pass | Fail | Status |
|-------|-------|------|------|--------|
| Copilot plumbing (`copilot-install.test.cjs`) | 19 | 19 | 0 | ✓ PASS |
| Full test suite (`npm test`) | 481 | 481 | 0 | ✓ PASS (zero regressions) |

### Commit Verification

| Commit | Message | Files | Status |
|--------|---------|-------|--------|
| `8fa3a73` | feat(01-01): add Copilot as 5th runtime across all install.js locations | `bin/install.js` | ✓ VERIFIED |
| `1975792` | test(01-01): add Copilot plumbing unit tests | `tests/copilot-install.test.cjs` | ✓ VERIFIED |

### Human Verification Required

None required. All truths are verifiable programmatically and have been verified through tests and code inspection.

### Gaps Summary

No gaps found. All 6 observable truths verified. All artifacts exist, are substantive, and are wired. All key links confirmed. All requirements satisfied. Full test suite passes with zero regressions.

---

_Verified: 2026-03-02T23:52:03Z_
_Verifier: Claude (gsd-verifier)_
