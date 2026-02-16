# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Performance is the product of alignment and integrity. Declare makes both structurally enforced and visibly measured.
**Current focus:** Phase 2 complete. Ready for Phase 3: Execution Tracking

## Current Position

Phase: 2 of 6 (Future Declaration & Backward Derivation) -- COMPLETE
Plan: 2 of 2 in current phase (02-02 done)
Status: Phase Complete
Last activity: 2026-02-16 — Completed 02-02 (declaration capture and backward derivation commands)

Progress: [████████░░] 29%

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: 4min
- Total execution time: 0.3 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3/3 | 14min | 5min |
| 02-future-declaration-backward-derivation | 2/2 | 6min | 3min |

**Recent Trend:**
- Last 5 plans: 01-01 (3min), 01-02 (3min), 01-03 (8min), 02-01 (3min), 02-02 (3min)
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

### Pending Todos

- [ ] **Monaco file browser plugin** — Localhost-based web editor (Monaco + file tree) for quick file viewing/editing from Claude Code. Should be a Mesh plugin but run standalone. Easy to invoke with a specific file path. Avoids needing Cursor/VS Code for quick checks and small adjustments. (Plan separately)

### Roadmap Evolution

- Phase 02.1 inserted after Phase 2: Artifact Separation and Command Split (URGENT) — separate ACTIONS.md from MILESTONES.md, split /declare:milestones into milestones-only + new /declare:actions, checkbox milestone UI

### Blockers/Concerns

- [Research]: Backward derivation prompting patterns (Phase 2) are novel territory -- no standard patterns exist. May need dedicated research before planning Phase 2.
- [Research]: Occurrence check frequency/trigger patterns (Phase 6) need experimentation to avoid being annoying.

## Session Continuity

Last session: 2026-02-16
Stopped at: Completed 02-02-PLAN.md (declaration capture and backward derivation commands). Phase 2 complete.
Resume file: .planning/phases/02-future-declaration-backward-derivation/02-02-SUMMARY.md
