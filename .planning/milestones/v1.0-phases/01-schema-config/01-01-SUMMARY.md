---
phase: 01-schema-config
plan: "01"
subsystem: templates
tags: [sme, template, schema, document-format]
dependency_graph:
  requires: []
  provides:
    - get-shit-done/templates/sme.md
  affects:
    - Phase 2 SDK query handlers (read template format)
    - Phase 3 creator agent (writes SME documents to this format)
    - Phase 5 auditor agent (validates documents against this format)
tech_stack:
  added: []
  patterns:
    - YAML frontmatter with nested objects (finding_counts)
    - HTML-commented example findings as creator guidance
    - Six flat H2 sections in fixed order
key_files:
  created:
    - get-shit-done/templates/sme.md
  modified: []
decisions:
  - "D-04: Frontmatter uses nested YAML for finding_counts with 2-space indentation for frontmatter.cjs round-trip compatibility"
  - "D-03: Six flat H2 sections in fixed order (no subsystem grouping — findings organized by type)"
  - "D-01/D-02: All four finding fields required (severity tag, bold title, evidence with file:line, concrete mitigation)"
  - "D-08: HTML-commented examples per section guide the creator agent; stripped when real findings added"
metrics:
  duration: "~1 minute"
  completed_date: "2026-04-28"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
requirements:
  - SCHEMA-01
  - SCHEMA-02
  - SCHEMA-03
  - SCHEMA-04
requirements-completed: [SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04]
---

# Phase 01 Plan 01: SME Document Template Summary

**One-liner:** Blank SME document template with YAML frontmatter (5 fields, nested finding_counts), six H2 sections in fixed order, and HTML-commented examples demonstrating all three severity levels (BLOCKER/WARNING/WATCH) with all four required sub-fields.

## What Was Built

Created `get-shit-done/templates/sme.md` — the single source of truth for the SME document contract. This file defines:

- **YAML frontmatter** with five fields: `process_name`, `last_analyzed_commit`, `block_mode` (defaults to `soft`), `created_date`, and nested `finding_counts` (blocker/warning/watch)
- **Six H2 sections** in fixed order: Process Overview, Identified Risks, Test Gaps, Outdated Logic, Edge Cases, Known Blockers
- **Process Overview** with a prose placeholder (no finding format — this section is always narrative)
- **Five finding sections** each with an HTML-commented example demonstrating the complete required format

The template uses placeholder tokens in `[BRACKET_CAPS]` style and HTML-comment guidance so the Phase 3 creator agent knows exactly what format to produce.

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create SME document template | e67aa3b5 | `get-shit-done/templates/sme.md` (created) |

## Verification Results

All automated checks passed:

- `grep -c "^## " get-shit-done/templates/sme.md` outputs `6` — correct section count
- All 5 frontmatter fields present: `process_name`, `last_analyzed_commit`, `block_mode`, `created_date`, `finding_counts`
- Nested `finding_counts` with `blocker: 0`, `warning: 0`, `watch: 0` at 2-space indent
- At least one `[BLOCKER]`, one `[WARNING]`, one `[WATCH]` severity example across sections
- All example findings have: severity tag, bold title, `*Evidence:*` with backtick file:line, `*Mitigation:*` with concrete action
- `frontmatter.cjs` round-trip confirmed — all 5 fields parse correctly including nested `finding_counts`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — the template is intentionally blank (placeholder tokens only). It is the template itself, not an SME document. No real findings are expected or present.

## Threat Flags

None — the template file is project-internal, authored by GSD developers, not user-supplied. No new network endpoints, auth paths, or trust boundaries introduced.

## Self-Check: PASSED

- `get-shit-done/templates/sme.md` exists: FOUND
- Commit `e67aa3b5` exists: FOUND
- 6 H2 sections verified: FOUND
- All 5 frontmatter fields verified: FOUND
- All 3 severity levels (BLOCKER/WARNING/WATCH) present: FOUND
- All 4 finding sub-fields (severity, title, evidence, mitigation) verified: FOUND
