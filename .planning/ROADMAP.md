# Roadmap: GSD Document Ingestion Enhancement

## Overview

This enhancement adds user-provided documentation support to `/gsd:map-codebase`. The journey moves from collecting user docs (Phase 1), to validating them against actual code (Phase 2), to making them available throughout GSD workflows (Phase 3), and finally documenting the feature for users (Phase 4). Each phase delivers independently testable functionality.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Document Ingestion Core** - Collect and store user-provided docs during map-codebase
- [ ] **Phase 2: Document Validation** - Validate doc claims against actual codebase
- [ ] **Phase 3: Workflow Integration** - Make validated docs available to downstream phases
- [ ] **Phase 4: Documentation and Release** - User-facing docs and release prep

## Phase Details

### Phase 1: Document Ingestion Core
**Goal**: Users can provide existing documentation during map-codebase and have it stored for later use
**Depends on**: Nothing (first phase)
**Requirements**: ARCH-01, ARCH-03, ARCH-04, ING-01, ING-02, ING-03, ING-04
**Success Criteria** (what must be TRUE):
  1. User running `/gsd:map-codebase` is prompted for existing documentation
  2. User can provide one or more file paths and see them acknowledged
  3. User can skip ("no docs") and map-codebase continues normally
  4. Provided docs appear in `.planning/codebase/USER-CONTEXT.md`
  5. Sub-agent handles ingestion (not inline in orchestrator workflow)
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md — Create gsd-doc-ingestor agent
- [ ] 01-02-PLAN.md — Integrate doc prompting into map-codebase workflow

### Phase 2: Document Validation
**Goal**: User-provided docs are validated against actual codebase before integration
**Depends on**: Phase 1
**Requirements**: ARCH-02, VAL-01, VAL-02, VAL-03, VAL-04
**Success Criteria** (what must be TRUE):
  1. Claims in user docs are cross-checked against actual code
  2. Stale or contradictory information is flagged with explanation
  3. User is prompted to decide on docs with validation issues (include/exclude)
  4. Each verified claim shows confidence level (HIGH/MEDIUM/LOW)
  5. Validation uses dedicated sub-agent following gsd-verifier patterns
**Plans**: TBD

Plans:
- [ ] 02-01: TBD

### Phase 3: Workflow Integration
**Goal**: Validated user docs are available to all downstream GSD phases
**Depends on**: Phase 2
**Requirements**: WFL-01, WFL-02, WFL-03, WFL-04
**Success Criteria** (what must be TRUE):
  1. plan-phase command can reference user docs when planning
  2. execute-phase command has access to user context during implementation
  3. discuss-phase command uses user docs to inform discussion
  4. Only docs relevant to current phase type are loaded (smart selection)
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: Documentation and Release
**Goal**: Feature is documented for users and ready for release
**Depends on**: Phase 3
**Requirements**: DOC-01, DOC-02, REL-01
**Success Criteria** (what must be TRUE):
  1. GSD help/docs explain the document ingestion feature
  2. Usage example shows how to provide documentation
  3. Changelog includes new functionality description
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Document Ingestion Core | 0/2 | Planned | - |
| 2. Document Validation | 0/TBD | Not started | - |
| 3. Workflow Integration | 0/TBD | Not started | - |
| 4. Documentation and Release | 0/TBD | Not started | - |

---
*Roadmap created: 2026-01-19*
*Last updated: 2026-01-19*
