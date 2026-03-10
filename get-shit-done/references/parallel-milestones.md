<parallel_milestones>

Reference for parallel milestone development — running multiple milestones concurrently with independent phase numbering.

## Overview

Parallel milestones enable teams to work on multiple streams simultaneously:
- Each milestone has its own `ROADMAP.md`, `REQUIREMENTS.md`, and `phases/`
- Phase numbers are scoped to milestones (M1/01, M7/01 can coexist)
- Progress tracked per-milestone in STATE.md
- Commands accept `M7/01` syntax for milestone-scoped operations

## Directory Structure

```
.planning/
├── PROJECT.md              # Shared project context
├── STATE.md                # Multi-milestone state (see schema below)
├── config.json             # Includes parallel milestone config
└── milestones/
    ├── M1-ingestion/
    │   ├── ROADMAP.md      # M1's phases and progress
    │   ├── REQUIREMENTS.md # M1's requirements
    │   └── phases/
    │       ├── 01-setup/
    │       └── 02-pipeline/
    ├── M7-patient-engagement/
    │   ├── ROADMAP.md      # M7's phases (independent numbering)
    │   ├── REQUIREMENTS.md
    │   └── phases/
    │       ├── 01-foundation/
    │       └── 02-compliance/
    └── ...
```

## Milestone Reference Syntax

Commands accept milestone-scoped references:

| Syntax | Meaning |
|--------|---------|
| `M7/01` | Phase 01 of milestone M7 |
| `M1/03-02` | Plan 02 of phase 03 in milestone M1 |
| `01` | Phase 01 of default milestone (or legacy) |

Examples:
```bash
/gsd:execute-phase M7/01      # Execute phase 1 of M7
/gsd:plan-phase M1/03         # Plan phase 3 of M1
/gsd:progress M7              # Show M7's progress
/gsd:verify-work M7/02        # Verify phase 2 of M7
```

## CLI Commands

### Milestone Management

```bash
# Create a new milestone
gsd-tools milestone create M7 "Patient Engagement"
# Creates: .planning/milestones/M7-patient-engagement/

# List all milestones with status
gsd-tools milestone list
# Returns JSON: [{id, name, status, progress_percent, phase_count}]

# Switch default milestone context
gsd-tools milestone switch M7
# Sets M7 as default for commands without explicit milestone

# Show milestone details
gsd-tools milestone info M7
```

### Migration

```bash
# Preview migration from legacy to parallel structure
gsd-tools migrate-to-parallel --dry-run

# Interactive migration wizard
gsd-tools migrate-to-parallel

# Auto-detect milestone boundaries
gsd-tools migrate-to-parallel --auto

# Restore from backup if needed
gsd-tools migrate-to-parallel --restore .planning/backups/pre-migration-*/
```

## Configuration

Add to `.planning/config.json`:

```json
{
  "parallel_milestones": true,
  "default_milestone": "M1",
  "milestones": {
    "M1": {
      "name": "Full PubMed Ingestion",
      "dependencies": []
    },
    "M7": {
      "name": "Patient Engagement",
      "dependencies": ["M1"]
    }
  },
  "dependency_mode": "advisory"
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `parallel_milestones` | `false` | Enable parallel milestone mode |
| `default_milestone` | `null` | Default milestone for unscoped commands |
| `milestones` | `{}` | Milestone definitions with dependencies |
| `dependency_mode` | `"advisory"` | `"advisory"` (warn) or `"strict"` (block) |

## STATE.md Schema (Parallel Mode)

```markdown
---
project: Nova Res
version: 2.0
parallel_milestones: true
active_milestones: [M1, M7]
---

# Project State

## Milestones

| ID | Name | Status | Progress | Current Phase | Blockers |
|----|------|--------|----------|---------------|----------|
| M1 | Full PubMed Ingestion | active | 80% | 3-bulk-ingestion | |
| M2 | RAG Quality | blocked | 20% | 1-query-transform | Waiting M1 |
| M7 | Patient Engagement | active | 40% | 2-compliance | |

## Position

milestone: M1
phase: 3
plan: 2
status: Executing plan 3-02

## Progress

Overall: [##########] 60%  (3/5 milestones progressing)

## Recent Activity

- 2026-02-27 14:30 - M7: Completed phase 1-fhir-foundation
- 2026-02-27 12:15 - M1: Started phase 3-bulk-ingestion
```

## Multi-Milestone Progress Display

```
# Project Name

## Milestone Progress

M1 Ingestion      [########--] 80%  Phase 3/5  <- active
M2 RAG Quality    [##--------] 20%  Phase 1/5
M4 Admin          [##########] 100% COMPLETE
M7 Patient Eng    [####------] 40%  Phase 2/4  <- active

## Overall
[######----] 60%  4 milestones, 2 active
```

## Backward Compatibility

**Legacy projects work unchanged:**
- No `.planning/milestones/` directory = legacy mode
- Commands without `M7/` prefix use `.planning/phases/` directly
- All existing workflows continue to function

**Mixed mode during transition:**
- Can have both `.planning/phases/` (legacy) and `.planning/milestones/`
- Legacy phases treated as implicit "default" milestone
- Gradual migration supported

## Workflow Integration

All GSD workflows support parallel milestones:

| Workflow | Parallel Support |
|----------|------------------|
| `/gsd:execute-phase M7/01` | Executes in milestone context |
| `/gsd:plan-phase M7/02` | Creates plan in milestone's phases/ |
| `/gsd:progress M7` | Shows milestone-specific progress |
| `/gsd:verify-work M7/01` | Verifies milestone phase |
| `/gsd:new-milestone` | Creates new parallel milestone |

## Use Cases

**When to use parallel milestones:**
- Multiple independent workstreams (e.g., M1: Backend, M2: Frontend)
- Regulatory tracks alongside feature development
- Team members working on different features simultaneously
- Long-running migrations with continued feature work

**When NOT to use:**
- Single linear progression
- Small projects with < 10 phases total
- Solo development with clear sequence

</parallel_milestones>
