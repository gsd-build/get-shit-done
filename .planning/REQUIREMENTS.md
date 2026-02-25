# Requirements: get-shit-done Test Infrastructure

**Defined:** 2026-02-25
**Core Value:** Every module has tests that catch regressions before they reach users

## v1.1 Requirements

### Commands Coverage

- [x] **CMD-01**: commands.cjs tests for cmdGenerateSlug and cmdCurrentTimestamp
- [x] **CMD-02**: commands.cjs tests for cmdListTodos and cmdVerifyPathExists
- [x] **CMD-03**: commands.cjs tests for cmdResolveModel
- [x] **CMD-04**: commands.cjs tests for cmdCommit (git repo scenarios)
- [x] **CMD-05**: commands.cjs tests for cmdWebsearch (async, API mocking)

### Init Coverage

- [ ] **INIT-01**: init.cjs tests for cmdInitTodos (directory reading, filtering)
- [ ] **INIT-02**: init.cjs tests for cmdInitMilestoneOp (phase counting, completion detection)
- [ ] **INIT-03**: init.cjs tests for cmdInitProgress phase enumeration logic
- [ ] **INIT-04**: init.cjs tests for cmdInitPhaseOp fallback path
- [ ] **INIT-05**: init.cjs tests for cmdInitQuick and cmdInitMapCodebase
- [ ] **INIT-06**: init.cjs tests for cmdInitNewProject and cmdInitNewMilestone

### State Coverage

- [ ] **STATE-01**: state.cjs tests for stateExtractField and stateReplaceField helpers
- [ ] **STATE-02**: state.cjs tests for cmdStateLoad and cmdStateGet
- [ ] **STATE-03**: state.cjs tests for cmdStatePatch and cmdStateUpdate
- [ ] **STATE-04**: state.cjs tests for cmdStateAdvancePlan
- [ ] **STATE-05**: state.cjs tests for cmdStateRecordMetric and cmdStateUpdateProgress
- [ ] **STATE-06**: state.cjs tests for cmdStateResolveBlocker and cmdStateRecordSession

### Dispatcher Coverage

- [ ] **DISP-01**: gsd-tools.cjs tests for untested command dispatch branches
- [ ] **DISP-02**: gsd-tools.cjs tests for error handling and unknown command paths

### Roadmap Coverage

- [ ] **ROAD-01**: roadmap.cjs tests for uncovered analysis and parsing branches

### Coverage Tooling

- [ ] **COV-01**: c8 added as devDependency with npm run test:coverage script
- [ ] **COV-02**: Coverage thresholds enforced at 70%+ line coverage
- [ ] **COV-03**: CI workflow updated to run coverage check on PR

## v2 Requirements

### Additional Testing

- **PERF-01**: Performance tests for large ROADMAP.md files
- **WIN-01**: Windows-specific path separator tests
- **CRLF-01**: Windows CRLF line ending handling tests

## Out of Scope

| Feature | Reason |
|---------|--------|
| Source code refactoring | Tests only — no production code changes |
| Mocking frameworks | Follow existing convention of real filesystem isolation |
| 100% coverage target | Diminishing returns — 75% is practical minimum |
| Coverage badges in README | Nice-to-have, defer to later |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CMD-01 | Phase 7 | Complete |
| CMD-02 | Phase 7 | Complete |
| CMD-03 | Phase 7 | Complete |
| CMD-04 | Phase 7 | Complete |
| CMD-05 | Phase 7 | Complete |
| INIT-01 | Phase 8 | Pending |
| INIT-02 | Phase 8 | Pending |
| INIT-03 | Phase 8 | Pending |
| INIT-04 | Phase 8 | Pending |
| INIT-05 | Phase 8 | Pending |
| INIT-06 | Phase 8 | Pending |
| STATE-01 | Phase 9 | Pending |
| STATE-02 | Phase 9 | Pending |
| STATE-03 | Phase 9 | Pending |
| STATE-04 | Phase 9 | Pending |
| STATE-05 | Phase 9 | Pending |
| STATE-06 | Phase 9 | Pending |
| DISP-01 | Phase 10 | Pending |
| DISP-02 | Phase 10 | Pending |
| ROAD-01 | Phase 11 | Pending |
| COV-01 | Phase 12 | Pending |
| COV-02 | Phase 12 | Pending |
| COV-03 | Phase 12 | Pending |

**Coverage:**
- v1.1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-02-25*
*Last updated: 2026-02-25 after v1.1 roadmap created*
