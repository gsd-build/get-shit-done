# Requirements: /gsd:docs-update

**Defined:** 2026-03-29
**Core Value:** Documentation that is verified accurate against the codebase — no hallucinated paths, phantom endpoints, or stale signatures.

## v1 Requirements

Requirements for this contribution. Each maps to roadmap phases.

### Command Infrastructure

- [x] **INFRA-01**: gsd-tools init returns JSON context with project signals, existing docs, model resolution
- [x] **INFRA-02**: docs-update case wired into gsd-tools.cjs switch with help text
- [x] **INFRA-03**: Command entry point (commands/gsd/docs-update.md) with --force and --verify-only flags
- [x] **INFRA-04**: Workflow orchestration (workflows/docs-update.md) with 13-step process
- [ ] **INFRA-05**: Cross-runtime sequential fallback when Task tool unavailable

### Documentation Generation

- [x] **DOCG-01**: gsd-doc-writer agent with dynamic assignment list, create and update modes
- [x] **DOCG-02**: 9 doc types: README, ARCHITECTURE, GETTING-STARTED, DEVELOPMENT, TESTING, API, CONFIGURATION, DEPLOYMENT, CONTRIBUTING
- [x] **DOCG-03**: Project type detection (open source library, private SaaS, CLI tool, monorepo)
- [x] **DOCG-04**: Conditional doc routing — API.md only for API projects, CONTRIBUTING.md only for open source, DEPLOYMENT.md only for projects with deploy config
- [ ] **DOCG-05**: Parallel subagent spawning with confirmation-only returns (same pattern as map-codebase)
- [x] **DOCG-06**: VERIFY markers for undiscoverable infrastructure claims
- [x] **DOCG-07**: Update mode preserves user-written content, updates only inaccurate/missing sections
- [x] **DOCG-08**: Embedded doc templates in agent definition (no external template dependencies)

### Verification

- [ ] **VERF-01**: Verification gate checks file paths, commands, endpoints, signatures, config, dependencies against codebase
- [ ] **VERF-02**: Bounded fix loop — max 2 iterations, re-sends flagged items to doc-writer
- [ ] **VERF-03**: Secret scanning before commit (same pattern as map-codebase)

### Existing Doc Handling

- [x] **EXIST-01**: Detect hand-written docs (no GSD marker) vs GSD-generated docs
- [x] **EXIST-02**: Preserve/supplement/regenerate choice per hand-written file
- [x] **EXIST-03**: Doc tooling detection (Docusaurus, VitePress, MkDocs, Storybook) — respect their structure
- [x] **EXIST-04**: Monorepo awareness — detect workspaces, per-package docs when appropriate

### Constraints

- [x] **CONS-01**: CHANGELOG.md is out of scope
- [x] **CONS-02**: No GSD methodology content in generated docs
- [x] **CONS-03**: CommonJS (.cjs), no external dependencies in core
- [x] **CONS-04**: Evidence-based infrastructure docs only — never fabricate claims

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| CHANGELOG.md generation | GSD handles this in /gsd:ship |
| GSD methodology in docs | Docs describe the project, not the tool |
| Auto-generated API docs from comments | Reference existing specs (TypeDoc, JSDoc) rather than duplicate |
| Documentation hosting/deployment | Just generates the files |
| Inline code comment generation | Different concern, different tool |
| Canonical glossary pre-pass | Research addition, not in contribution scope |
| llms.txt generation | Research addition, not in contribution scope |
| Fix loop regression detection | Research addition, not in contribution scope |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 3 | Complete |
| INFRA-04 | Phase 2 | Complete |
| INFRA-05 | Phase 2 | Pending |
| DOCG-01 | Phase 1 | Complete |
| DOCG-02 | Phase 3 | Complete |
| DOCG-03 | Phase 2 | Complete |
| DOCG-04 | Phase 2 | Complete |
| DOCG-05 | Phase 2 | Pending |
| DOCG-06 | Phase 3 | Complete |
| DOCG-07 | Phase 3 | Complete |
| DOCG-08 | Phase 1 | Complete |
| VERF-01 | Phase 4 | Pending |
| VERF-02 | Phase 4 | Pending |
| VERF-03 | Phase 4 | Pending |
| EXIST-01 | Phase 3 | Complete |
| EXIST-02 | Phase 3 | Complete |
| EXIST-03 | Phase 3 | Complete |
| EXIST-04 | Phase 3 | Complete |
| CONS-01 | Phase 2 | Complete |
| CONS-02 | Phase 2 | Complete |
| CONS-03 | Phase 1 | Complete |
| CONS-04 | Phase 2 | Complete |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0

---
*Requirements defined: 2026-03-29*
*Last updated: 2026-03-29 — traceability filled after roadmap creation*
