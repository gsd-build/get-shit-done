# Requirements: v1.24 Autonomous Skill

**Defined:** 2026-03-10
**Core Value:** Enable fully autonomous milestone execution — system drives the discuss→plan→execute loop for every phase, pausing only for explicit user decisions

## v1.24 Requirements

Requirements for the Autonomous Skill. Each maps to roadmap phases.

### Autonomous Orchestration

- [ ] **ORCH-01**: User can run `gsd-autonomous` to execute all remaining phases in a milestone sequentially without manual phase-by-phase invocation
- [ ] **ORCH-02**: User can see progress banners between phases showing what's running and what's next
- [ ] **ORCH-03**: System reads ROADMAP.md to discover all phases and their order, starting from the first incomplete phase
- [ ] **ORCH-04**: System runs audit → complete → cleanup automatically after all phases finish

### Smart Discuss (Grey Area Resolution)

- [ ] **DISC-01**: System proposes answers for each grey area instead of open-ended questions, presenting one grey area at a time
- [ ] **DISC-02**: For each grey area, system presents the questions with recommended answers and alternatives
- [ ] **DISC-03**: User can accept all proposed answers for a grey area, or change specific ones
- [ ] **DISC-04**: System writes CONTEXT.md with locked decisions (same format as regular discuss-phase)

### Phase Execution Chain

- [ ] **EXEC-01**: After discuss completes, system automatically invokes plan-phase for the current phase
- [ ] **EXEC-02**: After plan completes, system automatically invokes execute-phase for the current phase
- [ ] **EXEC-03**: If validation is needed after execution, system asks user; otherwise continues to next phase
- [ ] **EXEC-04**: System handles plan-phase interactions (research questions, plan approval) by asking user directly

### Autonomy Control

- [ ] **CTRL-01**: System only pauses for explicit user decisions (grey area acceptance, validation, blockers)
- [ ] **CTRL-02**: System provides an emergency stop mechanism (user can interrupt at any point)
- [ ] **CTRL-03**: System preserves all existing skill logic — delegates to real workflows, doesn't reimplement them

### Artifacts

- [ ] **ART-01**: New command file at `commands/gsd/autonomous.md` following existing frontmatter and section patterns
- [ ] **ART-02**: New workflow file at `get-shit-done/workflows/autonomous.md` with full orchestration logic
- [ ] **ART-03**: Command follows existing `name: gsd:autonomous` naming convention so the installer generates the Copilot skill automatically

## Future Requirements

Deferred to later milestones.

_(None — all requirements are in scope for v1.24)_

## Out of Scope

| Feature | Reason |
|---------|--------|
| New agent types | Autonomous skill orchestrates existing agents — no new agent definitions needed |
| Modifications to existing workflow files | Delegates to existing discuss-phase, plan-phase, execute-phase workflows as-is |
| Web UI or dashboard | GSD is a CLI-native tool; progress is shown via terminal banners |
| Parallel phase execution | Phases execute sequentially to preserve dependency ordering and user oversight |
| Auto-resolving grey areas without user input | User must confirm or override proposed answers — full automation of decisions is out of scope |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ORCH-01 | Phase 8 | Pending |
| ORCH-02 | Phase 8 | Pending |
| ORCH-03 | Phase 5 | Pending |
| ORCH-04 | Phase 8 | Pending |
| DISC-01 | Phase 6 | Pending |
| DISC-02 | Phase 6 | Pending |
| DISC-03 | Phase 6 | Pending |
| DISC-04 | Phase 6 | Pending |
| EXEC-01 | Phase 7 | Pending |
| EXEC-02 | Phase 7 | Pending |
| EXEC-03 | Phase 7 | Pending |
| EXEC-04 | Phase 7 | Pending |
| CTRL-01 | Phase 8 | Pending |
| CTRL-02 | Phase 8 | Pending |
| CTRL-03 | Phase 8 | Pending |
| ART-01 | Phase 5 | Pending |
| ART-02 | Phase 5 | Pending |
| ART-03 | Phase 5 | Pending |

**Coverage:**
- v1.24 requirements: 18 total
- Mapped to phases: 18 ✓
- Unmapped: 0

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-10*
