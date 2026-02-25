# Roadmap: get-shit-done Test Infrastructure

## Milestones

- ✅ **v1.0 Test Infrastructure** — Phases 1-6 (shipped 2026-02-25)
- 🚧 **v1.1 Coverage Hardening** — Phases 7-12 (in progress)

## Phases

<details>
<summary>✅ v1.0 Test Infrastructure (Phases 1-6) — SHIPPED 2026-02-25</summary>

- [x] Phase 1: core.cjs Tests (2/2 plans) — completed 2026-02-25
- [x] Phase 2: frontmatter.cjs Tests (2/2 plans) — completed 2026-02-25
- [x] Phase 3: verify.cjs Tests (3/3 plans) — completed 2026-02-25
- [x] Phase 4: config.cjs + template.cjs Tests (2/2 plans) — completed 2026-02-25
- [x] Phase 5: milestone.cjs Tests (2/2 plans) — completed 2026-02-25
- [x] Phase 6: CI Pipeline (1/1 plan) — completed 2026-02-25

**Delivered:** 245 new tests (355 total), 6,715 lines of test code, GitHub Actions CI with 3x3 matrix
**Archive:** `.planning/milestones/v1.0-ROADMAP.md`

</details>

### 🚧 v1.1 Coverage Hardening (In Progress)

**Milestone Goal:** Bring all under-covered modules to 75%+ line coverage and enforce thresholds in CI

- [ ] **Phase 7: commands.cjs Coverage** - Bring commands.cjs from 59% to 75%+ via 5 targeted test groups
- [x] **Phase 8: init.cjs Coverage** - Bring init.cjs from 42% to 75%+ via 6 targeted test groups
- [x] **Phase 9: state.cjs Coverage** - Bring state.cjs from 40% to 75%+ via 6 targeted test groups (completed 2026-02-25)
- [x] **Phase 10: gsd-tools.cjs Coverage** - Bring dispatcher from 76% to 85%+ via error and branch tests (completed 2026-02-25)
- [x] **Phase 11: roadmap.cjs Coverage** - Bring roadmap.cjs from 71% to 75%+ via branch and parsing tests (completed 2026-02-25)
- [ ] **Phase 12: Coverage Tooling** - Add c8 tooling and enforce thresholds in CI

## Phase Details

### Phase 7: commands.cjs Coverage
**Goal**: commands.cjs reaches 75%+ line coverage with all major command functions tested
**Depends on**: Phase 6 (CI pipeline exists to validate coverage)
**Requirements**: CMD-01, CMD-02, CMD-03, CMD-04, CMD-05
**Success Criteria** (what must be TRUE):
  1. `npm test` runs new commands.cjs tests without failures
  2. cmdGenerateSlug and cmdCurrentTimestamp produce correct output for known inputs
  3. cmdListTodos and cmdVerifyPathExists behave correctly for existing and missing paths
  4. cmdResolveModel returns expected model strings for valid and invalid inputs
  5. cmdCommit handles both clean-repo and dirty-repo git scenarios without crashing
**Plans**: 2 plans
- [ ] 07-01-PLAN.md — Utility function tests (slug, timestamp, todos, pathExists, resolveModel)
- [ ] 07-02-PLAN.md — Complex function tests (commit with git repos, websearch with fetch mocking)

### Phase 8: init.cjs Coverage
**Goal**: init.cjs reaches 75%+ line coverage with all init command functions tested
**Depends on**: Phase 7
**Requirements**: INIT-01, INIT-02, INIT-03, INIT-04, INIT-05, INIT-06
**Success Criteria** (what must be TRUE):
  1. `npm test` runs new init.cjs tests without failures
  2. cmdInitTodos correctly reads and filters directory contents in isolated temp dirs
  3. cmdInitMilestoneOp counts phases and detects completion from real planning directories
  4. cmdInitProgress enumerates phases and returns correct progress state
  5. cmdInitNewProject and cmdInitNewMilestone create expected file structures in temp dirs
**Plans**: 2 plans
- [x] 08-01-PLAN.md — cmdInitTodos, cmdInitMilestoneOp, cmdInitPhaseOp fallback tests (INIT-01, INIT-02, INIT-04)
- [x] 08-02-PLAN.md — cmdInitProgress, cmdInitQuick, cmdInitMapCodebase, cmdInitNewProject, cmdInitNewMilestone tests (INIT-03, INIT-05, INIT-06)

### Phase 9: state.cjs Coverage
**Goal**: state.cjs reaches 75%+ line coverage with all state management functions tested
**Depends on**: Phase 8
**Requirements**: STATE-01, STATE-02, STATE-03, STATE-04, STATE-05, STATE-06
**Success Criteria** (what must be TRUE):
  1. `npm test` runs new state.cjs tests without failures
  2. stateExtractField and stateReplaceField round-trip correctly on STATE.md fixtures
  3. cmdStateLoad and cmdStateGet return correct values for known STATE.md content
  4. cmdStatePatch and cmdStateUpdate modify STATE.md fields without corrupting other fields
  5. cmdStateAdvancePlan, cmdStateRecordMetric, cmdStateUpdateProgress, cmdStateResolveBlocker, and cmdStateRecordSession each update STATE.md as expected
**Plans**: 2 plans
- [ ] 09-01-PLAN.md — Helper function unit tests + load/get/patch/update CLI tests (STATE-01, STATE-02, STATE-03)
- [ ] 09-02-PLAN.md — Advance-plan, metrics/progress, resolve-blocker, record-session CLI tests (STATE-04, STATE-05, STATE-06)

### Phase 10: gsd-tools.cjs Coverage
**Goal**: gsd-tools.cjs dispatcher reaches 85%+ line coverage with branch and error paths tested
**Depends on**: Phase 9
**Requirements**: DISP-01, DISP-02
**Success Criteria** (what must be TRUE):
  1. `npm test` runs new gsd-tools.cjs tests without failures
  2. All previously untested dispatch branches produce correct output when invoked via CLI
  3. Unknown command names produce a clear error message and non-zero exit code
  4. Error handling paths (bad args, missing files) return meaningful output rather than crashing silently
**Plans**: 1 plan
Plans:
- [ ] 10-01-PLAN.md — Dispatcher error paths, unknown subcommand errors, --cwd parsing, and untested routing branches (DISP-01, DISP-02)

### Phase 11: roadmap.cjs Coverage
**Goal**: roadmap.cjs reaches 75%+ line coverage with uncovered analysis and parsing branches tested
**Depends on**: Phase 10
**Requirements**: ROAD-01
**Success Criteria** (what must be TRUE):
  1. `npm test` runs new roadmap.cjs tests without failures
  2. Previously uncovered parsing branches produce correct output for edge-case inputs
  3. Analysis functions handle missing or malformed ROADMAP.md sections without throwing
**Plans**: 2 plans
Plans:
- [ ] 11-01-PLAN.md — Analyze edge-case branches (disk status variants, milestone extraction, missing details) and get-phase success_criteria
- [ ] 11-02-PLAN.md — cmdRoadmapUpdatePlanProgress tests (partial, complete, error paths)

### Phase 12: Coverage Tooling
**Goal**: c8 coverage tool is integrated and CI fails if any module drops below 70% line coverage
**Depends on**: Phase 11
**Requirements**: COV-01, COV-02, COV-03
**Success Criteria** (what must be TRUE):
  1. `npm run test:coverage` runs the full test suite and prints a per-file coverage report
  2. The coverage report shows all target modules at or above their coverage targets
  3. CI workflow runs `npm run test:coverage` on every PR and fails the check if thresholds are not met
  4. A PR that intentionally drops coverage below 70% causes CI to fail with a clear threshold error
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. core.cjs Tests | v1.0 | 2/2 | Complete | 2026-02-25 |
| 2. frontmatter.cjs Tests | v1.0 | 2/2 | Complete | 2026-02-25 |
| 3. verify.cjs Tests | v1.0 | 3/3 | Complete | 2026-02-25 |
| 4. config.cjs + template.cjs Tests | v1.0 | 2/2 | Complete | 2026-02-25 |
| 5. milestone.cjs Tests | v1.0 | 2/2 | Complete | 2026-02-25 |
| 6. CI Pipeline | v1.0 | 1/1 | Complete | 2026-02-25 |
| 7. commands.cjs Coverage | v1.1 | 0/2 | Planned | - |
| 8. init.cjs Coverage | v1.1 | 2/2 | Complete | 2026-02-25 |
| 9. state.cjs Coverage | 2/2 | Complete    | 2026-02-25 | - |
| 10. gsd-tools.cjs Coverage | 1/1 | Complete    | 2026-02-25 | - |
| 11. roadmap.cjs Coverage | 2/2 | Complete    | 2026-02-25 | - |
| 12. Coverage Tooling | v1.1 | 0/TBD | Not started | - |
