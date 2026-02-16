# Roadmap: Declare

## Overview

Declare replaces linear phase-based planning with a structure rooted in declared futures. The roadmap builds from infrastructure and data model (Phase 1), through the core innovation of backward derivation from declared futures (Phase 2), into navigation that makes the structure usable (Phase 3), structured execution (Phase 4), integrity tracking with the honor protocol (Phase 5), and finally alignment monitoring with performance scoring (Phase 6). Each phase delivers a coherent, verifiable capability that the next phase builds on.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Graph engine, artifact layer, CLI shell, and fork boundary
- [x] **Phase 2: Future Declaration + Backward Derivation** - Users declare futures; system derives milestones and actions backward
- [x] **Phase 02.1: Artifact Separation and Command Split** (INSERTED) - Per-milestone PLAN.md folders, milestones-only derivation, new /declare:actions
- [x] **Phase 3: Traceability + Navigation** - Why-chains, visualization, and impact-based prioritization (completed 2026-02-16)
- [ ] **Phase 4: Execution Pipeline** - Topology-aware execution with wave scheduling
- [ ] **Phase 5: Integrity System** - Commitment tracking and honor protocol
- [ ] **Phase 6: Alignment + Performance** - Drift detection, occurrence checks, and performance scoring

## Phase Details

### Phase 1: Foundation
**Goal**: The project infrastructure exists -- graph engine, artifact formats, CLI entry points, and fork boundary are operational
**Depends on**: Nothing (first phase)
**Requirements**: INFR-01, INFR-02, INFR-03, INFR-04, INFR-05, DAG-01, DAG-02, DAG-05
**Success Criteria** (what must be TRUE):
  1. User can invoke `/declare:*` slash commands from Claude Code and receive a response
  2. `.planning/` directory contains FUTURE.md and MILESTONES.md in their specified markdown formats
  3. Graph engine can create, persist, and reload a three-layer graph (declarations, milestones, actions) with upward causation edges
  4. All state changes produce atomic git commits
  5. FORK-BOUNDARY.md exists defining exactly which GSD modules are kept, extended, or replaced
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md -- Fork boundary, project scaffolding, and DeclareDag graph engine with tests
- [x] 01-02-PLAN.md -- Artifact persistence (FUTURE.md + MILESTONES.md parsers/writers) and declare-tools.js CLI entry point
- [x] 01-03-PLAN.md -- Slash commands (/declare:init, /declare:status, /declare:help), esbuild bundle, and integration verification

### Phase 2: Future Declaration + Backward Derivation
**Goal**: Users can declare a set of futures and the system derives milestones and actions backward from those declarations
**Depends on**: Phase 1
**Requirements**: FUTR-01, FUTR-02, FUTR-03, FUTR-04, FUTR-05, DAG-03, DAG-04
**Success Criteria** (what must be TRUE):
  1. User can create a set of future truth statements through a guided flow that produces standalone declarations (not goals or requirements)
  2. System detects past-derived language ("I want X because Y sucks") and responds with Socratic questions, never verdicts
  3. System derives milestones from declarations by asking "what must be true for this to be realized?" and populates MILESTONES.md
  4. System derives actions from milestones by asking "what must be done for this to be true?" and populates MILESTONES.md
  5. Declarations are stored in FUTURE.md as structured, human-readable markdown
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md -- Tooling subcommands (add-declaration, add-milestone, add-action, load-graph) with TDD and bundle rebuild
- [x] 02-02-PLAN.md -- Slash commands (/declare:future, /declare:milestones), workflow prompts, and command installation

### Phase 02.1: Artifact Separation and Command Split (INSERTED)

**Goal:** Actions live in per-milestone PLAN.md files inside `.planning/milestones/`, /declare:milestones only derives milestones with checkbox UI, new /declare:actions derives action plans per milestone
**Depends on:** Phase 2
**Success Criteria** (what must be TRUE):
  1. Each milestone has a folder in `.planning/milestones/{M-XX-slug}/` containing PLAN.md with actions
  2. MILESTONES.md contains only milestones (no actions section)
  3. /declare:milestones presents milestones as checkboxes for batch confirmation per declaration
  4. /declare:actions derives action plans per milestone and writes PLAN.md to milestone folders
  5. load-graph reads from FUTURE.md + MILESTONES.md + milestone folder PLAN.md files
  6. /declare:status shows milestone coverage and staleness indicators
**Plans:** 3 plans

Plans:
- [x] 02.1-01-PLAN.md -- Artifact layer: milestones.js rewrite, plan.js parser/writer, milestone-folders.js, load-graph update, tests
- [x] 02.1-02-PLAN.md -- CLI subcommands: create-plan, add-milestone update, status staleness, init update, bundle rebuild
- [x] 02.1-03-PLAN.md -- Slash commands: /declare:milestones checkbox UI, /declare:actions, /declare:status coverage

### Phase 3: Traceability + Navigation
**Goal**: Users can understand, trace, and prioritize the structure the system has built
**Depends on**: Phase 2
**Requirements**: DAG-06, DAG-07, DAG-08
**Success Criteria** (what must be TRUE):
  1. User can trace any action through its milestones to its source declaration (answering "why am I doing this?")
  2. System displays an ASCII/text-based visualization of the full derivation structure
  3. Actions are ordered by causal contribution to declarations, not arbitrary sequence
**Plans**: 2 plans

Plans:
- [ ] 03-01-PLAN.md -- Shared buildDagFromDisk, trace command (why-chains), prioritize command (dependency-weight ranking)
- [ ] 03-02-PLAN.md -- Visualize command (ASCII tree), slash commands (/declare:trace, /declare:visualize, /declare:prioritize)

### Phase 4: Execution Pipeline
**Goal**: The system executes actions respecting topological order, with parallel scheduling and upward verification
**Depends on**: Phase 3
**Requirements**: EXEC-01, EXEC-02, EXEC-03, EXEC-04
**Success Criteria** (what must be TRUE):
  1. Actions execute in topologically valid order derived from the milestone structure
  2. Independent branches execute in parallel via wave-based scheduling
  3. Each action has a PLAN.md created using forked GSD planner patterns
  4. After each action completes, system verifies the action advanced its parent milestone (upward causation check)
**Plans**: 2 plans

Plans:
- [ ] 04-01-PLAN.md -- Core engine modules: compute-waves, exec-plan generator, verify-wave (data layer)
- [ ] 04-02-PLAN.md -- Execute command, declare-tools wiring, bundle rebuild, /declare:execute slash command (orchestration layer)

### Phase 5: Integrity System
**Goal**: Commitments are explicit, tracked, and when broken, the system guides restoration rather than punishment
**Depends on**: Phase 4
**Requirements**: INTG-01, INTG-02, INTG-03
**Success Criteria** (what must be TRUE):
  1. Every commitment has a visible state (ACTIVE, KEPT, HONORED, BROKEN, or RENEGOTIATED) tracked in INTEGRITY.md
  2. When a commitment breaks, the system activates the honor protocol: acknowledge, inform affected nodes, clean up consequences, renegotiate
  3. Integrity is presented as restoration opportunity ("what do you want to do about it?"), never as judgment or score
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

### Phase 6: Alignment + Performance
**Goal**: The system actively detects drift from the declared future and computes performance as alignment multiplied by integrity
**Depends on**: Phase 5
**Requirements**: ALGN-01, ALGN-02, ALGN-03, ALGN-04
**Success Criteria** (what must be TRUE):
  1. FUTURE.md serves as the shared future document referenced by all agents as the source of truth
  2. System periodically performs occurrence checks, asking "does this still occur as what we declared?"
  3. System detects and surfaces drift when actions have no causation path to any declaration
  4. Performance is computed as alignment x integrity (qualitative: HIGH/MEDIUM/LOW) and visible at project level
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | 2026-02-15 |
| 2. Future Declaration + Backward Derivation | 2/2 | Complete | 2026-02-15 |
| 02.1. Artifact Separation + Command Split | 3/3 | Complete | 2026-02-16 |
| 3. Traceability + Navigation | 0/2 | Complete    | 2026-02-16 |
| 4. Execution Pipeline | 0/2 | Not started | - |
| 5. Integrity System | 0/2 | Not started | - |
| 6. Alignment + Performance | 0/2 | Not started | - |
