---
phase: 01-core-implementation
plan: 01
subsystem: installer
tags: [cursor, conversion, tool-names, frontmatter]
dependency-graph:
  requires: []
  provides: [claudeToCursorTools, convertCursorToolName, convertClaudeToCursorFrontmatter]
  affects: [01-02]
tech-stack:
  added: []
  patterns: [tool-name-mapping, frontmatter-conversion]
file-tracking:
  key-files:
    created: []
    modified: [bin/install.js]
decisions:
  - id: cursor-tool-naming
    choice: snake_case for Cursor tools (matches OpenCode pattern)
    rationale: Cursor uses snake_case tool names like OpenCode
  - id: task-tool-exclusion
    choice: Exclude Task tool for Cursor
    rationale: Cursor uses subagent mechanism, not Task tool
metrics:
  duration: ~5 minutes
  completed: 2026-02-05
---

# Phase 01 Plan 01: Cursor Conversion Functions Summary

**One-liner:** Tool name mapping and frontmatter conversion functions for Cursor runtime support

## Changes Made

### Task 1: Tool Name Mapping and Conversion
- Added `claudeToCursorTools` mapping object with 12 tool mappings
- Added `convertCursorToolName()` function that:
  - Excludes Task tool (Cursor uses subagent mechanism)
  - Preserves MCP tools (mcp__*) format unchanged
  - Converts PascalCase to snake_case for unmapped tools
- Commit: `1b21389`

### Task 2: Frontmatter Conversion Function
- Added `convertClaudeToCursorFrontmatter()` function that:
  - Converts `allowed-tools:` array to `tools:` object with boolean values
  - Converts `tools:` comma-separated string to `tools:` object
  - Converts color names to hex using existing `colorNameToHex` mapping
  - Replaces tool names in body text (Read → read, AskUserQuestion → ask_question)
  - Replaces `/gsd:` → `/gsd-` for Cursor command format
  - Replaces `~/.claude/` → `~/.cursor/` in content
  - Removes `name:` field (Cursor uses filename for command name)
- Commit: `a6173eb`

## Requirements Implemented

| Requirement | Description | Status |
|-------------|-------------|--------|
| CONV-01 | Tool name mapping object | ✓ |
| CONV-02 | Tool name conversion function | ✓ |
| CONV-03 | Frontmatter conversion (tools array → object) | ✓ |
| CONV-04 | Color name to hex conversion | ✓ |
| CONV-05 | Tool name replacement in body text | ✓ |
| PATH-03 | Path reference replacement (~/.claude/ → ~/.cursor/) | ✓ |
| PATH-04 | Command format conversion (/gsd: → /gsd-) | ✓ |

## Decisions Made

1. **Tool naming convention**: Used snake_case for Cursor tools (matching OpenCode pattern)
2. **Task tool handling**: Excluded Task tool completely (Cursor uses subagent mechanism)
3. **MCP tools**: Preserved mcp__* format unchanged (same as OpenCode)

## Deviations from Plan

None - plan executed exactly as written.

## Files Modified

| File | Changes |
|------|---------|
| bin/install.js | +166 lines (mapping object + 2 functions) |

## Test Results

- `node -c bin/install.js` passes (no syntax errors)
- All three functions/objects verified present in file

## Next Phase Readiness

**Ready for Plan 01-02:** The conversion functions are in place. Plan 01-02 can now:
- Detect Cursor runtime
- Use `convertClaudeToCursorFrontmatter()` during file copying
- Use `convertCursorToolName()` for tool name conversions

**No blockers identified.**
