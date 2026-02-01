# Requirements: GSD Adversary Agent

**Defined:** 2026-01-31
**Core Value:** Unchallenged assumptions get caught before they cause problems in execution

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Agent Core

- [ ] **AGENT-01**: Adversary uses constructive stance ("Potential risk..." not "This is wrong")
- [ ] **AGENT-02**: Adversary classifies objections by severity (BLOCKING / MAJOR / MINOR)
- [ ] **AGENT-03**: Adversary adapts focus based on checkpoint type (requirements vs roadmap vs plan vs verification)

### Convergence

- [ ] **CONV-01**: Debate terminates after max 3 rounds regardless of state
- [ ] **CONV-02**: Debate uses adaptive convergence detection to exit early when stable

### Integration

- [ ] **INTG-01**: Adversary challenges REQUIREMENTS.md after creation in /gsd:new-project
- [ ] **INTG-02**: Adversary challenges ROADMAP.md after creation in /gsd:new-project
- [ ] **INTG-03**: Adversary challenges PLAN.md after creation in /gsd:plan-phase
- [ ] **INTG-04**: Adversary challenges verification conclusions in /gsd:verify-work

### Configuration

- [ ] **CONF-01**: Global toggle enables/disables adversary in config.json
- [ ] **CONF-02**: Max rounds is configurable in config.json
- [ ] **CONF-03**: Individual checkpoints can be toggled on/off in config.json

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Critique

- **ADV-01**: Structured 5-dimension critique framework (assumptions, feasibility, completeness, logic, risk)
- **ADV-02**: Challenge history tracking across rounds within a checkpoint
- **ADV-03**: Cross-checkpoint consistency tracking (issues raised in requirements tracked through verification)

### Calibration

- **CAL-01**: Intensity calibration (routine vs high-stakes phases)
- **CAL-02**: Challenge rate metrics and tuning

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Different model for adversary | Adds complexity; advisory-only design mitigates same-model collusion risk |
| User-mediated dispute resolution | Claude makes final decisions; adversary is advisory |
| Blocking behavior | Adversary never blocks progress; informs only |
| Integration with gsd-debugger | Separate concern; debugging is reactive, adversary is proactive |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AGENT-01 | Phase 1 | Pending |
| AGENT-02 | Phase 1 | Pending |
| AGENT-03 | Phase 1 | Pending |
| CONV-01 | Phase 3 | Pending |
| CONV-02 | Phase 1 | Pending |
| INTG-01 | Phase 3 | Pending |
| INTG-02 | Phase 3 | Pending |
| INTG-03 | Phase 4 | Pending |
| INTG-04 | Phase 5 | Pending |
| CONF-01 | Phase 2 | Pending |
| CONF-02 | Phase 2 | Pending |
| CONF-03 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-01-31*
*Last updated: 2026-01-31 after roadmap creation*
