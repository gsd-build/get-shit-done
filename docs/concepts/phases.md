# Phases

A **Phase** is a coherent unit of work that delivers a specific outcome within a milestone. Phases are defined in the roadmap but are too large to execute directly — they're broken into executable plans.

## Overview

| Attribute | Value |
|-----------|-------|
| **Location** | Defined in `ROADMAP.md`, directory at `.planning/phases/{NN}-{name}/` |
| **Created by** | `/gsd:new-project` or `/gsd:new-milestone` (roadmap creation) |
| **Planned by** | `/gsd:plan-phase` |
| **Executed by** | `/gsd:execute-phase` |

## Purpose

A phase:
- Delivers observable value that can be verified
- Maps to specific requirements
- Has clear success criteria
- Contains 1-3+ executable plans

## Phase Structure in ROADMAP.md

```markdown
## Phases

- [ ] **Phase 1: Foundation** - Project setup and core infrastructure
- [ ] **Phase 2: Authentication** - User signup, login, and sessions
- [ ] **Phase 3: Features** - Core product functionality
- [x] **Phase 4: Polish** - UI refinement and bug fixes ✓

## Phase Details

### Phase 2: Authentication
**Goal**: Users can securely sign up, log in, and maintain sessions
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):
  1. User can create account via signup form
  2. User can log in with email/password
  3. Session persists across browser refresh
  4. User can reset forgotten password
**Plans**: 3 plans

Plans:
- [ ] 02-01: JWT auth with refresh rotation
- [ ] 02-02: Protected route middleware
- [ ] 02-03: Password reset flow
```

## Phase Numbering

### Integer Phases (Normal)
Standard milestone work, numbered sequentially:
- Phase 1, Phase 2, Phase 3...

### Decimal Phases (Urgent Insertions)
For critical work discovered mid-milestone:
- Phase 2.1, Phase 2.2, Phase 3.1...

**Execution order:** 2 → 2.1 → 2.2 → 3 → 3.1 → 4

**Marked in ROADMAP.md:**
```markdown
### Phase 2.1: Critical Security Patch (INSERTED)
```

### Continuous Numbering
Phase numbers **never restart** between milestones:
- v1.0: Phases 1-4
- v1.1: Phases 5-7
- v2.0: Phases 8-12

## Phase Directory Structure

```
.planning/phases/01-foundation/
├── 01-CONTEXT.md           # Optional: User decisions from /gsd:discuss-phase
├── 01-RESEARCH.md          # Optional: Domain research
├── 01-01-PLAN.md           # Plan 1
├── 01-01-SUMMARY.md        # Created after execution
├── 01-02-PLAN.md           # Plan 2
├── 01-02-SUMMARY.md
├── 01-03-PLAN.md           # Plan 3
├── 01-03-SUMMARY.md
├── 01-VERIFICATION.md      # Created after all plans complete
└── .continue-here.md       # Optional: Resume handoff
```

## Phase Lifecycle

### Stage 1: Planning

#### `/gsd:discuss-phase [N]` (Optional)
Clarify decisions before planning:
- Presents gray areas (UI, behavior, etc.)
- Creates `{phase}-CONTEXT.md` with locked decisions
- Prevents re-exploring settled questions

#### `/gsd:plan-phase [N]`
Create executable plans:

```
/gsd:plan-phase 2
    ↓
1. Research (optional) → RESEARCH.md
    ↓
2. Planning → PLAN.md files
    ↓
3. Verification → Plan checker validates
    ↓
✓ Ready for execution
```

**Flags:**
- `--research` — Force re-research
- `--skip-research` — Skip research entirely
- `--gaps` — Gap closure mode (reads VERIFICATION.md)
- `--skip-verify` — Skip plan verification loop

### Stage 2: Execution

#### `/gsd:execute-phase [N]`
Execute all plans with wave-based parallelization:

```
/gsd:execute-phase 2
    ↓
Wave 1: Plans 02-01, 02-02 (parallel)
    ↓
Wave 2: Plan 02-03 (depends on Wave 1)
    ↓
Verification: gsd-verifier checks must_haves
    ↓
✓ Phase complete
```

### Stage 3: Verification

After execution, `gsd-verifier` checks:
- **Truths** — Observable behaviors work
- **Artifacts** — Files exist with real implementation
- **Key Links** — Components properly connected

**Statuses:**
- `passed` — Goal achieved
- `gaps_found` — Need additional plans
- `human_needed` — Manual testing required

## Phase vs Plan

| Aspect | PHASE | PLAN |
|--------|-------|------|
| **Scope** | "What outcome?" | "What exact steps?" |
| **Granularity** | 1-3+ plans | 2-3 tasks |
| **Parallelization** | Sequential (1 → 2 → 3) | Wave-based parallel |
| **File type** | Directory + ROADMAP entry | Single `.md` file |
| **Verification** | Phase-level VERIFICATION.md | Plan-level SUMMARY.md |

## Phase Management Commands

| Command | Purpose |
|---------|---------|
| `/gsd:add-phase [name]` | Add phase to end of milestone |
| `/gsd:insert-phase [N.N] [name]` | Insert urgent decimal phase |
| `/gsd:remove-phase [N]` | Remove future phase, renumber |
| `/gsd:discuss-phase [N]` | Clarify before planning |
| `/gsd:list-phase-assumptions [N]` | Surface Claude's assumptions |
| `/gsd:plan-phase [N]` | Create executable plans |
| `/gsd:execute-phase [N]` | Run all plans |

## Wave-Based Execution

Plans are grouped by `wave` number for parallelization:

```yaml
# 02-01-PLAN.md
wave: 1
depends_on: []         # No dependencies → Wave 1

# 02-02-PLAN.md
wave: 1
depends_on: []         # No dependencies → Wave 1

# 02-03-PLAN.md
wave: 2
depends_on: ["02-01", "02-02"]  # Depends on both → Wave 2
```

**Result:** Plans 02-01 and 02-02 run in parallel. Plan 02-03 waits for both.

## Goal-Backward Verification

Verification checks that the **phase goal was achieved**, not just tasks completed.

**Must-haves** (from PLAN.md frontmatter):
```yaml
must_haves:
  truths:                           # Observable behaviors
    - "User can log in with email/password"
    - "Session persists across refresh"

  artifacts:                        # Files that must exist
    - path: "src/auth/login.ts"
      provides: "Login endpoint"

  key_links:                        # Critical connections
    - from: "src/components/LoginForm.tsx"
      to: "/api/auth/login"
      via: "form submission"
```

## Gap Closure

When verification finds gaps:

1. User sees: "Phase 2 — Gaps Found"
2. Run: `/gsd:plan-phase 2 --gaps`
3. Planner creates gap closure plans (04, 05, etc.)
4. Run: `/gsd:execute-phase 2 --gaps-only`
5. Verifier runs again
6. Loop until passed

## Best Practices

1. **Clear goals** — "Users can X" not "Implement X"
2. **Observable success criteria** — What user can do/see
3. **2-4 plans per phase** — Not too many, not too few
4. **Vertical slices** — Feature complete over horizontal layers
5. **Discuss complex phases** — Use `/gsd:discuss-phase` for clarity

## Related Concepts

- [Plans](plans.md) — Executable units within phases
- [Milestones](milestones.md) — Collections of phases
- [Projects](projects.md) — Strategic container
