# Roadmap: /gsd:docs-update

## Overview

Four phases deliver a verified documentation generation command for GSD. Phase 1 wires the infrastructure and defines the doc-writer agent skeleton. Phase 2 builds the workflow orchestrator with parallel doc routing. Phase 3 completes the command entry point, all nine doc types, and existing doc preservation. Phase 4 adds the verification gate, fix loop, and test suite — the primary differentiator over every competing tool.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Infrastructure & Agent Skeleton** - Wire init.cjs, gsd-tools.cjs dispatcher, and define the doc-writer agent stub (completed 2026-03-30)
- [x] **Phase 2: Workflow Orchestration** - Build the docs-update workflow with wave-based parallel dispatch and doc routing logic (completed 2026-03-30)
- [x] **Phase 3: Full Doc Generation & Existing Doc Handling** - Complete all 9 doc types, command entry point, and preserve/supplement/regenerate per file (completed 2026-03-30)
- [x] **Phase 4: Verification Gate & Test Suite** - Add fact-checker agent, bounded fix loop, and node:test coverage for gsd-tools commands (completed 2026-03-30)
- [ ] **Phase 5: Refinement of docs output** - Fix doc output paths, recursive existing doc scanning, and CONTRIBUTING.md confirmation gate

## Phase Details

### Phase 1: Infrastructure & Agent Skeleton
**Goal**: The command infrastructure is wired so `gsd-tools docs-init` returns project context and a doc-writer agent stub exists ready to receive prompts
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, DOCG-01, DOCG-08, CONS-03
**Success Criteria** (what must be TRUE):
  1. Running `node get-shit-done/bin/gsd-tools.cjs docs-init` returns valid JSON with project signals, existing doc inventory, and model resolution
  2. The `docs-update` case appears in gsd-tools.cjs switch with correct help text and routes to the docs module
  3. `agents/gsd-doc-writer.md` exists with dynamic assignment list, create/update mode distinction, and embedded doc templates — no external template dependencies
  4. All new .cjs code uses Node.js built-ins only (no npm dependencies introduced)
**Plans**: 2 plans
Plans:
- [x] 01-01-PLAN.md — Create docs-init command (lib/docs.cjs + gsd-tools wiring + model profile)
- [x] 01-02-PLAN.md — Create gsd-doc-writer agent definition with 9 stub templates

### Phase 2: Workflow Orchestration
**Goal**: The docs-update workflow drives the full lifecycle — init, project-type detection, conditional doc routing, and parallel subagent dispatch — with sequential fallback when Task tool is unavailable
**Depends on**: Phase 1
**Requirements**: INFRA-04, INFRA-05, DOCG-03, DOCG-04, DOCG-05, CONS-01, CONS-02, CONS-04
**Success Criteria** (what must be TRUE):
  1. `get-shit-done/workflows/docs-update.md` executes a 13-step orchestration: context load, project type detection, conditional doc selection, parallel wave dispatch, and commit
  2. Project type (open source library, private SaaS, CLI tool, monorepo) is correctly detected and determines which docs are queued
  3. API.md is only queued for API projects; CONTRIBUTING.md only for open source; DEPLOYMENT.md only for projects with deploy config — wrong-type docs are not generated
  4. When Task tool is unavailable, docs are generated sequentially using the same inline fallback pattern as map-codebase
  5. Generated docs contain zero GSD methodology content — all content describes the target project exclusively
  6. DEPLOYMENT.md and CONFIGURATION.md use VERIFY markers for any infrastructure claim not discoverable from the repo
**Plans**: 1 plan
Plans:
- [x] 02-01-PLAN.md — Create docs-update.md workflow with 13-step orchestration (init, classify, route, dispatch, fallback, commit)
**UI hint**: no

### Phase 3: Full Doc Generation & Existing Doc Handling
**Goal**: All 9 doc types are fully specified in the agent, the command entry point exists with --force and --verify-only flags, and hand-written docs are never overwritten without explicit user choice
**Depends on**: Phase 2
**Requirements**: INFRA-03, DOCG-02, DOCG-06, DOCG-07, EXIST-01, EXIST-02, EXIST-03, EXIST-04
**Success Criteria** (what must be TRUE):
  1. `commands/gsd/docs-update.md` exists with --force and --verify-only flag documentation and loads the workflow correctly
  2. All 9 doc types (README, ARCHITECTURE, GETTING-STARTED, DEVELOPMENT, TESTING, API, CONFIGURATION, DEPLOYMENT, CONTRIBUTING) are fully specified in the doc-writer agent with type-specific content guidance
  3. Files without a GSD marker are detected as hand-written; the user is offered preserve, supplement, or regenerate for each such file before any write occurs
  4. Update mode rewrites only inaccurate or missing sections, leaving user-authored prose intact
  5. Docusaurus, VitePress, MkDocs, and Storybook config signals are detected and their directory/front-matter conventions respected
  6. Monorepo workspaces are detected; per-package doc generation is triggered when appropriate
**Plans**: 2 plans
Plans:
- [x] 03-01-PLAN.md — Fill 9 doc type templates with content guidance, add supplement mode and doc tooling guidance
- [x] 03-02-PLAN.md — Create command entry point, add preservation check, flag handling, and monorepo dispatch to workflow
**UI hint**: no

### Phase 4: Verification Gate & Test Suite
**Goal**: Every factual claim in generated docs is checked against the live codebase, flagged inaccuracies are corrected in a bounded fix loop, and gsd-tools commands have node:test coverage
**Depends on**: Phase 3
**Requirements**: VERF-01, VERF-02, VERF-03
**Success Criteria** (what must be TRUE):
  1. `agents/gsd-doc-verifier.md` checks file paths, commands, endpoints, and function signatures using filesystem tools (Read, Grep, Glob, Bash) — not self-consistency checks
  2. Flagged inaccuracies are re-sent to the doc-writer for surgical correction; the loop runs at most 2 times and halts if a fact regresses between iterations
  3. Secret scanning runs before any commit and follows the same pattern as map-codebase
  4. `tests/docs-update.test.cjs` covers all new gsd-tools.cjs subcommands using node:test and node:assert/strict exclusively
**Plans**: 3 plans
Plans:
- [x] 04-01-PLAN.md — Create gsd-doc-verifier agent and add fix_mode to gsd-doc-writer
- [x] 04-02-PLAN.md — Extend docs-update workflow with verification gate, fix loop, and secret scanning
- [x] 04-03-PLAN.md — Create docs-init test suite (node:test + node:assert/strict)

### Phase 5: Refinement of docs output
**Goal**: Generated docs land in the correct directory (docs/ by default), existing non-canonical docs are scanned and verified for accuracy, and new CONTRIBUTING.md creation requires user confirmation
**Depends on**: Phase 4
**Requirements**: REFINE-01, REFINE-02, REFINE-03
**Success Criteria** (what must be TRUE):
  1. Generated docs (except README.md and CONTRIBUTING.md) are written to the `docs/` directory by default, with root-level fallback for existing files
  2. `scanExistingDocs` recursively scans `docs/` subdirectories up to 4 levels deep, finding files like `docs/api/endpoint-map.md`
  3. Non-canonical existing docs are queued for verification-only review (not rewriting) and failures are reported with "manual correction recommended"
  4. New CONTRIBUTING.md creation prompts user for confirmation unless `--force` is passed or the file already exists
**Plans**: 2 plans
Plans:
- [ ] 05-01-PLAN.md — Fix recursive docs/ scanning in docs.cjs and update doc-writer default path guidance
- [ ] 05-02-PLAN.md — Invert workflow path table, add CONTRIBUTING confirmation gate, and existing doc review queue

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure & Agent Skeleton | 2/2 | Complete   | 2026-03-30 |
| 2. Workflow Orchestration | 1/1 | Complete   | 2026-03-30 |
| 3. Full Doc Generation & Existing Doc Handling | 2/2 | Complete   | 2026-03-30 |
| 4. Verification Gate & Test Suite | 3/3 | Complete   | 2026-03-30 |
| 5. Refinement of docs output | 0/2 | Planned | — |
