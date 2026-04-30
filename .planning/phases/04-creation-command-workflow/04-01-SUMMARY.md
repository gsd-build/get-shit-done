---
phase: 04-creation-command-workflow
plan: 01
subsystem: cli-command-workflow
tags: [sme, cli, workflow, interactive, progress-indicators, tdd]
dependency_graph:
  requires:
    - agents/gsd-sme-creator.md (Phase 3 deliverable)
    - sdk/src/query/sme.ts (Phase 2 deliverable -- sme.list query)
  provides:
    - commands/gsd/create-sme.md (/gsd-create-sme CLI entry point)
    - get-shit-done/workflows/create-sme.md (workflow orchestration)
    - sdk/src/agents/create-sme-workflow-structure.test.ts (structural validation)
  affects:
    - Any user running /gsd-create-sme to create SME documents
tech_stack:
  added: []
  patterns:
    - AskUserQuestion interactive menu with text-mode fallback
    - Blocking Task() spawn with progress banner
    - Process name validation via [a-zA-Z0-9_-]+ regex
    - gsd-sdk query init.map-codebase for workflow context
    - Structural test pattern (readAgent/countOccurrences from Phase 3)
key_files:
  created:
    - commands/gsd/create-sme.md
    - get-shit-done/workflows/create-sme.md
    - sdk/src/agents/create-sme-workflow-structure.test.ts
  modified: []
decisions:
  - "Used init.map-codebase for workflow context (not init.phase-op -- no phase number needed)"
  - "Single blocking Task() for creator -- not background, no TaskOutput needed"
  - "PROCESS_NAME validated against [a-zA-Z0-9_-]+ before any filesystem use (T-04-01/T-04-02)"
  - "update/create/cancel options presented via AskUserQuestion when SME already exists"
  - "mkdir -p .planning/smes in workflow (not in creator) to prevent first-ever-SME failure"
metrics:
  duration: "3 minutes"
  completed_date: "2026-04-30"
  tasks_completed: 3
  files_created: 3
---

# Phase 04 Plan 01: Create SME Command and Workflow Summary

**One-liner:** `/gsd-create-sme` CLI command and workflow with interactive process menu, existing-SME detection, progress banners, and blocking Task() spawn of gsd-sme-creator agent.

## What Was Built

Three files implementing the user-facing SME creation experience:

1. **`commands/gsd/create-sme.md`** — Thin delegation command (33 lines). YAML frontmatter with `name: gsd:create-sme`, `AskUserQuestion` in `allowed-tools`. Passes `$ARGUMENTS` to `workflows/create-sme.md`.

2. **`get-shit-done/workflows/create-sme.md`** — 7-step workflow:
   - Step 1 (`init_context`): loads `init.map-codebase`, resolves `CREATOR_MODEL` and `AGENT_SKILLS_CREATOR`, guards on `planning_exists`, sets `TEXT_MODE`
   - Step 2 (`resolve_process_name`): parses `$ARGUMENTS` or presents `AskUserQuestion` menu built from `sme.list` output
   - Step 3 (`validate_process_name`): validates `[a-zA-Z0-9_-]+` regex before any filesystem use; creates `.planning/smes/` directory
   - Step 4 (`check_existing_sme`): checks for `{PROCESS_NAME}-SME.md`, presents update/create/cancel choice
   - Step 5 (`spawn_creator`): displays ASCII banner + "◆ Spawning SME creator..." then calls `Task(subagent_type="gsd-sme-creator")` with CODEX RUNTIME rule
   - Step 6 (`handle_return`): checks for `## SME Creation Complete` return marker, handles error case
   - Step 7 (`commit_and_complete`): commits via `gsd-sdk query commit` if `commit_docs` is true, displays completion summary with next steps

3. **`sdk/src/agents/create-sme-workflow-structure.test.ts`** — 18 structural tests across 4 describe blocks (CMD-01 through CMD-04). All tests RED in Wave 0 (before command/workflow created), all GREEN after.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create structural validation test scaffold (Wave 0) | de6730e4 | sdk/src/agents/create-sme-workflow-structure.test.ts |
| 2 | Create /gsd-create-sme command definition | d3f96c49 | commands/gsd/create-sme.md |
| 3 | Create create-sme workflow with interactive flow | ebb09052 | get-shit-done/workflows/create-sme.md |

## Verification

All 18 structural tests pass GREEN:

```
Test Files  1 passed (1)
Tests  18 passed (18)
```

Security constraints verified:
- `[a-zA-Z0-9_-]+` validation present before filesystem use
- `mkdir -p .planning/smes` prevents first-SME directory failure
- `subagent_type="gsd-sme-creator"` matches agent's `name:` field exactly
- `TEXT_MODE` fallback present for non-Claude runtimes

## Deviations from Plan

None — plan executed exactly as written.

The node_modules symlink created for test execution in the worktree (`sdk/node_modules -> /home/mkline/Repos/get-shit-done/sdk/node_modules`) was not committed as it is a local worktree artifact, not a deliverable.

## Known Stubs

None. The workflow is complete — all steps are wired. The actual SME document content is produced by `gsd-sme-creator` (Phase 3 deliverable), not this workflow.

## Threat Flags

No new threat surface beyond what is documented in the plan's `<threat_model>`. All T-04-01 through T-04-05 mitigations are present in the workflow:
- T-04-01/T-04-02: `[a-zA-Z0-9_-]+` validation + quoted `"$PROCESS_NAME"` in bash
- T-04-03: exact `subagent_type="gsd-sme-creator"` string (verified by CMD-04 structural test)

## Self-Check: PASSED

Files created:
- FOUND: /home/mkline/Repos/get-shit-done/.claude/worktrees/agent-a53b7752c294a8dd1/commands/gsd/create-sme.md
- FOUND: /home/mkline/Repos/get-shit-done/.claude/worktrees/agent-a53b7752c294a8dd1/get-shit-done/workflows/create-sme.md
- FOUND: /home/mkline/Repos/get-shit-done/.claude/worktrees/agent-a53b7752c294a8dd1/sdk/src/agents/create-sme-workflow-structure.test.ts

Commits verified:
- de6730e4: test(04-01): add structural validation tests for create-sme command and workflow (RED)
- d3f96c49: feat(04-01): create /gsd-create-sme command definition
- ebb09052: feat(04-01): create create-sme workflow with interactive flow and progress indicators
