# Requirements: get-shit-done

**Defined:** 2026-02-28
**Core Value:** Reliable AI agent orchestration with quality gates that catch bad plans before execution burns context.

## v1.3 Requirements

Requirements for PR #762 review fixes. Each maps to roadmap phases.

### PR Structure

- [ ] **PRS-01**: PR #762 is split into 3 focused PRs: tests+CI (PR A), resolve-model fix (PR B), autopilot feature (PR C)
- [ ] **PRS-02**: `.planning/` artifacts are removed from all PR branches via `git rm --cached`
- [ ] **PRS-03**: `.gitignore` updated to prevent `.planning/` from being committed again
- [ ] **PRS-04**: PR #761 status confirmed and resolve-model fix coordinated (no duplicate changes)

### Config Fixes

- [ ] **CFG-01**: Auto-advance uses `--auto` runtime flag instead of mutating `config.json` via `config-set`
- [ ] **CFG-02**: `discuss_agents` validated at runtime in `auto-discuss.md` (odd, 3-9 range, absent key accepted)
- [ ] **CFG-03**: `model_overrides` added to `loadConfig` return object so `resolveModelInternal` can read it
- [ ] **CFG-04**: `model_overrides` config key documented in appropriate reference files

### Coordination

- [ ] **CRD-01**: PR A (tests+CI) submitted first with no dependencies on B or C
- [ ] **CRD-02**: PR B (resolve-model) submitted after confirming PR #761 status
- [ ] **CRD-03**: PR C (autopilot) submitted last, includes all code fixes from CFG category

## Future Requirements

### v2.0 — MoE Panels (deferred)

- MoE panel infrastructure with 3 config keys
- Plan Checker Panel: 3 parallel specialists
- Verifier Panel: 3 domain specialists
- Research Panel: 3 domain researchers
- Workflow routing and output contract preservation

## Out of Scope

| Feature | Reason |
|---------|--------|
| Rewriting autopilot feature logic | Reviewer didn't request feature changes, only structural/quality fixes |
| Adding tests for autopilot workflows | Reviewer noted it as missing but it's a separate effort (v1.4 candidate) |
| Changing existing test assertions | Tests PR (A) should preserve existing test content |
| TypeScript migration | Different milestone entirely |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PRS-01 | — | Pending |
| PRS-02 | — | Pending |
| PRS-03 | — | Pending |
| PRS-04 | — | Pending |
| CFG-01 | — | Pending |
| CFG-02 | — | Pending |
| CFG-03 | — | Pending |
| CFG-04 | — | Pending |
| CRD-01 | — | Pending |
| CRD-02 | — | Pending |
| CRD-03 | — | Pending |

**Coverage:**
- v1.3 requirements: 11 total
- Mapped to phases: 0
- Unmapped: 11

---
*Requirements defined: 2026-02-28*
*Last updated: 2026-02-28 after initial definition*
