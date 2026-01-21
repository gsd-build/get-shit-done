# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-19)

**Core value:** Claude understands your codebase structure and conventions before it starts working — automatically
**Current focus:** v1.9.0 Codebase Intelligence System

## Current Position

Phase: 6 of 6 (Multi-Stack Analyzer)
Plan: 5 of 6
Status: In progress
Last activity: 2026-01-21 — Completed 06-05-PLAN.md (Entity Template Update)

Progress: [███████████░] 96%

## Performance Metrics

**Velocity:**
- Total plans completed: 16
- Average duration: 2.5 min
- Total execution time: 40 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Foundation & Learning | 2/2 | 7 min | 3.5 min |
| 2. Context Injection | 2/2 | 4 min | 2.0 min |
| 3. Brownfield & Integration | 3/3 | 6 min | 2.0 min |
| 4. Semantic Intelligence | 5/5 | 13 min | 2.6 min |
| 5. Subagent Codebase Analysis | 1/2 | 1 min | 1.0 min |
| 6. Multi-Stack Analyzer | 4/6 | 9 min | 2.3 min |

*Updated after each plan completion*

## Accumulated Context

### Decisions

| Decision | Phase | Rationale |
|----------|-------|-----------|
| index.json keyed by absolute path | 01-01 | O(1) lookup for file entries |
| JSON schema with version field | 01-01 | Enables future schema migrations |
| updated=null for initialization | 01-01 | Distinguishes init from update |
| Use heredoc for stdin testing | 01-02 | Pipe chaining has timing issues with async stdin |
| Extract 'default' as export name | 01-02 | Both 'default' and identifier recorded for default exports |
| Read file from disk for Edit tool | 01-02 | Edit only provides old_string/new_string, not full content |
| Regenerate conventions every index update | 02-01 | Detection is fast, avoids staleness issues |
| Skip 'default' in case detection | 02-01 | Keyword, not naming convention indicator |
| Single lowercase words as camelCase | 02-01 | Follows camelCase rules (e.g., 'main', 'app') |
| Use lookup tables for purposes | 02-01 | More maintainable than regex patterns |
| Target < 500 tokens for summary | 02-02 | Minimize context window usage |
| Top 5 directories, top 3 suffixes | 02-02 | Keep output concise |
| Command documents same regex as hook | 03-01 | Consistency between bulk scan and incremental updates |
| generateSummary in intel-index.js | 03-01 | Co-locate all intel generation; regenerate on every update |
| No FK constraints in graph schema | 04-01 | Entities can reference before target indexed |
| Virtual id from JSON body | 04-01 | Flexible node structure with unique constraint |
| Delete-then-insert for edges | 04-01 | Clean replacement removes stale links |
| Singleton WASM instance | 04-01 | Avoids repeated sql.js init overhead |
| 50 file limit per entity run | 04-03 | Prevents context window exhaustion |
| Batches of 10 for Task tool | 04-03 | Balances parallelization with overhead |
| Entity slug: path--segments--file-ext.md | 04-03 | Flat directory with reversible identification |
| LEFT JOIN allows forward references | 04-02 | Edges can exist before target nodes indexed |
| UNION in recursive CTE | 04-02 | Prevents infinite loops in cyclic graphs |
| maxDepth default of 5 | 04-02 | Prevents runaway queries on deep dependencies |
| Query mode read-only | 04-04 | Query actions don't persist to disk, safe operations |
| Default limit 10 for dependents | 04-04 | Prevents huge output for files with many dependents |
| Query routing before Write/Edit | 04-04 | Clean separation between query and indexing modes |
| Intel read in Step 7 with others | 04-05 | Keep all context file reads in one place |
| 2>/dev/null for missing intel | 04-05 | Graceful degradation when summary.md doesn't exist |
| Skip existing entities by default | 05-01 | Prevents overwriting manual edits to entities |
| Confidence scoring: markers 40%, files 40%, frameworks 20% | 06-01 | Balanced weighting for accurate stack detection |
| 40% minimum confidence threshold | 06-01 | Filters incidental files, focuses on meaningful stacks |
| Simple YAML parser fallback | 06-01 | Works without js-yaml dependency, graceful degradation |
| Primary stack by highest confidence | 06-01 | More intelligent than file count alone |
| Reference implementation used for stack profiles | 06-02 | Ensures consistency with design research |
| 24+ language profiles in YAML | 06-02 | Comprehensive multi-stack support |
| Framework detection nested under languages | 06-02 | Organizes framework-specific patterns with parent stack |
| Lazy-loadable profile structure | 06-02 | Only detected stacks loaded to minimize context usage |
| 100 file limit per stack analysis | 06-03 | Prevents context explosion while providing sufficient sampling |
| Compact JSON output (<100 tokens) | 06-03 | Preserves orchestrator context, enables 20+ stack analysis |
| Load profile per invocation | 06-03 | Each subagent loads only its stack profile, reduces context |
| Use regex patterns exactly from profiles | 06-03 | Consistency across stacks for summary aggregation |
| Observe naming from actual code | 06-03 | Detect real patterns vs profile defaults |
| Step 0 calls detect-stacks.js | 06-04 | Detect stacks before file scanning |
| Step 0.5 spawns per-stack subagents | 06-04 | Polyglot codebases analyzed in parallel with fresh context |
| Stack field initialized to null | 06-04 | Incremental updates set null, bulk scan populates actual values |
| Subagent delegation preserves context | 06-04 | Orchestrator receives ~50 tokens per stack, not full analysis |
| Stack field derived from extension | 06-05 | .ts -> typescript, .py -> python, maintains consistency |
| Framework field is optional | 06-05 | Only when framework-specific imports detected |
| Omit framework when not detected | 06-05 | Don't use null or "none", keeps frontmatter clean |
| Stack values match stack-profiles.yaml | 06-05 | Ensures consistency across detection and generation |

### Pending Todos

- `/gsd:resume-work` decimal phase handling (deferred from v1.8.0)

### Roadmap Evolution

- Phase 5 added: Subagent Codebase Analysis

### Blockers/Concerns

- `.planning/` is gitignored in GSD repo - intel files created but not committed (expected for project-local data)

## Session Continuity

Last session: 2026-01-21
Stopped at: Completed 06-05-PLAN.md (Entity Template Update)
Resume file: None

## Phase Progress

- Phase 1: Foundation & Learning ✓
- Phase 2: Context Injection ✓
- Phase 3: Brownfield & Integration ✓
- Phase 4: Semantic Intelligence & Scale ✓

**Phase 5 status:**
- 05-01: gsd-entity-generator agent definition ✓
- 05-02: Integrate into analyze-codebase (pending)

**Phase 6 status:**
- 06-01: Multi-stack detection ✓
- 06-02: Stack profiles configuration ✓
- 06-03: Stack analyzer subagent ✓
- 06-04: Lightweight orchestrator update ✓
- 06-05: Entity template update ✓
- 06-06: Integration testing (pending)
