# Roadmap: GSD Reflect

## Milestones

- <details><summary>v1.12 GSD Reflect (Phases 0-6) -- SHIPPED 2026-02-09</summary>See milestones/v1.12-ROADMAP.md</details>
- <details><summary>v1.13 Upstream Sync & Validation (Phases 7-12) -- SHIPPED 2026-02-11</summary>See milestones/v1.13-ROADMAP.md</details>
- <details><summary>v1.14 Multi-Runtime Interop (Phases 13-21) -- SHIPPED 2026-02-16</summary>See milestones/v1.14-ROADMAP.md</details>
- <details><summary>v1.15 Backlog & Update Experience (Phases 22-30) -- SHIPPED 2026-02-23</summary>See milestones/v1.15-ROADMAP.md</details>

### v1.16 Signal Lifecycle & Reflection (In Progress)

**Milestone Goal:** Close the self-improvement loop -- from partial signal detection to a complete lifecycle (detect, triage, remediate, verify, recurrence check, lesson) with epistemic rigor built into every stage. Success test: the system can produce lessons from signals and verify that remediations work.

**Phase Numbering:**
- Integer phases (31, 32, 33, ...): Planned milestone work
- Decimal phases (31.1, 31.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 31: Signal Schema Foundation** - Extended signal schema with lifecycle fields, mutability boundary, and tiered epistemic rigor
- [ ] **Phase 32: Multi-Sensor Orchestrator** - Parallel sensor collection with synthesizer deduplication and single-writer KB access
- [ ] **Phase 33: Enhanced Reflector** - Lifecycle-aware triage, confidence-weighted patterns, lesson distillation, and remediation suggestions
- [ ] **Phase 34: Signal-Plan Linkage** - Wires reflector output into planning with recurrence detection and passive verification
- [ ] **Phase 35: Spike Audit & Lightweight Mode** - Verify root cause of non-use, implement research-only spikes, close reflect-to-spike pipeline

## Phase Details

### Phase 31: Signal Schema Foundation
**Goal**: Signals carry the metadata needed for a complete lifecycle -- triage state, remediation tracking, verification status, and epistemic evidence -- while all 46 existing signals remain valid without migration
**Depends on**: Nothing (first phase of v1.16)
**Requirements**: SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04, SCHEMA-05, SCHEMA-06, SCHEMA-07, SCHEMA-08, SCHEMA-09
**Success Criteria** (what must be TRUE):
  1. A new signal can be created with lifecycle fields (triage, remediation, verification) and the fields are preserved in YAML frontmatter
  2. All 46 existing signals load and validate without errors -- no migration required, missing lifecycle fields default gracefully
  3. The mutability boundary is enforced: detection payload fields cannot be modified after creation, but lifecycle fields can be updated
  4. Counter-evidence fields (evidence.supporting, evidence.counter, confidence, confidence_basis) exist in the schema and tiered rigor is enforced -- critical signals require counter-evidence, trace signals are exempt
  5. A positive signal (baseline, not deviation) can be emitted and stored alongside deviation signals
**Plans:** 4 plans (3 initial + 1 gap closure)

Plans:
- [ ] 31-01-PLAN.md -- Schema specification: knowledge-store.md lifecycle/epistemic/mutability extensions, signal template, feature manifest settings
- [ ] 31-02-PLAN.md -- Reference docs: signal-detection.md and reflection-patterns.md updated for four-tier severity and positive signals
- [ ] 31-03-PLAN.md -- Code implementation: FRONTMATTER_SCHEMAS signal validation in gsd-tools.js, tests, kb-rebuild-index.sh lifecycle column
- [ ] 31-04-PLAN.md -- Gap closure: backward compat for pre-existing critical signals without evidence

### Phase 32: Multi-Sensor Orchestrator
**Goal**: Signal collection scales beyond a single agent -- multiple sensors run in parallel, a synthesizer deduplicates and caps their output, and the knowledge base has exactly one writer
**Depends on**: Phase 31 (sensors emit signals using the extended schema)
**Requirements**: SENSOR-01, SENSOR-02, SENSOR-03, SENSOR-04, SENSOR-05, SENSOR-06, SENSOR-07
**Success Criteria** (what must be TRUE):
  1. Running /gsd:collect-signals spawns artifact and git sensors in parallel, and a synthesizer merges their output into the KB -- the user sees a single command producing signals from multiple sources
  2. The git sensor detects at least one real pattern (fix-fix-fix commits, file churn, or scope creep) from the project's actual git history
  3. Duplicate signals from different sensors about the same issue are merged by the synthesizer -- the KB does not contain near-duplicate entries from the same collection run
  4. Sensor configuration in the feature manifest allows enabling/disabling individual sensors, and the log sensor ships as a disabled stub
  5. The synthesizer enforces epistemic rigor fields (from Phase 31 schema) before writing any signal to the KB
**Plans:** 4 plans

Plans:
- [x] 32-01-PLAN.md -- Sensor foundation: artifact sensor extraction, log sensor stub, feature manifest config, signal-collector deprecation
- [x] 32-02-PLAN.md -- Git sensor: commit pattern detection (fix-fix-fix chains, file churn, scope creep) with live validation
- [x] 32-03-PLAN.md -- Signal synthesizer: single KB writer with dedup, rigor enforcement, trace filtering, and cap management
- [x] 32-04-PLAN.md -- Orchestrator assembly: refactor collect-signals workflow to parallel sensor pattern, update command, installer sync

### Phase 33: Enhanced Reflector
**Goal**: The reflector transforms accumulated signals into actionable triage decisions, distilled lessons, and remediation suggestions -- proving it can produce more than 5 lessons from the existing 46 signals
**Depends on**: Phase 31 (schema), Phase 32 (lifecycle-aware signals with epistemic fields)
**Requirements**: REFLECT-01, REFLECT-02, REFLECT-03, REFLECT-04, REFLECT-05, REFLECT-06, REFLECT-07, REFLECT-08
**Success Criteria** (what must be TRUE):
  1. Running /gsd:reflect reads lifecycle state (triage, remediation, verification) from signals and adjusts its analysis accordingly -- triaged signals are treated differently from untriaged ones
  2. Pattern detection uses confidence-weighted thresholds instead of raw counts -- a cluster of 3 high-confidence signals can surface a pattern that 5 low-confidence signals would not
  3. The reflector produces triage proposals with cluster-level decisions that the user can approve or reject, and generates remediation suggestions for triaged signals
  4. The reflector distills at least 5 lessons from the existing 46 signals, with evidence snapshots included in each lesson
  5. The reflect output includes a lifecycle dashboard (N untriaged / N triaged / N remediated / N verified) and flags low-confidence patterns as spike candidates
**Plans:** 4 plans

Plans:
- [ ] 33-01-PLAN.md -- Detection rules: confidence-weighted scoring, counter-evidence seeking, and reflect-to-spike pipeline in reflection-patterns.md
- [ ] 33-02-PLAN.md -- Output infrastructure: evidence_snapshots in lesson template, lifecycle dashboard and triage UX in reflect workflow
- [ ] 33-03-PLAN.md -- Reflector rewrite: lifecycle-aware gsd-reflector.md with all REFLECT-01 through REFLECT-08 capabilities
- [ ] 33-04-PLAN.md -- Installer sync and human verification: sync .claude/ runtime, verify /gsd:reflect produces lifecycle-aware output

### Phase 34: Signal-Plan Linkage
**Goal**: The signal lifecycle closes end-to-end -- plans declare which signals they fix, completion updates remediation status, recurrence is detected passively, and at least one signal completes the full lifecycle
**Depends on**: Phase 33 (reflector produces triage decisions and remediation suggestions)
**Requirements**: LIFECYCLE-01, LIFECYCLE-02, LIFECYCLE-03, LIFECYCLE-04, LIFECYCLE-05, LIFECYCLE-06, LIFECYCLE-07
**Success Criteria** (what must be TRUE):
  1. A plan can declare resolves_signals in its PLAN.md frontmatter, and the planner agent recommends signal IDs to resolve based on active triaged signals
  2. When a plan with resolves_signals completes execution, the referenced signals automatically update to remediated status
  3. The synthesizer checks new signals against remediated signals and links recurrences via recurrence_of -- recurrence triggers severity escalation
  4. Passive verification-by-absence works: after a configurable N-phase window (default 3) with no recurrence, remediated signals move toward verified status
  5. At least one signal completes the full lifecycle (detected, triaged, remediated, verified) end-to-end during this phase
**Plans:** 4 plans

Plans:
- [ ] 34-01-PLAN.md -- Schema and manifest foundation: resolves_signals documentation in knowledge-store.md, verification_window in feature manifest
- [ ] 34-02-PLAN.md -- Planner signal awareness: signal_awareness section in gsd-planner.md, triaged signal loading in plan-phase.md
- [ ] 34-03-PLAN.md -- Lifecycle transitions: remediation step in execute-plan.md, recurrence detection and passive verification in synthesizer
- [ ] 34-04-PLAN.md -- Cleanup and demo: remove Phase 34 notes from reflector/workflow, installer sync, end-to-end lifecycle demonstration

### Phase 35: Spike Audit & Lightweight Mode
**Goal**: The spike system works in practice -- root cause of non-use is identified and fixed, a lightweight research-only mode reduces ceremony for simple questions, and the reflect-to-spike pipeline produces real spike candidates
**Depends on**: Phase 33 (reflect-to-spike pipeline generates spike candidates)
**Requirements**: SPIKE-01, SPIKE-02, SPIKE-03, SPIKE-04, SPIKE-05
**Success Criteria** (what must be TRUE):
  1. The spike integration audit produces concrete findings -- step 5.5 wiring in plan-phase.md is verified as present or absent, and researcher's Genuine Gaps emission is confirmed or fixed
  2. A lightweight research spike (question, research, decision -- no BUILD/RUN phases) can be completed end-to-end in a single session
  3. At least one spike is completed end-to-end (designed, executed, decision recorded) -- not just designed
  4. The reflect-to-spike pipeline is verified with a real spike candidate from the enhanced reflector, demonstrating the reflector-to-spike handoff works
**Plans:** 4 plans

Plans:
- [x] 35-01-PLAN.md -- Spike wiring audit fixes: step 5.5 in plan-phase.md, researcher Genuine Gaps format, feature manifest spike section
- [x] 35-02-PLAN.md -- Lightweight research spike mode: option 4 in run-spike.md, research-only path in gsd-spike-runner.md
- [x] 35-03-PLAN.md -- End-to-end spike execution and pipeline verification: complete spike 002, verify reflect-to-spike pipeline
- [x] 35-04-PLAN.md -- Installer sync and human verification: sync .claude/ runtime, verify complete spike system

## Progress

**Execution Order:**
Phases execute in numeric order: 31 -> 32 -> 33 -> 34 -> 35

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|---------------|--------|-----------|
| 31. Signal Schema Foundation | v1.16 | 4/4 | Complete | 2026-02-28 |
| 32. Multi-Sensor Orchestrator | v1.16 | 4/4 | Complete | 2026-02-28 |
| 33. Enhanced Reflector | v1.16 | 4/4 | Complete | 2026-03-01 |
| 34. Signal-Plan Linkage | v1.16 | 4/4 | Complete | 2026-03-01 |
| 35. Spike Audit & Lightweight Mode | v1.16 | 4/4 | Complete | 2026-03-02 |

## Overall Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|---------------|--------|-----------|
| 0-6 | v1.12 | 25/25 | Complete | 2026-02-09 |
| 7-12 | v1.13 | 18/18 | Complete | 2026-02-11 |
| 13-21 | v1.14 | 18/18 | Complete | 2026-02-16 |
| 22-30 | v1.15 | 24/24 | Complete | 2026-02-23 |
| 31-35 | v1.16 | 20/20 | Complete | 2026-03-02 |

**Totals:** 5 milestones, 35 phases complete, 105 plans completed
