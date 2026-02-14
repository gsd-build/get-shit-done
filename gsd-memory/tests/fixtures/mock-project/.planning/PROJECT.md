# MockProject

## What This Is

A test project for validating GSD memory extraction. Contains all expected document types and frontmatter structures.

## Core Value

Test coverage for GSD memory extractors.

## Requirements

### Validated

- ✓ Extractor parses SUMMARY.md frontmatter — Phase 1

### Active

- [ ] Cross-project search works
- [ ] Decision extraction includes rationale

### Out of Scope

- Production deployment — test fixture only

## Context

Mock project used in GSD memory test suite.

## Constraints

- **Tech stack**: TypeScript, Vitest
- **Scope**: Test fixtures only

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| YAML frontmatter | Machine-readable metadata | ✓ Good |
| Gray-matter parser | Battle-tested, handles edge cases | — Pending |

---
*Last updated: 2025-01-20 after creation*
