# Support Components Reference

Comprehensive reference for GSD workflows, templates, and reference documents.

---

## Workflows

| Workflow | Purpose | Used By | Output |
|----------|---------|---------|--------|
| execute-plan.md | Task-by-task plan execution with atomic commits | gsd-executor | SUMMARY.md, code changes |
| execute-phase.md | Orchestrates parallel plan execution across waves | /gsd:execute-phase | Multiple SUMMARY.md files |
| verify-work.md | Interactive UAT testing with user | /gsd:verify-work | UAT.md |
| verify-phase.md | Goal-backward verification after execution | gsd-verifier | VERIFICATION.md |
| discuss-phase.md | Gather user context before planning | /gsd:discuss-phase | CONTEXT.md |
| resume-project.md | Restore context for returning sessions | /gsd:resume-work | Display output |
| transition.md | Phase completion and next phase setup | execute-phase | STATE.md updates |
| map-codebase.md | Analyze existing codebase structure | gsd-codebase-mapper | CODEBASE.md |
| diagnose-issues.md | Parallel gap investigation from UAT | /gsd:verify-work | DEBUG.md files |
| list-phase-assumptions.md | Surface implicit assumptions in phase | /gsd:list-phase-assumptions | Display output |
| complete-milestone.md | Archive completed milestone | /gsd:complete-milestone | Milestone archive |
| discovery-phase.md | Shallow research for library decisions | plan-phase | DISCOVERY.md |

---

### execute-plan.md Details

**Purpose:** Execute tasks from a single PLAN.md with atomic commits per task.

**Steps:**
1. Load PLAN.md, parse frontmatter and tasks
2. Execute each task sequentially (read files, make changes, verify)
3. Handle deviations per deviation rules (auto-fix or checkpoint)
4. Commit after each task completion with conventional format
5. Write SUMMARY.md with execution results and frontmatter

**Key Behaviors:**
- One commit per task (atomic units)
- Deviation rules determine auto-fix vs checkpoint
- Checkpoints pause and return to orchestrator
- SUMMARY frontmatter enables dependency tracking

---

### execute-phase.md Details

**Purpose:** Orchestrate execution of all plans in a phase using wave-based parallelism.

**Steps:**
1. Read all PLAN.md files in phase directory
2. Group plans by wave number from frontmatter
3. Execute Wave 1 plans in parallel (spawn Task agents)
4. Wait for Wave 1 completion, then execute Wave 2
5. Handle checkpoints by presenting to user and resuming agents
6. After all plans complete, trigger verify-phase

**Key Behaviors:**
- Plans with same wave number execute in parallel
- `autonomous: false` plans pause at checkpoints
- Agent resumption via `resume: agent_id`
- Wave assignment is pre-computed in frontmatter

---

### verify-work.md Details

**Purpose:** Interactive user acceptance testing after phase execution.

**Steps:**
1. Read SUMMARY.md files to extract testable behaviors
2. Present tests one at a time to user
3. Capture pass/fail/issue responses
4. On issues: infer severity from natural language
5. Generate UAT.md with results and gaps
6. If gaps found, offer diagnosis option

**Key Behaviors:**
- Tests derived from SUMMARY accomplishments
- Severity inferred, never asked (blocker/major/minor/cosmetic)
- UAT.md in YAML format for plan-phase --gaps consumption
- Diagnosis spawns parallel debug agents

---

### verify-phase.md Details

**Purpose:** Automated goal-backward verification against must_haves.

**Steps:**
1. Load must_haves from PLAN.md frontmatter
2. Check observable truths (can behavior be verified?)
3. Check required artifacts (do files exist and are substantive?)
4. Check key links (are components wired together?)
5. Generate VERIFICATION.md with pass/fail/gaps
6. If gaps found, generate recommended fix plan outlines

**Key Behaviors:**
- 4-level hierarchy: Existence → Substantive → Wired → Functional
- Truths checked via test commands or human verification
- Artifacts checked for stub patterns and minimum substance
- Key links checked via grep for connection patterns

---

### discuss-phase.md Details

**Purpose:** Gather implementation decisions from user before planning.

**Steps:**
1. Read phase goal from ROADMAP.md
2. Present phase boundary to user
3. Ask clarifying questions about implementation preferences
4. Capture decisions organized by discussion areas
5. Write CONTEXT.md with decisions and deferred ideas

**Key Behaviors:**
- Categories emerge from discussion, not predefined
- "Claude's Discretion" section for flexibility areas
- Deferred ideas captured to prevent scope creep
- Downstream: CONTEXT.md feeds researcher and planner

---

### resume-project.md Details

**Purpose:** Restore context when returning to a project.

**Steps:**
1. Read STATE.md for current position
2. Check for .continue-here.md files
3. Read recent SUMMARY.md files for context
4. Present status and recommended next action
5. If .continue-here exists, restore mid-task state

**Key Behaviors:**
- STATE.md is primary restoration source
- .continue-here.md enables mid-task resume
- Presents "Next Up" block with command
- Cleans up .continue-here after successful resume

---

### transition.md Details

**Purpose:** Handle phase completion and prepare for next phase.

**Steps:**
1. Mark current phase complete in ROADMAP.md
2. Update STATE.md position and progress
3. Extract decisions to PROJECT.md Key Decisions
4. Clear resolved blockers
5. Present next phase options

**Key Behaviors:**
- Updates progress bar in STATE.md
- Refreshes Project Reference date
- Continuous phase numbering (never restart at 01)
- Presents "Next Up" with plan-phase command

---

### map-codebase.md Details

**Purpose:** Analyze existing codebase for brownfield projects.

**Steps:**
1. Scan directory structure and file types
2. Identify frameworks, libraries, patterns
3. Analyze architecture (layers, modules, dependencies)
4. Detect technical debt and code smells
5. Generate CODEBASE.md with findings

**Key Behaviors:**
- Produces multiple analysis files (structure, patterns, debt)
- Informs PROJECT.md Validated requirements
- Used during new-project for existing codebases
- Non-destructive analysis only

---

### diagnose-issues.md Details

**Purpose:** Parallel investigation of UAT gaps.

**Steps:**
1. Read UAT.md gaps section
2. Spawn parallel debug agents (one per gap)
3. Each agent investigates root cause
4. Collect results and update UAT.md with diagnosis
5. Set status to "diagnosed" when complete

**Key Behaviors:**
- Parallel debugging for efficiency
- Each gap gets root_cause, artifacts, missing fields
- Debug sessions saved to .planning/debug/
- Ready for /gsd:plan-phase --gaps after diagnosis

---

### list-phase-assumptions.md Details

**Purpose:** Surface implicit assumptions in phase before execution.

**Steps:**
1. Read PLAN.md files for phase
2. Extract implicit assumptions from tasks
3. Categorize: technical, scope, dependency, user
4. Present assumptions to user for validation
5. Flag questionable assumptions

**Key Behaviors:**
- Proactive risk identification
- Allows user to validate before execution
- No file output (display only)
- Helps prevent mid-execution surprises

---

### complete-milestone.md Details

**Purpose:** Archive completed milestone and prepare for next.

**Steps:**
1. Verify all phases in milestone complete
2. Create milestone entry in MILESTONES.md
3. Archive phase details to .planning/milestones/
4. Collapse completed phases in ROADMAP.md
5. Update PROJECT.md to brownfield format

**Key Behaviors:**
- Milestones grouped by version (v1.0, v1.1, etc.)
- Phase details preserved in archive
- ROADMAP uses `<details>` for collapsed phases
- Stats include file count, LOC, duration

---

### discovery-phase.md Details

**Purpose:** Shallow research for library/option decisions during planning.

**Steps:**
1. Identify discovery question from planning context
2. Query sources (Context7 → Official Docs → WebSearch)
3. Compare options with pros/cons
4. Write DISCOVERY.md with recommendation
5. Mark confidence level (HIGH/MEDIUM/LOW)

**Key Behaviors:**
- Shallow: answers "which library" not "how to build"
- Source hierarchy for reliability
- Low confidence findings marked for validation
- Differs from RESEARCH.md (deep ecosystem research)

---

## Templates

| Template | Produces | Filled By | Key Sections |
|----------|----------|-----------|--------------|
| roadmap.md | ROADMAP.md | gsd-roadmapper | Phases, Phase Details, Progress |
| state.md | STATE.md | Multiple workflows | Position, Metrics, Context |
| project.md | PROJECT.md | new-project | What This Is, Requirements, Constraints |
| summary.md | {phase}-{plan}-SUMMARY.md | gsd-executor | Performance, Accomplishments, Commits |
| phase-prompt.md | {phase}-{plan}-PLAN.md | gsd-planner | Objective, Context, Tasks, Verification |
| context.md | {phase}-CONTEXT.md | discuss-phase | Domain, Decisions, Specifics |
| requirements.md | REQUIREMENTS.md | new-project | v1 Requirements, Traceability |
| research.md | {phase}-RESEARCH.md | research-phase | Stack, Patterns, Pitfalls |
| discovery.md | DISCOVERY.md | plan-phase | Summary, Recommendation, Findings |
| verification-report.md | {phase}-VERIFICATION.md | verify-phase | Truths, Artifacts, Gaps |
| UAT.md | {phase}-UAT.md | verify-work | Tests, Summary, Gaps |
| DEBUG.md | {slug}.md | gsd-debugger | Focus, Symptoms, Evidence |
| milestone.md | MILESTONES.md entry | complete-milestone | Delivered, Stats, Git range |
| milestone-archive.md | v{X.Y}-{name}.md | complete-milestone | Phases, Decisions, Issues |
| user-setup.md | {phase}-USER-SETUP.md | execute-plan | Env Vars, Dashboard Config |
| continue-here.md | .continue-here.md | execute-plan | State, Work, Next Action |
| planner-subagent-prompt.md | (agent prompt) | plan-phase | Planning Context, Quality Gate |
| debug-subagent-prompt.md | (agent prompt) | debug/diagnose | Symptoms, Mode, Debug File |
| config.json | .planning/config.json | /gsd:new-project | mode, depth, parallelization, gates, safety |

---

### Frontmatter Schemas

#### PLAN.md Frontmatter

| Field | Type | Required | Used By | Description |
|-------|------|----------|---------|-------------|
| phase | string | Yes | execute-phase | Phase identifier (e.g., `01-foundation`) |
| plan | string | Yes | execute-phase | Plan number within phase (e.g., `01`, `02`) |
| type | string | Yes | executor | `execute` or `tdd` |
| wave | int | Yes | execute-phase | Execution wave number (1, 2, 3...) |
| depends_on | list | Yes | execute-phase | Plan IDs this plan requires (e.g., `["01-01"]`) |
| files_modified | list | Yes | planner | Files this plan modifies |
| autonomous | bool | Yes | executor | `true` if no checkpoints, `false` if has checkpoints |
| user_setup | list | No | execute-plan | Human-required setup items (external services) |
| must_haves | object | Yes | verify-phase | Goal-backward verification criteria |

**must_haves Structure:**
```yaml
must_haves:
  truths: []         # Observable behaviors that must be true
  artifacts: []      # Files that must exist with real implementation
  key_links: []      # Critical connections between artifacts
```

**artifacts Entry:**
```yaml
- path: "src/components/Chat.tsx"
  provides: "Message list rendering"
  min_lines: 30           # Optional
  exports: ["GET", "POST"] # Optional
  contains: "model Message" # Optional
```

**key_links Entry:**
```yaml
- from: "src/components/Chat.tsx"
  to: "/api/chat"
  via: "fetch in useEffect"
  pattern: "fetch.*api/chat"  # Optional regex
```

---

#### SUMMARY.md Frontmatter

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| phase | string | Yes | Phase identifier |
| plan | string | Yes | Plan number |
| subsystem | string | Yes | Primary category (auth, payments, ui, api, etc.) |
| tags | list | Yes | Searchable tech keywords |
| requires | list | No | Prior phases this depends on |
| provides | list | Yes | What this phase built/delivered |
| affects | list | No | Phase names that will need this context |
| tech-stack.added | list | No | Libraries/tools added |
| tech-stack.patterns | list | No | Architectural patterns established |
| key-files.created | list | No | Important files created |
| key-files.modified | list | No | Important files modified |
| key-decisions | list | No | Key decisions made |
| patterns-established | list | No | Patterns for future phases |
| duration | string | Yes | Execution time (e.g., `23min`) |
| completed | string | Yes | Completion date (YYYY-MM-DD) |

---

#### UAT.md Frontmatter

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| status | string | Yes | `testing`, `complete`, or `diagnosed` |
| phase | string | Yes | Phase identifier |
| source | list | Yes | SUMMARY.md files being tested |
| started | string | Yes | ISO timestamp |
| updated | string | Yes | ISO timestamp (update on every change) |

**Gaps Entry (YAML):**
```yaml
- truth: "Expected behavior from test"
  status: failed
  reason: "User reported: verbatim response"
  severity: blocker | major | minor | cosmetic
  test: 2
  root_cause: ""        # Filled by diagnosis
  artifacts: []         # Filled by diagnosis
  missing: []           # Filled by diagnosis
  debug_session: ""     # Filled by diagnosis
```

---

#### DEBUG.md Frontmatter

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| status | string | Yes | `gathering`, `investigating`, `fixing`, `verifying`, `resolved` |
| trigger | string | Yes | Verbatim user input (immutable) |
| created | string | Yes | ISO timestamp (immutable) |
| updated | string | Yes | ISO timestamp (update on every change) |

---

### config.json Schema

Produced by `/gsd:new-project` and consumed by commands that read `.planning/config.json`. The source of truth for this schema is `get-shit-done/templates/config.json`.

```json
{
  "mode": "interactive",
  "depth": "standard",
  "parallelization": {
    "enabled": true,
    "plan_level": true,
    "task_level": false,
    "skip_checkpoints": true,
    "max_concurrent_agents": 3,
    "min_plans_for_parallel": 2
  },
  "gates": {
    "confirm_project": true,
    "confirm_phases": true,
    "confirm_roadmap": true,
    "confirm_breakdown": true,
    "confirm_plan": true,
    "execute_next_plan": true,
    "issues_review": true,
    "confirm_transition": true
  },
  "safety": {
    "always_confirm_destructive": true,
    "always_confirm_external_services": true
  }
}
```

**Fields:**
- `mode`: string mode selector (e.g., `interactive`).  
- `depth`: string planning depth (e.g., `standard`).  
- `parallelization`: object controlling parallel execution:
  - `enabled`: boolean to allow parallelism.
  - `plan_level`: boolean to run plans in parallel.
  - `task_level`: boolean to run tasks in parallel.
  - `skip_checkpoints`: boolean to bypass checkpoints during parallel runs.
  - `max_concurrent_agents`: integer cap for simultaneous agents.
  - `min_plans_for_parallel`: integer threshold before parallelism activates.
- `gates`: object of boolean confirmation gates (`confirm_project`, `confirm_phases`, `confirm_roadmap`, `confirm_breakdown`, `confirm_plan`, `execute_next_plan`, `issues_review`, `confirm_transition`).
- `safety`: object of boolean safety toggles (`always_confirm_destructive`, `always_confirm_external_services`).

---

#### VERIFICATION.md Frontmatter

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| phase | string | Yes | Phase identifier |
| verified | string | Yes | ISO timestamp |
| status | string | Yes | `passed`, `gaps_found`, or `human_needed` |
| score | string | Yes | N/M must-haves verified |

---

#### user_setup Schema (in PLAN.md)

```yaml
user_setup:
  - service: stripe
    why: "Payment processing requires API keys"
    env_vars:
      - name: STRIPE_SECRET_KEY
        source: "Stripe Dashboard → Developers → API keys → Secret key"
    dashboard_config:
      - task: "Create webhook endpoint"
        location: "Stripe Dashboard → Developers → Webhooks"
        details: "URL: https://[domain]/api/webhooks/stripe"
    local_dev:
      - "stripe listen --forward-to localhost:3000/api/webhooks/stripe"
```

---

#### .continue-here.md Frontmatter

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| phase | string | Yes | Phase directory name |
| task | int | Yes | Current task number |
| total_tasks | int | Yes | Total tasks in plan |
| status | string | Yes | `in_progress`, `blocked`, `almost_done` |
| last_updated | string | Yes | ISO timestamp |

---

## References

| Reference | Domain | Used By |
|-----------|--------|---------|
| tdd.md | Test-Driven Development | gsd-planner, gsd-executor |
| checkpoints.md | Human-in-the-loop patterns | gsd-executor, plan templates |
| ui-brand.md | Visual output patterns | All orchestrators |
| git-integration.md | Commit strategy | gsd-executor |
| verification-patterns.md | Stub detection and wiring checks | gsd-verifier |
| continuation-format.md | Next steps presentation | All commands |
| questioning.md | Dream extraction methodology | new-project |

---

### tdd.md — Test-Driven Development

**Domain:** TDD methodology and plan structure for testable features.

**Key Concepts:**
- **TDD Heuristic:** Can you write `expect(fn(input)).toBe(output)` before `fn`? → TDD plan
- **Red-Green-Refactor:** Three commits per TDD plan (test → feat → refactor)
- **Context Budget:** TDD plans target ~40% (lower than standard ~50%)
- **One Feature Per Plan:** TDD work is heavier, needs full context
- **Skip TDD For:** UI, config, glue code, CRUD, prototyping

**When TDD Improves Quality:**
- Business logic with defined inputs/outputs
- API endpoints with request/response contracts
- Data transformations, parsing, formatting
- Validation rules and constraints
- Algorithms with testable behavior

---

### checkpoints.md — Human-in-the-Loop Patterns

**Domain:** Checkpoint types and execution protocol for plans.

**Key Concepts:**
- **checkpoint:human-verify (90%):** Claude automated, human confirms visual/functional correctness
- **checkpoint:decision (9%):** Human makes architectural/technology choice
- **checkpoint:human-action (1%):** Truly unavoidable manual steps (email verification, 3DS)
- **Authentication Gates:** Dynamic checkpoints when CLI/API needs credentials
- **The Golden Rule:** If Claude CAN automate it, Claude MUST automate it

**Checkpoint Protocol:**
1. Stop immediately at checkpoint task
2. Display checkpoint clearly with formatted box
3. Wait for user response
4. Verify if possible
5. Resume execution with `resume: agent_id`

---

### ui-brand.md — Visual Output Patterns

**Domain:** Consistent formatting for user-facing GSD output.

**Key Concepts:**
- **Stage Banners:** `GSD ► {STAGE NAME}` with double-line borders
- **Checkpoint Boxes:** 62-character width with type-specific prompts
- **Status Symbols:** ✓ ✗ ◆ ○ ⚡ ⚠ 🎉 (no random emoji)
- **Progress Display:** `████████░░ 80%` for phase/plan/task progress
- **Next Up Block:** Always at end of major completions

**Anti-Patterns:**
- Varying box/banner widths
- Mixing banner styles
- Random emoji (🚀, ✨, 💫)
- Missing Next Up block

---

### git-integration.md — Commit Strategy

**Domain:** Git commit patterns for GSD execution.

**Key Concepts:**
- **Commit Outcomes, Not Process:** Git log reads like changelog
- **Per-Task Commits:** Each task gets atomic commit immediately
- **Commit Format:** `{type}({phase}-{plan}): {task-name}`
- **Types:** feat, fix, test, refactor, perf, chore, docs
- **Plan Completion:** `docs({phase}-{plan}): complete [plan-name] plan`

**Don't Commit:**
- PLAN.md creation (intermediate)
- RESEARCH.md (intermediate)
- DISCOVERY.md (intermediate)
- "Fixed typo in roadmap"

**Do Commit:**
- Each task completion (feat/fix/test/refactor)
- Plan completion metadata (docs)
- Project initialization (docs)

---

### verification-patterns.md — Stub Detection

**Domain:** Programmatic verification of real implementations vs stubs.

**Key Concepts:**
- **4-Level Hierarchy:** Existence → Substantive → Wired → Functional
- **Stub Patterns:** TODO, FIXME, placeholder, return null, hardcoded values
- **Component Verification:** Exports function, returns JSX, uses props/state
- **API Verification:** Queries database, returns meaningful response, has error handling
- **Wiring Verification:** Component→API, API→Database, Form→Handler, State→Render

**Human Verification Triggers:**
- Visual appearance
- User flow completion
- Real-time behavior (WebSocket, SSE)
- External service integration
- Error message clarity

---

### continuation-format.md — Next Steps Presentation

**Domain:** Standard format for presenting next actions.

**Key Concepts:**
- **Structure:** `## ▶ Next Up` with identifier, description, command
- **Always Include:** `/clear` explanation, "Also available" alternatives
- **Pull Context:** Phase name from ROADMAP.md, plan objective from PLAN.md
- **Visual Separators:** `---` above and below for visibility

**Variants:**
- Execute Next Plan
- Execute Final Plan (note it's last)
- Plan a Phase
- Phase Complete
- Milestone Complete

---

### questioning.md — Dream Extraction

**Domain:** Methodology for project initialization questioning.

**Key Concepts:**
- **Thinking Partner, Not Interviewer:** Collaborative, not interrogative
- **Follow Energy:** Dig into what excited them
- **Challenge Vagueness:** Never accept fuzzy answers
- **Make Abstract Concrete:** "Walk me through using this"
- **Context Checklist:** What, Why, Who, What "done" looks like

**Question Types:**
- Motivation — Why this exists
- Concreteness — What it actually is
- Clarification — What they mean
- Success — How you'll know it's working

**Anti-Patterns:**
- Checklist walking regardless of context
- Corporate speak ("stakeholders", "success criteria")
- Interrogation without building on answers
- Shallow acceptance of vague answers

---

## Quick Reference Tables

### Workflow → Output Mapping

| Workflow | Primary Output | Secondary Output |
|----------|---------------|------------------|
| execute-plan | SUMMARY.md | Code changes, commits |
| execute-phase | Multiple SUMMARY.md | STATE.md updates |
| verify-work | UAT.md | — |
| verify-phase | VERIFICATION.md | Fix plan recommendations |
| discuss-phase | CONTEXT.md | — |
| diagnose-issues | DEBUG.md files | UAT.md updates |
| complete-milestone | MILESTONES.md, archive | ROADMAP.md collapse |

### Template → Consumer Mapping

| Template | Produced By | Consumed By |
|----------|-------------|-------------|
| PLAN.md | gsd-planner | gsd-executor, verify-phase |
| SUMMARY.md | gsd-executor | verify-work, plan-phase |
| CONTEXT.md | discuss-phase | gsd-phase-researcher, gsd-planner |
| RESEARCH.md | research-phase | gsd-planner |
| VERIFICATION.md | verify-phase | plan-phase --gaps |
| UAT.md | verify-work | plan-phase --gaps, diagnose-issues |
| DEBUG.md | gsd-debugger | User, plan-phase --gaps |

### Reference → Usage Mapping

| Reference | Primary Users | When Loaded |
|-----------|---------------|-------------|
| tdd.md | gsd-planner | TDD plan creation |
| checkpoints.md | gsd-executor, PLAN.md | Checkpoint tasks in plan |
| ui-brand.md | All orchestrators | User-facing output |
| git-integration.md | gsd-executor | Every commit |
| verification-patterns.md | gsd-verifier | Post-execution verification |
| continuation-format.md | All commands | End of command output |
| questioning.md | new-project | Project initialization |

---

*Generated: 2025-01-17*
*Source: get-shit-done/workflows/, get-shit-done/templates/, get-shit-done/references/*
