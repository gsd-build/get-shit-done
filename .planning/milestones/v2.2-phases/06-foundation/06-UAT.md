---
status: complete
phase: 06-foundation
source: 06-01-SUMMARY.md, 06-02-SUMMARY.md
started: 2026-02-17T22:00:00Z
updated: 2026-02-17T22:01:00Z
mode: auto
---

## Current Test

[testing complete]

## Tests

### 1. CLI Adapter Modules Exist
expected: Three adapter files (codex.cjs, gemini.cjs, opencode.cjs) exist in get-shit-done/bin/adapters/
result: pass

### 2. Adapter Contract Exports
expected: Each adapter exports detect (function), invoke (function), and CLI_NAME (string) matching its name
result: pass

### 3. Config Template Co-Planners Section
expected: get-shit-done/templates/config.json has co_planners section with enabled: false and timeout_ms: 120000
result: pass

### 4. Coplanner Detect Command
expected: Running `gsd-tools.cjs coplanner detect` returns JSON with available/version/error for each CLI
result: pass

### 5. Coplanner Enabled Command
expected: Running `gsd-tools.cjs coplanner enabled` returns JSON with enabled status and source (default: false from config)
result: pass

### 6. Kill Switch Env Override
expected: Setting GSD_CO_PLANNERS=true overrides config to enable co-planners, source shows "env"
result: pass

### 7. Coplanner Detect Raw Output
expected: Running `gsd-tools.cjs coplanner detect --raw` displays human-readable table with CLI, Available, Version columns
result: pass

### 8. Install Copies Adapters Directory
expected: install.js copyWithPathReplacement recursively copies get-shit-done/ including bin/adapters/ subdirectory
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
