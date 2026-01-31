# Agent Reference

GSD uses specialized subagents for different tasks. Each agent is spawned fresh to avoid context pollution.

## Agent Overview

| Agent | Purpose | Spawned By |
|-------|---------|------------|
| `gsd-planner` | Create executable plans | `/gsd:plan-phase` |
| `gsd-executor` | Execute plans with atomic commits | `/gsd:execute-phase` |
| `gsd-verifier` | Verify goal achievement | `/gsd:execute-phase` |
| `gsd-plan-checker` | Validate plans before execution | `/gsd:plan-phase` |
| `gsd-phase-researcher` | Research phase implementation | `/gsd:plan-phase` |
| `gsd-project-researcher` | Research domain ecosystem | `/gsd:new-project` |
| `gsd-research-synthesizer` | Synthesize research outputs | `/gsd:new-project` |
| `gsd-roadmapper` | Create project roadmaps | `/gsd:new-project` |
| `gsd-codebase-mapper` | Analyze existing codebase | `/gsd:map-codebase` |
| `gsd-integration-checker` | Verify cross-phase integration | Milestone audit |
| `gsd-debugger` | Systematic debugging | `/gsd:debug` |

---

## gsd-planner

**Purpose:** Create executable phase plans with task breakdown, dependency analysis, and goal-backward verification.

**Tools:** Read, Write, Bash, Glob, Grep, WebFetch, Context7

**Reads:**
- STATE.md, ROADMAP.md, REQUIREMENTS.md
- CONTEXT.md (if exists)
- RESEARCH.md (if exists)
- Prior SUMMARY.md files

**Creates:**
- `.planning/phases/{NN}-{name}/{phase}-{plan}-PLAN.md`
- Updates ROADMAP.md with plan counts

**Key Behaviors:**
- Plans ARE prompts (not documents that become prompts)
- 2-3 tasks per plan, ~50% context budget
- Maximizes parallelization (vertical slices > horizontal layers)
- Pre-computes wave numbers based on dependencies
- Derives must_haves from phase goal (goal-backward)
- Supports revision mode from checker feedback
- Gap closure mode creates targeted fix plans

---

## gsd-executor

**Purpose:** Execute PLAN.md files atomically with per-task commits.

**Tools:** Read, Write, Edit, Bash, Grep, Glob

**Reads:**
- STATE.md, config.json
- PLAN.md files
- Prior SUMMARY.md files (for context)

**Creates:**
- Per-task git commits: `{type}({phase}-{plan}): {description}`
- `.planning/phases/{NN}-{name}/{phase}-{plan}-SUMMARY.md`
- Updates STATE.md

**Deviation Rules:**

| Rule | Situation | Action |
|------|-----------|--------|
| 1 | Bug discovered | Auto-fix + document |
| 2 | Missing critical functionality | Auto-add + document |
| 3 | Blocking issue | Auto-fix to unblock |
| 4 | Architectural change needed | STOP and checkpoint |

**Checkpoint Handling:**
- Pauses at checkpoint tasks
- Returns structured state to orchestrator
- Fresh continuation agent spawns after user input

**TDD Support:** RED-GREEN-REFACTOR cycle when task has `tdd="true"`

---

## gsd-verifier

**Purpose:** Verify phase goal achievement through goal-backward analysis.

**Tools:** Read, Bash, Grep, Glob

**Reads:**
- ROADMAP.md, REQUIREMENTS.md
- All SUMMARY.md files for phase
- PLAN.md must_haves
- Source codebase

**Creates:** `.planning/phases/{NN}-{name}/{phase}-VERIFICATION.md`

**Verification Levels:**
1. **Existence** — Does file exist?
2. **Substantive** — Real implementation, not stub?
3. **Wired** — Connected to system?

**Must-Haves Checked:**
- **Truths** — Observable behaviors work
- **Artifacts** — Files exist with real code
- **Key Links** — Critical connections working

**Statuses:**
- `passed` — Goal achieved
- `gaps_found` — Need additional plans
- `human_needed` — Manual testing required

**Re-verification Mode:** Focuses on previously failed items, quick regression on passed items

---

## gsd-plan-checker

**Purpose:** Validate plans WILL achieve phase goal before execution.

**Tools:** Read, Bash, Glob, Grep

**Reads:** PLAN.md files, ROADMAP.md, REQUIREMENTS.md

**Returns:** Issue report to planner (not committed)

**Verification Dimensions:**
1. **Requirement Coverage** — Every requirement has tasks
2. **Task Completeness** — Each task has files/action/verify/done
3. **Dependency Correctness** — Valid, acyclic graph
4. **Key Links Planned** — Artifacts will be wired
5. **Scope Sanity** — Within context budget
6. **Must-Haves Derivation** — Properly derived from goal

**Issue Severities:**
- `blocker` — Must fix before execution
- `warning` — Should fix
- `info` — Suggestions

---

## gsd-phase-researcher

**Purpose:** Research how to implement a specific phase well.

**Tools:** Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, Context7

**Reads:**
- CONTEXT.md (user decisions)
- ROADMAP.md
- Existing codebase

**Creates:** `.planning/phases/{NN}-{name}/{phase}-RESEARCH.md`

**Sections:**
- Summary
- Standard Stack (libraries to use)
- Architecture Patterns
- Don't Hand-Roll (use existing solutions)
- Common Pitfalls
- Code Examples
- Sources (HIGH/MEDIUM/LOW confidence)

**Source Hierarchy:**
1. Context7 (authoritative)
2. Official docs
3. WebSearch (with verification)

---

## gsd-project-researcher

**Purpose:** Research domain ecosystem before roadmap creation.

**Tools:** Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, Context7

**Reads:** PROJECT.md, existing ROADMAP.md (if continuing)

**Creates:** `.planning/research/` files:
- STACK.md
- FEATURES.md
- ARCHITECTURE.md
- PITFALLS.md

**Execution:** 4 researchers run in parallel (stack, features, architecture, pitfalls)

**Does NOT commit** — Synthesizer commits all files together

---

## gsd-research-synthesizer

**Purpose:** Synthesize outputs from 4 parallel researchers into SUMMARY.md.

**Tools:** Read, Write, Bash

**Reads:** All files in `.planning/research/`

**Creates:** `.planning/research/SUMMARY.md`

**Commits:** All research files together

**Output Includes:**
- Integrated findings (not concatenated)
- Roadmap implications
- Confidence assessment

---

## gsd-roadmapper

**Purpose:** Create project roadmaps with phase breakdown and requirement mapping.

**Tools:** Read, Write, Bash, Glob, Grep

**Reads:**
- PROJECT.md
- REQUIREMENTS.md
- research/SUMMARY.md (if exists)

**Creates:**
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- Updates REQUIREMENTS.md with traceability

**Key Behaviors:**
- Derives phases from requirements
- Goal-backward success criteria
- 100% requirement coverage (no orphans, no duplicates)
- Depth calibration: quick (3-5), standard (5-8), comprehensive (8-12) phases
- Presents for approval before writing

---

## gsd-codebase-mapper

**Purpose:** Analyze existing codebase for a specific focus area.

**Tools:** Read, Bash, Grep, Glob, Write

**Focus Areas:**
- `tech` → STACK.md, INTEGRATIONS.md
- `arch` → ARCHITECTURE.md, STRUCTURE.md
- `quality` → CONVENTIONS.md, TESTING.md
- `concerns` → CONCERNS.md

**Creates:** Files directly in `.planning/codebase/`

**Key Behaviors:**
- Always includes exact file paths
- Prescriptive ("Use X") not descriptive
- Does NOT commit (orchestrator handles)

---

## gsd-integration-checker

**Purpose:** Verify cross-phase integration and E2E flows.

**Tools:** Read, Bash, Grep, Glob

**Reads:**
- SUMMARY.md files from all phases
- Source codebase

**Returns:** Integration report (not committed)

**Checks:**
- Export/import maps
- API coverage
- Auth protection
- E2E flows
- Wiring: Component→API, API→Database, Form→Handler, State→Render

**Identifies:**
- Orphaned exports
- Broken flows
- Unprotected routes
- Missing connections

---

## gsd-debugger

**Purpose:** Investigate bugs using scientific method with persistent state.

**Tools:** Read, Write, Edit, Bash, Grep, Glob, WebSearch

**Creates:** `.planning/debug/{slug}.md`

**Debug File Sections:**
- **Frontmatter:** status, trigger, timestamps
- **Current Focus:** hypothesis, test, expecting, next_action (OVERWRITE)
- **Symptoms:** expected, actual, errors, reproduction (IMMUTABLE)
- **Eliminated:** disproven hypotheses (APPEND only)
- **Evidence:** timestamped findings (APPEND only)
- **Resolution:** root_cause, fix, verification (OVERWRITE as evolving)

**Methodology:**
1. Hypothesis → Prediction → Test → Observe → Conclude
2. Falsifiable hypotheses only
3. Binary search, rubber duck, minimal reproduction
4. Persistent state survives context resets

**Modes:**
- Standard interactive
- `symptoms_prefilled: true` (skip gathering)
- `goal: find_root_cause_only` (diagnose only)
- `goal: find_and_fix` (default)

---

## Agent Interaction Flow

```
/gsd:new-project
    ├─ 4× gsd-project-researcher (parallel)
    ├─ gsd-research-synthesizer
    └─ gsd-roadmapper

/gsd:plan-phase
    ├─ gsd-phase-researcher (if needed)
    ├─ gsd-planner
    └─ gsd-plan-checker (feedback loop)

/gsd:execute-phase
    ├─ gsd-executor (per plan, parallel by wave)
    └─ gsd-verifier

/gsd:map-codebase
    └─ 4× gsd-codebase-mapper (parallel)

/gsd:debug
    └─ gsd-debugger
```

---

## Model Profile Mapping

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| gsd-project-researcher | opus | sonnet | haiku |
| gsd-research-synthesizer | sonnet | sonnet | haiku |
| gsd-roadmapper | opus | sonnet | sonnet |
| gsd-planner | opus | opus | sonnet |
| gsd-executor | opus | sonnet | sonnet |
| gsd-verifier | sonnet | sonnet | haiku |
| gsd-plan-checker | sonnet | sonnet | haiku |
| gsd-phase-researcher | opus | sonnet | haiku |
| gsd-codebase-mapper | sonnet | sonnet | haiku |
| gsd-debugger | opus | sonnet | sonnet |
