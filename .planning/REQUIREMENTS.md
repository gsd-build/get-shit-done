# Requirements: get-shit-done Test Infrastructure

**Defined:** 2026-02-25
**Core Value:** Every module has tests that catch regressions before they reach users

## v1 Requirements

### Test Coverage — Critical Modules

- [x] **TEST-01**: core.cjs has tests for loadConfig including model_overrides regression
- [x] **TEST-02**: core.cjs has tests for resolveModelInternal across all profiles and overrides
- [x] **TEST-03**: core.cjs has tests for escapeRegex, generateSlugInternal, and utility functions
- [x] **TEST-04**: core.cjs has tests for searchPhaseInDir, findPhaseInternal, getRoadmapPhaseInternal
- [x] **TEST-05**: frontmatter.cjs has tests for extractFrontmatter including quoted comma edge case
- [x] **TEST-06**: frontmatter.cjs has tests for reconstructFrontmatter roundtrip identity
- [x] **TEST-07**: frontmatter.cjs has tests for parseMustHavesBlock and spliceFrontmatter
- [x] **TEST-08**: frontmatter.cjs has CLI integration tests for get/set/merge/validate commands
- [x] **TEST-09**: verify.cjs has tests for validate-health (all 8 checks + repair)
- [x] **TEST-10**: verify.cjs has tests for verify plan-structure and phase-completeness
- [x] **TEST-11**: verify.cjs has tests for verify summary including search(-1) regression
- [x] **TEST-12**: verify.cjs has tests for verify references, commits, artifacts, key-links

### Test Coverage — Medium Priority Modules

- [x] **TEST-13**: config.cjs has tests for config-ensure-section, config-set, config-get
- [x] **TEST-14**: template.cjs has tests for template select heuristics and template fill
- [x] **TEST-15**: milestone.cjs has extended tests for milestone complete with archiving
- [ ] **TEST-16**: milestone.cjs has tests for requirements mark-complete with all ID formats

### Bug Regressions

- [x] **REG-01**: Test confirms loadConfig returns model_overrides when present
- [x] **REG-02**: Test confirms getRoadmapPhaseInternal is exported from core.cjs
- [x] **REG-03**: Test confirms verify-summary handles missing self-check section correctly
- [x] **REG-04**: Test confirms frontmatter inline arrays handle quoted commas

### Infrastructure

- [ ] **INFRA-01**: GitHub Actions workflow runs tests on push/PR to main
- [ ] **INFRA-02**: CI matrix covers Ubuntu, macOS, Windows x Node 18, 20, 22
- [x] **INFRA-03**: Test helper createTempGitProject added for git-dependent tests

## v2 Requirements

### Coverage Tooling

- **COV-01**: c8 devDependency with npm run test:coverage script
- **COV-02**: Coverage thresholds enforced at 70%+ line coverage
- **COV-03**: Coverage badge in README

### Additional Testing

- **PERF-01**: Performance tests for large ROADMAP.md files
- **WIN-01**: Windows-specific path separator tests
- **CRLF-01**: Windows CRLF line ending handling tests

## Out of Scope

| Feature | Reason |
|---------|--------|
| Source code refactoring | Tests only — no production code changes |
| Mocking frameworks | Follow existing convention of real filesystem isolation |
| E2E workflow tests | Too complex, plan-phase->execute-phase spans multiple processes |
| TypeScript migration | Different milestone entirely |
| Snapshot testing | Existing assertion pattern is more maintainable |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEST-01 | Phase 1 | Complete |
| TEST-02 | Phase 1 | Complete |
| TEST-03 | Phase 1 | Complete |
| TEST-04 | Phase 1 | Complete |
| REG-01 | Phase 1 | Complete |
| REG-02 | Phase 1 | Complete |
| TEST-05 | Phase 2 | Complete |
| TEST-06 | Phase 2 | Complete |
| TEST-07 | Phase 2 | Complete |
| TEST-08 | Phase 2 | Complete |
| REG-04 | Phase 2 | Complete |
| TEST-09 | Phase 3 | Complete |
| TEST-10 | Phase 3 | Complete |
| TEST-11 | Phase 3 | Complete |
| TEST-12 | Phase 3 | Complete |
| REG-03 | Phase 3 | Complete |
| INFRA-03 | Phase 3 | Complete |
| TEST-13 | Phase 4 | Complete |
| TEST-14 | Phase 4 | Complete |
| TEST-15 | Phase 5 | Complete |
| TEST-16 | Phase 5 | Pending |
| INFRA-01 | Phase 6 | Pending |
| INFRA-02 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-02-25*
*Last updated: 2026-02-25 after roadmap creation*
