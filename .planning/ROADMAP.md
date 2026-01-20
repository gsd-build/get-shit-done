# Roadmap: GSD Constitutional Enforcement

## Overview

Transform GSD from convention-documented to convention-enforced through constitutional system. Five phases build from foundation files through TDD validation to checkpoint enforcement and retroactive application, delivering automated TDD-first validation that prevents executors from writing features before tests exist.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Constitution Foundation** - Files, loading, versioning, severity system
- [ ] **Phase 2: TDD Commit Validation** - Evidence-based TDD enforcement
- [ ] **Phase 3: Enforcement Infrastructure** - Override mechanism, audit trail
- [ ] **Phase 4: Verifier Integration** - Checkpoint validation in phase workflow
- [ ] **Phase 5: Retroactive Application** - Migration tooling, progressive rollout
- [ ] **Phase 6: TDD-First Workflow & Security Compliance** - Planner TDD enforcement, security compliance levels, quality verification
- [ ] **Phase 7: Repository Contribution** - Copy local GSD changes to repository for PR

## Phase Details

### Phase 1: Constitution Foundation
**Goal**: Constitutional files exist with loading system that merges global + project rules, including TDD and security enforcement
**Depends on**: Nothing (first phase)
**Requirements**: CONST-01, CONST-02, CONST-03, CONST-04, CONST-05, SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, SEC-07, DOC-01, DOC-02, DOC-03, DOC-04
**Success Criteria** (what must be TRUE):
  1. Global CONSTITUTION.md exists at `~/.claude/get-shit-done/CONSTITUTION.md` with NON-NEGOTIABLE/ERROR/WARNING sections
  2. Per-project CONSTITUTION.md template exists at `.planning/CONSTITUTION.md`
  3. Constitution loader merges global + project rules with project override precedence
  4. Constitution versioning prevents retroactive breaks through version field
  5. TDD-01 rule documented (test before implementation)
  6. Security rules documented: SEC-01 (no hardcoded secrets), SEC-02 (parameterized queries), SEC-03 (input validation), SEC-04 (output sanitization), SEC-05 (auth checks), SEC-06 (secure dependencies), SEC-07 (no data exposure)
  7. Anti-patterns documented with rationale explaining why each rule exists
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — Constitution file templates (global + project)
- [ ] 01-02-PLAN.md — Constitution loader with TDD (parse, merge, validate)
- [ ] 01-03-PLAN.md — System integration (install + new-project workflows)

### Phase 2: TDD Commit Validation
**Goal**: TDD validator analyzes git history to detect test-before-implementation violations
**Depends on**: Phase 1
**Requirements**: TDD-01, TDD-02, TDD-03, TDD-04
**Success Criteria** (what must be TRUE):
  1. Validator parses git history for commit range within phase
  2. Validator detects test files using naming conventions (*.test.js, *.spec.js, __tests__/)
  3. Validator identifies test committed before corresponding implementation through timestamp comparison
  4. Violations reported with specific file, commit hash, and timestamp evidence
**Plans**: TBD

Plans:
- [ ] 02-01: TBD

### Phase 3: Enforcement Infrastructure
**Goal**: Override mechanism with required justification prevents bypass abuse
**Depends on**: Phase 2
**Requirements**: ENFORCE-01, ENFORCE-02, ENFORCE-03, ENFORCE-04
**Success Criteria** (what must be TRUE):
  1. Error-level violations block verification with clear prompt for override
  2. Override requires user-provided justification (free-form text)
  3. All overrides logged to STATE.md with timestamp, rule ID, and reason
  4. Override metrics tracked per-rule for effectiveness monitoring
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: Verifier Integration
**Goal**: Constitutional validation integrated as Step 10 in gsd-verifier workflow
**Depends on**: Phase 3
**Requirements**: VERIFY-01, VERIFY-02, VERIFY-03, VERIFY-04
**Success Criteria** (what must be TRUE):
  1. gsd-verifier extended with constitutional validation step after goal verification
  2. Validator runs at phase completion checkpoint (not pre-commit)
  3. Violations surfaced in VERIFICATION.md with severity, details, and fix guidance
  4. Verifier returns gaps_found status when constitutional violations block completion
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

### Phase 5: Retroactive Application
**Goal**: Existing GSD projects can adopt constitutional enforcement through migration path
**Depends on**: Phase 4
**Requirements**: RETRO-01, RETRO-02, RETRO-03, RETRO-04
**Success Criteria** (what must be TRUE):
  1. Migration tooling upgrades existing projects to constitution version 1
  2. Projects opt-out through constitution_version field in config.json
  3. Grandfather clause allows existing projects to pin to version 0 (no enforcement)
  4. New projects default to latest constitution version automatically
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

### Phase 6: TDD-First Workflow & Security Compliance
**Goal**: GSD planner enforces TDD-first for logic plans, includes security compliance levels, verifier checks quality metrics
**Depends on**: Phase 1 (uses constitution structure)
**Requirements**: TDD-FLOW-01, TDD-FLOW-02, TDD-FLOW-03, SEC-COMPLY-01, SEC-COMPLY-02, QUALITY-01, QUALITY-02
**Success Criteria** (what must be TRUE):
  1. new-project.md asks security compliance level (none/soc2/hipaa/pci-dss/iso27001)
  2. Security compliance stored in PROJECT.md and config.json
  3. gsd-planner creates type:tdd plans for logic with 4 test categories (acceptance, edge, security, performance)
  4. Security tests in plans match project compliance level
  5. gsd-verifier checks quality must_haves (coverage, security, vulnerabilities)
  6. Refactor plans auto-added when 3+ feature plans in phase
  7. Reference file security-compliance.md exists with test templates per level
**Plans**: 4 plans

Plans:
- [ ] 06-01-PLAN.md — Security compliance question in new-project + config storage
- [ ] 06-02-PLAN.md — Planner TDD-first enforcement with test categories
- [ ] 06-03-PLAN.md — Verifier quality checks extension
- [ ] 06-04-PLAN.md — Security compliance reference file

### Phase 7: Repository Contribution
**Goal**: Copy all Phase 6 changes from local GSD install (~/.claude/) to repository files for PR submission
**Depends on**: Phase 6
**Requirements**: None (operational task)
**Success Criteria** (what must be TRUE):
  1. All modified GSD files copied from ~/.claude/ to corresponding repo locations
  2. Repository structure mirrors GSD install structure
  3. Changes committed with clear commit message
  4. PR created with summary of Phase 6 features
**Plans**: 1 plan

Plans:
- [ ] 07-01-PLAN.md — Copy GSD changes to repo and create PR

**Files to copy:**
| Source (GSD Install) | Destination (Repo) |
|---------------------|-------------------|
| `~/.claude/get-shit-done/references/security-compliance.md` | `references/security-compliance.md` |
| `~/.claude/get-shit-done/references/tdd.md` | `references/tdd.md` |
| `~/.claude/commands/gsd/new-project.md` | `commands/gsd/new-project.md` |
| `~/.claude/get-shit-done/workflows/verify-phase.md` | `workflows/verify-phase.md` |
| `~/.claude/agents/gsd-planner.md` | `agents/gsd-planner.md` |
| `~/.claude/agents/gsd-executor.md` | `agents/gsd-executor.md` |

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Constitution Foundation | 0/3 | Ready to execute | - |
| 2. TDD Commit Validation | 0/TBD | Not started | - |
| 3. Enforcement Infrastructure | 0/TBD | Not started | - |
| 4. Verifier Integration | 0/TBD | Not started | - |
| 5. Retroactive Application | 0/TBD | Not started | - |
| 6. TDD-First Workflow | 0/4 | Implemented (local) | - |
| 7. Repository Contribution | 0/1 | Ready to execute | - |
