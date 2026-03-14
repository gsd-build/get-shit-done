# GSD Parallel Milestones Support

**Status:** Draft
**Author:** Nova Res Team
**Created:** 2026-02-27
**Version:** 1.0

---

## Problem Statement

GSD currently assumes a **linear milestone progression** where:
- One milestone is active at a time
- Phases are numbered sequentially (01, 02, 03...)
- `.planning/phases/` contains all phases for the current milestone
- Completing a milestone archives it before starting the next

This breaks down for **parallel milestone execution** where:
- Multiple milestones run simultaneously (e.g., M1, M2, M4, M7)
- Each milestone has its own phase sequence
- Different agents work on different milestones concurrently
- Progress tracking needs per-milestone granularity

### Current Workarounds

| Workaround | Limitation |
|------------|------------|
| Milestone-prefixed phases (`M7-01-*`) | GSD progress tracking breaks |
| Separate git worktrees | Complex setup, scattered planning docs |
| Manual folder management | No GSD tooling support |

---

## Proposed Solution

### Nested Milestone Structure

```
.planning/
├── PROJECT.md                    # Shared project vision
├── STATE.md                      # Global state + per-milestone tracking
├── config.json                   # Global + milestone-specific config
├── PARALLEL_EXECUTION.md         # Cross-milestone coordination
│
├── milestones/
│   ├── M1-ingestion/
│   │   ├── ROADMAP.md            # M1-specific roadmap
│   │   ├── REQUIREMENTS.md       # M1-specific requirements
│   │   ├── STATE.md              # M1-specific state (optional)
│   │   └── phases/
│   │       ├── 01-legacy-cleanup/
│   │       ├── 02-parallel-infra/
│   │       └── 03-bulk-ingestion/
│   │
│   ├── M2-rag-quality/
│   │   ├── ROADMAP.md
│   │   ├── REQUIREMENTS.md
│   │   └── phases/
│   │       ├── 01-query-transform/
│   │       └── 02-multi-field/
│   │
│   ├── M4-admin/
│   │   ├── ROADMAP.md
│   │   └── phases/
│   │       └── 01-core-dashboards/
│   │
│   └── M7-patient-engagement/
│       ├── ROADMAP.md
│       ├── REQUIREMENTS.md
│       └── phases/
│           ├── 01-fhir-foundation/
│           ├── 02-compliance-engine/
│           └── 03-outreach-service/
│
├── research/                     # Shared research (optional)
└── codebase/                     # Shared codebase analysis
```

---

## User Stories

### US-1: Create Milestone

**As a** developer using GSD
**I want to** create a new milestone within my project
**So that** I can plan and execute it in parallel with other milestones

**Acceptance Criteria:**
- `gsd:new-milestone M7 "Patient Engagement"` creates `.planning/milestones/M7-patient-engagement/`
- Creates milestone-specific `ROADMAP.md` and `REQUIREMENTS.md`
- Updates global `STATE.md` with new milestone entry
- Does not affect other active milestones

---

### US-2: Plan Phase Within Milestone

**As a** developer
**I want to** plan a phase within a specific milestone
**So that** phase numbering is scoped to that milestone

**Acceptance Criteria:**
- `gsd:plan-phase M7/01` creates `.planning/milestones/M7-*/phases/01-*/`
- `gsd:plan-phase 01` in milestone context uses current milestone
- Phase numbers are independent per milestone (M1/01, M7/01 both valid)
- Research and plans are stored in milestone-scoped phase directory

---

### US-3: Execute Phase Within Milestone

**As a** developer
**I want to** execute a phase within a specific milestone
**So that** summaries and artifacts are properly scoped

**Acceptance Criteria:**
- `gsd:execute-phase M7/01` executes plans in M7's phase 01
- Summaries written to milestone-scoped phase directory
- Global `STATE.md` updated with milestone-specific progress
- Other milestones unaffected

---

### US-4: Track Progress Across Milestones

**As a** project lead
**I want to** see progress across all active milestones
**So that** I can coordinate parallel work streams

**Acceptance Criteria:**
- `gsd:progress` shows all milestones with individual progress bars
- `gsd:progress M7` shows detailed progress for specific milestone
- Global state tracks: milestone name, phase count, completion %, blockers
- Visual dashboard of parallel execution status

---

### US-5: Complete Individual Milestone

**As a** developer
**I want to** complete and archive a milestone independently
**So that** other milestones continue unaffected

**Acceptance Criteria:**
- `gsd:complete-milestone M4` archives only M4
- Creates `.planning/archive/M4-admin-v1.0/`
- Removes from active milestones in `STATE.md`
- Other milestones continue normally

---

### US-6: Coordinate Cross-Milestone Dependencies

**As a** developer
**I want to** define dependencies between milestones
**So that** GSD can warn about blocked work

**Acceptance Criteria:**
- `config.json` supports milestone dependency graph
- `gsd:progress` warns if dependent milestone not complete
- `gsd:plan-phase M2/01` warns if M1 not at required phase
- Dependencies are advisory (can be overridden)

---

## Technical Requirements

### TR-1: CLI Changes

| Current Command | New Command | Behavior |
|-----------------|-------------|----------|
| `gsd:new-milestone` | `gsd:new-milestone <id> "<name>"` | Creates milestone directory |
| `gsd:plan-phase 01` | `gsd:plan-phase [milestone/]phase` | Milestone-scoped planning |
| `gsd:execute-phase 01` | `gsd:execute-phase [milestone/]phase` | Milestone-scoped execution |
| `gsd:progress` | `gsd:progress [milestone]` | Global or milestone-specific |
| `gsd:complete-milestone` | `gsd:complete-milestone <id>` | Archive specific milestone |

**Milestone Context:**
- If CWD contains `.planning/milestones/M7-*/`, assume M7 context
- Explicit `M7/01` syntax always works
- `--milestone M7` flag as alternative

---

### TR-2: File Structure

```typescript
interface ProjectStructure {
  ".planning/": {
    "PROJECT.md": ProjectVision;
    "STATE.md": GlobalState;
    "config.json": GlobalConfig;
    "milestones/": {
      [milestoneDir: string]: {
        "ROADMAP.md": MilestoneRoadmap;
        "REQUIREMENTS.md"?: MilestoneRequirements;
        "STATE.md"?: MilestoneState;  // Optional override
        "phases/": {
          [phaseDir: string]: PhaseDirectory;
        };
      };
    };
  };
}

interface GlobalState {
  project: string;
  milestones: {
    [id: string]: {
      name: string;
      directory: string;
      status: "active" | "complete" | "blocked";
      current_phase: number | null;
      phase_count: number;
      completed_count: number;
      progress_percent: number;
      dependencies: string[];  // Other milestone IDs
      blockers: string[];
    };
  };
  active_milestone_count: number;
  last_activity: {
    milestone: string;
    phase: string;
    timestamp: string;
  };
}
```

---

### TR-3: Config Schema

```json
{
  "version": "2.0",
  "parallel_milestones": true,
  "milestones": {
    "M1": {
      "name": "Full PubMed Ingestion",
      "tag": "MVP",
      "dependencies": [],
      "max_agents": 7
    },
    "M7": {
      "name": "Patient Engagement",
      "tag": "MVP",
      "dependencies": ["M1"],
      "max_agents": 3
    }
  },
  "dependency_mode": "advisory",  // "advisory" | "strict"
  "default_milestone": "M1"
}
```

---

### TR-4: gsd-tools.cjs Changes

| Function | Change |
|----------|--------|
| `init` | Return `milestones[]` array with per-milestone status |
| `progress bar` | Support `--milestone M7` flag |
| `roadmap analyze` | Accept milestone path parameter |
| `state-snapshot` | Include all milestones or filter by ID |

**New Functions:**
- `milestone list` - List all milestones with status
- `milestone create <id> <name>` - Create milestone directory
- `milestone switch <id>` - Set default milestone context
- `milestone dependencies <id>` - Show dependency graph

---

### TR-5: Progress Display

**Global Progress:**
```
# Nova Res

## Milestone Progress

M1 Ingestion      [████████░░] 80%  Phase 3/5  ← active
M2 RAG Quality    [██░░░░░░░░] 20%  Phase 1/5
M4 Admin          [██████████] 100% COMPLETE
M7 Patient Eng    [████░░░░░░] 40%  Phase 2/4  ← active

## Overall MVP
[██████░░░░] 60%  Target: Week 6
```

**Milestone-Specific Progress:**
```
# M7: Patient Engagement

**Progress:** [████░░░░░░] 2/4 phases (40%)

## Phases
01-fhir-foundation     [██████] 3/3 plans ✓ COMPLETE
02-compliance-engine   [████░░] 2/3 plans   IN PROGRESS
03-outreach-service    [░░░░░░] 0/2 plans   PLANNED
04-provider-dashboard  [░░░░░░] not started

## Dependencies
- M1 (Ingestion): ✓ 80% - sufficient for M7 work
```

---

## Migration Path

### Phase 1: Backward Compatible

1. Detect existing `.planning/phases/` structure
2. Treat as single "default" milestone
3. New milestones created in `.planning/milestones/`
4. Mixed mode supported during transition

### Phase 2: Migration Tool

```bash
gsd:migrate-to-parallel

# Prompts:
# - Identify milestone boundaries in existing phases
# - Create milestone directories
# - Move phases to appropriate milestones
# - Update STATE.md and config.json
```

### Phase 3: Full Parallel Mode

1. All phases under `.planning/milestones/`
2. Legacy `.planning/phases/` deprecated
3. Commands require milestone context

---

## Success Criteria

| Criteria | Metric |
|----------|--------|
| Multiple milestones can be created | `gsd:new-milestone` creates isolated structure |
| Phases are milestone-scoped | Phase 01 exists in multiple milestones |
| Progress tracks per-milestone | `gsd:progress` shows accurate per-milestone % |
| No cross-milestone interference | Completing M4 doesn't affect M7 |
| Dependencies are enforced | Warning when planning blocked milestone |
| Migration is seamless | Existing projects upgrade without data loss |
| Parallel agents supported | 10+ agents across milestones without conflict |

---

## Open Questions

1. **Shared vs. duplicated research?**
   - Should `research/` be global or per-milestone?
   - Proposal: Global by default, milestone-specific if needed

2. **Cross-milestone phases?**
   - What if a phase spans milestones (e.g., integration testing)?
   - Proposal: Create in primary milestone, reference from others

3. **Worktree integration?**
   - Should parallel milestones recommend worktrees?
   - Proposal: Optional - worktrees for file isolation, nested structure for planning isolation

4. **Archive structure?**
   - Archive per-milestone or entire project?
   - Proposal: Per-milestone with `gsd:complete-milestone M4`

---

## References

- Current GSD workflows: `~/.claude/get-shit-done/workflows/`
- Nova Res parallel execution: `.planning/PARALLEL_EXECUTION.md`
- Related issue: Multi-agent coordination for 10-20 parallel agents

---

*Spec created: 2026-02-27*
*Target GSD version: 2.0*
