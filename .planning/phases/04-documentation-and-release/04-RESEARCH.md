# Phase 4: Documentation and Release - Research

**Researched:** 2026-01-19
**Domain:** CLI tool documentation and changelog maintenance
**Confidence:** HIGH

## Summary

Phase 4 is a documentation-only phase with three deliverables: README update, /help output update, and CHANGELOG entry. The research domain is the existing GSD documentation patterns rather than external libraries or frameworks.

The codebase already has well-established documentation patterns. README.md uses markdown with collapsible details, tables for command references, and code blocks for examples. The help.md command outputs a structured reference document. CHANGELOG.md follows Keep a Changelog format with version headers and categorized entries.

**Primary recommendation:** Follow existing documentation patterns exactly. The feature to document (user-provided documentation ingestion) is already implemented in map-codebase workflow. Documentation should describe what exists, not invent new patterns.

## Standard Stack

No external libraries needed. This phase uses only existing file formats.

### Core
| File | Format | Purpose | Location |
|------|--------|---------|----------|
| README.md | Markdown | Public documentation | Project root |
| help.md | Claude Code slash command | In-tool help reference | `commands/gsd/help.md` |
| CHANGELOG.md | Keep a Changelog 1.1.0 | Version history | Project root |

### Existing Patterns
| Pattern | Example | Where Used |
|---------|---------|------------|
| Callout boxes | `> [!TIP]` | README line 129 |
| Collapsible sections | `<details><summary>` | README lines 94-104 |
| Command tables | `\| Command \| What it does \|` | README lines 387-432 |
| Code blocks with lang | ` ```bash ` | Throughout README |
| Section headers | `### Command Name` | help.md command sections |

## Architecture Patterns

### README Structure (Existing)
```
README.md
- Header (badges, install command)
- "Why I Built This" (philosophy)
- "Who This Is For" (audience)
- "Getting Started" (install, verify)
- "How It Works" (step-by-step workflow)  <-- ADD DOC INGESTION HERE
  - Brownfield callout at top
  - Step 1-6 workflow sections
- "Why It Works" (technical explanation)
  - Context Engineering
  - XML Prompt Formatting
  - Multi-Agent Orchestration
  - Atomic Git Commits
- "Commands" (reference tables)
- "Troubleshooting"
- Footer
```

### Help.md Structure (Existing)
```
help.md
- <objective> (display only, no analysis)
- <reference>
  - Quick Start
  - Core Workflow
  - Project Initialization section  <-- map-codebase ALREADY DOCUMENTED
    - /gsd:new-project
    - /gsd:map-codebase  <-- ADD DOC INGESTION MENTION HERE
  - Phase Planning section
  - Execution section
  - ...
  - Files & Structure
  - Workflow Modes
  - Common Workflows
  - Getting Help
```

### CHANGELOG Structure (Existing)
```
CHANGELOG.md
- Header with Keep a Changelog link
- ## [Unreleased]  <-- ADD ENTRY HERE
- ## [1.6.4] - 2026-01-17
  - ### Fixed (bug fixes)
  - ### Added (new features)
  - ### Changed (modifications)
  - ### Removed (removed features)
- ... older versions
- Link references at bottom
```

### Anti-Patterns to Avoid
- **Top-level README sections for minor features:** Per CONTEXT.md, nest under existing section, not new top-level
- **Separate /help section for doc ingestion:** Per CONTEXT.md, mention alongside map-codebase, not separate
- **Verbose prose:** Per CONTEXT.md, concise and technical, one sentence on benefits then mechanics
- **Internal explanation:** Per CONTEXT.md, black box approach, don't explain validation/confidence internals

## Don't Hand-Roll

Not applicable - this is documentation work, not code.

## Common Pitfalls

### Pitfall 1: Over-documenting internals
**What goes wrong:** Explaining validation confidence levels, claim extraction, sub-agent architecture
**Why it happens:** Developer knowledge leaks into user documentation
**How to avoid:** Per CONTEXT.md, black box approach. User cares about: "provide docs path" -> "docs available during planning"
**Warning signs:** Mentions of HIGH/MEDIUM/LOW confidence, gsd-doc-ingestor, gsd-doc-validator in user docs

### Pitfall 2: Wrong README location
**What goes wrong:** Adding doc ingestion as top-level section or under wrong parent
**Why it happens:** Not analyzing existing structure
**How to avoid:** The brownfield callout (line 169) already mentions map-codebase. Doc ingestion extends this.
**Warning signs:** New `## Document Ingestion` header at same level as `## How It Works`

### Pitfall 3: Example shows wrong flow
**What goes wrong:** Showing skip flow or multi-file flow when simple example suffices
**Why it happens:** Trying to be comprehensive
**How to avoid:** Per CONTEXT.md, one simple example, show provide-docs path only
**Warning signs:** Example includes "no" response or multiple file additions

### Pitfall 4: Changelog over-description
**What goes wrong:** Multi-line changelog entry with detailed explanation
**Why it happens:** Wanting to explain the feature
**How to avoid:** Per CONTEXT.md, one-liner entry, no references to README
**Warning signs:** Entry spans multiple lines, includes "see README" or feature details

### Pitfall 5: Cross-references between README and /help
**What goes wrong:** README says "see /gsd:help for more" or help says "see README"
**Why it happens:** DRY instinct
**How to avoid:** Per CONTEXT.md, README is self-contained, no cross-references
**Warning signs:** Phrases like "for details, run /gsd:help"

## Code Examples

### README: Brownfield Callout Pattern (Existing, Line 169)
```markdown
> **Already have code?** Run `/gsd:map-codebase` first. It spawns parallel agents
> to analyze your stack, architecture, conventions, and concerns. Then
> `/gsd:new-project` knows your codebase -- questions focus on what you're adding,
> and planning automatically loads your patterns.
```

This is the location to extend. Doc ingestion happens during map-codebase.

### Help.md: Command Documentation Pattern (Existing)
```markdown
**`/gsd:map-codebase`**
Map an existing codebase for brownfield projects.

- Analyzes codebase with parallel Explore agents
- Creates `.planning/codebase/` with 7 focused documents
- Covers stack, architecture, structure, conventions, testing, integrations, concerns
- Use before `/gsd:new-project` on existing codebases

Usage: `/gsd:map-codebase`
```

Doc ingestion adds a bullet point to this existing entry.

### CHANGELOG: Entry Pattern (Existing)
```markdown
## [Unreleased]

## [1.6.4] - 2026-01-17

### Fixed
- Installation on WSL2/non-TTY terminals now works correctly...

### Added
- `--gaps-only` flag for `/gsd:execute-phase`...
```

New feature goes under `### Added` in `## [Unreleased]`.

### Target: Simple Usage Example Format
```
/gsd:map-codebase

Do you have any existing documentation I should know about?
(File paths, directories, or 'no' to skip)

> docs/architecture.md

Found: architecture.md
Add another? (path or 'done')

> done

[mapping continues...]
```

This matches the implemented interaction in map-codebase.md workflow.

## State of the Art

| Aspect | Current State | Notes |
|--------|---------------|-------|
| Keep a Changelog | v1.1.0 | Project already follows this |
| Markdown GFM | Current | GitHub Flavored Markdown |
| Claude Code slash commands | Current | Existing pattern well-established |

**No deprecated patterns to avoid** - existing documentation is current and consistent.

## Open Questions

None. CONTEXT.md decisions fully specify the documentation approach:
1. README location: nested under existing section (brownfield callout area)
2. /help location: alongside map-codebase entry
3. Content depth: concise, technical, black box
4. Example format: one simple example, command/response interaction
5. Changelog format: one-liner entry

## Sources

### Primary (HIGH confidence)
- `README.md` - Analyzed full structure, identified insertion point (brownfield callout line 169)
- `commands/gsd/help.md` - Analyzed command documentation patterns, map-codebase entry location
- `CHANGELOG.md` - Analyzed Keep a Changelog format, version entry patterns
- `04-CONTEXT.md` - User decisions constraining documentation approach

### Secondary (HIGH confidence)
- `commands/gsd/map-codebase.md` - Actual implementation to document
- `get-shit-done/workflows/map-codebase.md` - Detailed workflow showing user interaction

### Implementation Reference (for accuracy)
- `agents/gsd-doc-ingestor.md` - Understanding what to NOT expose to users (internals)
- `agents/gsd-doc-validator.md` - Understanding what to NOT expose to users (internals)

## Metadata

**Confidence breakdown:**
- Standard patterns: HIGH - analyzed existing files directly
- Architecture: HIGH - patterns extracted from actual codebase
- Pitfalls: HIGH - derived from CONTEXT.md constraints

**Research date:** 2026-01-19
**Valid until:** N/A - documentation patterns are stable, constrained by user decisions
