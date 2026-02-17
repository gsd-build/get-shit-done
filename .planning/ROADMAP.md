# Roadmap: Get Shit Done Together

## Milestones

- [x] **v2.0 MVP** - Phases 1-? (shipped 2026-01-31)
- [x] **v2.1 Adversary Agent** - Phases 1-5 (shipped 2026-02-13)
- [ ] **v2.2 Collaborative Design** - Phases 6-11 (in progress)

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
- [x] **Phase 7: Configuration** - Per-checkpoint agent assignment in config.json (completed 2026-02-17)
- [x] **Phase 8: Workflow Integration** - Draft-review-synthesize pattern at all workflow checkpoints (completed 2026-02-17)
- [ ] **Phase 9: Multi-Agent Orchestration** - Parallel review and merged synthesis with attribution
- [x] **Phase 10: Settings Fix & Integration Polish** - Wire settings CLI detection, fix stale docs and config init (gap closure) (completed 2026-02-17)
- [x] **Phase 11: Async Error Classification Fix** - Fix classifyError async-path misclassification (gap closure) (completed 2026-02-17)

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
- [x] 07-01-PLAN.md -- Config resolution function, config template schema, and settings command extension

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
**Plans**: 3 plans

Plans:
- [x] 08-01-PLAN.md -- Co-planner review at requirements and roadmap checkpoints (new-project.md)
- [x] 08-02-PLAN.md -- Co-planner review at plan and verification checkpoints (plan-phase.md, execute-phase.md)
- [x] 08-03-PLAN.md -- Gap closure: fix dead commits, hardcoded scope, missing criteria, missing handler

### Phase 9: Multi-Agent Orchestration
**Goal**: Multiple external agents review the same artifact in parallel, producing a single merged synthesis with source attribution
**Depends on**: Phase 8 (single-agent integration pattern must work first)
**Requirements**: MULTI-01, MULTI-02
**Success Criteria** (what must be TRUE):
  1. User can configure multiple agents at a single checkpoint and all configured agents receive the same artifact for review simultaneously
  2. When multiple agents respond, Claude produces a single synthesized summary that merges all feedback with clear attribution of which agent said what
  3. If one agent fails while others succeed, the synthesis proceeds with available responses and notes the failure
**Plans**: 2 plans

Plans:
- [ ] 09-01-PLAN.md -- Async adapter infrastructure and coplanner invoke-all command
- [ ] 09-02-PLAN.md -- Workflow instruction updates with parallel invocation and theme-based synthesis

### Phase 10: Settings Fix & Integration Polish
**Goal**: Wire settings CLI detection and fix accumulated integration debt from v2.2 audit
**Depends on**: Phase 9 (completes v2.2 integration surface)
**Requirements**: CFG-01 (polish — detection annotation in settings flow)
**Gap Closure:** Closes gaps from audit — integration #8, flow #1, tech debt (docstring, config init)
**Success Criteria** (what must be TRUE):
  1. User can run settings flow and see which co-planner CLIs are installed vs not-installed
  2. gsd-tools.cjs docstring lists all coplanner subcommands including `agents` and `invoke-all`
  3. `cmdConfigEnsureSection` initializes `co_planners` section when creating new config

Plans:
- [ ] 10-01-PLAN.md -- Settings Bash tool fix, docstring update, config init fix

### Phase 11: Async Error Classification Fix
**Goal**: Fix classifyError to correctly identify NOT_FOUND/PERMISSION errors in the async invocation path
**Depends on**: Phase 10 (sequential cleanup)
**Requirements**: CORE-03 (polish — error classification accuracy)
**Gap Closure:** Closes tech debt from audit — async classifyError exit-127/126 misclassification
**Success Criteria** (what must be TRUE):
  1. `invokeAsync` correctly classifies exit code 127 as `NOT_FOUND` (not `EXIT_ERROR`)
  2. `invokeAsync` correctly classifies exit code 126 as `PERMISSION` (not `EXIT_ERROR`)
  3. Error metadata from async path matches sync path classification for the same error conditions

Plans:
- [ ] 11-01-PLAN.md -- Fix async classifyError exit code handling

## Progress

**Execution Order:**
Phases execute in numeric order: 6 -> 7 -> 8 -> 9

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 6. Foundation | v2.2 | 2/2 | Complete | 2026-02-17 |
| 7. Configuration | v2.2 | 1/1 | Complete | 2026-02-17 |
| 8. Workflow Integration | v2.2 | 3/3 | Complete | 2026-02-17 |
| 9. Multi-Agent Orchestration | v2.2 | 0/? | Not started | - |
| 10. Settings Fix & Integration Polish | v2.2 | Complete    | 2026-02-17 | - |
| 11. Async Error Classification Fix | v2.2 | Complete    | 2026-02-17 | - |
