# GSD User Journey — End-to-End Flow (Corrected)

> **Purpose:** Complete user journey from idea to shipped milestone, showing all decision points, context flow, and what persists vs resets.
> **Usage:** Load when understanding the holistic system flow or debugging why context was lost.
> **Version:** v1.1 (Corrected 2026-01-18)
> **Verified Against:** Source code 2026-01-18

---

## The Complete Lifecycle

```
IDEA → new-project → [plan → execute → verify]×N → audit-milestone → complete-milestone → new-milestone → ...
```

### Phase-Level Loop (Repeated N Times)

```
            ┌──────────────────────────────────────────┐
            │         PHASE LIFECYCLE                   │
            │                                          │
            │   discuss-phase (optional)               │
            │        ↓                                 │
            │   plan-phase                             │
            │        ↓  ↗ revision loop (max 3)        │
            │   [planner ↔ plan-checker]              │
            │        ↓                                 │
            │   execute-phase                          │
            │        ↓                                 │
            │   [executor ×N → verifier]              │
            │        ↓                                 │
            │   gaps? ─yes→ plan-phase --gaps         │
            │        │           ↓                     │
            │        │      execute-phase --gaps-only  │
            │        │                                 │
            │        no                                │
            │        ↓                                 │
            │   verify-work (optional UAT)             │
            │        ↓                                 │
            │   issues? ─yes→ debugger → plan --gaps  │
            │        │                                 │
            │        no                                │
            │        ↓                                 │
            │   NEXT PHASE                             │
            └──────────────────────────────────────────┘
```

### Milestone-Level Loop

```
            ┌──────────────────────────────────────────┐
            │       MILESTONE LIFECYCLE                 │
            │                                          │
            │   [Phase Loop ×N]                        │
            │        ↓                                 │
            │   audit-milestone                        │
            │        ↓                                 │
            │   [integration-checker]                  │
            │        ↓                                 │
            │   gaps? ─yes→ plan-milestone-gaps        │
            │        │           ↓                     │
            │        │      [Phase Loop for gaps]      │
            │        │                                 │
            │   tech_debt? ─→ review & decide         │
            │        │                                 │
            │        passed                            │
            │        ↓                                 │
            │   complete-milestone                     │
            │        ↓                                 │
            │   new-milestone → [repeat]              │
            └──────────────────────────────────────────┘
```

---

## Decision Points Catalog

Every point where the system pauses for user input:

### Project Initialization

| Point | Command | User Provides | System Creates |
|-------|---------|---------------|----------------|
| **1** | new-project | Project vision (deep questioning) | PROJECT.md |
| **2** | new-project | Research? (yes/no) | research/ files |
| **3** | new-project | Requirements (v1/v2/out) | REQUIREMENTS.md |
| **4** | new-project | Workflow preferences | config.json |

### Phase Planning

| Point | Command | User Provides | System Creates |
|-------|---------|---------------|----------------|
| **5** | discuss-phase | Implementation decisions | CONTEXT.md |
| **6** | plan-phase | (auto unless checkpoint) | PLAN.md files |
| **7** | plan-phase revision | Accept/reject checker feedback | Updated PLAN.md |

### Phase Execution

| Point | Command | User Provides | System Creates |
|-------|---------|---------------|----------------|
| **8** | execute-phase | Checkpoint responses | Code + SUMMARY.md |
| **9** | execute-phase | human-verify: Did it work? | Continue/stop |
| **10** | execute-phase | human-action: Complete step | Continue |
| **11** | execute-phase | decision: Which option? | Implementation |

### Phase Verification

| Point | Command | User Provides | System Creates |
|-------|---------|---------------|----------------|
| **12** | verify-work (UAT) | Test results (pass/fail/issue) | UAT.md |
| **13** | verify-work | Approve gap closure plans | Gap PLAN.md files |

### Milestone

| Point | Command | User Provides | System Creates |
|-------|---------|---------------|----------------|
| **14** | audit-milestone | Accept audit or plan gaps | MILESTONE-AUDIT.md |
| **14a** | plan-milestone-gaps | Approve gap closure phases | Gap closure phases in ROADMAP |
| **15** | complete-milestone | Version number | Archive + git tag |
| **16** | new-milestone | What's next? (deep questioning) | New ROADMAP.md |

---

## Context Flow Between Agents

What data passes between agents and how:

### Project Init Flow

```
User Input
    ↓
/gsd:new-project
    ├── Deep questioning → PROJECT.md (if new project)
    ├── → gsd-project-researcher (×4 parallel)
    │       ├── STACK.md (tech)
    │       ├── FEATURES.md (features)
    │       ├── ARCHITECTURE.md (arch)
    │       └── PITFALLS.md (pitfalls)
    │           ↓
    └── → gsd-research-synthesizer
            └── SUMMARY.md
                ↓
        → gsd-roadmapper
            ├── ROADMAP.md (phases + goals + criteria)
            └── STATE.md (current position)
```

### Phase Planning Flow

```
STATE.md + ROADMAP.md (phase goal)
    ↓
/gsd:plan-phase
    ├── → gsd-phase-researcher
    │       └── {phase}-RESEARCH.md
    │           ↓
    └── → gsd-planner
            ├── Reads: STATE, ROADMAP, REQUIREMENTS, CONTEXT, RESEARCH
            └── Writes: {phase}-{plan}-PLAN.md (1-5 files)
                ↓
        → gsd-plan-checker
            ├── Reads: All PLAN.md files
            └── Returns: PASSED or ISSUES (structured)
                ↓
        [If issues → gsd-planner revision mode → max 3 loops]
```

### Phase Execution Flow

```
PLAN.md files (with wave assignments)
    ↓
/gsd:execute-phase
    ├── Wave 1: gsd-executor (×N parallel)
    │       ├── Reads: PLAN.md, STATE.md, @-references
    │       └── Writes: Code + {phase}-{plan}-SUMMARY.md
    │           ↓
    ├── Wave 2: gsd-executor (×N parallel)
    │       └── ... (depends on Wave 1 outputs)
    │           ↓
    └── → gsd-verifier
            ├── Reads: PLAN.md (must_haves), SUMMARY.md, codebase
            └── Writes: {phase}-VERIFICATION.md
                ↓
        [If gaps → offer /gsd:plan-phase --gaps]
            ↓
        [If --gaps created → /gsd:execute-phase --gaps-only]
```

### UAT Flow

```
SUMMARY.md files (accomplishments)
    ↓
/gsd:verify-work
    ├── Extract testable behaviors
    ├── Present one at a time to user
    │       ↓
    └── User response: pass / issue
            ↓
        → UAT.md
            ↓
        [If issues → gsd-debugger (×N parallel)]
            └── Diagnose root causes
                ↓
            → gsd-planner (--gaps mode)
                └── Gap closure PLAN.md files
```

### Milestone Audit Flow

```
VERIFICATION.md files (all phases)
    ↓
/gsd:audit-milestone
    ├── Read all phase verifications
    ├── Aggregate tech debt and gaps
    ├── → gsd-integration-checker
    │       ├── Verify cross-phase wiring (exports → imports)
    │       ├── Verify API coverage (routes → consumers)
    │       └── Verify E2E flows (complete paths)
    │           ↓
    └── MILESTONE-AUDIT.md
            ↓
        Status: passed | gaps_found | tech_debt
            ↓
        [If gaps → /gsd:plan-milestone-gaps]
            └── Gap closure phases added to ROADMAP
                ↓
            [Phase Loop for gap phases]
```

---

## What Persists vs What Resets

### Survives `/clear` (File-Based State)

| Artifact | Location | Purpose |
|----------|----------|---------|
| PROJECT.md | .planning/ | Core project context |
| STATE.md | .planning/ | Current position, decisions, blockers |
| ROADMAP.md | .planning/ | Phase structure, goals |
| REQUIREMENTS.md | .planning/ | Feature requirements |
| config.json | .planning/ | Workflow preferences |
| PLAN.md | .planning/phases/XX-*/ | Execution instructions |
| SUMMARY.md | .planning/phases/XX-*/ | What was accomplished |
| CONTEXT.md | .planning/phases/XX-*/ | User decisions |
| RESEARCH.md | .planning/phases/XX-*/ | Implementation guidance |
| VERIFICATION.md | .planning/phases/XX-*/ | Verification results |
| UAT.md | .planning/phases/XX-*/ | User acceptance test results |
| DEBUG.md | .planning/debug/ | Debug session state |
| .continue-here.md | .planning/ | Mid-task handoff |
| MILESTONE-AUDIT.md | .planning/ | Milestone audit results |

### Resets on `/clear` (Context-Based)

| Item | What Happens | How to Restore |
|------|--------------|----------------|
| Current conversation | Lost | /gsd:resume-work reads STATE.md |
| In-progress agent work | Lost | .continue-here.md captures state |
| User's verbal preferences | Lost | Captured in CONTEXT.md if discussed |
| Debug investigation state | Survives | DEBUG.md persists |
| Checkpoint state | Lost | execute-phase continuation protocol |

### Recovery Protocols

| Scenario | Command | What It Does |
|----------|---------|--------------|
| Returning to project | `/gsd:resume-work` | Reads STATE.md, shows status, routes to next action |
| Context filled mid-task | (automatic) | .continue-here.md written before checkpoint |
| Debug session interrupted | `/gsd:debug` | Resumes from DEBUG.md |
| Forgot where I was | `/gsd:progress` | Shows status + intelligent routing |

---

## Context Budget Through the Flow

How context fills at each stage:

| Stage | Orchestrator Context | Agent Context | Key Files Loaded |
|-------|---------------------|---------------|------------------|
| new-project questioning | 10-15% | — | PROJECT.md template |
| new-project research | 10-15% | 30-40% per researcher | Domain docs |
| new-project roadmapping | 10-15% | 40-50% | REQUIREMENTS + SUMMARY |
| plan-phase research | 10-15% | 30-40% | Phase docs + Context7 |
| plan-phase planning | 10-15% | 40-50% | STATE, ROADMAP, RESEARCH, CONTEXT |
| plan-phase checking | 10-15% | 30-40% | All PLAN.md files |
| execute-phase per plan | 10-15% | 40-50% | PLAN.md + @-references |
| execute-phase verification | 10-15% | 40-50% | must_haves + codebase |
| verify-work UAT | 15-20% | — | SUMMARYs for testables |
| verify-work debugging | 10-15% | 30-40% per issue | Codebase + errors |
| audit-milestone | 10-15% | 30-40% | VERIFICATIONs + codebase |

**Key insight:** Orchestrators stay lean (10-15%); agents do heavy lifting (40-50%); this is why GSD spawns fresh agents instead of loading everything into one context.

---

## State Machine: Project Status

```
                    ┌──────────────────────────┐
                    │      NOT_INITIALIZED     │
                    └────────────┬─────────────┘
                                 │ /gsd:new-project
                                 ▼
                    ┌──────────────────────────┐
          ┌────────│      PHASE_PENDING       │◄───────────┐
          │        └────────────┬─────────────┘            │
          │                     │ /gsd:plan-phase          │
          │                     ▼                          │
          │        ┌──────────────────────────┐            │
          │        │      PHASE_PLANNED       │            │
          │        └────────────┬─────────────┘            │
          │                     │ /gsd:execute-phase       │
          │                     ▼                          │
          │        ┌──────────────────────────┐            │
          │        │     PHASE_EXECUTING      │            │
          │        └────────────┬─────────────┘            │
          │                     │ All plans complete       │
          │                     ▼                          │
          │        ┌──────────────────────────┐            │
          │  gaps  │     PHASE_VERIFYING      │────────────┤
          │  found └────────────┬─────────────┘            │
          │                     │ Verification passed      │
          │                     ▼                          │ More
          │        ┌──────────────────────────┐            │ phases
          │        │     PHASE_COMPLETE       │────────────┘
          │        └────────────┬─────────────┘
          │                     │ Last phase
          │                     ▼
          │        ┌──────────────────────────┐
          │        │   MILESTONE_AUDITING     │◄───────────┐
          │        └────────────┬─────────────┘            │
          │                     │                          │ Gaps
          │                     │ Audit passed             │ found
          │                     ▼                          │
          │        ┌──────────────────────────┐            │
          │        │   MILESTONE_PENDING      │────────────┘
          │        └────────────┬─────────────┘
          │                     │ /gsd:complete-milestone
          │                     ▼
          │        ┌──────────────────────────┐
          └───────►│   MILESTONE_COMPLETE     │
                   └──────────────────────────┘
                                 │ /gsd:new-milestone
                                 ▼
                              (restart at PHASE_PENDING)
```

---

## Quick Reference: "Where Am I?"

| I see... | I'm in... | Next command |
|----------|-----------|--------------|
| No .planning/ folder | Not initialized | `/gsd:new-project` |
| ROADMAP.md, no PLAN.md in phase | Phase pending | `/gsd:discuss-phase N` or `/gsd:plan-phase N` |
| PLAN.md exists, no SUMMARY.md | Phase planned | `/gsd:execute-phase N` |
| SUMMARY.md exists, no VERIFICATION.md | Execution complete | (auto-triggers verifier) |
| VERIFICATION.md with gaps | Gaps found | `/gsd:plan-phase N --gaps` |
| All phases complete, no MILESTONE-AUDIT.md | Audit pending | `/gsd:audit-milestone` |
| MILESTONE-AUDIT.md with gaps_found | Gaps need closure | `/gsd:plan-milestone-gaps` |
| MILESTONE-AUDIT.md with passed | Ready to complete | `/gsd:complete-milestone` |
| .continue-here.md exists | Mid-task pause | `/gsd:resume-work` |
| DEBUG.md with status != resolved | Debug in progress | `/gsd:debug` |

---

## Typical Session Patterns

### Pattern A: Fresh Start (3-4 hours)
```
/gsd:new-project
    ↓ (deep questioning, 15 min)
/clear
/gsd:discuss-phase 1
    ↓ (context gathering, 10 min)
/clear
/gsd:plan-phase 1
    ↓ (planning + verification, auto)
/clear
/gsd:execute-phase 1
    ↓ (execution, 30-60 min per plan)
/gsd:verify-work 1
    ↓ (UAT, 10 min)
[repeat for phases 2-N]
/clear
/gsd:audit-milestone
    ↓ (integration check)
/gsd:complete-milestone 1.0
```

### Pattern B: Return to Project (resuming)
```
/gsd:resume-work
    ↓ (reads STATE.md, shows context)
    → Routes to appropriate next command
```

### Pattern C: Context Filled Mid-Task
```
[Working on /gsd:execute-phase]
    ↓ (context fills to 70%+)
[Claude notices degradation, creates .continue-here.md]
/clear
/gsd:resume-work
    ↓ (detects .continue-here.md)
    → Continues from checkpoint
```

### Pattern D: Gap Closure After Verification
```
/gsd:execute-phase 3
    ↓ (verifier finds gaps)
/clear
/gsd:plan-phase 3 --gaps
    ↓ (creates gap closure plans)
/clear
/gsd:execute-phase 3 --gaps-only
    ↓ (executes only the new gap plans)
```

### Pattern E: Milestone Gap Closure
```
/gsd:audit-milestone
    ↓ (integration checker finds cross-phase issues)
/clear
/gsd:plan-milestone-gaps
    ↓ (creates new phases to close gaps)
/clear
[Phase Loop for gap phases]
    ↓
/gsd:audit-milestone
    ↓ (re-verify)
/gsd:complete-milestone 1.0
```

---

## Checkpoint Types Reference

Three checkpoint types pause execution for user input:

| Type | When Used | User Action | Example |
|------|-----------|-------------|---------|
| `human-verify` | After visible change | Confirm it looks right | "Check the login form renders correctly" |
| `human-action` | External action needed | Complete action, report | "Run database migration, confirm success" |
| `decision` | Implementation choice | Choose option | "Use JWT or sessions for auth?" |

---

## Version

- **Documentation Version:** v1.1 (Corrected)
- **GSD Version:** 1.6.3
- **Generated:** 2026-01-18
- **Verified Against:** Source code

### Changelog from v1.0
- Added MILESTONE_AUDITING state to state machine
- Added milestone audit decision points (14, 14a)
- Added Milestone Audit Flow to context flows
- Added execute-phase --gaps-only to phase loop
- Added /gsd:plan-milestone-gaps to quick reference
- Added Pattern D and E to session patterns
- Added Checkpoint Types Reference section
- Fixed quick reference "Where Am I?" table with audit states
