# Roadmap: GSD Adversary Agent

## Overview

This roadmap delivers an adversarial review agent that challenges assumptions and stress-tests feasibility at four key checkpoints in the GSD workflow: requirements, roadmap, plans, and verification. The agent integrates into existing commands without disrupting workflows, enabled via configuration toggle. Research-backed patterns (structured critique, constructive stance, adaptive convergence) prevent common multi-agent debate failures.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4, 5): Planned milestone work
- Decimal phases (e.g., 2.1): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Core Agent** - Implement gsd-adversary agent with structured challenge generation
- [ ] **Phase 2: Configuration** - Add adversary settings to config.json schema
- [ ] **Phase 3: New-Project Integration** - Adversary checkpoints for requirements and roadmap
- [ ] **Phase 4: Plan Integration** - Adversary checkpoint for plan creation
- [ ] **Phase 5: Verification Integration** - Adversary checkpoint for verification conclusions

## Phase Details

### Phase 1: Core Agent
**Goal**: Adversary agent can challenge artifacts with structured, constructive feedback
**Depends on**: Nothing (first phase)
**Requirements**: AGENT-01, AGENT-02, AGENT-03, CONV-02
**Success Criteria** (what must be TRUE):
  1. Adversary can be spawned via Task tool with artifact content and checkpoint type
  2. Adversary returns structured challenges with severity classification (BLOCKING/MAJOR/MINOR)
  3. Adversary adapts challenge focus based on checkpoint type (requirements vs roadmap vs plan vs verification)
  4. Adversary uses constructive tone in all challenges ("Potential risk..." not "This is wrong")
  5. Adversary assesses previous defense rounds and recommends convergence or continuation
**Plans**: TBD

Plans:
- [ ] 01-01: TBD

### Phase 2: Configuration
**Goal**: Users can control adversary behavior through config.json settings
**Depends on**: Nothing (can parallel Phase 1)
**Requirements**: CONF-01, CONF-02, CONF-03
**Success Criteria** (what must be TRUE):
  1. User can enable/disable adversary globally via config.json "adversary" toggle
  2. User can configure max debate rounds in config.json
  3. User can toggle individual checkpoints on/off in config.json (requirements, roadmap, plan, verification)
**Plans**: TBD

Plans:
- [ ] 02-01: TBD

### Phase 3: New-Project Integration
**Goal**: /gsd:new-project invokes adversary at requirements and roadmap checkpoints
**Depends on**: Phase 1, Phase 2
**Requirements**: INTG-01, INTG-02, CONV-01
**Success Criteria** (what must be TRUE):
  1. Adversary challenges REQUIREMENTS.md after creation in /gsd:new-project (if enabled)
  2. Adversary challenges ROADMAP.md after creation in /gsd:new-project (if enabled)
  3. Debate loop runs until convergence or max rounds reached (hard cap at 3)
  4. User sees adversary challenges and Claude's responses in output
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: Plan Integration
**Goal**: /gsd:plan-phase invokes adversary after plan creation
**Depends on**: Phase 3 (reuses debate loop patterns)
**Requirements**: INTG-03
**Success Criteria** (what must be TRUE):
  1. Adversary challenges PLAN.md after creation in /gsd:plan-phase (if enabled)
  2. Plan is updated based on valid adversary challenges before commit
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

### Phase 5: Verification Integration
**Goal**: /gsd:verify-work invokes adversary to challenge verification conclusions
**Depends on**: Phase 4 (same patterns)
**Requirements**: INTG-04
**Success Criteria** (what must be TRUE):
  1. Adversary challenges verification conclusions after VERIFICATION.md created (if enabled)
  2. Verification summary reflects consideration of adversary challenges
**Plans**: TBD

**Research Note**: This phase may overlap with existing gsd-verifier. Evaluate during implementation whether adversarial verification adds unique value or is redundant.

Plans:
- [ ] 05-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Agent | 0/? | Not started | - |
| 2. Configuration | 0/? | Not started | - |
| 3. New-Project Integration | 0/? | Not started | - |
| 4. Plan Integration | 0/? | Not started | - |
| 5. Verification Integration | 0/? | Not started | - |

---
*Roadmap created: 2026-01-31*
*Depth: comprehensive*
*Coverage: 12/12 v1 requirements mapped*
