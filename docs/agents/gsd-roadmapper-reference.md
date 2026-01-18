# gsd-roadmapper.md — Enhanced Reference (Code-Verified)

## Metadata
| Attribute | Value |
|-----------|-------|
| **Type** | Agent |
| **Location** | `agents/gsd-roadmapper.md` |
| **Size** | 606 lines |
| **Documentation Tier** | Enhanced Standard |
| **Complexity Score** | 2+2+2+2 = **8/12** |
| **Verified Against** | Source code 2026-01-18 |

---

## Purpose

Creates project roadmaps that map requirements to phases with goal-backward success criteria. Transforms requirements into a phase structure where every v1 requirement maps to exactly one phase, and every phase has observable success criteria (2-5 user-verifiable behaviors). Initializes STATE.md for project memory.

---

## Critical Behaviors

| Constraint | Rule | Source Section |
|------------|------|----------------|
| Derive phases from requirements | Let work determine phases, not template ("Setup → Core → Features → Polish") | `<philosophy>` |
| 100% coverage validation | Every v1 requirement maps to exactly one phase; no orphans, no duplicates | `<coverage_validation>` |
| Goal-backward thinking | "What must be TRUE for users?" not "What should we build?" | `<goal_backward_phases>` |
| Write files FIRST, then return | Ensures artifacts persist even if context is lost | `<execution_flow>` Step 7 |
| Anti-enterprise | No time estimates, sprints, resource allocation, stakeholder management | `<philosophy>` |

---

## Anti-Enterprise Philosophy (CRITICAL)

**Source:** `<philosophy>` lines ~20-50

You are roadmapping for ONE person (the user) and ONE implementer (Claude).
- No teams, stakeholders, sprints, resource allocation
- User is the visionary/product owner
- Claude is the builder
- Phases are buckets of work, not project management artifacts

**NEVER include phases for:**
- Team coordination, stakeholder management
- Sprint ceremonies, retrospectives
- Documentation for documentation's sake
- Change management processes

If it sounds like corporate PM theater, delete it.

---

## Goal-Backward Phase Derivation

**Source:** `<goal_backward_phases>`

**Forward planning asks:** "What should we build in this phase?"
**Goal-backward asks:** "What must be TRUE for users when this phase completes?"

**Process:**
1. **State phase goal** as outcome (not task)
   - Good: "Users can securely access their accounts"
   - Bad: "Build authentication"

2. **Derive 2-5 observable truths**
   - What users can observe/do when phase completes
   - Each truth should be verifiable by a human using the app

3. **Cross-check against requirements**
   - Each criterion supported by requirement
   - Each requirement supports a criterion

4. **Resolve gaps**
   - Gap in criteria: Add requirement or mark out of scope
   - Gap in requirement: Create phase or defer to v2

**Example:**
```
Phase Goal: "Users can securely access their accounts"

Observable Truths:
1. User can register with email/password ← AUTH-01
2. User can log in with credentials ← AUTH-02
3. User stays logged in across sessions ← AUTH-03
4. User can reset forgotten password ← ??? GAP

Requirements: AUTH-01, AUTH-02, AUTH-03

Gap: Criterion 4 (password reset) has no requirement.

Options:
1. Add AUTH-04: "User can reset password via email link"
2. Remove criterion 4 (defer password reset to v2)
```

---

## Phase Numbering Convention (CRITICAL)

**Source:** `<phase_identification>`

| Type | Format | Purpose | Example |
|------|--------|---------|---------|
| **Integer phases** | 1, 2, 3 | Planned milestone work | Phase 1: Setup |
| **Decimal phases** | 2.1, 2.2 | Urgent insertions after planning | Phase 2.1: Hotfix Auth |

**Execution order:** 1 → 1.1 → 1.2 → 2 → 2.1 → 3

**When to use decimal phases:**
- Created via `/gsd:insert-phase`
- For urgent work discovered mid-milestone
- Execute between integers

**Starting number:**
- New milestone: Start at 1
- Continuing milestone: Check existing phases, start at last + 1

---

## Depth Calibration

**Source:** `<phase_identification>`

Read depth from `config.json`. Depth controls compression tolerance:

| Depth | Typical Phases | Guidance |
|-------|----------------|----------|
| **Quick** | 3-5 | Combine aggressively, critical path only |
| **Standard** | 5-8 | Balanced grouping |
| **Comprehensive** | 8-12 | Let natural boundaries stand |

**Key:** Derive phases from work, then apply depth as compression guidance. Don't pad small projects or compress complex ones.

---

## Phase Patterns

**Source:** `<phase_identification>`

**Good — Vertical Slices:**
```
Phase 1: Setup (project scaffolding)
Phase 2: Auth (complete feature)
Phase 3: Content (complete feature)
Phase 4: Social (complete feature)
```

**Bad — Horizontal Layers:**
```
Phase 1: All database models ← Too coupled
Phase 2: All API endpoints ← Can't verify independently
Phase 3: All UI components ← Nothing works until end
```

**Good boundaries:**
- Complete a requirement category
- Enable a user workflow end-to-end
- Unblock the next phase

**Bad boundaries:**
- Arbitrary technical layers
- Partial features
- Artificial splits to hit a number

---

## Coverage Validation

**Source:** `<coverage_validation>`

After phase identification, verify every v1 requirement is mapped:

```
AUTH-01 → Phase 2
AUTH-02 → Phase 2
AUTH-03 → Phase 2
PROF-01 → Phase 3
PROF-02 → Phase 3
...

Mapped: 12/12 ✓
```

**If orphaned requirements found:**
```
⚠️ Orphaned requirements (no phase):
- NOTF-01: User receives in-app notifications
- NOTF-02: User receives email for followers

Options:
1. Create Phase 6: Notifications
2. Add to existing Phase 5
3. Defer to v2 (update .planning/REQUIREMENTS.md)
```

**Do not proceed until coverage = 100%.**

---

## Output Files

**Source:** `<output_formats>`

### ROADMAP.md Structure

Use the template at `get-shit-done/templates/roadmap.md`.

Key elements to preserve from the template:
- Overview paragraph (single paragraph summary of the journey)
- Phase list with checkbox status and one-line descriptions
- Phase Details blocks with **Goal**, **Depends on**, **Requirements**, **Success Criteria**, and **Plans** count
- Plans checklist entries (e.g., `01-01`, `02-02`) for each phase
- Progress table with plans-complete counts, status, and completion date
- Decimal phases labeled as INSERTED and ordered numerically between integers

### STATE.md Structure

Use the template at `get-shit-done/templates/state.md`.

Key elements to preserve from the template:
- Project Reference pointing to `.planning/PROJECT.md`
- Current Position with phase/plan indices, status, last activity, and progress bar
- Performance Metrics (velocity, phase breakdown, recent trend)
- Accumulated Context (Decisions, Pending Todos, Blockers/Concerns)
- Session Continuity with last session info and resume file path

---

## Execution Flow

**Source:** `<execution_flow>`

```
Step 1: Receive Context
├── .planning/PROJECT.md content (core value, constraints)
├── .planning/REQUIREMENTS.md content (v1 requirements with REQ-IDs)
├── research/SUMMARY.md content (if exists)
└── config.json (depth setting)

Step 2: Extract Requirements
├── Parse .planning/REQUIREMENTS.md
├── Count total v1 requirements
├── Extract categories (AUTH, CONTENT, etc.)
└── Build requirement list with IDs

Step 3: Load Research Context (if exists)
├── Extract suggested phase structure
├── Note research flags
└── Use as input, not mandate

Step 4: Identify Phases
├── Group requirements by natural delivery boundaries
├── Identify dependencies between groups
├── Create phases that complete coherent capabilities
└── Check depth setting for compression guidance

Step 5: Derive Success Criteria
├── For each phase, apply goal-backward
├── State phase goal (outcome, not task)
├── Derive 2-5 observable truths
└── Cross-check against requirements

Step 6: Validate Coverage
├── Every v1 requirement → exactly one phase
├── No orphans, no duplicates
└── If gaps found, include in draft for user decision

Step 7: Write Files IMMEDIATELY
├── Write ROADMAP.md
├── Write STATE.md
├── Update .planning/REQUIREMENTS.md traceability section
└── Files on disk = context preserved

Step 8: Return Summary
└── ROADMAP CREATED with summary

Step 9: Handle Revision (if needed)
├── Parse user feedback
├── Update files in place (Edit, not rewrite)
├── Re-validate coverage
└── Return ROADMAP REVISED
```

---

## Interactions

| Category | Details |
|----------|---------|
| **Reads** | .planning/PROJECT.md (core value), .planning/REQUIREMENTS.md (v1 reqs), research/SUMMARY.md (if exists), config.json (depth) |
| **Writes** | `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/REQUIREMENTS.md` traceability update |
| **Spawned By** | `/gsd:new-project` |
| **Consumed By** | `/gsd:plan-phase`, `gsd-planner`, `gsd-verifier` |

---

## Structured Returns

### Roadmap Created
```markdown
## ROADMAP CREATED

**Files written:**
- .planning/ROADMAP.md
- .planning/STATE.md

**Updated:**
- .planning/REQUIREMENTS.md (traceability section)

### Summary

**Phases:** {N}
**Depth:** {from config}
**Coverage:** {X}/{X} requirements mapped ✓

| Phase | Goal | Requirements |
|-------|------|--------------|
| 1 - {name} | {goal} | {req-ids} |
| 2 - {name} | {goal} | {req-ids} |

### Success Criteria Preview
[Abbreviated criteria for first 2 phases]
```

### Roadmap Blocked
```markdown
## ROADMAP BLOCKED

**Blocked by:** {issue}

### Options
1. {Resolution option}
2. {Alternative approach}

### Awaiting
{What input is needed}
```

---

## Anti-Patterns

| Anti-Pattern | Why Bad | Correct Approach |
|--------------|---------|------------------|
| Impose arbitrary structure | "All projects need 5-7 phases" | Derive phases from requirements |
| Horizontal layers | Models → APIs → UI | Vertical slices (complete features) |
| Skip coverage validation | Orphaned requirements | Explicit mapping of every requirement |
| Vague success criteria | "Auth works" | Observable behaviors: "User can log in and stay logged in" |
| Enterprise artifacts | Estimates, Gantt, risks | Phases, goals, requirements, criteria only |
| Duplicate requirements | Same req in multiple phases | Assign to ONE phase (first that delivers it) |
| Return before writing | Files not persisted | Write files FIRST, then return |

---

## Change Impact Analysis

### If gsd-roadmapper Changes:

**Upstream Impact:**
- `new-project` command — May need to update spawning context

**Downstream Impact:**
- `plan-phase` command — Reads ROADMAP.md for phase goals
- `gsd-planner` — Extracts phase goal and success criteria
- `gsd-verifier` — Uses success criteria for verification
- `resume-work` — Reads STATE.md for position

**Breaking Changes to Watch:**
- ROADMAP.md section structure
- STATE.md section structure
- Phase numbering format
- Success criteria format

---

## Section Index

| Section | Lines (approx) | Purpose |
|---------|----------------|---------|
| `<role>` | 1-30 | Identity, responsibilities |
| `<downstream_consumer>` | 31-60 | How plan-phase uses output |
| `<philosophy>` | 61-120 | Anti-enterprise, requirements drive structure |
| `<goal_backward_phases>` | 121-200 | Goal-backward methodology |
| `<phase_identification>` | 201-300 | Deriving phases, numbering, depth |
| `<coverage_validation>` | 301-350 | 100% requirement coverage |
| `<output_formats>` | 351-500 | ROADMAP.md and STATE.md templates |
| `<execution_flow>` | 501-560 | Step-by-step process |
| `<structured_returns>` | 561-590 | Return message formats |
| `<success_criteria>` | 591-606 | Completion checklist |

---

## Quick Reference

```
WHAT:     Requirement → phase mapping with goal-backward success criteria
MODES:    Single mode (roadmap creation)
OUTPUT:   .planning/ROADMAP.md, .planning/STATE.md, .planning/REQUIREMENTS.md traceability

CORE RULES:
• Derive phases from requirements (don't impose template)
• 100% coverage required (every v1 req → exactly one phase)
• Goal-backward: "What must be TRUE for users?"
• Write files FIRST, then return
• No enterprise artifacts (estimates, Gantt, risks)

PHASE NUMBERING:
• Integer (1, 2, 3): Planned milestone work
• Decimal (2.1, 2.2): Urgent insertions via /gsd:insert-phase

SPAWNED BY: /gsd:new-project
CONSUMED BY: /gsd:plan-phase, gsd-planner, gsd-verifier
```
