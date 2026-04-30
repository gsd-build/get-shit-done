# Roadmap: SME Agent Framework

## Overview

The SME Agent Framework adds domain-expert AI agents to GSD that capture process-specific knowledge and enforce it during planning. The build order follows the strict dependency graph: establish the document contract first, then the SDK plumbing, then the creation path, then the audit gate (the core product value), then the upstream and downstream integrations that extend the gate loop. Every phase ships independently testable artifacts.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Schema & Config** - Define the SME document format and opt-in config keys that all other components depend on (completed 2026-04-28)
- [ ] **Phase 2: SDK Query Handlers** - Implement the three query handlers that gate, detect, and discuss integrations all call
- [ ] **Phase 3: SME Creator Agent** - Build the agent that analyzes codepaths, git history, and docs to produce SME documents
- [ ] **Phase 4: Creation Command & Workflow** - Wire the creator into a user-facing `/gsd-create-sme` command with interactive flow
- [ ] **Phase 5: SME Auditor Agent** - Build the adversarial read-only agent that reviews PLAN.md against SME domain knowledge
- [ ] **Phase 6: Plan-Phase Gate** - Integrate the auditor as step 12.5 in plan-phase — the core product value
- [ ] **Phase 7: Discuss-Phase Integration** - Inject SME domain probing questions into discuss-phase before planning begins
- [ ] **Phase 8: New-Milestone Process Detection** - Auto-detect processes at milestone start and surface or queue relevant SMEs
- [ ] **Phase 9: Post-Execution Refresh** - Refresh stale SME documents after phase execution and warn on staleness at gate

## Phase Details

### Phase 1: Schema & Config
**Goal**: The SME document contract and config feature flag exist so all downstream components have a stable interface to read and write
**Depends on**: Nothing (first phase)
**Requirements**: SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04, SCHEMA-05, CONFIG-01, CONFIG-02, CONFIG-03
**Success Criteria** (what must be TRUE):
  1. A `.planning/smes/{PROCESS_NAME}-SME.md` file with required sections (process overview, risks, test gaps, outdated logic, edge cases, blockers) can be created and validated against schema
  2. Each finding in the document carries exactly one severity label: BLOCKER, WARNING, or WATCH
  3. SME document frontmatter contains `last_analyzed_commit` and `block_mode` fields
  4. `gsd-tools template sme` outputs a valid blank SME document
  5. `workflow.use_sme_agents: false` config flag exists and all SME workflow steps are unconditionally skipped when it is false
**Plans:** 3/3 plans complete
Plans:
- [x] 01-01-PLAN.md — Create SME document template with frontmatter, sections, and example findings
- [x] 01-02-PLAN.md — Register SME config keys across CJS schema, SDK schema, types, defaults, and docs
- [x] 01-03-PLAN.md — Wire gsd-tools template sme command and run end-to-end validation

**Note:** CONFIG-04 (warning when SMEs enabled with no documents) moved to Phase 6 during plan revision. It requires runtime workflow integration co-located with GATE-07 and SDK query handlers from Phase 2.

### Phase 2: SDK Query Handlers
**Goal**: The three SDK query handlers that the gate, detect, and discuss integrations all depend on are implemented and registered
**Depends on**: Phase 1
**Requirements**: SDK-01, SDK-02, SDK-03
**Success Criteria** (what must be TRUE):
  1. `sme.list` query returns all SME documents in `.planning/smes/` with their frontmatter metadata
  2. `sme.detect-processes` query returns which processes a phase touches given a set of file paths and phase goal keywords
  3. `sme.context-block` query produces an XML block containing SME findings ready for injection into an agent prompt
**Plans:** 2 plans
Plans:
- [x] 02-01-PLAN.md — Implement three SME query handlers (smeList, smeDetectProcesses, smeContextBlock) with TDD
- [x] 02-02-PLAN.md — Register handlers in SDK registry and add golden policy exception entries

### Phase 3: SME Creator Agent
**Goal**: The creator agent can produce a complete, accurate SME document for a given process by analyzing code, git history, PR descriptions, and docs
**Depends on**: Phase 1
**Requirements**: CREATE-01, CREATE-02, CREATE-03, CREATE-04
**Success Criteria** (what must be TRUE):
  1. Running the creator agent against a known process produces a `.planning/smes/{PROCESS}-SME.md` with all required sections and severity-labeled findings
  2. The generated document captures the "why" behind patterns by referencing `git log --follow` output and PR descriptions, not just current code state
  3. The creator uses parallel sub-agent decomposition for large codepaths without burning the session context budget
  4. On the HSA engine target, the document correctly identifies the contribution fraud logic, member-ID character limit fragility, and COVID-era logic as domain risks
**Plans:** 2 plans
Plans:
- [x] 03-01-PLAN.md — Create both SME creator agent definitions (orchestrator + analyzer sub-agent)
- [x] 03-02-PLAN.md — Create Promptfoo eval config and validate all Phase 3 deliverables

### Phase 4: Creation Command & Workflow
**Goal**: Users can create and refresh SME documents via the `/gsd-create-sme` command with an interactive flow
**Depends on**: Phase 3
**Requirements**: CMD-01, CMD-02, CMD-03, CMD-04
**Success Criteria** (what must be TRUE):
  1. `/gsd-create-sme contribution` creates an SME document for the contribution process
  2. `/gsd-create-sme` with no arguments presents an interactive process menu for the user to choose from
  3. When an SME already exists for the specified process, the user is offered a choice: create new or update existing
  4. The workflow shows progress indicators during SME creation so the user knows the agent is working
**Plans:** 1 plan
Plans:
- [ ] 04-01-PLAN.md — Create /gsd-create-sme command, create-sme workflow, and structural validation tests

### Phase 5: SME Auditor Agent
**Goal**: The adversarial SME auditor agent can review a PLAN.md against domain knowledge and return structured findings with the correct return markers
**Depends on**: Phase 1, Phase 2
**Requirements**: AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04, AUDIT-05
**Success Criteria** (what must be TRUE):
  1. The auditor reviews PLAN.md with an adversarial stance — it assumes domain risks ARE present until the plan proves otherwise
  2. The auditor never modifies implementation files (read-only mode enforced)
  3. The auditor returns either `## SME_APPROVED` or `## SME_CONCERNS` with severity-classified findings
  4. BLOCKER findings cite concrete mitigations naming specific file paths and function calls, not abstract patterns
  5. The auditor's return markers are registered in `agent-contracts.md`
**Plans:** 1 plan
Plans:
- [x] 05-01-PLAN.md — TDD: Structural tests (RED) then agent definition + contracts registration (GREEN)

### Phase 6: Plan-Phase Gate
**Goal**: The plan-phase gate runs as step 12.5, detects relevant processes, spawns the auditor, and enforces soft or strict blocking based on per-process config
**Depends on**: Phase 2, Phase 5
**Requirements**: GATE-01, GATE-02, GATE-03, GATE-04, GATE-05, GATE-06, GATE-07, GATE-08, CONFIG-04
**Success Criteria** (what must be TRUE):
  1. When `use_sme_agents: true`, plan-phase runs an SME audit step after the plan-checker and before PLAN.md finalization
  2. The gate detects which processes the current phase touches and loads only the relevant SME documents
  3. In soft mode, BLOCKER findings surface as warnings and the user can proceed; planning is not halted
  4. In strict mode, BLOCKER findings halt plan finalization until the user acknowledges the risk or revises the plan
  5. The `--acknowledge-sme-risk` flag overrides strict mode and allows the user to proceed with documented risk acceptance
  6. When no SME exists for a detected process, the gate emits a warning with `/gsd-create-sme` instructions and never blocks (CONFIG-04, GATE-07)
**Plans:** 1 plan
Plans:
- [x] 06-01-PLAN.md — TDD: Structural tests (RED) then SME audit gate step 12.6 in plan-phase workflow (GREEN)

### Phase 7: Discuss-Phase Integration
**Goal**: SME domain knowledge is injected into discuss-phase as probing questions so domain risks surface before planning even begins
**Depends on**: Phase 2, Phase 5
**Requirements**: DISCUSS-01, DISCUSS-02, DISCUSS-03
**Success Criteria** (what must be TRUE):
  1. Before plan-phase, discuss-phase checks whether `milestone.active_smes` is populated in STATE.md
  2. When active SMEs exist, the auditor generates domain-specific probing questions that surface known risks
  3. SME insights appear in `{phase_num}-CONTEXT.md` under a `<sme_context>` block, visible to the planner
**Plans:** 1 plan
Plans:
- [ ] 07-01-PLAN.md — TDD: Structural tests (RED) then sme-step.md sub-workflow + context template update (GREEN)

### Phase 8: New-Milestone Process Detection
**Goal**: When a new milestone starts, GSD automatically detects which processes it touches and surfaces or queues the relevant SMEs
**Depends on**: Phase 2, Phase 3
**Requirements**: DETECT-01, DETECT-02, DETECT-03, DETECT-04, DETECT-05
**Success Criteria** (what must be TRUE):
  1. New-milestone setup scans the codebase and identifies which processes the milestone is likely to touch
  2. The setup step checks which of those processes already have SME documents in `.planning/smes/`
  3. For processes with existing SMEs, the user is asked to confirm they want to use them
  4. For processes without SMEs, the user is offered a per-process yes/no/skip-all prompt to create them
  5. Selected SME names are queued in `STATE.md` under `milestone.active_smes` so downstream steps can find them
**Plans**: TBD

### Phase 9: Post-Execution Refresh
**Goal**: SME documents stay current — they are refreshed after phase execution and the gate warns when they are stale
**Depends on**: Phase 3, Phase 6
**Requirements**: REFRESH-01, REFRESH-02, REFRESH-03, REFRESH-04
**Success Criteria** (what must be TRUE):
  1. After a phase execution completes, the system determines which processes were affected by the files modified
  2. The creator runs in refresh mode and updates affected SME documents with knowledge of the new code changes
  3. Updated SME documents are committed as the final step of phase completion
  4. The plan-phase gate warns the user when an SME's `last_analyzed_commit` is behind the current HEAD before running the audit
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Schema & Config | 3/3 | Complete   | 2026-04-28 |
| 2. SDK Query Handlers | 0/2 | Not started | - |
| 3. SME Creator Agent | 0/2 | Not started | - |
| 4. Creation Command & Workflow | 0/1 | Not started | - |
| 5. SME Auditor Agent | 0/1 | Not started | - |
| 6. Plan-Phase Gate | 0/1 | Not started | - |
| 7. Discuss-Phase Integration | 0/1 | Not started | - |
| 8. New-Milestone Process Detection | 0/TBD | Not started | - |
| 9. Post-Execution Refresh | 0/TBD | Not started | - |
