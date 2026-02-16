# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Performance is the product of alignment and integrity. Declare makes both structurally enforced and visibly measured.
**Current focus:** Phase 04 in progress -- Execution Pipeline

## Current Position

Phase: 04 of 6 (Execution Pipeline)
Plan: 1 of 2 in current phase
Status: Plan 04-01 complete
Last activity: 2026-02-16 — Completed 04-01 (execution pipeline engine modules)

Progress: [███████░░░] 60%

## Performance Metrics

**Velocity:**
- Total plans completed: 11
- Average duration: 4min
- Total execution time: 0.68 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3/3 | 14min | 5min |
| 02-future-declaration-backward-derivation | 2/2 | 6min | 3min |
| 02.1-artifact-separation-and-command-split | 3/3 | 11min | 4min |
| 03-traceability-navigation | 2/2 | 7min | 4min |
| 04-execution-pipeline | 1/2 | 2min | 2min |

**Recent Trend:**
- Last 5 plans: 02.1-03 (3min), 03-01 (4min), 03-02 (3min), 04-01 (2min)
- Trend: Consistent

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 6-phase structure derived from 29 requirements across 6 categories
- [Roadmap]: Graph engine + infrastructure in Phase 1; backward derivation as Phase 2 (core innovation)
- [Roadmap]: Integrity and alignment deferred to Phases 5-6 (need working execution first)
- [Revision]: Renamed DAG.md to MILESTONES.md for user clarity; replaced "constellation" with "set of declarations"
- [01-01]: Graph engine uses dual adjacency lists (upEdges + downEdges) for bidirectional O(1) lookups
- [01-01]: Kahn's algorithm serves double duty: topological sort and cycle detection
- [01-01]: Validation is explicit (validate() method), not called by addNode/addEdge
- [01-02]: execFileSync over execSync for git operations (proper argument handling with spaces)
- [01-02]: parseMarkdownTable exported as reusable helper from milestones.js
- [01-02]: Permissive parse, strict write pattern for all artifact files
- [01-03]: Commands installed to user-level ~/.claude/commands/declare/ with absolute paths for cross-project usage
- [01-03]: Slash commands use meta-prompt pattern: .md instructs Claude, declare-tools.cjs provides data via JSON stdout
- [01-03]: esbuild for CJS bundling; single-file dist/declare-tools.cjs with no external dependencies
- [02-01]: Shared parse-args.js with generic parseFlag rather than duplicating in each command
- [02-01]: Bidirectional cross-reference integrity: milestones update FUTURE.md, actions update MILESTONES.md causedBy
- [02-01]: Command module pattern: parseFlag for args, load artifacts, build DAG for nextId, mutate, write, commit
- [02-02]: Workflow files separated from command files: commands handle tool orchestration, workflows contain conversation logic
- [02-02]: Language detection embedded as classification guide in workflow rather than code-based NLP
- [02-02]: Reframing limited to 2-3 attempts then accept user phrasing (per locked decision)
- [02.1-01]: Folder naming uses M-XX-slug matching DAG ID format (not M001-slug)
- [02.1-01]: writeMilestonesFile backward compat bridge: accepts 2 or 3 args for gradual migration
- [02.1-01]: add-action deprecated immediately (returns create-plan suggestion)
- [02.1-01]: Milestones have hasPlan boolean field instead of causedBy array
- [02.1-02]: create-plan writes entire PLAN.md at once (not individual actions)
- [02.1-02]: 30-day threshold for STALE detection; COMPLETABLE/INCONSISTENT for consistency checks
- [02.1-03]: AskUserQuestion for checkbox milestone confirmation (batch selection per declaration)
- [02.1-03]: Action derivation separated into /declare:actions (not bundled with milestones)
- [03-01]: Shared buildDagFromDisk in build-dag.js eliminates graph-loading duplication across all commands
- [03-01]: loadActionsFromFolders canonical location is build-dag.js (moved from load-graph.js to avoid circular dependency)
- [03-01]: Trace tree formatting uses Unicode box-drawing connectors, plain text only, no ANSI colors
- [03-02]: Visualize duplicates nodes under each parent for many-to-many (tree view, not graph view)
- [03-02]: Status markers: checkmark=DONE, >=ACTIVE, circle=PENDING, !=BLOCKED (has non-done children)
- [03-02]: Slash commands use relative dist/declare-tools.cjs path matching existing status.md pattern
- [04-01]: generateExecPlan is pure function (no I/O) in artifacts/; runGenerateExecPlan is I/O wrapper in commands/
- [04-01]: verify-wave uses looksLikeFilePath heuristic for produces field (descriptions auto-pass)
- [04-01]: v1 wave model: all sibling actions within a milestone form a single wave (no inter-action edges)

### Pending Todos

- [ ] **Monaco file browser plugin** — Localhost-based web editor (Monaco + file tree) for quick file viewing/editing from Claude Code. Should be a Mesh plugin but run standalone. Easy to invoke with a specific file path. Avoids needing Cursor/VS Code for quick checks and small adjustments. (Plan separately)

### Roadmap Evolution

- Phase 02.1 inserted after Phase 2: Artifact Separation and Command Split (URGENT) — separate ACTIONS.md from MILESTONES.md, split /declare:milestones into milestones-only + new /declare:actions, checkbox milestone UI

### Blockers/Concerns

- [Research]: Backward derivation prompting patterns (Phase 2) are novel territory -- no standard patterns exist. May need dedicated research before planning Phase 2.
- [Research]: Occurrence check frequency/trigger patterns (Phase 6) need experimentation to avoid being annoying.

## Session Continuity

Last session: 2026-02-16
Stopped at: Completed 04-01-PLAN.md
Resume file: .planning/phases/04-execution-pipeline/04-01-SUMMARY.md
