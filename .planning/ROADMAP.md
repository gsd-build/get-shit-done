# Roadmap: Get Shit Done Together

## Milestones

- [x] **v2.0 MVP** - Phases 1-? (shipped 2026-01-31)
- [x] **v2.1 Adversary Agent** - Phases 1-5 (shipped 2026-02-13)
- [ ] **v2.2 Collaborative Design** - Phases 6-9 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (6.1, 6.2): Urgent insertions (marked with INSERTED)

v2.1 completed phases 1-5. v2.2 continues from phase 6.

<details>
<summary>v2.1 Adversary Agent (Phases 1-5) - SHIPPED 2026-02-13</summary>

See `.planning/milestones/v2.1-ROADMAP.md` for full details.

</details>

### v2.2 Collaborative Design (In Progress)

- [x] **Phase 6: Foundation** - CLI detection, invocation normalization, and graceful degradation layer (completed 2026-02-17)
- [ ] **Phase 7: Configuration** - Per-checkpoint agent assignment in config.json
- [ ] **Phase 8: Workflow Integration** - Draft-review-synthesize pattern at all workflow checkpoints
- [ ] **Phase 9: Multi-Agent Orchestration** - Parallel review and merged synthesis with attribution

## Phase Details

### Phase 6: Foundation
**Goal**: External AI CLIs can be reliably detected, invoked, and gracefully handled when unavailable
**Depends on**: Nothing (first phase of v2.2; builds on existing gsd-tools.cjs infrastructure)
**Requirements**: INFRA-01, INFRA-02, CORE-03
**Success Criteria** (what must be TRUE):
  1. User can run a detection command and see which external CLIs (codex, gemini, opencode) are installed and available
  2. User can set `co_planners.enabled: false` in config.json and no external agent invocation occurs anywhere in the workflow
  3. User can invoke an external agent and receive normalized text output regardless of which CLI was used
  4. When an external CLI is missing, times out, or returns an error, the workflow continues with a clear message instead of crashing
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md -- CLI adapter modules (codex, gemini, opencode) and config template
- [x] 06-02-PLAN.md -- coplanner command group in gsd-tools.cjs and install verification

### Phase 7: Configuration
**Goal**: Users control exactly which external agents participate at which workflow checkpoints
**Depends on**: Phase 6 (detection and invocation layer must exist)
**Requirements**: CFG-01
**Success Criteria** (what must be TRUE):
  1. User can configure different agents for different checkpoints (e.g., codex for planning, gemini for verification) in config.json
  2. User can see sensible defaults when no per-checkpoint configuration exists (global agent list applies everywhere)
  3. Commands read checkpoint-specific agent configuration and invoke only the configured agents
**Plans**: 1 plan

Plans:
- [ ] 07-01-PLAN.md -- Config resolution function, config template schema, and settings command extension

### Phase 8: Workflow Integration
**Goal**: External agents participate as co-planners at workflow checkpoints with clear, attributed feedback that Claude synthesizes
**Depends on**: Phase 6 (invocation layer), Phase 7 (checkpoint configuration)
**Requirements**: CORE-01, CORE-02, CORE-04, UX-01, UX-02
**Success Criteria** (what must be TRUE):
  1. User can trigger a workflow checkpoint (requirements, roadmap, plan, verification) and see Claude draft an artifact, send it to the configured external agent, and receive structured feedback
  2. External agent feedback is displayed in a clearly formatted block showing challenges, suggestions, and endorsements before Claude acts on it
  3. Each piece of feedback shows which agent provided it (provenance/attribution)
  4. Claude synthesizes external feedback and makes the final decision -- external input visibly informs but does not dictate the outcome
  5. The draft-review-synthesize pattern works at all four checkpoint types (requirements, roadmap, plan, verification)
**Plans**: TBD

Plans:
- [ ] 08-01: TBD
- [ ] 08-02: TBD
- [ ] 08-03: TBD

### Phase 9: Multi-Agent Orchestration
**Goal**: Multiple external agents review the same artifact in parallel, producing a single merged synthesis with source attribution
**Depends on**: Phase 8 (single-agent integration pattern must work first)
**Requirements**: MULTI-01, MULTI-02
**Success Criteria** (what must be TRUE):
  1. User can configure multiple agents at a single checkpoint and all configured agents receive the same artifact for review simultaneously
  2. When multiple agents respond, Claude produces a single synthesized summary that merges all feedback with clear attribution of which agent said what
  3. If one agent fails while others succeed, the synthesis proceeds with available responses and notes the failure
**Plans**: TBD

Plans:
- [ ] 09-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 6 -> 7 -> 8 -> 9

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 6. Foundation | v2.2 | 2/2 | Complete | 2026-02-17 |
| 7. Configuration | v2.2 | 0/1 | Planned | - |
| 8. Workflow Integration | v2.2 | 0/? | Not started | - |
| 9. Multi-Agent Orchestration | v2.2 | 0/? | Not started | - |
