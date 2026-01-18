# GSD System Architecture Scaffolding

> **Purpose:** Maximum signal-to-noise architectural reference for LLM modification tasks.
> **Usage:** Load this first, then extract behavioral details from source files as needed.

---

## Core Problem & Solution

**Problem:** Claude's output quality degrades as context fills (>60% = degradation mode).

**Solution:** Spawn fresh 200k context agents for each discrete task. Orchestrators stay lean (10-15%), agents execute in isolation (40-50%), communicate via files only.

---

## Five Invariant Principles

| # | Principle | Rule | Violation Consequence |
|---|-----------|------|----------------------|
| 1 | **Context Budget** | Orchestrators ≤15%, Agents target ≤50% | Quality degradation |
| 2 | **Orchestrator Pattern** | Commands coordinate, agents execute. No business logic in commands. | Context pollution |
| 3 | **File-Based State** | All state in `.planning/` as Markdown+YAML. No IPC, no shared memory. | State loss, race conditions |
| 4 | **Goal-Backward** | Verify truths (outcomes), not tasks (changes) | Ship incomplete work |
| 5 | **Wave Parallelism** | Pre-compute waves at plan time, execute same-wave plans in parallel | Sequential bottleneck |

---

## Four-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ DISTRIBUTION LAYER                                          │
│ bin/install.js → ~/.claude/ or ./.claude/                   │
│ hooks/statusline.js, hooks/gsd-check-update.js             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ COMMAND LAYER (Orchestrators) — 10-15% context              │
│ commands/gsd/*.md                                           │
│ Validate → Spawn agents → Read outputs → Route next         │
└─────────────────────────────────────────────────────────────┘
                              │ Task(prompt, subagent_type)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ AGENT LAYER (Executors) — Fresh 200k, target 40-50%         │
│ agents/gsd-*.md                                             │
│ Load workflows+templates → Execute → Write outputs          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ STATE LAYER                                                 │
│ .planning/ — PROJECT.md, STATE.md, ROADMAP.md, phases/      │
└─────────────────────────────────────────────────────────────┘
```

---

## Command Registry

| Command | Purpose | Spawns | Source |
|---------|---------|--------|--------|
| `/gsd:new-project` | Project init (questioning→research→requirements→roadmap) | gsd-project-researcher (×4 parallel), gsd-research-synthesizer, gsd-roadmapper | `commands/gsd/new-project.md` |
| `/gsd:plan-phase` | Phase planning with verification loop | gsd-phase-researcher, gsd-planner, gsd-plan-checker | `commands/gsd/plan-phase.md` |
| `/gsd:execute-phase` | Wave-based execution + verification | gsd-executor (parallel), gsd-verifier | `commands/gsd/execute-phase.md` |
| `/gsd:verify-work` | Conversational UAT session | gsd-debugger (if issues), gsd-planner (--gaps), gsd-plan-checker | `commands/gsd/verify-work.md` |
| `/gsd:debug` | Scientific debugging | gsd-debugger | `commands/gsd/debug.md` |
| `/gsd:progress` | Status check + intelligent routing | None | `commands/gsd/progress.md` |
| `/gsd:discuss-phase` | Capture user vision before planning | None | `commands/gsd/discuss-phase.md` |
| `/gsd:research-phase` | Phase-specific research | gsd-phase-researcher | `commands/gsd/research-phase.md` |
| `/gsd:list-phase-assumptions` | Preview Claude's planned approach | None | `commands/gsd/list-phase-assumptions.md` |
| `/gsd:audit-milestone` | Audit milestone before archiving | gsd-integration-checker | `commands/gsd/audit-milestone.md` |
| `/gsd:map-codebase` | Brownfield codebase analysis | gsd-codebase-mapper | `commands/gsd/map-codebase.md` |
| `/gsd:new-milestone` | Start new milestone cycle | gsd-project-researcher (×4), gsd-research-synthesizer, gsd-roadmapper | `commands/gsd/new-milestone.md` |
| `/gsd:complete-milestone` | Archive milestone, tag release | None | `commands/gsd/complete-milestone.md` |
| `/gsd:plan-milestone-gaps` | Create phases to close audit gaps | None | `commands/gsd/plan-milestone-gaps.md` |
| `/gsd:pause-work` | Create a session handoff checkpoint | None | `commands/gsd/pause-work.md` |
| `/gsd:resume-work` | Resume work with context restoration | None | `commands/gsd/resume-work.md` |
| `/gsd:add-todo` | Capture a follow-up todo | None | `commands/gsd/add-todo.md` |
| `/gsd:check-todos` | Review captured todos | None | `commands/gsd/check-todos.md` |
| `/gsd:update` | Update GSD install | None | `commands/gsd/update.md` |
| `/gsd:whats-new` | Show release notes | None | `commands/gsd/whats-new.md` |
| `/gsd:add-phase` | Add a roadmap phase | None | `commands/gsd/add-phase.md` |
| `/gsd:insert-phase` | Insert a phase in the roadmap | None | `commands/gsd/insert-phase.md` |
| `/gsd:remove-phase` | Remove a roadmap phase | None | `commands/gsd/remove-phase.md` |
| `/gsd:help` | GSD command index | None | `commands/gsd/help.md` |

---

## Agent Registry

| Agent | Expertise | Input | Output | Source |
|-------|-----------|-------|--------|--------|
| **gsd-planner** | Task breakdown, dependency graphs, goal-backward | ROADMAP goal, CONTEXT, RESEARCH | `{phase}-{plan}-PLAN.md` | `agents/gsd-planner.md` |
| **gsd-plan-checker** | Pre-execution verification (6 dimensions) | PLAN.md files | Pass/fail + feedback | `agents/gsd-plan-checker.md` |
| **gsd-executor** | Code implementation, atomic commits | PLAN.md | `{phase}-{plan}-SUMMARY.md` + commits | `agents/gsd-executor.md` |
| **gsd-verifier** | Goal-backward verification (3-level programmatic + UAT) | ROADMAP, codebase | `{phase}-VERIFICATION.md` | `agents/gsd-verifier.md` |
| **gsd-debugger** | Scientific debugging, hypothesis testing | Issue description | `debug/{slug}.md` | `agents/gsd-debugger.md` |
| **gsd-project-researcher** | Project-level ecosystem research (4 dimensions) | Research question, dimension | `research/STACK.md`, `research/FEATURES.md`, `research/ARCHITECTURE.md`, `research/PITFALLS.md` | `agents/gsd-project-researcher.md` |
| **gsd-research-synthesizer** | Synthesize parallel research outputs | 4 research files | `research/SUMMARY.md` | `agents/gsd-research-synthesizer.md` |
| **gsd-phase-researcher** | Phase-specific implementation research | Phase goal | `{phase}-RESEARCH.md` | `agents/gsd-phase-researcher.md` |
| **gsd-roadmapper** | Requirement→phase mapping | REQUIREMENTS.md, research/ | ROADMAP.md, STATE.md | `agents/gsd-roadmapper.md` |
| **gsd-codebase-mapper** | Brownfield analysis | Existing codebase | `codebase/*.md` (7 files) | `agents/gsd-codebase-mapper.md` |
| **gsd-integration-checker** | Cross-phase integration verification | Phase SUMMARYs, codebase | MILESTONE-AUDIT.md | `agents/gsd-integration-checker.md` |

### Critical Agent Sections

| Agent | Critical Sections |
|-------|-------------------|
| **gsd-planner** | `<philosophy>`, `<goal_backward>`, `<scope_estimation>`, `<tdd_integration>`, `<dependency_graph>`, `<discovery_levels>` |
| **gsd-plan-checker** | `<verification_dimensions>`, `<core_principle>`, `<issue_structure>` |
| **gsd-executor** | `<execution_flow>`, `<deviation_rules>`, `<checkpoint_behavior>`, `<segment_execution>` |
| **gsd-verifier** | `<verification_process>`, `<core_principle>`, `<output>` |
| **gsd-debugger** | `<investigation_techniques>`, `<hypothesis_testing>` |
| **gsd-project-researcher** | `<research_modes>`, `<source_hierarchy>`, `<verification_protocol>` |
| **gsd-research-synthesizer** | `<execution_flow>`, `<output_format>`, `<success_criteria>` |

---

## Workflow Registry

| Workflow | Purpose | Used By | Source |
|----------|---------|---------|--------|
| `execute-plan.md` | Task execution procedure | gsd-executor | `get-shit-done/workflows/execute-plan.md` |
| `execute-phase.md` | Phase orchestration | /gsd:execute-phase | `get-shit-done/workflows/execute-phase.md` |
| `verify-phase.md` | Goal verification procedure | gsd-verifier | `get-shit-done/workflows/verify-phase.md` |
| `verify-work.md` | UAT session procedure | /gsd:verify-work | `get-shit-done/workflows/verify-work.md` |
| `diagnose-issues.md` | Parallel issue diagnosis | /gsd:verify-work | `get-shit-done/workflows/diagnose-issues.md` |
| `complete-milestone.md` | Milestone archival | /gsd:complete-milestone | `get-shit-done/workflows/complete-milestone.md` |
| `discuss-phase.md` | Gather phase context | /gsd:discuss-phase | `get-shit-done/workflows/discuss-phase.md` |
| `discovery-phase.md` | Library/option research | /gsd:plan-phase | `get-shit-done/workflows/discovery-phase.md` |
| `map-codebase.md` | Brownfield analysis | /gsd:map-codebase | `get-shit-done/workflows/map-codebase.md` |
| `resume-project.md` | Session restoration | /gsd:resume-work | `get-shit-done/workflows/resume-project.md` |
| `transition.md` | Phase completion | execute-phase | `get-shit-done/workflows/transition.md` |
| `list-phase-assumptions.md` | Surface assumptions | /gsd:list-phase-assumptions | `get-shit-done/workflows/list-phase-assumptions.md` |

---

## Template Registry

| Template | Produces | Filled By | Source |
|----------|----------|-----------|--------|
| `phase-prompt.md` | PLAN.md | gsd-planner | `get-shit-done/templates/phase-prompt.md` |
| `planner-subagent-prompt.md` | Planner context | /gsd:plan-phase | `get-shit-done/templates/planner-subagent-prompt.md` |
| `summary.md` | SUMMARY.md | gsd-executor | `get-shit-done/templates/summary.md` |
| `verification-report.md` | VERIFICATION.md | gsd-verifier | `get-shit-done/templates/verification-report.md` |
| `project.md` | PROJECT.md | /gsd:new-project | `get-shit-done/templates/project.md` |
| `roadmap.md` | ROADMAP.md | gsd-roadmapper | `get-shit-done/templates/roadmap.md` |
| `requirements.md` | REQUIREMENTS.md | /gsd:new-project | `get-shit-done/templates/requirements.md` |
| `state.md` | STATE.md | Multiple | `get-shit-done/templates/state.md` |
| `codebase/*.md` | Brownfield analysis files (7) | gsd-codebase-mapper | `get-shit-done/templates/codebase/` |
| `research-project/*.md` | Research dimension files | gsd-project-researcher | `get-shit-done/templates/research-project/` |

---

## Reference Registry

| Reference | Domain | Used By | Source |
|-----------|--------|---------|--------|
| `checkpoints.md` | Checkpoint protocols (3 types) | gsd-executor | `get-shit-done/references/checkpoints.md` |
| `tdd.md` | Test-driven development patterns | gsd-planner, gsd-executor | `get-shit-done/references/tdd.md` |
| `questioning.md` | Requirements elicitation | /gsd:new-project | `get-shit-done/references/questioning.md` |
| `ui-brand.md` | UI styling conventions | Multiple commands | `get-shit-done/references/ui-brand.md` |
| `verification-patterns.md` | Stub detection, wiring checks | gsd-verifier | `get-shit-done/references/verification-patterns.md` |
| `continuation-format.md` | Session handoff format | /gsd:pause-work, /gsd:resume-work | `get-shit-done/references/continuation-format.md` |
| `git-integration.md` | Git workflow patterns | gsd-executor | `get-shit-done/references/git-integration.md` |

---

## Source Hierarchy (Research)

When agents perform research, sources are ranked by confidence:

| Rank | Source | Confidence | Notes |
|------|--------|------------|-------|
| 1 | Context7 | HIGH | Pre-indexed, verified documentation |
| 2 | Official documentation | HIGH | Primary source of truth |
| 3 | Official GitHub repos | HIGH | Reference implementations |
| 4 | WebSearch (verified) | MEDIUM | Cross-referenced with official source |
| 5 | WebSearch (unverified) | LOW | Must flag as unverified |

**Rule:** Researchers must include confidence level with every recommendation.

---

## State File Hierarchy

```
.planning/
├── PROJECT.md              # Strategic: Vision, constraints (rarely changes)
├── config.json             # Strategic: Workflow preferences
├── REQUIREMENTS.md         # Strategic: Scoped requirements with REQ-IDs
├── ROADMAP.md              # Operational: Phase structure, completion status
├── STATE.md                # Operational: Current position, decisions, blockers
├── research/               # Context: Domain knowledge
│   ├── STACK.md            # Technology recommendations
│   ├── FEATURES.md         # Feature landscape
│   ├── ARCHITECTURE.md     # System structure patterns
│   ├── PITFALLS.md         # Domain pitfalls
│   └── SUMMARY.md          # Synthesis with roadmap implications
├── codebase/               # Context: Brownfield analysis (7 files)
│   ├── STACK.md            # Existing tech stack
│   ├── STRUCTURE.md        # Directory layout
│   ├── ARCHITECTURE.md     # Current patterns
│   ├── CONVENTIONS.md      # Coding standards, naming
│   ├── TESTING.md          # Test setup, patterns
│   ├── INTEGRATIONS.md     # External services
│   └── CONCERNS.md         # Tech debt, known issues
├── phases/
│   └── XX-name/
│       ├── XX-CONTEXT.md       # Phase decisions
│       ├── XX-RESEARCH.md      # Phase research
│       ├── XX-YY-PLAN.md       # Execution plans
│       ├── XX-YY-SUMMARY.md    # What was built
│       ├── XX-VERIFICATION.md  # Goal achievement status
│       └── XX-UAT.md           # User acceptance testing
├── todos/                  # Session: Captured ideas
├── debug/                  # Session: Debug investigations
└── cache/                  # Session: Project-local caches
```

Global update-check cache (installed hook):

```
~/.claude/cache/gsd-update-check.json
```

---

## Key Flows

### Flow 1: Project Initialization
```
/gsd:new-project
├─→ Phase 1: Setup (git init, brownfield detection)
├─→ Phase 2: Brownfield Offer (optional /gsd:map-codebase)
├─→ Phase 3: Deep Questioning
├─→ Phase 4: Write PROJECT.md
├─→ Phase 5: Workflow Preferences → config.json
├─→ Phase 6: Research Decision
│   └─→ Spawn 4× gsd-project-researcher (parallel)
│       ├─→ STACK.md
│       ├─→ FEATURES.md
│       ├─→ ARCHITECTURE.md
│       └─→ PITFALLS.md
│   └─→ Spawn gsd-research-synthesizer → SUMMARY.md
├─→ Phase 7: Define Requirements → REQUIREMENTS.md
├─→ Phase 8: Spawn gsd-roadmapper → ROADMAP.md, STATE.md
└─→ Phase 10: Present completion + next steps
```

### Flow 2: Phase Planning
```
/gsd:plan-phase N [--gaps] [--skip-research] [--skip-verify]
├─→ Check for CONTEXT.md (from discuss-phase)
├─→ Check for RESEARCH.md (or spawn gsd-phase-researcher)
├─→ Spawn gsd-planner → PLAN.md files
│   ├─→ Mode: standard (default)
│   ├─→ Mode: gap_closure (if --gaps flag)
│   └─→ Mode: revision (if checker returns issues)
└─→ Spawn gsd-plan-checker (verification loop)
    ├─→ PASS → ready for execution
    └─→ FAIL → revision loop (max 3) → re-spawn planner
```

### Flow 3: Phase Execution
```
/gsd:execute-phase N
├─→ Discover plans (frontmatter only)
├─→ Group by wave
├─→ Wave 1: spawn gsd-executor ×N (parallel)
│   └─→ writes SUMMARY.md, commits code
├─→ Wave 2: spawn gsd-executor ×N (parallel)
│   └─→ ...
└─→ spawn gsd-verifier
    ├─→ PASS → route to next phase
    └─→ GAPS → offer gap closure planning
```

### Flow 4: Milestone Completion
```
/gsd:audit-milestone
├─→ Read all phase VERIFICATION.md files
├─→ Aggregate tech debt and deferred gaps
├─→ Spawn gsd-integration-checker
│   ├─→ Build export/import map from SUMMARYs
│   ├─→ Verify export usage (connected/orphaned)
│   ├─→ Verify API coverage (routes → consumers)
│   ├─→ Verify auth protection on sensitive routes
│   └─→ Trace E2E flows (complete/broken)
├─→ Check requirements coverage from REQUIREMENTS.md
├─→ Generate v{version}-MILESTONE-AUDIT.md
└─→ Route: passed → complete, gaps → plan-gaps, tech_debt → review

/gsd:plan-milestone-gaps (if gaps found)
├─→ Load MILESTONE-AUDIT.md
├─→ Prioritize gaps by requirement priority
├─→ Group related gaps into phases
├─→ Present gap closure plan
├─→ On approval, update ROADMAP.md
└─→ Route to first gap phase

/gsd:complete-milestone {version}
├─→ Verify audit passed (or tech_debt accepted)
├─→ Archive to .planning/milestones/v{version}/
│   ├─→ v{version}-ROADMAP.md
│   └─→ v{version}-REQUIREMENTS.md
├─→ Update PROJECT.md to brownfield format
├─→ Git tag v{version}
└─→ Offer /gsd:new-milestone
```

### Flow 5: Verification & UAT
```
/gsd:verify-work [phase]
├─→ Interactive testing session
├─→ User reports issues (natural language)
│   └─→ infers severity
├─→ writes UAT.md
└─→ If issues: spawn gsd-debugger (parallel per issue)
    └─→ writes diagnoses → spawn gsd-planner --gaps → gsd-plan-checker
```

---

## Critical Behaviors by Agent

### gsd-planner — `agents/gsd-planner.md`

| Behavior | Section | Key Rules |
|----------|---------|-----------|
| Three modes | `<role>` | standard (default), gap_closure (--gaps), revision (checker feedback) |
| Context target | `<philosophy>` | 50% target (not 80%) |
| Task limit | `<scope_estimation>` | 2-3 tasks per plan MAXIMUM |
| Goal-backward | `<goal_backward>` | 5-step process for verification derivation |
| TDD detection | `<tdd_integration>` | Can you write `expect(fn(input)).toBe(output)` before `fn`? |
| Discovery | `<discovery_levels>` | MANDATORY context gathering (Levels 0-3) |
| Wave assignment | `<dependency_graph>` | Build needs/creates graph, compute waves |
| User setup | `<task_breakdown>` | External services detection → frontmatter only |
| Split signals | `<scope_estimation>` | >3 tasks, different subsystems, >5 files, risk of overflow |

### gsd-executor — `agents/gsd-executor.md`

| Behavior | Section | Key Rules |
|----------|---------|-----------|
| Atomic commits | `<execution_flow>` | One commit per task |
| Deviation rules | `<deviation_rules>` | Rule 1: Auto-fix bugs, Rule 2: Auto-add critical, Rule 3: Auto-fix blockers, Rule 4: Ask about architectural |
| Checkpoint types | `<checkpoint_behavior>` | human-verify, decision, human-action |
| Segment routing | `<segment_execution>` | Subagent spawning for long plans |
| TDD execution | `<tdd_execution>` | RED → GREEN → REFACTOR cycle |

### gsd-verifier — `agents/gsd-verifier.md`

| Behavior | Section | Key Rules |
|----------|---------|-----------|
| 3-level programmatic | `<verification_process>` | Exists → Substantive → Wired |
| 4th level (Functional) | Via UAT | Requires human verification (/gsd:verify-work) |
| Truth verification | `<core_principle>` | Verify outcomes, not task completion |
| Gap classification | `<output>` | Status: passed, gaps_found, human_needed |
| Re-verification mode | `<verification_process>` | Optimized for gap closure checks |

### gsd-plan-checker — `agents/gsd-plan-checker.md`

| Behavior | Section | Key Rules |
|----------|---------|-----------|
| 6 verification dimensions | `<verification_dimensions>` | Coverage, Completeness, Dependencies, Key Links, Scope, Derivation |
| Requirement coverage | Dimension 1 | Every phase requirement has task(s) |
| Scope sanity | Dimension 5 | 2-3 tasks/plan, 5-8 files/plan typical, 15+ is blocker |
| Issue severity | `<issue_structure>` | blocker, warning, info |

### gsd-project-researcher — `agents/gsd-project-researcher.md`

| Behavior | Section | Key Rules |
|----------|---------|-----------|
| 4 research dimensions | `<execution_flow>` | Stack, Features, Architecture, Pitfalls |
| Source hierarchy | `<source_hierarchy>` | Context7 → Official docs → Official GitHub → WebSearch (verified) → WebSearch (unverified) |
| Confidence levels | `<verification_protocol>` | HIGH/MEDIUM/LOW with justification |
| No commit | `<execution_flow>` | Researchers write files but DON'T commit |

### gsd-research-synthesizer — `agents/gsd-research-synthesizer.md`

| Behavior | Section | Key Rules |
|----------|---------|-----------|
| 4-file synthesis | `<execution_flow>` | Reads STACK, FEATURES, ARCHITECTURE, PITFALLS |
| Cross-referencing | `<execution_flow>` | Validates consistency across research files |
| Priority conflicts | `<execution_flow>` | Resolves contradictions between sources |
| Output format | `<output_format>` | Produces SUMMARY.md with actionable synthesis |

**Key insight:** Synthesizer runs AFTER parallel researchers complete. It doesn't do research — it reconciles and prioritizes findings from the 4 research dimensions.

---

## Numeric Limits Quick Reference

| Limit | Value | Enforced By |
|-------|-------|-------------|
| Orchestrator context | ≤15% | Commands |
| Agent context target | ≤50% | Agents |
| TDD context target | ≤40% | gsd-planner |
| Tasks per plan | 2-3 max | gsd-planner |
| Files per plan | 5-8 typical, 15+ is blocker | gsd-plan-checker |
| Key links per plan | 3-5 typical | gsd-planner |
| Revision iterations | Max 3 | /gsd:plan-phase |
| Observable truths | 3-7 | gsd-planner |
| Parallel researchers | 4 | /gsd:new-project, /gsd:research-project |
| Quality degradation start | 60% | All |

---

## Anti-Pattern Quick Reference

| Anti-Pattern | Why Bad | Correct Approach |
|--------------|---------|------------------|
| Command loads workflow content | Context pollution | Spawn agent |
| Agent spawns another agent | Architecture violation | Return to orchestrator |
| Plan with >3 tasks | Exceeds budget | Split into plans |
| Horizontal slicing | No parallelism | Vertical slices |
| Target 80% context | 40% in degradation | Target 50% |
| Skip verification | Stubs ship | Always verify truths |
| Hardcode paths | Breaks portability | Use @-references |
| Trust SUMMARY.md claims | Stubs documented as complete | Verify codebase directly |
| Reflexive SUMMARY chaining | Creates false dependencies | Only reference if genuinely needed |
| Verifying tasks not truths | Ship incomplete features | Verify observable outcomes |
| Research without synthesis | Fragmented knowledge | Always run synthesizer after parallel research |

---

## Extraction Protocol

When modifying a component, extract behavioral details from source:

```
1. Load this scaffolding (architectural context)
2. Identify source file from registries above
3. Read "Critical Sections" for that component
4. Scan source for:
   - MUST/NEVER/ALWAYS constraints
   - Numeric limits (%, counts)
   - Mode/branch conditions
   - Anti-patterns with consequences
5. Document extracted behaviors before modifying
```

---

## Version

- **GSD Version:** 1.6.3
- **Scaffolding Version:** v5
- **Updated:** 2026-01-18
