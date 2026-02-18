---
status: complete
phase: 02-future-declaration-backward-derivation
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md]
started: 2026-02-16T15:40:00Z
updated: 2026-02-16T15:42:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Add a declaration via CLI
expected: Running `add-declaration --title "Test" --statement "Test truth"` returns JSON with D-01 ID, title, statement, status PENDING, committed true.
result: pass

### 2. Add a milestone linked to a declaration
expected: Running `add-milestone --title "Test MS" --realizes D-01` returns JSON with M-01, realizes ["D-01"], committed true.
result: pass

### 3. Add an action linked to a milestone
expected: Running `add-action --title "Test action" --causes M-01` returns JSON with A-01, causes ["M-01"], committed true.
result: pass

### 4. Load graph shows full structure
expected: Running `load-graph` returns JSON with 1 declaration, 1 milestone, 1 action, stats, and validation (valid: true).
result: pass

### 5. ID auto-increment works
expected: Running a second `add-declaration` produces D-02 (not D-01 again).
result: pass

### 6. Error on missing required flags
expected: Running `add-declaration --title "Test"` (missing --statement) returns JSON with an error field, not a crash.
result: pass

### 7. /declare:future command exists and loads
expected: Command file exists at ~/.claude/commands/declare/future.md with load-graph and add-declaration tool calls. Workflow file contains Language Detection guide and declaration capture flow.
result: pass

### 8. /declare:milestones command exists and loads
expected: Command file exists at ~/.claude/commands/declare/milestones.md with load-graph, add-milestone, and add-action tool calls. Workflow file contains "what must be true?" backward derivation logic.
result: pass

### 9. All 5 declare commands installed
expected: `ls ~/.claude/commands/declare/` shows 5 files: future.md, help.md, init.md, milestones.md, status.md.
result: pass

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
