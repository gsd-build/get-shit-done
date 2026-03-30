---
phase: 01-infrastructure-agent-skeleton
plan: "01"
subsystem: gsd-tools
tags: [docs-init, model-profiles, gsd-tools, docs-update]
dependency_graph:
  requires: []
  provides: [docs-init gsd-tools command, gsd-doc-writer model profile]
  affects: [Phase 2 docs-update workflow]
tech_stack:
  added: [get-shit-done/bin/lib/docs.cjs]
  patterns: [cmdInitMapCodebase pattern, checkAgentsInstalled injection]
key_files:
  created:
    - get-shit-done/bin/lib/docs.cjs
  modified:
    - get-shit-done/bin/gsd-tools.cjs
    - get-shit-done/bin/lib/model-profiles.cjs
decisions:
  - inline withProjectRoot logic via checkAgentsInstalled (function is private in init.cjs, not exported)
metrics:
  duration: ~12min
  completed: 2026-03-30
  tasks_completed: 2
  files_changed: 3
---

# Phase 01 Plan 01: docs-init Command and Model Profile Summary

docs-init gsd-tools command with project type detection, doc inventory scanning, and GSD marker detection — wired into dispatcher with gsd-doc-writer model profile registered.

## What Was Built

### Task 1: lib/docs.cjs

New CommonJS module `get-shit-done/bin/lib/docs.cjs` following the `cmdInitMapCodebase` pattern from `init.cjs`. Exports one public function `cmdDocsInit`; all detection helpers are private.

**Detection helpers:**
- `hasGsdMarker(filePath)` — reads first 500 bytes, checks for `<!-- generated-by: gsd-doc-writer -->`
- `scanExistingDocs(cwd)` — scans root .md files (non-recursive) and `docs/` (one level deep), skipping dirs in SKIP_DIRS set; returns sorted array with `{path, has_gsd_marker}`
- `detectProjectType(cwd)` — boolean signals: `has_package_json`, `has_api_routes`, `has_cli_bin`, `is_open_source`, `has_deploy_config`, `is_monorepo`, `has_tests`
- `detectDocTooling(cwd)` — detects docusaurus, vitepress, mkdocs, storybook
- `detectMonorepoWorkspaces(cwd)` — extracts workspace globs from pnpm-workspace.yaml, package.json, or lerna.json

**`cmdDocsInit(cwd, raw)`** builds and outputs:
```json
{
  "doc_writer_model": "sonnet",
  "commit_docs": false,
  "existing_docs": [...],
  "project_type": {...},
  "doc_tooling": {...},
  "monorepo_workspaces": [],
  "planning_exists": true,
  "project_root": "...",
  "agents_installed": true,
  "missing_agents": []
}
```

### Task 2: gsd-tools.cjs dispatcher + model-profiles.cjs

- Added `const docs = require('./lib/docs.cjs')` to gsd-tools.cjs
- Added `case 'docs-init'` routing to `docs.cmdDocsInit(cwd, raw)`
- Added `docs-init` to help text and JSDoc header comment
- Registered `'gsd-doc-writer': { quality: 'opus', balanced: 'sonnet', budget: 'haiku' }` in MODEL_PROFILES

## Verification Results

All plan verification criteria passed:

1. `node gsd-tools.cjs docs-init --raw` returns valid JSON
2. JSON contains all required fields: `project_root`, `doc_writer_model`, `existing_docs`, `project_type`, `doc_tooling`, `monorepo_workspaces`, `planning_exists`, `agents_installed`
3. `existing_docs` entries have `path` and `has_gsd_marker` fields
4. No `.planning/` paths in `existing_docs`
5. `doc_writer_model` resolves to `"sonnet"` (balanced profile)
6. Help text includes `docs-init`
7. Module loads without error

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] withProjectRoot not exported from init.cjs**
- **Found during:** Task 2 verification
- **Issue:** The plan's `<interfaces>` block showed `withProjectRoot` as importable from `init.cjs`, but it is a private function not in `module.exports`
- **Fix:** Inlined equivalent logic directly in `cmdDocsInit`: set `result.project_root = cwd`, call `checkAgentsInstalled()` from core.cjs (which IS exported), inject `agents_installed` and `missing_agents`
- **Files modified:** `get-shit-done/bin/lib/docs.cjs`
- **Commit:** d9e5796

## Commits

| Hash | Message |
|------|---------|
| 157d6c8 | feat(01-01): create lib/docs.cjs with cmdDocsInit and detection helpers |
| d9e5796 | feat(01-01): wire docs-init into gsd-tools.cjs and register gsd-doc-writer model profile |

## Known Stubs

None — `cmdDocsInit` is fully wired and returns real data from the filesystem.

## Self-Check: PASSED

- [x] `get-shit-done/bin/lib/docs.cjs` exists
- [x] `get-shit-done/bin/gsd-tools.cjs` modified
- [x] `get-shit-done/bin/lib/model-profiles.cjs` modified
- [x] Commit 157d6c8 exists
- [x] Commit d9e5796 exists
