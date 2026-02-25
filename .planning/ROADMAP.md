# Roadmap: get-shit-done Test Infrastructure

## Overview

Six phases, each a standalone PR: core.cjs tests (foundational), frontmatter.cjs tests (YAML parser), verify.cjs tests (largest gap), config.cjs + template.cjs tests (medium priority), milestone.cjs tests (extend existing), and GitHub Actions CI pipeline (automates everything). Every phase delivers independently reviewable test coverage. When all six phases ship, every module has tests and PRs are validated automatically on every push.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: core.cjs Tests** - Test the foundational module's 25 exports including known regression bugs
- [x] **Phase 2: frontmatter.cjs Tests** - Test the hand-rolled YAML parser including quoted comma edge case
- [ ] **Phase 3: verify.cjs Tests** - Comprehensive tests for the largest gap (772 lines, only 3 tests)
- [ ] **Phase 4: config.cjs + template.cjs Tests** - Test config operations and template selection
- [ ] **Phase 5: milestone.cjs Tests** - Extend existing minimal coverage with archiving and ID formats
- [ ] **Phase 6: CI Pipeline** - GitHub Actions matrix covering 3 OS × 3 Node versions

## Phase Details

### Phase 1: core.cjs Tests
**Goal**: The foundational module's 25 exports are fully tested, including regressions for known bugs
**Depends on**: Nothing (first phase)
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, REG-01, REG-02
**Success Criteria** (what must be TRUE):
  1. `npm test` runs a core.cjs test file and all tests pass
  2. A test explicitly asserts `loadConfig` returns `model_overrides` when present in config
  3. A test explicitly asserts `getRoadmapPhaseInternal` is exported from core.cjs (regression for missing export bug)
  4. Tests cover `resolveModelInternal` across all profiles including override precedence
  5. Tests cover `searchPhaseInDir`, `findPhaseInternal`, `escapeRegex`, and `generateSlugInternal`
**Plans**: 2 plans
  - [x] 01-01-PLAN.md — loadConfig and resolveModelInternal tests (TEST-01, TEST-02, REG-01)
  - [x] 01-02-PLAN.md — Phase utilities and string helper tests (TEST-03, TEST-04, REG-02)

### Phase 2: frontmatter.cjs Tests
**Goal**: The hand-rolled YAML parser's 8 exports are tested including the quoted comma edge case
**Depends on**: Phase 1
**Requirements**: TEST-05, TEST-06, TEST-07, TEST-08, REG-04
**Success Criteria** (what must be TRUE):
  1. `npm test` runs a frontmatter.cjs test file and all tests pass
  2. A test confirms `extractFrontmatter` correctly handles inline arrays with quoted commas (does not split on comma inside quotes)
  3. A test confirms `reconstructFrontmatter` produces output that round-trips back to identical input
  4. CLI integration tests exercise the `get`, `set`, `merge`, and `validate` subcommands via `execSync`
**Plans**: 2 plans
  - [x] 02-01-PLAN.md — Unit tests for extractFrontmatter, reconstructFrontmatter, spliceFrontmatter, parseMustHavesBlock, FRONTMATTER_SCHEMAS (TEST-05, TEST-06, TEST-07, REG-04)
  - [x] 02-02-PLAN.md — CLI integration tests for get/set/merge/validate subcommands (TEST-08)

### Phase 3: verify.cjs Tests
**Goal**: verify.cjs goes from 3 tests to comprehensive coverage of all 9 exports and the search(-1) regression
**Depends on**: Phase 1
**Requirements**: TEST-09, TEST-10, TEST-11, TEST-12, REG-03, INFRA-03
**Success Criteria** (what must be TRUE):
  1. `npm test` runs a verify.cjs test file and all tests pass
  2. `validate-health` is tested for all 8 health checks and the repair path
  3. A test confirms `verify summary` handles the case where `content.search()` returns -1 without producing wrong output (regression)
  4. A test confirms `verify-summary` handles a missing self-check section correctly
  5. `createTempGitProject` helper is added to `tests/helpers.cjs` and used by git-dependent verify tests
**Plans**: 3 plans
Plans:
- [ ] 03-01-PLAN.md — createTempGitProject helper + verify plan-structure and phase-completeness tests (INFRA-03, TEST-10)
- [ ] 03-02-PLAN.md — validate-health tests covering all 8 checks and repair path (TEST-09)
- [ ] 03-03-PLAN.md — verify-summary, references, commits, artifacts, key-links tests (TEST-11, TEST-12, REG-03)

### Phase 4: config.cjs + template.cjs Tests
**Goal**: config.cjs and template.cjs each have a test file covering their exports
**Depends on**: Phase 1
**Requirements**: TEST-13, TEST-14
**Success Criteria** (what must be TRUE):
  1. `npm test` runs config.cjs and template.cjs test files and all tests pass
  2. Tests exercise `config-ensure-section`, `config-set`, and `config-get` via CLI integration
  3. Tests confirm template selection heuristics choose the correct template for given inputs
  4. Tests confirm `template fill` replaces all placeholders with provided values
**Plans**: TBD

### Phase 5: milestone.cjs Tests
**Goal**: milestone.cjs tests are extended beyond 2 tests to cover archiving and all requirement ID formats
**Depends on**: Phase 1
**Requirements**: TEST-15, TEST-16
**Success Criteria** (what must be TRUE):
  1. `npm test` runs extended milestone.cjs tests and all tests pass
  2. A test confirms `milestone complete` archives completed phase files to the expected location
  3. A test confirms `requirements mark-complete` handles all requirement ID formats (TEST-XX, REG-XX, INFRA-XX, bare IDs)
**Plans**: TBD

### Phase 6: CI Pipeline
**Goal**: Every push and PR to main automatically runs the full test suite across 3 OS and 3 Node versions
**Depends on**: Phase 1
**Requirements**: INFRA-01, INFRA-02
**Success Criteria** (what must be TRUE):
  1. A `.github/workflows/test.yml` file exists and is syntactically valid
  2. Pushing to main triggers the workflow and all matrix jobs appear in the GitHub Actions UI
  3. Opening a PR to main triggers the workflow and a failing test causes the check to fail (blocks merge)
  4. The matrix covers Ubuntu, macOS, and Windows on Node 18, 20, and 22 (9 jobs total)
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. core.cjs Tests | 2/2 | Complete | 2026-02-25 |
| 2. frontmatter.cjs Tests | 2/2 | Complete | 2026-02-25 |
| 3. verify.cjs Tests | 2/3 | In Progress|  |
| 4. config.cjs + template.cjs Tests | 0/TBD | Not started | - |
| 5. milestone.cjs Tests | 0/TBD | Not started | - |
| 6. CI Pipeline | 0/TBD | Not started | - |
