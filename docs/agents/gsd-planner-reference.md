# gsd-planner.md — Deep Reference Documentation

## Metadata
| Attribute | Value |
|-----------|-------|
| **Type** | Agent |
| **Location** | `agents/gsd-planner.md` |
| **Size** | 1368 lines |
| **Documentation Tier** | Deep Reference |
| **Complexity Score** | 3+3+3+3 = **12** |

### Complexity Breakdown
- **Centrality: 3** — Spawned by plan-phase orchestrator; output (PLAN.md files) consumed by executor, checker, and verifier
- **Complexity: 3** — 3 operational modes (standard/gap closure/revision), goal-backward methodology, wave assignment, TDD detection, discovery levels
- **Failure Impact: 3** — Bad plans cascade to execution failures, wasted context, incorrect implementations
- **Novelty: 3** — Goal-backward planning methodology is core GSD innovation; "plans are prompts" paradigm is unique

---

## Purpose
The GSD Planner transforms phase goals into executable PLAN.md files that Claude executors can implement without interpretation. It decomposes phases into parallel-optimized plans with 2-3 tasks each, builds dependency graphs, assigns execution waves, and derives must-haves using goal-backward methodology.

**Key innovation:** Plans ARE prompts, not documents that become prompts. PLAN.md contains objective, context, tasks with verification criteria, and success criteria — everything needed for autonomous execution.

---

## Critical Behaviors

### Constraints Enforced
| Constraint | Rule | Consequence if Violated | Source Section |
|------------|------|------------------------|----------------|
| Task limit per plan | 2-3 tasks max | Quality degrades; context anxiety triggers "completion mode" | `<scope_estimation>` |
| Context target | Complete within ~50% context | 50-70% = degrading quality, 70%+ = poor rushed work | `<philosophy>` |
| Discovery is mandatory | Must prove current context exists to skip | Wrong tool choices, reinventing wheels | `<discovery_levels>` |
| Task specificity | Must be executable without clarification | Ambiguous execution, wrong implementations | `<task_breakdown>` |
| Vertical slices preferred | Group by feature not by layer | Sequential dependencies kill parallelism | `<dependency_graph>` |

### Numeric Limits
| Limit | Value | Rationale |
|-------|-------|-----------|
| Tasks per plan | 2-3 | Quality threshold; more = context anxiety |
| Context budget target | ~50% | Safety margin before degradation begins |
| Task duration | 15-60 minutes | Calibrates granularity; <15min combine, >60min split |
| Observable truths | 3-7 per goal | Too few = vague, too many = over-specified |
| File modifications per task | 3-5 files | Signal task is right size |

### Quality Degradation Curve
| Context Usage | State | Behavior |
|---------------|-------|----------|
| 0-30% | PEAK | Thorough, comprehensive, creative solutions |
| 30-50% | GOOD | Confident, solid work, maintained quality |
| 50-70% | DEGRADING | Efficiency mode begins, shortcuts appear |
| 70%+ | POOR | Rushed, minimal effort, "completion mode" |

---

## Operational Modes

### Mode 1: Standard Planning
- **Trigger:** `/gsd:plan-phase` orchestrator spawns planner (no `--gaps` flag)
- **Input:** ROADMAP.md with phase goal, STATE.md with project context, optional CONTEXT.md/RESEARCH.md
- **Process:**
  1. Load project state and codebase context
  2. Apply mandatory discovery protocol (Level 0-3)
  3. Read project history via frontmatter dependency graph
  4. Gather phase context files (CONTEXT.md, RESEARCH.md)
  5. Break phase into tasks (think dependencies first)
  6. Build dependency graph (needs/creates/has_checkpoint)
  7. Assign waves based on dependencies
  8. Group tasks into plans (2-3 tasks, single concern)
  9. Derive must_haves using goal-backward methodology
  10. Write PLAN.md files with complete structure
  11. Update ROADMAP.md with plan list
  12. Commit and return structured result
- **Output:** PLAN.md files in `.planning/phases/XX-name/`, updated ROADMAP.md
- **Key difference:** Full planning from phase goal; creates new plans

### Mode 2: Gap Closure Planning
- **Trigger:** `/gsd:plan-phase --gaps` flag (after verification failures)
- **Input:** VERIFICATION.md or UAT.md with diagnosed gaps, existing SUMMARY.md files
- **Process:**
  1. Find gap sources (VERIFICATION.md, UAT.md with `status: diagnosed`)
  2. Parse gaps (truth, reason, artifacts, missing items)
  3. Load existing SUMMARYs for context
  4. Find next plan number (sequential after existing)
  5. Group related gaps into plans (same artifact, same concern)
  6. Create gap closure tasks from `gap.missing` items
  7. Write PLAN.md files with `gap_closure: true` in frontmatter
- **Output:** Additional PLAN.md files (04, 05, etc.) addressing specific gaps
- **Key difference:** Targeted fixes for verification failures; references existing work

### Mode 3: Revision Mode
- **Trigger:** Orchestrator provides `<revision_context>` with checker issues
- **Input:** Existing PLAN.md files, structured issues from plan-checker
- **Process:**
  1. Load all existing PLAN.md files in phase directory
  2. Parse checker issues (plan, dimension, severity, fix_hint)
  3. Group issues by plan and dimension
  4. Determine revision strategy per dimension type
  5. Make targeted updates (minimal changes to fix issues)
  6. Validate changes (no new issues introduced)
  7. Commit revised plans
  8. Return revision summary
- **Output:** Updated PLAN.md files, revision summary
- **Key difference:** Surgeon mindset — minimal edits to address specific checker feedback

---

## Mechanism

### Execution Flow
```
1. load_project_state [priority: first]
   ├── Read .planning/STATE.md
   ├── Parse current position, accumulated decisions
   └── Handle missing STATE.md (reconstruct or continue)

2. load_codebase_context
   ├── Check for .planning/codebase/*.md
   └── Load relevant docs based on phase keywords → CONVENTIONS, ARCHITECTURE, etc.

3. identify_phase
   ├── Read ROADMAP.md and list phases/
   ├── Determine which phase to plan
   └── Check for --gaps flag → switch to gap_closure_mode

4. mandatory_discovery
   ├── Evaluate discovery level (0-3)
   └── Route to appropriate depth or skip

5. read_project_history
   ├── Scan summary frontmatter (first ~25 lines)
   ├── Build dependency graph for current phase
   ├── Select 2-4 relevant prior phases
   └── Extract tech available, patterns, decisions

6. gather_phase_context
   ├── Load CONTEXT.md (user's vision) → honor locked decisions
   └── Load RESEARCH.md (standard_stack, pitfalls) → use identified tools

7. break_into_tasks
   ├── Decompose phase into tasks
   ├── Think dependencies first (needs/creates)
   ├── Apply TDD detection heuristic
   └── Apply user setup detection

8. build_dependency_graph
   ├── Map needs/creates/has_checkpoint for each task
   ├── Identify parallelization opportunities
   └── Prefer vertical slices over horizontal layers

9. assign_waves
   ├── Wave 1: tasks with empty depends_on
   ├── Wave N: max(dependency waves) + 1
   └── Pre-compute all wave numbers

10. group_into_plans
    ├── Same-wave tasks with no file conflicts → parallel plans
    ├── Tasks with shared files → same or sequential plans
    ├── Checkpoint tasks → mark autonomous: false
    └── Each plan: 2-3 tasks, ~50% context

11. derive_must_haves
    ├── State the goal (outcome, not task)
    ├── Derive observable truths (3-7)
    ├── Derive required artifacts (specific files)
    ├── Derive required wiring (connections)
    └── Identify key links (critical connections)

12. write_phase_prompt
    ├── Write to .planning/phases/XX-name/{phase}-{NN}-PLAN.md
    └── Include complete frontmatter and task structure
```

### Core Methodology: Goal-Backward Planning
**Goal-backward planning asks:** "What must be TRUE for the goal to be achieved?"

**Step-by-step process:**

1. **State the Goal** — Take phase goal from ROADMAP.md; reframe if task-shaped
   - Good: "Working chat interface" (outcome)
   - Bad: "Build chat components" (task)

2. **Derive Observable Truths** — List 3-7 truths from USER perspective
   - Good: "User can see existing messages", "User can send a message"
   - Bad: "User can use chat" (too vague)

3. **Derive Required Artifacts** — For each truth, what must EXIST?
   - Good: "src/components/Chat.tsx", "src/app/api/chat/route.ts"
   - Bad: "Chat system", "Auth module" (too abstract)

4. **Derive Required Wiring** — For each artifact, what must be CONNECTED?
   - Good: "Chat.tsx fetches from /api/chat via useEffect on mount"
   - Bad: Listing components without connections

5. **Identify Key Links** — Where is this most likely to break?
   - Input onSubmit → API call
   - API save → database
   - Component → real data (not mocked)

### Decision Heuristics

#### TDD Detection
| Condition | TDD? | Action |
|-----------|------|--------|
| Can write `expect(fn(input)).toBe(output)` before `fn`? | Yes | Create dedicated TDD plan |
| Business logic with defined inputs/outputs | Yes | TDD plan |
| API endpoints with request/response contracts | Yes | TDD plan |
| UI layout, styling, visual components | No | Standard task |
| Configuration changes | No | Standard task |
| Glue code connecting existing components | No | Standard task |

#### Discovery Level
| Level | Trigger | Action | Produces |
|-------|---------|--------|----------|
| 0 - Skip | Pure internal work, existing patterns only | Proceed | Nothing |
| 1 - Quick | Single known library, confirming syntax | Context7 query | Nothing |
| 2 - Standard | Choosing between 2-3 options, new API | Research workflow | DISCOVERY.md |
| 3 - Deep | Architectural decision, novel problem | Full research | DISCOVERY.md |

### Scope/Budget Estimation
| Files Modified | Context Impact |
|----------------|----------------|
| 0-3 files | ~10-15% (small) |
| 4-6 files | ~20-30% (medium) |
| 7+ files | ~40%+ (large - split) |

| Task Complexity | Context/Task |
|-----------------|--------------|
| Simple CRUD | ~15% |
| Business logic | ~25% |
| Complex algorithms | ~40% |
| Domain modeling | ~35% |

### Split Signals
**ALWAYS split if:**
- More than 3 tasks (even if tasks seem small)
- Multiple subsystems (DB + API + UI = separate plans)
- Any task with >5 file modifications
- Checkpoint + implementation work in same plan
- Discovery + implementation in same plan

**CONSIDER splitting:**
- Estimated >5 files modified total
- Complex domains (auth, payments, data modeling)
- Any uncertainty about approach
- Natural semantic boundaries (Setup → Core → Features)

---

## Interactions

### Reads
| File | What It Uses | Why |
|------|--------------|-----|
| `.planning/STATE.md` | Current position, decisions, blockers | Context for planning |
| `.planning/ROADMAP.md` | Phase goal, phase dependencies | What to plan |
| `.planning/phases/XX-*/CONTEXT.md` | User's vision, essential features | Honor user decisions |
| `.planning/phases/XX-*/RESEARCH.md` | standard_stack, pitfalls | Use identified tools |
| `.planning/phases/*-SUMMARY.md` | Prior work, tech available, patterns | Build on existing work |
| `.planning/codebase/*.md` | CONVENTIONS, ARCHITECTURE, STACK | Match existing patterns |
| `.planning/phases/XX-*/VERIFICATION.md` | Gaps to close (gap closure mode) | Create targeted fixes |

### Writes
| File | Content | Format |
|------|---------|--------|
| `.planning/phases/XX-name/{phase}-{NN}-PLAN.md` | Executable plan with tasks | YAML frontmatter + XML structure |
| `.planning/ROADMAP.md` | Updated plan list for phase | Markdown checkboxes |

### Spawned By
| Command/Agent | Mode | Context Provided |
|---------------|------|------------------|
| `/gsd:plan-phase` | Standard | Phase number, depth setting |
| `/gsd:plan-phase --gaps` | Gap Closure | Phase number, gap sources |
| `/gsd:plan-phase` (with checker feedback) | Revision | `<revision_context>` with issues |

### Output Consumed By
| Consumer | What They Use | How |
|----------|--------------|-----|
| `gsd-plan-checker` | PLAN.md files, must_haves | Validates before execution |
| `gsd-executor` | PLAN.md (objective, tasks, context) | Executes tasks |
| `execute-phase` | Wave assignments, depends_on | Orchestrates parallel execution |
| `gsd-verifier` | must_haves (truths, artifacts, key_links) | Goal-backward verification |

---

## Structured Returns

### PLANNING COMPLETE
```markdown
## PLANNING COMPLETE

**Phase:** {phase-name}
**Plans:** {N} plan(s) in {M} wave(s)

### Wave Structure

| Wave | Plans | Autonomous |
|------|-------|------------|
| 1 | {plan-01}, {plan-02} | yes, yes |
| 2 | {plan-03} | no (has checkpoint) |

### Plans Created

| Plan | Objective | Tasks | Files |
|------|-----------|-------|-------|
| {phase}-01 | [brief] | 2 | [files] |
| {phase}-02 | [brief] | 3 | [files] |

### Next Steps

Execute: `/gsd:execute-phase {phase}`

<sub>`/clear` first - fresh context window</sub>
```

### CHECKPOINT REACHED
```markdown
## CHECKPOINT REACHED

**Type:** decision
**Plan:** {phase}-{plan}
**Task:** {task-name}

### Decision Needed

[Decision details from task]

### Options

[Options from task]

### Awaiting

[What to do to continue]
```

### GAP CLOSURE PLANS CREATED
```markdown
## GAP CLOSURE PLANS CREATED

**Phase:** {phase-name}
**Closing:** {N} gaps from {VERIFICATION|UAT}.md

### Plans

| Plan | Gaps Addressed | Files |
|------|----------------|-------|
| {phase}-04 | [gap truths] | [files] |
| {phase}-05 | [gap truths] | [files] |

### Next Steps

Execute: `/gsd:execute-phase {phase} --gaps-only`
```

### REVISION COMPLETE
```markdown
## REVISION COMPLETE

**Issues addressed:** {N}/{M}

### Changes Made

| Plan | Change | Issue Addressed |
|------|--------|-----------------|
| {plan-id} | {what changed} | {dimension: description} |

### Files Updated

- .planning/phases/{phase_dir}/{phase}-{plan}-PLAN.md

### Unaddressed Issues (if any)

| Issue | Reason |
|-------|--------|
| {issue} | {why - needs user input, etc.} |

### Ready for Re-verification

Checker can now re-verify updated plans.
```

---

## Anti-Patterns

| Anti-Pattern | Why Bad | Correct Approach |
|--------------|---------|------------------|
| "Add authentication" as a task | Too vague for execution | Specify: "JWT auth with refresh rotation using jose library, httpOnly cookie" |
| Horizontal layers (all models, then all APIs) | Creates sequential dependencies | Vertical slices: User feature (model + API + UI) together |
| 5+ tasks in one plan | Quality degrades past 50% context | Split into 2-3 plans |
| Team structures, RACI matrices | Enterprise process for solo dev | User is visionary, Claude is builder |
| Human dev time estimates | Wrong mental model | Estimate Claude execution time (15-60 min/task) |
| Reflexive SUMMARY chaining | Burns context | Only reference prior SUMMARY if genuinely needed |
| Implementation-focused truths | Not verifiable by user | User-observable: "User can log in" not "bcrypt installed" |
| Discovery skipped | Wrong tools, reinventing wheels | Mandatory discovery unless proven unnecessary |

---

## Change Impact Analysis

### If gsd-planner Changes:

**Upstream Impact (who calls this):**
- `plan-phase` command — May need updated spawning logic if modes change
- Orchestrator — May need to handle new return formats

**Downstream Impact (who consumes output):**
- `gsd-plan-checker` — Expects PLAN.md structure with must_haves in frontmatter
- `gsd-executor` — Expects task structure with type, files, action, verify, done
- `gsd-verifier` — Expects must_haves format (truths, artifacts, key_links)
- `execute-phase` — Expects wave/depends_on in frontmatter

**Breaking Changes to Watch:**
- Changing PLAN.md frontmatter schema → breaks executor wave reading
- Changing must_haves structure → breaks verifier gap detection
- Changing task XML structure → breaks executor task parsing
- Changing return message format → breaks orchestrator handling
- Removing gap_closure mode → breaks verification loop

---

## Section Index

| Section | Lines (approx) | Purpose |
|---------|----------------|---------|
| `<role>` | 1-26 | Identity and core responsibilities |
| `<philosophy>` | 28-80 | Solo dev workflow, quality curve, anti-enterprise |
| `<discovery_levels>` | 82-117 | Mandatory discovery protocol (Level 0-3) |
| `<task_breakdown>` | 119-231 | Task anatomy, types, sizing, TDD detection |
| `<dependency_graph>` | 233-310 | Building graph, vertical vs horizontal, file ownership |
| `<scope_estimation>` | 312-379 | Context budget, split signals, depth calibration |
| `<plan_format>` | 381-490 | PLAN.md structure, frontmatter fields, context rules |
| `<goal_backward>` | 492-598 | Goal-backward methodology (5 steps) |
| `<checkpoints>` | 600-716 | Checkpoint types, auth gates, anti-patterns |
| `<tdd_integration>` | 718-800 | TDD detection, plan structure, context budget |
| `<gap_closure_mode>` | 802-877 | Planning from verification gaps |
| `<revision_mode>` | 879-989 | Planning from checker feedback |
| `<execution_flow>` | 991-1227 | 12-step execution process |
| `<structured_returns>` | 1229-1332 | 4 return message formats |
| `<success_criteria>` | 1334-1368 | Completion checklists (standard/gap closure) |

---

## Quick Reference

```
WHAT:     Creates executable PLAN.md files with goal-backward verification
MODES:    Standard, Gap Closure, Revision
BUDGET:   ~50% context per plan (2-3 tasks)
OUTPUT:   .planning/phases/XX-name/{phase}-{NN}-PLAN.md

CORE RULES:
• 2-3 tasks per plan, 15-60 min each
• Plans ARE prompts — complete, not drafts
• Goal-backward: truths → artifacts → wiring → key links
• Mandatory discovery unless proven unnecessary
• Vertical slices over horizontal layers

SPAWNED BY: /gsd:plan-phase, /gsd:plan-phase --gaps
CONSUMED BY: gsd-plan-checker, gsd-executor, gsd-verifier, execute-phase
```
