# Roadmap: GSD Brownfield Support

## Overview

Add comprehensive brownfield support to GSD. Users adopting GSD for existing codebases will have a systematic way to capture architectural knowledge before planning begins. A new `/gsd:map-codebase` workflow will produce structured `.planning/codebase/` documents that stay current as plans execute.

## Domain Expertise

None - this is internal GSD development following existing command/workflow/template patterns.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Templates & Structure** - Create codebase map templates and folder structure
- [ ] **Phase 2: Map Codebase Command** - Build /gsd:map-codebase with parallel Explore agents
- [ ] **Phase 3: Integration** - Wire brownfield support into existing GSD workflows

## Phase Details

### Phase 1: Templates & Structure
**Goal**: Create templates for all codebase map document types and define the folder structure
**Depends on**: Nothing (first phase)
**Research**: Unlikely (established GSD template patterns)
**Plans**: TBD

Documents to template:
- stack.md (languages, frameworks, dependencies)
- architecture.md (patterns, layers, data flow)
- structure.md (directory layout, key files)
- conventions.md (coding standards, naming)
- testing.md (test setup, patterns)
- integrations.md (external services, APIs)
- concerns.md (tech debt, known issues)

### Phase 2: Map Codebase Command
**Goal**: Build the /gsd:map-codebase slash command with parallel Explore agent workflow
**Depends on**: Phase 1
**Research**: Unlikely (using existing Explore agent patterns, GSD workflow conventions)
**Plans**: TBD

Components:
- Slash command: `commands/gsd/map-codebase.md`
- Workflow: `get-shit-done/workflows/map-codebase.md`
- Parallel Explore agent orchestration
- Output to `.planning/codebase/`

### Phase 3: Integration
**Goal**: Wire brownfield support into existing GSD workflows
**Depends on**: Phase 2
**Research**: Unlikely (modifying existing GSD commands, established patterns)
**Plans**: TBD

Integration points:
- `/gsd:new-project` - detect existing code, offer to map first
- `/gsd:plan-phase` - load relevant codebase context automatically
- Post-execution - update codebase map after plan execution

### Phase 4: Plan-Phase Optimizations
**Goal**: Reduce context usage in /gsd:plan-phase by ~37% through file consolidation and verbosity reduction
**Depends on**: Phase 3
**Research**: Unlikely (internal optimization of existing files)
**Plans**: TBD

Optimization targets:
- Merge `cli-automation.md` into `checkpoints.md` (-15KB)
- Compress `plan-format.md` to reference card (-7KB)
- Trim `scope-estimation.md` verbosity (-6KB)
- Streamline `plan-phase.md` workflow (-9KB)

### Phase 5: TDD Instructions
**Goal**: Add TDD guidance to GSD so Claude uses test-driven development when appropriate and beneficial
**Depends on**: Phase 4
**Research**: Unlikely (established TDD patterns, GSD integration points clear)
**Plans**: 2 plans

Plans:
- [ ] 05-01: TDD Foundation - Create tdd.md reference, add TDD annotation to plan-format.md
- [ ] 05-02: TDD Integration - Update plan-phase.md detection, execute-phase.md execution flow

### Phase 6: Frontmatter System Upgrade

**Goal:** Add YAML frontmatter to SUMMARY.md enabling automatic context assembly via dependency graph
**Depends on:** Phase 5
**Plans:** 2 plans

Plans:
- [ ] 06-01: Frontmatter Schema - Add comprehensive YAML frontmatter to summary.md template with dependency metadata
- [ ] 06-02: Intelligent Selection - Implement frontmatter-based context assembly in plan-phase.md

**Details:**
Transform planning from "Claude guesses which summaries to read" to "System automatically assembles optimal context" by:
- Adding frontmatter with subsystem, requires/provides/affects, tech-stack, key-files, key-decisions
- Scanning all summary frontmatter (fast - first ~25 lines each)
- Building dependency graph to auto-select relevant prior phases
- Extracting context from frontmatter before reading full summaries
- Making context assembly deterministic and optimal

### Phase 7: Backfill Existing Summaries With Frontmatter

**Goal:** Backfill YAML frontmatter with dependency graph metadata to Phase 1-6 historical summaries
**Depends on:** Phase 6
**Plans:** 1 plan

Plans:
- [x] 07-01: Backfill frontmatter to all Phase 1-5 summaries (10 files)

**Details:**
Enable intelligent context assembly for all historical phases by adding consistent frontmatter with subsystem categorization, dependency graph (requires/provides/affects), tech tracking, key decisions, and patterns established.

### Phase 8: Improve Roadmap System

**Goal:** [To be planned]
**Depends on:** Phase 7
**Research:** Unlikely (internal GSD workflow improvements)
**Plans:** TBD

Plans:
- [ ] TBD (run /gsd:plan-phase 8 to break down)

**Details:**
[To be added during planning]

### Phase 9: Integrate Verify-Work

**Goal:** Properly integrate /gsd:verify-work into GSD with workflow delegation, templates, and /gsd:plan-fix command
**Depends on:** Phase 8
**Research:** Unlikely (refactoring contributed command to match GSD patterns)
**Plans:** TBD

Components:
- Refactor `commands/gsd/verify-work.md` to GSD style (workflow delegation)
- Create `workflows/verify-work.md` for UAT logic
- Create `templates/uat-issues.md` for phase-scoped issues format
- Create `commands/gsd/plan-fix.md` for planning fixes from UAT issues
- Update `commands/gsd/progress.md` to offer plan-fix when issues exist
- Update README.md with new commands

**Details:**
Community contribution from OracleGreyBeard. Original command works but doesn't follow GSD patterns (no workflow delegation, inline templates, verbose steps). Refactor to match conventions, then add /gsd:plan-fix to complete the verify → fix loop.

### Phase 10: Subagent Resume Capability

**Goal:** Enable resumption of interrupted subagent tasks via Task tool's resume parameter
**Depends on:** Phase 9
**Research:** Unlikely (leveraging existing Task tool capabilities)
**Plans:** 2 plans

Plans:
- [x] 10-01: Agent ID Tracking Infrastructure - Add agent ID capture to execute-phase workflow
- [x] 10-02: Resume-Task Command - Create /gsd:resume-task and integrate into resume-project

**Details:**
GitHub Issue #37. When Claude Code session ends mid-execution, previously the work was lost. This phase adds agent ID tracking during subagent spawns and a /gsd:resume-task command to continue interrupted work using Task tool's resume parameter.

### Phase 11: Async Parallel Execution

**Goal:** Enable true parallel task execution with background agents for non-blocking workflows
**Depends on:** Phase 10 (requires agent tracking infrastructure)
**Research:** Unlikely (leveraging Task tool run_in_background and Phase 10 tracking)
**Plans:** 2 plans

Plans:
- [x] 11-01: Async Execution Foundation - Create /gsd:execute-async, /gsd:status, extend agent-history schema
- [x] 11-02: Parallel Phase Execution - Create /gsd:execute-phase-async with dependency detection and queue management

Components:
- `/gsd:execute-async` - Execute single plan in background
- `/gsd:execute-phase-async` - Spawn all phase plans as parallel background agents
- `/gsd:status` - Monitor background task progress and results
- Dependency detection - Auto-determine safe parallelization
- Queue management - Default 2-3 concurrent agents

**Details:**
GitHub Issue #33. GSD promises "walk away" workflow but execution remains blocking. This phase adds true async parallel execution using Task tool's `run_in_background: true` parameter. Builds on Phase 10's agent tracking to monitor multiple concurrent background agents.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Templates & Structure | 3/3 | Complete | 2025-12-17 |
| 2. Map Codebase Command | 2/2 | Complete | 2025-12-17 |
| 3. Integration | 1/1 | Complete | 2025-12-17 |
| 4. Plan-Phase Optimizations | 2/2 | Complete | 2025-12-29 |
| 5. TDD Instructions | 2/2 | Complete | 2025-12-31 |
| 6. Frontmatter System Upgrade | 2/2 | Complete | 2026-01-05 |
| 7. Backfill Existing Summaries | 1/1 | Complete | 2026-01-05 |
| 8. Improve Roadmap System | 1/1 | Complete | 2026-01-05 |
| 9. Integrate Verify-Work | 1/1 | Complete | 2026-01-09 |
| 10. Subagent Resume | 2/2 | Complete | 2026-01-09 |
| 11. Async Parallel Execution | 2/2 | Complete | 2026-01-09 |
