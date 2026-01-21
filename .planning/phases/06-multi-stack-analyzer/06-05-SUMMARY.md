---
phase: 06-multi-stack-analyzer
plan: 05
subsystem: intelligence
tags: [entity-template, entity-generator, stack-awareness, frontmatter, metadata]

# Dependency graph
requires:
  - phase: 06-02
    provides: Stack profiles YAML with stack IDs for all languages
  - phase: 06-03
    provides: Stack analyzer subagent that detects stacks
provides:
  - Entity template with stack and framework frontmatter fields
  - Entity generator subagent with stack detection from file extension
  - Framework detection from import patterns
  - Stack field requirement in entity generation
affects:
  - 06-06 (Integration testing will verify stack fields in generated entities)
  - Future entity generation (all entities now include stack metadata)
  - Graph queries (enables filtering by programming language)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Stack detection from file extension in entity generator
    - Optional framework field (only when detected)
    - Stack field matches stack-profiles.yaml IDs

key-files:
  created: []
  modified:
    - get-shit-done/templates/entity.md
    - agents/gsd-entity-generator.md

key-decisions:
  - "Stack field derived from file extension (.ts -> typescript, .py -> python, etc.)"
  - "Framework field is optional (only when framework-specific imports detected)"
  - "Framework field omitted when not detected (not set to null or 'none')"
  - "Stack values match stack IDs from hooks/lib/stack-profiles.yaml"

patterns-established:
  - "Entity frontmatter: path, type, stack, framework, updated, status"
  - "Extension-to-stack mapping table (12 languages)"
  - "Framework detection from common import patterns"

# Metrics
duration: 2min
completed: 2026-01-21
---

# Phase 6 Plan 5: Entity Template Update Summary

**Entity template and generator now include stack/framework metadata, enabling language-filtered queries in polyglot codebases**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-21T03:36:09Z
- **Completed:** 2026-01-21T03:38:01Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Entity template updated with stack and framework frontmatter fields
- Entity generator subagent includes stack detection from file extensions
- Framework detection documented with common import patterns
- Stack field requirement added to entity generation critical rules

## Task Commits

Each task was committed atomically:

1. **Task 1: Update entity template with stack fields** - `92af899` (feat)
   - Added stack and framework to frontmatter template
   - Updated field reference table with new fields
   - Added guidance section explaining stack and framework usage
   - Updated example entity to show stack fields

2. **Task 2: Update gsd-entity-generator for stack awareness** - `6d593e8` (feat)
   - Added stack and framework to entity template frontmatter
   - Updated file analysis to include stack detection from extension
   - Added stack detection table (12 languages)
   - Added framework detection from imports guidance
   - Updated critical rules to require stack field

## Files Created/Modified

- `get-shit-done/templates/entity.md` - Added stack and framework fields to entity template, added guidance section
- `agents/gsd-entity-generator.md` - Added stack detection logic, extension mapping, framework detection patterns

## Decisions Made

**Stack detection approach:**
- Use file extension as primary indicator (.ts -> typescript, .py -> python, .cs -> csharp, etc.)
- 12 languages supported initially (matches stack-profiles.yaml)
- Stack values must match stack IDs from stack-profiles.yaml for consistency

**Framework field handling:**
- Framework field is optional (only included when detected)
- Detection based on import patterns (e.g., "import React" -> react, "from django" -> django)
- Omit field entirely when no framework detected (don't use "none" or "unknown")
- Keeps frontmatter clean and avoids false data

**Template consistency:**
- Stack field required in entity generation (critical rule)
- Framework field optional (only when imports indicate framework)
- Frontmatter order: path, type, stack, framework, updated, status

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

**Ready for integration testing (06-06):**
- Entity template includes stack fields in frontmatter
- Entity generator knows how to determine stack from extension
- Framework detection patterns documented for common frameworks
- Stack values align with stack-profiles.yaml IDs

**What's enabled:**
- Entities can now be filtered by programming language in graph queries
- Users can ask "find all Python models" or "show TypeScript components"
- Multi-stack codebases can be analyzed with per-stack intelligence
- Framework detection helps understand conventions in use

**Notes:**
- PostToolUse hook will need to parse stack/framework fields from entity frontmatter
- Graph queries can use stack field for language-filtered results
- Existing entities without stack field will need migration or regeneration

---
*Phase: 06-multi-stack-analyzer*
*Completed: 2026-01-21*
