# Roadmap: install.js Modularization

## Overview

The refactor follows a test-first safety pattern: establish a meaningful test baseline before changing any code, extract the 5 runtime modules and 1 core module in one coherent pass, then verify that all tests still pass and coverage held. Three phases, three natural delivery boundaries — nothing arbitrary.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Test Baseline** - Write tests for all critical paths before any refactoring begins
- [x] **Phase 2: Module Extraction** - Extract 5 runtime modules + core, reduce install.js to thin orchestrator
- [x] **Phase 3: Verification** - Confirm all tests pass, coverage holds, backward compat intact (completed 2026-03-04)
- [x] **Phase 4: Post-Refactor Cleanup** - Realign Stryker config, remove dead imports, close audit tech debt (completed 2026-03-04)

## Phase Details

### Phase 1: Test Baseline
**Goal**: Critical paths are tested well enough to catch regressions during refactoring
**Depends on**: Nothing (first phase)
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04
**Success Criteria** (what must be TRUE):
  1. All 4 runtime converter functions (Claude->OpenCode, Claude->Gemini, Claude->Codex) have passing tests
  2. Shared utilities (path helpers, attribution, frontmatter extraction, settings I/O) have passing tests
  3. Install flow (file copying with path replacement, uninstall cleanup) has passing tests
  4. Mutation testing confirms tests fail when critical logic is altered — no false green coverage
**Plans:** 4/4 plans executed
Plans:
- [x] 01-01-PLAN.md — Expand exports + converter function tests (TEST-01)
- [x] 01-02-PLAN.md — Shared utility function tests (TEST-02)
- [x] 01-03-PLAN.md — Install/uninstall flow tests (TEST-03)
- [x] 01-04-PLAN.md — Mutation testing validation (TEST-04)

### Phase 2: Module Extraction
**Goal**: `bin/install.js` is a thin orchestrator and all runtime logic lives in focused `bin/lib/` modules
**Depends on**: Phase 1
**Requirements**: MOD-01, MOD-02, MOD-03, MOD-04, MOD-05, MOD-06
**Success Criteria** (what must be TRUE):
  1. `bin/lib/core.js` exists and exports shared utilities (path helpers, frontmatter parsing, attribution, manifest/patch, settings I/O)
  2. `bin/lib/claude.js`, `bin/lib/opencode.js`, `bin/lib/gemini.js`, `bin/lib/codex.js` each exist and own their runtime's install/uninstall logic
  3. `bin/install.js` contains only arg parsing, interactive prompts, and runtime dispatch — no runtime-specific logic
  4. All modules use `require`/`module.exports` (CJS), zero new dependencies, Node >=16.7 compatible
**Plans:** 5 plans
Plans:
- [x] 02-01-PLAN.md — Extract shared utilities into bin/lib/core.js (MOD-01)
- [x] 02-02-PLAN.md — Extract Codex functions into bin/lib/codex.js (MOD-05)
- [x] 02-03-PLAN.md — Extract OpenCode + Gemini into bin/lib/opencode.js and bin/lib/gemini.js (MOD-03, MOD-04)
- [x] 02-04-PLAN.md — Extract Claude module + reduce install.js to orchestrator (MOD-02, MOD-06)
- [x] 02-05-PLAN.md — Gap closure: extract hook/settings registration into claude.js (MOD-02)

### Phase 3: Verification
**Goal**: The refactored codebase is behaviorally identical to the original — no regressions, no coverage regression
**Depends on**: Phase 2
**Requirements**: VER-01, VER-02, VER-03
**Success Criteria** (what must be TRUE):
  1. All existing tests pass, including `tests/codex-config.test.cjs` which imports from `bin/install.js`
  2. Line coverage across `bin/install.js` + `bin/lib/*.js` combined meets or exceeds 27% pre-refactor baseline
  3. `GSD_TEST_MODE` exports work as before, or per-module exports are in place with backward-compatible re-exports from `bin/install.js`
**Plans:** 2/2 plans complete
Plans:
- [x] 03-01-PLAN.md — Run full test suite and coverage verification (VER-01, VER-02)
- [x] 03-02-PLAN.md — Audit GSD_TEST_MODE backward compatibility (VER-03)

### Phase 4: Post-Refactor Cleanup
**Goal**: Stryker mutation testing targets the correct code regions in the refactored codebase, and accumulated tech debt is resolved
**Depends on**: Phase 3
**Requirements**: TEST-04 (integration hardening)
**Gap Closure**: Closes `stryker-config-drift` integration gap from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. `stryker.config.json` mutate ranges align with actual code in refactored `bin/install.js`
  2. `bin/lib/*.js` modules are included in Stryker mutate targets
  3. No dead imports in `bin/install.js`
  4. All ROADMAP.md plan checkboxes reflect actual completion state
**Plans:** 1/1 plans complete
Plans:
- [x] 04-01-PLAN.md — Realign Stryker config, remove dead imports, fix ROADMAP checkboxes (TEST-04)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Test Baseline | 4/4 | Complete | 2026-03-04 |
| 2. Module Extraction | 5/5 | Complete | 2026-03-04 |
| 3. Verification | 2/2 | Complete | 2026-03-04 |
| 4. Post-Refactor Cleanup | 1/1 | Complete   | 2026-03-04 |
