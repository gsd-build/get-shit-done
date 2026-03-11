# Requirements: GSD v1.13.0 — Product Discovery & Docs Automation

**Defined:** 2026-03-11
**Milestone:** v1.13.0 — Product Discovery & Docs Automation
**Core Value:** Claude learns to make autonomous decisions based on the user's reasoning patterns, only stopping for actions that are irreversible, external, or cost money.

## v1 Requirements

### PRD Workflow (gsd:prd)

- [ ] **PRD-01**: User can run `gsd:prd` with a concept description (text, file path, or URL to existing PRD) to initiate PRD maturation
- [ ] **PRD-02**: PM Discovery stage performs web research on competitive landscape then runs multi-round Q&A (max 4 questions/round) until confidence is sufficient to advance — agent states confidence and blocking gaps explicitly each round
- [ ] **PRD-03**: PO/BA Scoping stage reads existing codebase and `.planning/prds/done/` for dependency context, defines user stories and acceptance criteria through Q&A, and draws MVP vs Phase 2 boundary
- [ ] **PRD-04**: HL Tech Discovery stage identifies technology candidates and architectural constraints through research — explicitly does NOT write schemas, API routes, or implementation code (those belong to GSD's research phase)
- [ ] **PRD-05**: Completed PRD is stored at `.planning/prds/pending/{name}.md` in product-oriented format (WHAT/WHY: problem, goals, user stories, acceptance criteria, tech candidates, open questions — no HOW)
- [ ] **PRD-06**: PRD includes an explicit assumptions list (things assumed but not confirmed) that GSD's research phase can validate during implementation

### Milestone PRD Integration (gsd:new-milestone)

- [ ] **MILE-01**: When invoked, `gsd:new-milestone` detects pending PRDs in `.planning/prds/pending/` and presents them as selectable options before asking "what to build next"
- [ ] **MILE-02**: When a PRD is selected, milestone phase decomposition is fully autonomous — agent reads PRD and derives phases with dependency ordering without requiring manual phase definition from user
- [ ] **MILE-03**: User sees proposed roadmap (phase names, goals, requirement coverage) as a single approval checkpoint before any branch or planning files are created
- [ ] **MILE-04**: On roadmap approval, selected PRD moves from `.planning/prds/pending/` to `.planning/prds/done/`

### Docs Automation

- [ ] **DOCS-01**: Phase executor runs a Haiku docs agent as the last mandatory task in the final execution wave, after all feature work is committed
- [ ] **DOCS-02**: Docs agent scales output to what was built: new API endpoint → create/update `api/` file; new UI (backoffice or player) → create/update `frontend-operator/` or `frontend-player/` file; architectural decision → append to `architecture/` doc; internal refactoring → minimal changelog entry only
- [ ] **DOCS-03**: Phase verifier validates that docs were updated appropriately relative to what was built in the phase — flags as gap if docs agent was skipped or output does not match build scope
- [ ] **DOCS-04**: Docs agent reads existing `/docs` templates and frontmatter conventions from the target project before writing, producing content that matches the project's established style
- [ ] **DOCS-05**: Guard behavior: if `/docs` exists in the project → update existing files where relevant, create new files for new surfaces; if `/docs` does not exist → create the folder and seed with what was built. Content must be thin, focused, and useful for both AI agents and human developers — no padding, no invented content.

## v2 Requirements

### PRD Workflow

- **PRD-07**: PRD maturation supports batch mode — process multiple concept descriptions in sequence, storing each to pending
- **PRD-08**: `gsd:prd` can accept a URL to a competitor's feature/product page and use it as PM Discovery research seed
- **PRD-09**: PRD confidence score is surfaced to user so they can override "advance to next stage" decision

### Docs Automation

- **DOCS-06**: Milestone closure triggers a full docs audit — Haiku agent reviews all `/docs` against what shipped in the milestone, updates stale content, and creates an index if missing
- **DOCS-07**: Docs agent generates a cross-module integration map when multiple modules are built in the same milestone

## Out of Scope

| Feature | Reason |
|---------|---------|
| Automatic PRD generation without user input | PRD maturation is collaborative; user input validates product intent |
| Technical spec generation in `gsd:prd` | HOW questions are answered by GSD's research phase, not the PRD workflow |
| PRD version control / diff tracking | Git handles version history; no separate versioning needed |
| Public docs site generation | `/docs` is for internal AI/developer use; publishing is out of scope |
| Retroactive docs for all existing code | Only docs for newly built phase output; full historical docs is a separate initiative |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PRD-01 | Phase 41 | Pending |
| PRD-02 | Phase 41 | Pending |
| PRD-03 | Phase 41 | Pending |
| PRD-04 | Phase 41 | Pending |
| PRD-05 | Phase 41 | Pending |
| PRD-06 | Phase 41 | Pending |
| MILE-01 | Phase 42 | Pending |
| MILE-02 | Phase 42 | Pending |
| MILE-03 | Phase 42 | Pending |
| MILE-04 | Phase 42 | Pending |
| DOCS-01 | Phase 43 | Pending |
| DOCS-02 | Phase 43 | Pending |
| DOCS-03 | Phase 43 | Pending |
| DOCS-04 | Phase 43 | Pending |
| DOCS-05 | Phase 43 | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-11*
*Last updated: 2026-03-11 after initial definition*
