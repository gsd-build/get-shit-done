# Milestones

A **Milestone** is a shipped, tagged version of your project (v1.0, v1.1, v2.0). It represents a coherent set of completed phases bundled together as a release.

## Overview

| Attribute | Value |
|-----------|-------|
| **Location** | Tracked in `PROJECT.md`, archived to `.planning/milestones/` |
| **Created by** | `/gsd:new-milestone` |
| **Completed by** | `/gsd:complete-milestone` |
| **Lifespan** | One version cycle |

## Purpose

Milestones serve as:
- **Shipping gates** — Separate "in development" from "shipped"
- **Requirement validation** — Move requirements from "hypothesis" to "proven"
- **Version markers** — Git tags, release notes, historical record
- **Context efficiency** — Archive heavy artifacts to keep planning lean
- **Evolution triggers** — After each milestone, decide what's next

## Milestone Lifecycle

```
Define (new-milestone)
    ↓
Research (optional, 4 parallel agents)
    ↓
Requirements (scope + categorize)
    ↓
Roadmap (phase structure)
    ↓
Execute Phases (plan → execute → verify cycles)
    ↓
Audit (verify requirements coverage)
    ↓
Complete (archive, tag, evolve PROJECT.md)
    ↓
Start Next Milestone
```

## MILESTONES.md Entry

After completion, milestones are recorded in `.planning/MILESTONES.md`:

```markdown
## v1.0 MVP (Shipped: 2025-01-15)

**Delivered:** Menu bar weather app with current conditions and 3-day forecast

**Phases completed:** 1-4 (7 plans total)

**Key accomplishments:**
- Menu bar app with popover UI (AppKit)
- OpenWeather API integration with auto-refresh
- Current weather display with conditions icon
- 3-day forecast list with high/low temperatures

**Stats:**
- 47 files created
- 2,450 lines of Swift
- 4 phases, 7 plans, 28 tasks
- 12 days from start to ship

**Git range:** `feat(01-01)` → `feat(04-01)`

**What's next:** Security audit and hardening for v1.1
```

## Milestone vs Project

| Aspect | PROJECT | MILESTONE |
|--------|---------|-----------|
| **Scope** | Entire product vision | One version release |
| **Lifespan** | Product lifetime | Release cycle |
| **Requirements** | Cumulative (all versions) | Scoped to this version |
| **Files** | PROJECT.md persists | ROADMAP.md + REQUIREMENTS.md replaced |
| **Core Value** | Rarely changes | N/A |

## Phase Numbering Across Milestones

**Critical:** Phase numbers continue across milestones, never restart:

```
v1.0 MVP: Phases 1-4
v1.1 Security: Phases 5-6 (continues from 4)
v2.0 Redesign: Phases 7-12 (continues from 6)
```

This creates an unbroken historical record of all work.

## File Structure

### During Active Milestone

```
.planning/
├── PROJECT.md                # "Current Milestone: v1.1"
├── REQUIREMENTS.md           # Scoped for THIS milestone (v1.1)
├── ROADMAP.md                # Phases for THIS milestone
├── STATE.md                  # Current position
├── phases/
│   ├── 01-foundation/        # v1.0 — shipped
│   ├── 02-auth/              # v1.0 — shipped
│   ├── 03-features/          # v1.0 — shipped
│   ├── 04-polish/            # v1.0 — shipped
│   ├── 05-security/          # v1.1 — current
│   └── 06-hardening/         # v1.1 — planned
└── milestones/               # Archive
    └── (empty until v1.0 completes)
```

### After Milestone Completion

```
.planning/
├── PROJECT.md                # Updated with Validated requirements
├── STATE.md                  # Reset for new milestone
├── MILESTONES.md             # NEW ENTRY for v1.0
├── phases/                   # Phases continue accumulating
│   └── ...
└── milestones/
    ├── v1.0-ROADMAP.md       # Archived v1.0 roadmap
    ├── v1.0-REQUIREMENTS.md  # Archived v1.0 requirements
    └── v1.0-MILESTONE-AUDIT.md
```

## Milestone Commands

### `/gsd:new-milestone [name]`

Starts a new milestone cycle:

1. Load PROJECT.md and MILESTONES.md
2. Gather milestone goals through questions
3. Determine next version (v1.0 → v1.1 or v2.0)
4. Update PROJECT.md with "Current Milestone" section
5. Optional: Research domain for new features
6. Define requirements for THIS milestone
7. Create roadmap with phase structure
8. Commit planning docs

### `/gsd:audit-milestone`

Verifies milestone completeness before shipping:

- All requirements satisfied
- Cross-phase integration working
- End-to-end flows complete
- Technical debt captured

**Statuses:**
- `passed` — Ready to complete
- `gaps_found` — Run `/gsd:plan-milestone-gaps` first
- `tech_debt` — Can proceed, debt tracked

### `/gsd:plan-milestone-gaps`

Creates phases to close gaps found by audit:

```
Gap: DASH-01 "User sees their data"
  → Phase 6: "Wire Dashboard to API"
     - Add useEffect for fetch
     - Add state for userData
     - Render userData in JSX
```

### `/gsd:complete-milestone`

Archives and tags the milestone:

1. Verify audit passed
2. Gather stats (files, LOC, timeline)
3. Extract accomplishments from SUMMARY.md files
4. Create MILESTONES.md entry
5. Full PROJECT.md evolution review
6. Archive artifacts to `.planning/milestones/`
7. Delete ROADMAP.md and REQUIREMENTS.md
8. Create git tag
9. Commit completion

## When to Create Milestones

### Create milestones for:
- Initial release (v1.0 MVP)
- Public releases
- Major feature sets shipped
- Before archiving planning

### Don't create milestones for:
- Individual phase completions
- Work in progress
- Minor bug fixes
- Internal dev iterations

**Quick test:** Is this deployed/usable/shipped? If yes → milestone.

## Version Numbering

GSD uses semantic versioning:

- **v1.0** — First release (MVP)
- **v1.1, v1.2** — Feature additions, non-breaking
- **v2.0** — Major changes, breaking or significant redesign

## Archive Strategy

After completing v1.0:

| File | Action |
|------|--------|
| ROADMAP.md | Archived → `milestones/v1.0-ROADMAP.md`, then deleted |
| REQUIREMENTS.md | Archived → `milestones/v1.0-REQUIREMENTS.md`, then deleted |
| PROJECT.md | Updated (requirements → Validated), persists |
| Phase directories | Persist (raw historical execution) |

This keeps current planning lean while preserving all history.

## Best Practices

1. **Ship small, ship often** — Prefer more milestones over larger ones
2. **Audit before completing** — Catch gaps early
3. **Archive everything** — Future you will thank past you
4. **Version semantically** — Breaking changes = major version
5. **Tag in git** — `git tag -a v1.0 -m "v1.0 MVP"`

## Related Commands

- `/gsd:new-milestone` — Start new milestone
- `/gsd:audit-milestone` — Verify completeness
- `/gsd:plan-milestone-gaps` — Close audit gaps
- `/gsd:complete-milestone` — Archive and tag
- `/gsd:progress` — Check current status
