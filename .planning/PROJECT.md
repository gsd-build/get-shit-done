# GSD Context Optimization

## What This Is

Optimizing GSD's context loading so agents start lean and stay in their peak quality zone. Reduces prompt bloat through lazy loading, tiered prompts, and compiled artifacts while preserving instructional density.

## Core Value

Agents execute at peak quality by starting at 8-12% context instead of 15-25%.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] History loads as structured digest instead of full SUMMARY.md files
- [ ] Summary templates match plan complexity (minimal/standard/complex)
- [ ] State operations are atomic patches, not full file read/write cycles
- [ ] Executor loads references on-demand based on task type
- [ ] Planner loads extensions based on planning mode
- [ ] Plans can be pre-compiled before execution

### Out of Scope

- Enhanced semantic queries (Phase 4) — defer unless Phases 1-3 prove insufficient
- Compressing instructional content — core methodology must remain intact
- Complex cache invalidation — simple mtime checks are sufficient

## Context

**Problem:** Claude's quality degrades predictably with context load:
- 0-30% context: Peak quality
- 30-50%: Good, occasional shortcuts
- 50-70%: Degrading, efficiency mode
- 70%+: Poor, rushed, misses requirements

Complex phases currently start agents at 15-25% context from prompt loading alone—before any codebase reading.

**Prior work:** v1.12.x shipped compound init commands (4,245 net line reduction), proving the direction works.

**Target state:** Agents start at 8-12% context, preserving peak quality zone for execution.

## Constraints

- **Instructional density**: Teaching content cannot be compressed—it's GSD's value
- **Adaptive intelligence**: Agents must still handle mid-execution surprises
- **Maintainability**: Clear separation between core and extensions
- **Debuggability**: Easy to trace which modules loaded for any execution
- **TDD**: Use test-driven development for gsd-tools.js changes — write tests first, then implementation

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Lazy loading over railroad architecture | Preserves adaptive intelligence while reducing context | — Pending |
| Build on compound-init foundation | v1.12.x proved the pattern works | — Pending |
| Three-phase implementation | Incremental, reversible changes | — Pending |

---
*Last updated: 2025-02-07 after initialization*
