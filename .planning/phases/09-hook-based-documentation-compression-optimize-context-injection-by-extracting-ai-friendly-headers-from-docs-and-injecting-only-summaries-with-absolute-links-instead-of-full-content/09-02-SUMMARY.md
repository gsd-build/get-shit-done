---
phase: 09-hook-based-documentation-compression
plan: 02
subsystem: routing-and-skills
tags: [compression, routing, task-context, skills, documentation]
dependency_graph:
  requires: [09-01-header-extraction]
  provides: [compress-cli, routing-summaries, task-context-skill]
  affects: [routing-infrastructure, skill-system]
tech_stack:
  added: [task-context-skill]
  patterns: [on-demand-summary-extraction, skill-definition]
key_files:
  created:
    - ~/.claude/skills/task-context/SKILL.md
  modified:
    - ~/.claude/get-shit-done/bin/gsd-tools.js
decisions:
  - "On-demand summary extraction vs pre-computed: chose on-demand for routing full (faster index builds, summaries only when needed)"
  - "Task Context Skill provides structured output format for orchestrators to consume routing + context in one call"
  - "HeaderExtractor lazy-loaded only when compression commands used to avoid dependency errors"
metrics:
  duration: 286
  completed: 2026-02-16T18:55:34Z
  tasks_completed: 3
  commits: 2
---

# Phase 09 Plan 02: Task Context Routing & CLI Summary

**One-liner:** Extended routing infrastructure with on-demand doc compression and created Task Context Skill for orchestrator consumption.

## Overview

Extended the Phase 1 routing infrastructure to include documentation summaries using the HeaderExtractor from Plan 09-01. Added CLI commands for doc compression and created the Task Context Skill definition for orchestrators to use when spawning subagents.

## What Was Built

### 1. Compress CLI Commands (Task 1)
- **cmdCompressSummary**: Extract summary from any markdown file with reduction stats
- **cmdCompressStats**: Placeholder for future session-based compression tracking
- Command routing: `gsd-tools compress summary <path> [--raw]`
- Returns JSON with summary, sections, originalLength, reductionPercent
- Tested: 76.2% reduction on ROADMAP.md (18.7KB → 4.5KB)

### 2. Routing Full Extension (Task 2)
- Extended `cmdRoutingFull` to extract summaries for matched docs
- Updated `buildContextIndex` with optional `includeSummaries` parameter
- Added `--with-summaries` flag to `routing index-build` for pre-computed summaries
- On-demand extraction: summaries generated when routing full called (faster index builds)
- Returns context array with summary field (null if extraction failed)

### 3. Task Context Skill (Task 3)
- Created `~/.claude/skills/task-context/SKILL.md` with proper YAML frontmatter
- Provides structured format for orchestrators: model tier + doc summaries + CLAUDE.md keywords
- Executes `gsd-tools routing full` and formats output for subagent consumption
- Summaries limited to 1-3 sentences or 2-4 bullet points for context efficiency
- File links use absolute paths (file:///full/path.md) for proper navigation

## Technical Decisions

**On-demand vs Pre-computed Summaries:**
- Chose on-demand for routing full (summaries extracted only for matched docs)
- Preserves fast index builds (no upfront summary extraction cost)
- Added `--with-summaries` option for users who prefer pre-computed summaries in index
- Rationale: Most routing calls match 3 docs, extracting 3 summaries is faster than extracting all upfront

**Lazy Loading HeaderExtractor:**
- Only loaded when compress commands used or routing full called
- Prevents import errors if compression module unavailable
- Keeps gsd-tools.js startup fast for non-compression commands

**Skill Output Format:**
- Structured markdown with clear sections (Model, Documentation Context, CLAUDE.md Keywords)
- Summaries inline with file links below (avoids context duplication)
- Sub-coordinators can use summaries for task prompts and file links for deep dives

## Deviations from Plan

None - plan executed exactly as written.

## Implementation Notes

**Commits:**
1. `38c689b` - feat(09-02): add compress summary CLI command to gsd-tools
2. `e442a27` - feat(09-02): extend routing full to include doc summaries

**Files Modified:**
- `~/.claude/get-shit-done/bin/gsd-tools.js`: Added compress commands, extended routing full, updated buildContextIndex

**Files Created:**
- `~/.claude/skills/task-context/SKILL.md`: Task Context Skill definition

**Verification Results:**
- ✅ compress summary: 76.2% reduction on ROADMAP.md (exceeds 60% target)
- ✅ routing full: Returns 3 docs with summary field populated
- ✅ SKILL.md: Valid YAML frontmatter with name and description

## Integration Points

**With Phase 1 (Auto Mode Foundation):**
- Extends existing routing commands (match, context, full, index-build)
- Uses existing context index caching and keyword extraction
- Maintains backward compatibility (summary field optional)

**With Plan 09-01 (Header Extraction):**
- Depends on HeaderExtractor for summary generation
- Uses same compression algorithm for consistent results
- Shares reduction percentage calculation logic

**With Future Orchestrators:**
- Task Context Skill provides standard interface for routing + context injection
- Orchestrators call skill before spawning subagents to get model tier + relevant docs
- Summaries reduce context size while maintaining discoverability via file links

## Success Criteria

All success criteria met:

1. ✅ `gsd-tools compress summary <path>` outputs summary with reduction percentage
2. ✅ `gsd-tools routing full <task>` includes summaries in context array
3. ✅ SKILL.md exists at ~/.claude/skills/task-context/SKILL.md
4. ✅ SKILL.md has valid YAML frontmatter with name and description
5. ✅ SKILL.md provides clear instructions for executing routing command
6. ✅ All docs in routing full output have summary field (null if extraction failed)

## Self-Check: PASSED

**Created Files:**
```
FOUND: /Users/ollorin/.claude/skills/task-context/SKILL.md
```

**Commits:**
```
FOUND: 38c689b
FOUND: e442a27
```

**Verification:**
- compress summary tested: 76.2% reduction on ROADMAP.md ✅
- routing full tested: 3 docs with summaries ✅
- SKILL.md frontmatter validated ✅

## Next Steps

Plan 09-03 will integrate these components into the orchestrator workflow, enabling automatic task routing with compressed context injection before spawning execution agents.
