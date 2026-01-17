# gsd-plan-checker.md — Deep Reference Documentation

## Metadata
| Attribute | Value |
|-----------|-------|
| **Type** | Agent |
| **Location** | `agents/gsd-plan-checker.md` |
| **Size** | 746 lines |
| **Documentation Tier** | Deep Reference |
| **Complexity Score** | 2+3+3+2 = **10** |

### Complexity Breakdown
- **Centrality: 2** — Only called by plan-phase orchestrator; output consumed by planner for revision
- **Complexity: 3** — 6 verification dimensions, structured issue format, dependency graph analysis
- **Failure Impact: 3** — Bad plans approved = cascading execution failures, wasted context
- **Novelty: 2** — Pre-execution verification pattern; goal-backward applied to plans

---

## Purpose
The GSD Plan Checker verifies that plans WILL achieve the phase goal BEFORE execution. It applies goal-backward analysis to plans themselves, catching issues that would cause execution failures: missing requirement coverage, incomplete tasks, circular dependencies, broken wiring, scope overruns, and poorly-derived must_haves.

**Critical distinction:**
- `gsd-verifier`: Verifies code DID achieve goal (after execution)
- `gsd-plan-checker`: Verifies plans WILL achieve goal (before execution)

Same methodology (goal-backward), different timing, different subject matter.

**Key insight:** A plan can have all tasks filled in but still miss the goal if key requirements have no tasks, dependencies are circular, or artifacts are planned without wiring between them.

---

## Critical Behaviors

### Constraints Enforced
| Constraint | Rule | Consequence if Violated | Source Section |
|------------|------|------------------------|----------------|
| All requirements covered | Every phase requirement has task(s) | Features missing from output | Dimension 1 |
| Task completeness | Auto tasks need files, action, verify, done | Can't execute or confirm completion | Dimension 2 |
| No circular dependencies | Dependency graph must be acyclic | Deadlock — neither plan can start | Dimension 3 |
| Wiring planned | Key links have implementation in actions | Artifacts created but not connected | Dimension 4 |
| Scope within budget | 2-3 tasks/plan, ~50% context | Quality degradation, rushed work | Dimension 5 |
| User-observable truths | must_haves.truths are testable by user | Can't verify goal achievement | Dimension 6 |

### Numeric Limits
| Limit | Value | Rationale |
|-------|-------|-----------|
| Tasks per plan (target) | 2-3 | Context budget for quality |
| Tasks per plan (warning) | 4 | Borderline, consider split |
| Tasks per plan (blocker) | 5+ | Must split before execution |
| Files per plan (warning) | 10 | Getting large |
| Files per plan (blocker) | 15+ | Must split |
| Context target | ~50% | Quality maintenance |
| Context warning | ~70% | Degradation begins |
| Context blocker | 80%+ | Rushed, minimal quality |

---

## The 6 Verification Dimensions

### Dimension 1: Requirement Coverage
**Question:** Does every phase requirement have task(s) addressing it?

**Process:**
1. Extract phase goal from ROADMAP.md
2. Decompose goal into requirements (what must be true)
3. For each requirement, find covering task(s)
4. Flag requirements with no coverage

**Red Flags:**
- Requirement has zero tasks addressing it
- Multiple requirements share one vague task ("implement auth" for login, logout, session)
- Requirement partially covered (login exists but logout doesn't)

**Example Issue:**
```yaml
issue:
  dimension: requirement_coverage
  severity: blocker
  description: "AUTH-02 (logout) has no covering task"
  plan: null
  fix_hint: "Add logout endpoint task to Plan 01 or create Plan 03"
```

### Dimension 2: Task Completeness
**Question:** Does every task have Files + Action + Verify + Done?

**Required by Task Type:**
| Type | Files | Action | Verify | Done |
|------|-------|--------|--------|------|
| `auto` | Required | Required | Required | Required |
| `checkpoint:*` | N/A | N/A | N/A | N/A |
| `tdd` | Required | Behavior + Implementation | Test commands | Expected outcomes |

**Red Flags:**
- Missing `<verify>` — can't confirm completion
- Missing `<done>` — no acceptance criteria
- Vague `<action>` — "implement auth" instead of specific steps
- Empty `<files>` — what gets created?

**Example Issue:**
```yaml
issue:
  dimension: task_completeness
  severity: blocker
  description: "Task 2 missing <verify> element"
  plan: "16-01"
  task: 2
  task_name: "Create login endpoint"
  fix_hint: "Add <verify> with curl command or test command"
```

### Dimension 3: Dependency Correctness
**Question:** Are plan dependencies valid and acyclic?

**Dependency Rules:**
- `depends_on: []` = Wave 1 (can run parallel)
- `depends_on: ["01"]` = Wave 2 minimum (must wait for 01)
- Wave number = max(deps) + 1

**Red Flags:**
- Plan references non-existent plan
- Circular dependency (A → B → A)
- Future reference (plan 01 referencing plan 03's output)
- Wave assignment inconsistent with dependencies

**Example Issue:**
```yaml
issue:
  dimension: dependency_correctness
  severity: blocker
  description: "Circular dependency between plans 02 and 03"
  plans: ["02", "03"]
  fix_hint: "Plan 02 depends_on includes 03, but 03 depends_on includes 02. Remove one."
```

### Dimension 4: Key Links Planned
**Question:** Are artifacts wired together, not just created in isolation?

**What to Check:**
```
Component → API: Does action mention fetch/axios call?
API → Database: Does action mention Prisma/query?
Form → Handler: Does action mention onSubmit implementation?
State → Render: Does action mention displaying state?
```

**Red Flags:**
- Component created but not imported anywhere
- API route created but component doesn't call it
- Database model created but API doesn't query it
- Form created but submit handler missing or stub

**Example Issue:**
```yaml
issue:
  dimension: key_links_planned
  severity: warning
  description: "Chat.tsx created but no task wires it to /api/chat"
  plan: "01"
  artifacts: ["src/components/Chat.tsx", "src/app/api/chat/route.ts"]
  fix_hint: "Add fetch call in Chat.tsx action or create wiring task"
```

### Dimension 5: Scope Sanity
**Question:** Will plans complete within context budget?

**Thresholds:**
| Metric | Target | Warning | Blocker |
|--------|--------|---------|---------|
| Tasks/plan | 2-3 | 4 | 5+ |
| Files/plan | 5-8 | 10 | 15+ |
| Total context | ~50% | ~70% | 80%+ |

**Red Flags:**
- Plan with 5+ tasks (quality degrades)
- Plan with 15+ file modifications
- Single task with 10+ files
- Complex work (auth, payments) crammed into one plan

**Example Issue:**
```yaml
issue:
  dimension: scope_sanity
  severity: blocker
  description: "Plan 01 has 5 tasks with 12 files - exceeds context budget"
  plan: "01"
  metrics:
    tasks: 5
    files: 12
    estimated_context: "~80%"
  fix_hint: "Split into: 01 (schema + API), 02 (middleware + lib), 03 (UI components)"
```

### Dimension 6: Verification Derivation
**Question:** Do must_haves trace back to phase goal?

**Red Flags:**
- Missing `must_haves` entirely
- Truths are implementation-focused ("bcrypt installed") not user-observable ("passwords are secure")
- Artifacts don't map to truths
- Key links missing for critical wiring

**Example Issue:**
```yaml
issue:
  dimension: verification_derivation
  severity: warning
  description: "Plan 02 must_haves.truths are implementation-focused"
  plan: "02"
  problematic_truths:
    - "JWT library installed"
    - "Prisma schema updated"
  fix_hint: "Reframe as user-observable: 'User can log in', 'Session persists'"
```

---

## Mechanism

### Execution Flow (10 Steps)
```
Step 1: Load Context
├── Normalize phase and find directory
├── List all PLAN.md files
├── Get phase goal from ROADMAP.md
└── Get phase brief if exists

Step 2: Load All Plans
├── Read each PLAN.md in phase directory
└── Parse frontmatter, objective, tasks

Step 3: Parse must_haves
├── Extract from each plan frontmatter
└── Aggregate across plans for full picture

Step 4: Check Requirement Coverage
├── Map phase requirements to tasks
├── Verify task action is specific enough
└── Flag uncovered requirements

Step 5: Validate Task Structure
├── Count tasks per plan
├── Check for missing verify/done elements
└── Verify action specificity

Step 6: Verify Dependency Graph
├── Parse depends_on from each plan
├── Build dependency graph
├── Check for cycles
└── Verify wave consistency

Step 7: Check Key Links Planned
├── For each key_link in must_haves
├── Find source artifact task
├── Check if action mentions connection
└── Flag missing wiring

Step 8: Assess Scope
├── Count tasks per plan
├── Count files in files_modified
└── Compare against thresholds

Step 9: Verify must_haves Derivation
├── Check truths are user-observable
├── Check artifacts map to truths
└── Check key_links cover critical wiring

Step 10: Determine Overall Status
├── passed: All dimensions pass
└── issues_found: One or more blockers/warnings
```

### Issue Severity Levels

| Severity | Description | Examples |
|----------|-------------|----------|
| **blocker** | Must fix before execution | Missing requirement, circular dependency, 5+ tasks |
| **warning** | Should fix, execution may work | 4 tasks (borderline), implementation-focused truths |
| **info** | Suggestions for improvement | Could split for parallelization |

### Dimension → Revision Strategy Mapping

| Dimension | Revision Strategy |
|-----------|-------------------|
| requirement_coverage | Add task(s) to cover missing requirement |
| task_completeness | Add missing elements to existing task |
| dependency_correctness | Fix depends_on array, recompute waves |
| key_links_planned | Add wiring task or update action |
| scope_sanity | Split plan into multiple smaller plans |
| verification_derivation | Derive and add must_haves to frontmatter |

---

## Interactions

### Reads
| File | What It Uses | Why |
|------|--------------|-----|
| `.planning/ROADMAP.md` | Phase goal | Target for coverage |
| `.planning/phases/XX-*/*-PLAN.md` | All plan content | Verification subject |
| `.planning/phases/XX-*/*-BRIEF.md` | Phase context | Additional requirements |

### Writes
| File | Content | Format |
|------|---------|--------|
| None | Returns structured issues | YAML in return message |

### Spawned By
| Command/Agent | Mode | Context Provided |
|---------------|------|------------------|
| `/gsd:plan-phase` | After planner creates plans | Phase number, plan paths |
| Re-verification | After planner revises | Same, expecting fixes |

### Output Consumed By
| Consumer | What They Use | How |
|----------|--------------|-----|
| `gsd-planner` (revision mode) | Structured issues | Makes targeted fixes |
| `plan-phase` orchestrator | Status | Decides: execute or revise |

---

## Structured Returns

### VERIFICATION PASSED
```markdown
## VERIFICATION PASSED

**Phase:** {phase-name}
**Plans verified:** {N}
**Status:** All checks passed

### Coverage Summary

| Requirement | Plans | Status |
|-------------|-------|--------|
| {req-1} | 01 | Covered |
| {req-2} | 01,02 | Covered |

### Plan Summary

| Plan | Tasks | Files | Wave | Status |
|------|-------|-------|------|--------|
| 01 | 3 | 5 | 1 | Valid |
| 02 | 2 | 4 | 2 | Valid |

### Ready for Execution

Plans verified. Run `/gsd:execute-phase {phase}` to proceed.
```

### ISSUES FOUND
```markdown
## ISSUES FOUND

**Phase:** {phase-name}
**Plans checked:** {N}
**Issues:** {X} blocker(s), {Y} warning(s), {Z} info

### Blockers (must fix)

**1. [{dimension}] {description}**
- Plan: {plan}
- Task: {task if applicable}
- Fix: {fix_hint}

### Warnings (should fix)

**1. [{dimension}] {description}**
- Plan: {plan}
- Fix: {fix_hint}

### Structured Issues

```yaml
issues:
  - plan: "01"
    dimension: "task_completeness"
    severity: "blocker"
    description: "Task 2 missing <verify> element"
    fix_hint: "Add verification command"
```

### Recommendation

{N} blocker(s) require revision. Returning to planner with feedback.
```

---

## Issue Structure

```yaml
issue:
  plan: "16-01"              # Which plan (null if phase-level)
  dimension: "task_completeness"  # Which dimension failed
  severity: "blocker"        # blocker | warning | info
  description: "Task 2 missing <verify> element"
  task: 2                    # Task number if applicable
  fix_hint: "Add verification command for build output"
```

---

## Anti-Patterns

| Anti-Pattern | Why Bad | Correct Approach |
|--------------|---------|------------------|
| Check code existence | That's gsd-verifier's job | Verify plans, not codebase |
| Run the application | This is static plan analysis | No npm start, no curl |
| Accept vague tasks | "Implement auth" is not executable | Require specific files, actions |
| Skip dependency analysis | Circular deps cause deadlock | Build and validate graph |
| Ignore scope | 5+ tasks degrades quality | Report and require split |
| Trust task names alone | Well-named task can be empty | Check action, verify, done fields |

---

## Change Impact Analysis

### If gsd-plan-checker Changes:

**Upstream Impact (who calls this):**
- `plan-phase` orchestrator — May need to handle new status types
- Re-verification flow — May need different context

**Downstream Impact (who consumes output):**
- `gsd-planner` (revision mode) — Expects specific issue structure with dimension, severity, fix_hint
- Orchestrator — Uses status to decide execute vs revise

**Breaking Changes to Watch:**
- Changing issue YAML structure → breaks planner revision parsing
- Changing severity levels → breaks orchestrator decision logic
- Adding new dimensions → planner needs revision strategy mapping
- Changing thresholds → affects what gets flagged

---

## Section Index

| Section | Lines (approx) | Purpose |
|---------|----------------|---------|
| `<role>` | 1-26 | Identity, distinction from verifier |
| `<core_principle>` | 28-48 | Plan completeness ≠ goal achievement |
| `<verification_dimensions>` | 50-238 | 6 dimensions with full details |
| `<verification_process>` | 240-438 | 10-step process |
| `<examples>` | 440-567 | 4 concrete examples |
| `<issue_structure>` | 569-628 | Issue format and severity levels |
| `<structured_returns>` | 630-708 | PASSED and ISSUES_FOUND formats |
| `<anti_patterns>` | 710-726 | What not to do |
| `<success_criteria>` | 728-746 | Completion checklist |

---

## Quick Reference

```
WHAT:     Pre-execution verification that plans WILL achieve goal
TIMING:   After planner, before executor
OUTPUT:   Structured issues or approval

6 DIMENSIONS:
1. Requirement Coverage — all requirements have tasks
2. Task Completeness — files, action, verify, done present
3. Dependency Correctness — no cycles, valid references
4. Key Links Planned — wiring in task actions
5. Scope Sanity — 2-3 tasks/plan, ~50% context
6. Verification Derivation — user-observable truths

THRESHOLDS:
• Tasks/plan: 2-3 (target), 4 (warning), 5+ (blocker)
• Files/plan: 5-8 (target), 10 (warning), 15+ (blocker)

SPAWNED BY: /gsd:plan-phase (after planner creates plans)
CONSUMED BY: gsd-planner (revision mode), orchestrator
```
