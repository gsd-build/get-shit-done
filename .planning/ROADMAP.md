# Roadmap: GSD Installer

## Milestones

- ✅ **v1.23 Copilot CLI Support** — Phases 1-4 (shipped 2026-03-03) → [archive](milestones/v1.23-ROADMAP.md)
- 🚧 **v1.24 Autonomous Skill** — Phases 5-8 (in progress)

## Phases

<details>
<summary>✅ v1.23 Copilot CLI Support (Phases 1-4) — SHIPPED 2026-03-03</summary>

- [x] Phase 1: Core Installer Plumbing (1/1 plans) — completed 2026-03-02
- [x] Phase 2: Content Conversion Engine (2/2 plans) — completed 2026-03-03
- [x] Phase 3: Instructions & Lifecycle (2/2 plans) — completed 2026-03-03
- [x] Phase 4: Integration Testing & Validation (1/1 plan) — completed 2026-03-03

</details>

### 🚧 v1.24 Autonomous Skill (In Progress)

**Milestone Goal:** Create a `gsd-autonomous` skill that runs the full milestone lifecycle autonomously, chaining existing GSD phases with minimal user interaction.

- [ ] **Phase 5: Skill Scaffolding & Phase Discovery** - Create command/workflow files and implement ROADMAP.md phase parsing
- [ ] **Phase 6: Smart Discuss** - Grey area resolution with proposed answers instead of open-ended questions
- [ ] **Phase 7: Phase Execution Chain** - Wire discuss→plan→execute into an automatic single-phase pipeline
- [ ] **Phase 8: Multi-Phase Orchestration & Lifecycle** - Drive all phases sequentially with progress visibility, lifecycle completion, and user controls

## Phase Details

### Phase 5: Skill Scaffolding & Phase Discovery
**Goal**: The autonomous skill files exist following project conventions and the workflow can discover phases from ROADMAP.md
**Depends on**: Phase 4 (v1.23 complete)
**Requirements**: ART-01, ART-02, ART-03, ORCH-03
**Success Criteria** (what must be TRUE):
  1. `commands/gsd/autonomous.md` exists with valid frontmatter (name, description, argument-hint) and structured sections matching existing command patterns
  2. `get-shit-done/workflows/autonomous.md` exists with bootstrap sequence (`gsd-tools.cjs init`) and standard workflow structure
  3. The command uses `name: gsd:autonomous` so the installer auto-generates `.github/skills/gsd-autonomous/SKILL.md` without any installer changes
  4. The workflow can parse ROADMAP.md and produce an ordered list of incomplete phases with their names, numbers, and dependency info
**Plans**: TBD

### Phase 6: Smart Discuss
**Goal**: Users get proposed answers for grey areas instead of open-ended questions, and can accept or override them per area
**Depends on**: Phase 5
**Requirements**: DISC-01, DISC-02, DISC-03, DISC-04
**Success Criteria** (what must be TRUE):
  1. For each grey area, the system displays questions with a recommended answer and alternatives — not open-ended prompts
  2. Grey areas are presented one at a time, letting the user focus on a single area before moving on
  3. User can accept all proposed answers for a grey area with a single confirmation, or change specific answers individually
  4. After all grey areas are resolved, CONTEXT.md is written with locked decisions in the same format as regular discuss-phase output
**Plans**: TBD

### Phase 7: Phase Execution Chain
**Goal**: For a single phase, the full discuss→plan→execute sequence runs automatically with human input only at decision points
**Depends on**: Phase 6
**Requirements**: EXEC-01, EXEC-02, EXEC-03, EXEC-04
**Success Criteria** (what must be TRUE):
  1. After discuss completes for a phase, plan-phase is automatically invoked without the user triggering it
  2. After plan completes for a phase, execute-phase is automatically invoked without the user triggering it
  3. Plan-phase interactions (research questions, plan approval) are surfaced to the user directly within the autonomous flow
  4. After execution, the system asks the user whether validation is needed; if declined, it proceeds to the next phase immediately
**Plans**: TBD

### Phase 8: Multi-Phase Orchestration & Lifecycle
**Goal**: The entire milestone runs autonomously from first incomplete phase through cleanup, with progress visibility and user safety controls
**Depends on**: Phase 7
**Requirements**: ORCH-01, ORCH-02, ORCH-04, CTRL-01, CTRL-02, CTRL-03
**Success Criteria** (what must be TRUE):
  1. User runs `gsd-autonomous` once and all remaining phases execute sequentially (discuss→plan→execute per phase) without manual phase-by-phase invocation
  2. Progress banners appear between phases showing the completed phase, the next phase, and overall milestone progress
  3. After all phases complete, the system automatically runs audit → complete → cleanup for the milestone
  4. The system only pauses for explicit user decisions (grey area acceptance, validation requests, blockers) — no unnecessary confirmation prompts
  5. User can interrupt autonomous execution at any point and resume later from the last completed phase
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 5 → 6 → 7 → 8

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Core Installer Plumbing | v1.23 | 1/1 | ✅ Complete | 2026-03-02 |
| 2. Content Conversion Engine | v1.23 | 2/2 | ✅ Complete | 2026-03-03 |
| 3. Instructions & Lifecycle | v1.23 | 2/2 | ✅ Complete | 2026-03-03 |
| 4. Integration Testing & Validation | v1.23 | 1/1 | ✅ Complete | 2026-03-03 |
| 5. Skill Scaffolding & Phase Discovery | v1.24 | 0/? | Not started | - |
| 6. Smart Discuss | v1.24 | 0/? | Not started | - |
| 7. Phase Execution Chain | v1.24 | 0/? | Not started | - |
| 8. Multi-Phase Orchestration & Lifecycle | v1.24 | 0/? | Not started | - |
