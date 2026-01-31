# Templates Reference

GSD uses structured templates for all planning artifacts. This reference covers the key templates and their purposes.

## Core Project Templates

### PROJECT.md

**Location:** `.planning/PROJECT.md`
**Created by:** `/gsd:new-project`

The strategic container for your product.

**Sections:**
- **What This Is** — 2-3 sentence product description
- **Core Value** — The ONE thing that matters most
- **Requirements** — Validated, Active, Out of Scope
- **Context** — Background information
- **Constraints** — Hard limits with reasoning
- **Key Decisions** — Significant choices with rationale

---

### ROADMAP.md

**Location:** `.planning/ROADMAP.md`
**Created by:** `/gsd:new-milestone`

Phase structure for the current milestone.

**Sections:**
- Phase list with goals
- Phase details (goal, dependencies, requirements, success criteria)
- Plan list per phase
- Progress tracking

**Example:**
```markdown
## Phases

- [x] **Phase 1: Foundation** - Project setup ✓
- [ ] **Phase 2: Authentication** - User auth system
- [ ] **Phase 3: Features** - Core functionality

### Phase 2: Authentication
**Goal**: Users can securely sign up and log in
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02
**Success Criteria**:
  1. User can create account
  2. User can log in
  3. Session persists
**Plans**: 3 plans
```

---

### STATE.md

**Location:** `.planning/STATE.md`
**Created by:** System (after ROADMAP.md)

Project memory across sessions.

**Sections:**
- **Project Reference** — Link to PROJECT.md
- **Current Position** — Phase, plan, status
- **Performance Metrics** — Plans completed, timing
- **Accumulated Context** — Decisions, blockers
- **Session Continuity** — Last activity, resume info

**Key constraint:** Kept under 100 lines for quick loading.

---

### REQUIREMENTS.md

**Location:** `.planning/REQUIREMENTS.md`
**Created by:** `/gsd:new-milestone`

Detailed requirements with traceability.

**Structure:**
```markdown
## v1 Requirements

### Authentication
- [ ] AUTH-01: User can sign up with email/password
- [ ] AUTH-02: User can log in
- [ ] AUTH-03: User can reset password

## Traceability
| Requirement | Phase |
|-------------|-------|
| AUTH-* | Phase 2 |
```

---

### config.json

**Location:** `.planning/config.json`
**Created by:** `/gsd:new-project`

Workflow configuration.

```json
{
  "mode": "interactive",
  "depth": "standard",
  "model_profile": "balanced",
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true
  },
  "git": {
    "branching_strategy": "none"
  }
}
```

---

## Execution Templates

### PLAN.md

**Location:** `.planning/phases/{NN}-{name}/{phase}-{plan}-PLAN.md`
**Created by:** `gsd-planner`

Executable prompt with tasks.

**Frontmatter:**
```yaml
---
phase: 02-authentication
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [...]
autonomous: true
must_haves:
  truths: [...]
  artifacts: [...]
  key_links: [...]
---
```

**Body sections:**
- `<objective>` — What this accomplishes
- `<context>` — @file references
- `<tasks>` — XML-structured tasks
- `<verification>` — Checklist
- `<success_criteria>` — Measurable completion

---

### SUMMARY.md

**Location:** `.planning/phases/{NN}-{name}/{phase}-{plan}-SUMMARY.md`
**Created by:** `gsd-executor`

Execution record.

**Sections:**
- Completed tasks with commit hashes
- Files modified
- Decisions made during execution
- Issues encountered
- Deliverables

---

### VERIFICATION.md

**Location:** `.planning/phases/{NN}-{name}/{phase}-VERIFICATION.md`
**Created by:** `gsd-verifier`

Phase goal verification.

**Frontmatter:**
```yaml
---
phase: 02-authentication
verified: 2025-01-15
status: passed  # or gaps_found, human_needed
---
```

**Sections:**
- Observable truths verification (VERIFIED/FAILED/UNCERTAIN)
- Artifacts verification (EXISTS/STUB/MISSING)
- Key links verification (WIRED/NOT WIRED)
- Anti-patterns found
- Gap summary (if any)

---

### UAT.md

**Location:** `.planning/phases/{NN}-{name}/{phase}-UAT.md`
**Created by:** `/gsd:verify-work`

User acceptance testing tracker.

**Frontmatter:**
```yaml
---
status: testing  # or complete, diagnosed
phase: 02-authentication
started: 2025-01-15T10:00:00Z
---
```

**Sections:**
- Current test
- Test results (pass/issue/pending)
- Summary counts
- Gaps (YAML for plan-phase --gaps)

---

## Context Templates

### CONTEXT.md

**Location:** `.planning/phases/{NN}-{name}/{phase}-CONTEXT.md`
**Created by:** `/gsd:discuss-phase`

User decisions for a phase.

**Sections:**
- **Decisions** — Locked user choices
- **Claude's Discretion** — Areas for recommendations
- **Deferred Ideas** — Out of scope for now

---

### RESEARCH.md

**Location:** `.planning/phases/{NN}-{name}/{phase}-RESEARCH.md`
**Created by:** `gsd-phase-researcher`

Technical research for a phase.

**Sections:**
- Summary
- Standard Stack
- Architecture Patterns
- Don't Hand-Roll
- Common Pitfalls
- Code Examples
- Sources (with confidence levels)

---

### .continue-here.md

**Location:** `.planning/phases/{NN}-{name}/.continue-here.md`
**Created by:** `/gsd:pause-work`

Handoff context for pausing.

**Sections:**
- `<current_state>` — Where exactly are we
- `<completed_work>` — What got done
- `<remaining_work>` — What's left
- `<decisions_made>` — Key decisions with rationale
- `<blockers>` — What's stuck
- `<context>` — Mental state
- `<next_action>` — First thing to do when resuming

---

## Codebase Analysis Templates

**Location:** `.planning/codebase/`
**Created by:** `gsd-codebase-mapper`

| Template | Purpose |
|----------|---------|
| STACK.md | Technology stack with versions |
| ARCHITECTURE.md | System architecture patterns |
| STRUCTURE.md | File/folder organization |
| CONVENTIONS.md | Coding patterns and standards |
| TESTING.md | Test framework and patterns |
| INTEGRATIONS.md | External services and APIs |
| CONCERNS.md | Technical debt and issues |

---

## Research Templates

**Location:** `.planning/research/`
**Created by:** `gsd-project-researcher`

| Template | Purpose |
|----------|---------|
| STACK.md | Recommended technologies |
| FEATURES.md | Feature landscape |
| ARCHITECTURE.md | System patterns |
| PITFALLS.md | Common mistakes |
| SUMMARY.md | Synthesized findings |

---

## Archive Templates

### MILESTONES.md

**Location:** `.planning/MILESTONES.md`
**Updated by:** `/gsd:complete-milestone`

Historical record of shipped versions.

**Entry format:**
```markdown
## v1.0 MVP (Shipped: 2025-01-15)

**Delivered:** [One sentence]
**Phases completed:** 1-4 (7 plans total)
**Key accomplishments:**
- [Achievement 1]
- [Achievement 2]
**Stats:** [files, LOC, timeline]
**Git range:** `feat(01-01)` → `feat(04-01)`
**What's next:** [v1.1 description]
```

---

## File Naming Patterns

```
.planning/
├── PROJECT.md
├── ROADMAP.md
├── STATE.md
├── REQUIREMENTS.md
├── config.json
├── MILESTONES.md
├── phases/
│   ├── 01-foundation/
│   │   ├── 01-CONTEXT.md
│   │   ├── 01-RESEARCH.md
│   │   ├── 01-01-PLAN.md
│   │   ├── 01-01-SUMMARY.md
│   │   ├── 01-02-PLAN.md
│   │   ├── 01-02-SUMMARY.md
│   │   ├── 01-VERIFICATION.md
│   │   ├── 01-UAT.md
│   │   └── .continue-here.md
│   └── 02.1-hotfix/          # Decimal = inserted
│       └── ...
├── research/
├── codebase/
├── quick/
│   └── 001-task-name/
├── todos/
│   └── pending/
├── debug/
│   └── session-001.md
└── milestones/
    └── v1.0-ROADMAP.md
```

---

## Template Creation Triggers

| Template | Command | Mandatory |
|----------|---------|-----------|
| PROJECT.md | `/gsd:new-project` | Yes |
| ROADMAP.md | `/gsd:new-milestone` | Yes |
| STATE.md | System | Yes |
| REQUIREMENTS.md | `/gsd:new-milestone` | Optional |
| config.json | `/gsd:new-project` | Yes |
| CONTEXT.md | `/gsd:discuss-phase` | Optional |
| RESEARCH.md | `/gsd:plan-phase` | Optional |
| PLAN.md | `/gsd:plan-phase` | Yes |
| SUMMARY.md | `gsd-executor` | Yes |
| VERIFICATION.md | `gsd-verifier` | Yes |
| UAT.md | `/gsd:verify-work` | Optional |
| .continue-here.md | `/gsd:pause-work` | Optional |
