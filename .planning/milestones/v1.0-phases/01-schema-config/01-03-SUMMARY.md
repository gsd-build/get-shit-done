---
phase: 01-schema-config
plan: "03"
subsystem: cli
tags: [gsd-tools, template, sme, stdout]

requires:
  - phase: 01-01
    provides: get-shit-done/templates/sme.md (the SME document template)
  - phase: 01-02
    provides: workflow.use_sme_agents config key and sme.* schema registered in CJS and SDK schemas
provides:
  - "`gsd-tools template sme` subcommand routing in get-shit-done/bin/gsd-tools.cjs"
  - "stdout delivery mechanism for the SME template per D-07"
  - "end-to-end validation: template output -> frontmatter round-trip -> config parity tests all green"
affects:
  - Phase 03 (SME creator agent)
  - Any workflow step that invokes `gsd-tools template sme` to scaffold an SME document

tech-stack:
  added: []
  patterns:
    - "stdout template delivery: process.stdout.write(content) (no trailing newline, caller redirects)"
    - "hardcoded path via path.resolve(__dirname, '..', 'templates', 'sme.md') — no user input in path"

key-files:
  created: []
  modified:
    - get-shit-done/bin/gsd-tools.cjs

key-decisions:
  - "Use process.stdout.write (not console.log) to avoid trailing newline contaminating redirected files"
  - "Hardcoded path relative to __dirname — no user input in path construction (T-01-04 threat mitigation)"
  - "Add fs.existsSync guard before readFileSync to surface clear error if template is missing"

patterns-established:
  - "Stdout template delivery: use process.stdout.write; add an existsSync guard before read"

requirements-completed: [SCHEMA-05]

duration: 3min
completed: 2026-04-28
---

# Phase 01 Plan 03: Wire gsd-tools template sme Subcommand Summary

**`gsd-tools template sme` wired to stdout via process.stdout.write, completing the programmatic template delivery interface for the SME creator agent**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-28T16:21:57Z
- **Completed:** 2026-04-28T16:24:29Z
- **Tasks:** 2 (1 implementation + 1 end-to-end validation)
- **Files modified:** 1

## Accomplishments

- Added `sme` branch in the `template` case block of `get-shit-done/bin/gsd-tools.cjs` after the `fill` branch
- Template is output via `process.stdout.write(content)` per D-07 — caller redirects to any target path
- Path construction uses `path.resolve(__dirname, '..', 'templates', 'sme.md')` — hardcoded, no user input (mitigates T-01-04)
- Unknown-subcommand error message updated to include `sme` in the available options list
- End-to-end validation passed: template output, frontmatter round-trip, config parity tests (0 failures), unit suite (5766 tests, 0 failures)

## Task Commits

1. **Task 1: Wire gsd-tools template sme subcommand** — `8f3f73a9` (feat)
2. **Task 2: End-to-end validation** — validation only, no file changes

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `get-shit-done/bin/gsd-tools.cjs` — Added `sme` branch in template case block; updated error message

## Decisions Made

- `process.stdout.write(content)` chosen over `console.log()` to avoid trailing newline contaminating redirected output
- Hardcoded path `path.resolve(__dirname, '..', 'templates', 'sme.md')` ensures no path traversal possible (T-01-04 mitigation)
- `fs.existsSync` guard added before `readFileSync` to provide a clear error if template file is missing

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — `npx vitest run --project unit` failed to find the vitest config module via npx, but `npm run test` ran the full suite cleanly (5766 tests, 0 failures). Config parity tests both passed. No regressions.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Phase 1 (schema-config) is now complete. All artifacts are in place:
- `get-shit-done/templates/sme.md` — SME document template (Plan 01-01)
- CJS schema, SDK schema, TypeScript types, config defaults for `workflow.use_sme_agents` and `sme.*` keys (Plan 01-02)
- `gsd-tools template sme` subcommand routing (Plan 01-03)

Phase 3 (SME creator agent) can invoke `gsd-tools template sme > .planning/smes/{name}-SME.md` to scaffold blank SME documents.

---
*Phase: 01-schema-config*
*Completed: 2026-04-28*
