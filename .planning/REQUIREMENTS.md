# Requirements: /gsd:docs-update

**Defined:** 2026-03-29
**Core Value:** Documentation that is verified accurate against the codebase — no hallucinated paths, phantom endpoints, or stale signatures.

## v1 Requirements

Requirements for this contribution. Each maps to roadmap phases.

### Command Infrastructure

- [ ] **INFRA-01**: gsd-tools init returns JSON context with project signals, existing docs, model resolution
- [ ] **INFRA-02**: docs-update case wired into gsd-tools.cjs switch with help text
- [ ] **INFRA-03**: Command entry point (commands/gsd/docs-update.md) with --force and --verify-only flags
- [ ] **INFRA-04**: Workflow orchestration (workflows/docs-update.md) with 13-step process
- [ ] **INFRA-05**: Cross-runtime sequential fallback when Task tool unavailable

### Documentation Generation

- [x] **DOCG-01**: gsd-doc-writer agent with dynamic assignment list, create and update modes
- [ ] **DOCG-02**: 9 doc types: README, ARCHITECTURE, GETTING-STARTED, DEVELOPMENT, TESTING, API, CONFIGURATION, DEPLOYMENT, CONTRIBUTING
- [ ] **DOCG-03**: Project type detection (open source library, private SaaS, CLI tool, monorepo)
- [ ] **DOCG-04**: Conditional doc routing — API.md only for API projects, CONTRIBUTING.md only for open source, DEPLOYMENT.md only for projects with deploy config
- [ ] **DOCG-05**: Parallel subagent spawning with confirmation-only returns (same pattern as map-codebase)
- [ ] **DOCG-06**: VERIFY markers for undiscoverable infrastructure claims
- [ ] **DOCG-07**: Update mode preserves user-written content, updates only inaccurate/missing sections
- [x] **DOCG-08**: Embedded doc templates in agent definition (no external template dependencies)

### Verification

- [ ] **VERF-01**: Verification gate checks file paths, commands, endpoints, signatures, config, dependencies against codebase
- [ ] **VERF-02**: Bounded fix loop — max 2 iterations, re-sends flagged items to doc-writer
- [ ] **VERF-03**: Secret scanning before commit (same pattern as map-codebase)

### Existing Doc Handling

- [ ] **EXIST-01**: Detect hand-written docs (no GSD marker) vs GSD-generated docs
- [ ] **EXIST-02**: Preserve/supplement/regenerate choice per hand-written file
- [ ] **EXIST-03**: Doc tooling detection (Docusaurus, VitePress, MkDocs, Storybook) — respect their structure
- [ ] **EXIST-04**: Monorepo awareness — detect workspaces, per-package docs when appropriate

### Constraints

- [ ] **CONS-01**: CHANGELOG.md is out of scope
- [ ] **CONS-02**: No GSD methodology content in generated docs
- [ ] **CONS-03**: CommonJS (.cjs), no external dependencies in core
- [ ] **CONS-04**: Evidence-based infrastructure docs only — never fabricate claims

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
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 3 | Pending |
| INFRA-04 | Phase 2 | Pending |
| INFRA-05 | Phase 2 | Pending |
| DOCG-01 | Phase 1 | Complete |
| DOCG-02 | Phase 3 | Pending |
| DOCG-03 | Phase 2 | Pending |
| DOCG-04 | Phase 2 | Pending |
| DOCG-05 | Phase 2 | Pending |
| DOCG-06 | Phase 3 | Pending |
| DOCG-07 | Phase 3 | Pending |
| DOCG-08 | Phase 1 | Complete |
| VERF-01 | Phase 4 | Pending |
| VERF-02 | Phase 4 | Pending |
| VERF-03 | Phase 4 | Pending |
| EXIST-01 | Phase 3 | Pending |
| EXIST-02 | Phase 3 | Pending |
| EXIST-03 | Phase 3 | Pending |
| EXIST-04 | Phase 3 | Pending |
| CONS-01 | Phase 2 | Pending |
| CONS-02 | Phase 2 | Pending |
| CONS-03 | Phase 1 | Pending |
| CONS-04 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0

---
*Requirements defined: 2026-03-29*
*Last updated: 2026-03-29 — traceability filled after roadmap creation*
