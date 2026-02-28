# Roadmap: get-shit-done

## Milestones

- ✅ **v1.0 Test Infrastructure** - Phases 1-6 (shipped 2026-02-25)
- ✅ **v1.1 Coverage Hardening** - Phases 7-13 (shipped 2026-02-25)
- 🚧 **v1.3 PR Review Fixes** - Phases 14-17 (in progress)

## Phases

<details>
<summary>✅ v1.0 Test Infrastructure (Phases 1-6) - SHIPPED 2026-02-25</summary>

Phases 1-6 completed. 245 new tests, 6,715 lines of test code, CI pipeline (3 OS x 3 Node matrix). See MILESTONES.md for full details.

</details>

<details>
<summary>✅ v1.1 Coverage Hardening (Phases 7-13) - SHIPPED 2026-02-25</summary>

Phases 7-13 completed. 433 tests passing, 94.01% overall line coverage, all 11 modules above 70%, c8 coverage enforcement in CI. See MILESTONES.md for full details.

</details>

### 🚧 v1.3 PR Review Fixes (In Progress)

**Milestone Goal:** Respond to PR reviewer feedback on PR #762 by splitting the monolithic PR into focused branches, removing committed dev artifacts, and applying three targeted code fixes before resubmission.

#### Phase 14: PR Restructure
**Goal**: Clean PR C branch (feat/autopilot-clean) submitted with only autopilot feature code, .planning/ artifacts removed from git index, PR #762 closed with split comment, and PR coordination confirmed (PR A=#763 merged, PR B=not needed since fix landed via #739)
**Depends on**: Phase 13
**Requirements**: PRS-01, PRS-02, PRS-03, PRS-04, CRD-01, CRD-02
**Success Criteria** (what must be TRUE):
  1. PR C branch (`feat/autopilot-clean`) contains autopilot feature code with .planning/ artifacts removed from git index (files still exist locally)
  2. `.gitignore` includes `.planning/` so the artifacts cannot be re-committed on any future branch
  3. PR C diff against origin/main shows only autopilot feature files
  4. PR #762 has closing comment explaining the split and linking to PR C, #763, #739
  5. PR #761 status confirmed CLOSED, resolve-model fix documented as landed via #739
**Plans**: 2 plans

Plans:
- [ ] 14-01-PLAN.md — Sync local main, rebase feat/autopilot onto origin/main, remove .planning/ from git index
- [ ] 14-02-PLAN.md — Create PR C branch, open PR on GitHub, add closing comment to PR #762

#### Phase 15: Auto-Advance Runtime Flag Fix
**Goal**: Autopilot workflow no longer mutates config.json to drive auto-advance behavior — the --auto flag propagates through the existing call chain instead
**Depends on**: Phase 14
**Requirements**: CFG-01
**Success Criteria** (what must be TRUE):
  1. `autopilot.md` contains no `config-set` calls that write `auto_advance` to config.json
  2. `discuss-phase.md` contains no `config-set` calls that write `auto_advance` to config.json
  3. Running autopilot does not modify config.json's `workflow.auto_advance` value
  4. The `--auto` flag drives auto-advance behavior via the existing argument propagation chain
**Plans**: TBD

Plans:
- [ ] 15-01: Remove config-set mutations from autopilot.md and discuss-phase.md; verify --auto propagation

#### Phase 16: Validation Hardening
**Goal**: auto-discuss.md validates discuss_agents before spawning agents — invalid config produces a clear error rather than a silent misbehavior
**Depends on**: Phase 15
**Requirements**: CFG-02
**Success Criteria** (what must be TRUE):
  1. `auto-discuss.md` validates that `discuss_agents` is an odd number in the 3-9 range before spawning agents
  2. If `discuss_agents` is missing or falsy, the workflow falls back to a default (no hard failure for the "key not set" case)
  3. An invalid value (even number, out-of-range) produces a clear error message with guidance on valid values
  4. Existing workflows that do not set `discuss_agents` are unaffected (backwards compatible)
**Plans**: TBD

Plans:
- [ ] 16-01: Add discuss_agents validation guard to auto-discuss.md

#### Phase 17: Module Fixes + Documentation
**Goal**: model_overrides is wired correctly through loadConfig and resolveModelInternal, config keys are documented, and PR C is ready for submission
**Depends on**: Phase 16
**Requirements**: CFG-03, CFG-04, CRD-03
**Success Criteria** (what must be TRUE):
  1. `loadConfig` returns `model_overrides` in its result object so `resolveModelInternal` can read it
  2. `cmdResolveModel` delegates to `resolveModelInternal` (eliminating duplicated resolution logic)
  3. New tests in `tests/commands.test.cjs` verify that `model_overrides` is honored by the `resolve-model` CLI command
  4. README documents the `autopilot.*` config keys (`discuss_agents`, `discuss_model`) with valid values
  5. PR C (`feat/autopilot-clean`) is submitted to upstream with all code fixes from phases 15-17 included
**Plans**: TBD

Plans:
- [ ] 17-01: Wire model_overrides through loadConfig and cmdResolveModel; add tests
- [ ] 17-02: Document autopilot config keys in README; submit PR C

## Progress

**Execution Order:**
Phases execute in numeric order: 14 → 15 → 16 → 17

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 14. PR Restructure | v1.3 | 0/2 | Not started | - |
| 15. Auto-Advance Fix | v1.3 | 0/1 | Not started | - |
| 16. Validation Hardening | v1.3 | 0/1 | Not started | - |
| 17. Module Fixes + Docs | v1.3 | 0/2 | Not started | - |
