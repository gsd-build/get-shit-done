---
phase: "08"
plan: "02"
subsystem: upstream-sync
tags: [suggestions, semantic-analysis, refactoring, cli]
dependency_graph:
  requires: [upstream.cjs core, gsd-tools.cjs routing]
  provides: [detectSemanticSimilarities, generateSuggestions, applySuggestion, sync apply-suggestion]
  affects: [cmdUpstreamStatus, sync commands]
tech_stack:
  added: []
  patterns: [semantic-diff-analysis, config-backed-caching, three-type-suggestion-model]
key_files:
  created: []
  modified:
    - get-shit-done/bin/lib/upstream.cjs
    - get-shit-done/bin/gsd-tools.cjs
decisions:
  - id: suggestion-storage
    summary: Store suggestions in config.json under upstream.analysis.suggestions
    rationale: Enables persistence across commands and apply tracking
  - id: three-severity-levels
    summary: Use high/medium/low severity for suggestions
    rationale: High=renames (likely merge fail), Medium=signatures (call site updates), Low=imports (review needed)
  - id: patch-file-approach
    summary: Generate patch files for rename conflicts rather than auto-apply
    rationale: Safer - user reviews and applies manually, preserving control
metrics:
  duration: 5min
  completed: 2026-02-24
---

# Phase 8 Plan 02: Refactoring Suggestions Summary

Semantic similarity detection with configurable suggestion application for proactive merge conflict prevention.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| bcf8b39 | feat | Add semantic similarity detection and suggestions |
| 2e33e90 | feat | Add sync apply-suggestion command |

## Implementation Details

### Semantic Similarity Detection Functions

**detectSemanticSimilarities(cwd)** - Core detection function:
- Detects rename conflicts where fork has modifications (severity: high)
- Detects function signature changes in files modified by both fork and upstream (severity: medium)
- Detects import relationship conflicts when module exports change (severity: low)

**Helper functions added:**
- `getFilesModifiedInBoth(cwd)` - Find files changed in both fork and upstream
- `detectFunctionSignatureChanges(cwd, file)` - Parse diffs for function definition changes
- `detectExportChanges(cwd)` - Find module.exports changes in upstream
- `findFilesRequiringModule(cwd, modulePath)` - Cross-reference fork imports

**Suggestion structure:**
```javascript
{
  id: number,           // Sequential ID for apply-suggestion
  type: string,         // 'rename_conflict' | 'signature_conflict' | 'import_conflict'
  severity: string,     // 'high' | 'medium' | 'low'
  file: string,         // Affected file path
  what: string,         // Brief description of the issue
  why: string,          // Why this matters for merge
  fix: string,          // Proposed action
  apply_command: string, // gsd-tools sync apply-suggestion <id>
  _meta: object         // Type-specific metadata for application
}
```

### Suggestion Generation and Storage

**generateSuggestions(cwd)** - Called by cmdUpstreamStatus:
- Calls detectSemanticSimilarities()
- Assigns sequential IDs starting from 1
- Stores in config.json under `upstream.analysis.suggestions`
- Records `suggestions_generated_at` timestamp

**loadSuggestions(cwd)** - Retrieves stored suggestions for apply command

**formatSuggestions(suggestions)** - Human-readable output with:
- Lightbulb emoji header
- Severity icons (warning for high, info for medium)
- What/Why/Fix/Apply format for each suggestion

### Apply Suggestion Command

**applySuggestion(cwd, suggestionId)** - Handles three suggestion types:

1. **rename_conflict** (high severity):
   - Gets fork's diff for original file
   - Creates patch file adjusted for renamed path
   - Writes to `.planning/suggestion-{id}.patch`
   - Returns instructions for git apply

2. **signature_conflict** (medium severity):
   - Returns detailed signature comparison
   - Lists manual steps for call site updates

3. **import_conflict** (low severity):
   - Lists affected importing files
   - Returns review instructions

**CLI routing** in gsd-tools.cjs:
- Route: `sync apply-suggestion <id>`
- Validates ID is positive number
- Shows help with --help flag
- Returns structured result or error

### Integration with Status Command

cmdUpstreamStatus now:
1. Generates suggestions during status check
2. Stores suggestions in config.json
3. Appends suggestions section to output (after warnings)
4. Includes suggestions array in JSON output

## Verification Results

All verifications passed:
- detectSemanticSimilarities exported as function
- generateSuggestions exported as function
- applySuggestion exported as function
- sync apply-suggestion --help shows usage
- sync apply-suggestion 999 returns "suggestion not found"

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] get-shit-done/bin/lib/upstream.cjs modified (3876 lines, exceeds 2500 min)
- [x] get-shit-done/bin/gsd-tools.cjs modified with apply-suggestion routing
- [x] Commits bcf8b39, 2e33e90 exist
- [x] All exports verified
