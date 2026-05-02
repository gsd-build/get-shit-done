# GSD Feature Reference

> Complete feature and function documentation with requirements. For architecture details, see [Architecture](ARCHITECTURE.md). For command syntax, see [Command Reference](COMMANDS.md).

---

## Table of Contents

- [Core Features](#core-features)
  - [Project Initialization](#1-project-initialization)
  - [Phase Discussion](#2-phase-discussion)
  - [UI Design Contract](#3-ui-design-contract)
  - [Phase Planning](#4-phase-planning)
  - [Phase Execution](#5-phase-execution)
  - [Work Verification](#6-work-verification)
  - [UI Review](#7-ui-review)
  - [Milestone Management](#8-milestone-management)
- [Planning Features](#planning-features)
  - [Phase Management](#9-phase-management)
  - [Quick Mode](#10-quick-mode)
  - [Autonomous Mode](#11-autonomous-mode)
  - [Freeform Routing](#12-freeform-routing)
  - [Note Capture](#13-note-capture)
  - [Auto-Advance (Next)](#14-auto-advance-next)
- [Quality Assurance Features](#quality-assurance-features)
  - [Nyquist Validation](#15-nyquist-validation)
  - [Plan Checking](#16-plan-checking)
  - [Post-Execution Verification](#17-post-execution-verification)
  - [Node Repair](#18-node-repair)
  - [Health Validation](#19-health-validation)
  - [Cross-Phase Regression Gate](#20-cross-phase-regression-gate)
  - [Requirements Coverage Gate](#21-requirements-coverage-gate)
- [Context Engineering Features](#context-engineering-features)
  - [Context Window Monitoring](#22-context-window-monitoring)
  - [Session Management](#23-session-management)
  - [Session Reporting](#24-session-reporting)
  - [Multi-Agent Orchestration](#25-multi-agent-orchestration)
  - [Model Profiles](#26-model-profiles)
- [Brownfield Features](#brownfield-features)
  - [Codebase Mapping](#27-codebase-mapping)
- [Utility Features](#utility-features)
  - [Debug System](#28-debug-system)
  - [Todo Management](#29-todo-management)
  - [Statistics Dashboard](#30-statistics-dashboard)
  - [Update System](#31-update-system)
  - [Settings Management](#32-settings-management)
  - [Test Generation](#33-test-generation)
- [Infrastructure Features](#infrastructure-features)
  - [Git Integration](#34-git-integration)
  - [CLI Tools](#35-cli-tools)
  - [Multi-Runtime Support](#36-multi-runtime-support)
  - [Hook System](#37-hook-system)
  - [Developer Profiling](#38-developer-profiling)
  - [Execution Hardening](#39-execution-hardening)
  - [Verification Debt Tracking](#40-verification-debt-tracking)
- [v1.27 Features](#v127-features)
  - [Fast Mode](#41-fast-mode)
  - [Cross-AI Peer Review](#42-cross-ai-peer-review)
  - [Backlog Parking Lot](#43-backlog-parking-lot)
  - [Persistent Context Threads](#44-persistent-context-threads)
  - [PR Branch Filtering](#45-pr-branch-filtering)
  - [Security Hardening](#46-security-hardening)
  - [Multi-Repo Workspace Support](#47-multi-repo-workspace-support)
  - [Discussion Audit Trail](#48-discussion-audit-trail)
- [v1.28 Features](#v128-features)
  - [Forensics](#49-forensics)
  - [Milestone Summary](#50-milestone-summary)
  - [Workstream Namespacing](#51-workstream-namespacing)
  - [Manager Dashboard](#52-manager-dashboard)
  - [Assumptions Discussion Mode](#53-assumptions-discussion-mode)
  - [UI Phase Auto-Detection](#54-ui-phase-auto-detection)
  - [Multi-Runtime Installer Selection](#55-multi-runtime-installer-selection)
- [v1.29 Features](#v129-features)
  - [Windsurf Runtime Support](#56-windsurf-runtime-support)
  - [Internationalized Documentation](#57-internationalized-documentation)
- [v1.30 Features](#v130-features)
  - [GSD SDK](#58-gsd-sdk)
- [v1.31 Features](#v131-features)
  - [Schema Drift Detection](#59-schema-drift-detection)
  - [Security Enforcement](#60-security-enforcement)
  - [Documentation Generation](#61-documentation-generation)
  - [Discuss Chain Mode](#62-discuss-chain-mode)
  - [Single-Phase Autonomous](#63-single-phase-autonomous)
  - [Scope Reduction Detection](#64-scope-reduction-detection)
  - [Claim Provenance Tagging](#65-claim-provenance-tagging)
  - [Worktree Toggle](#66-worktree-toggle)
  - [Project Code Prefixing](#67-project-code-prefixing)
  - [Claude Code Skills Migration](#68-claude-code-skills-migration)
- [v1.32 Features](#v132-features)
  - [STATE.md Consistency Gates](#69-statemd-consistency-gates)
  - [Autonomous `--to N` Flag](#70-autonomous---to-n-flag)
  - [Research Gate](#71-research-gate)
  - [Verifier Milestone Scope Filtering](#72-verifier-milestone-scope-filtering)
  - [Read-Before-Edit Guard Hook](#73-read-before-edit-guard-hook)
  - [Context Reduction](#74-context-reduction)
  - [Discuss-Phase `--power` Flag](#75-discuss-phase---power-flag)
  - [Debug `--diagnose` Flag](#76-debug---diagnose-flag)
  - [Phase Dependency Analysis](#77-phase-dependency-analysis)
  - [Anti-Pattern Severity Levels](#78-anti-pattern-severity-levels)
  - [Methodology Artifact Type](#79-methodology-artifact-type)
  - [Planner Reachability Check](#80-planner-reachability-check)
  - [Playwright-MCP UI Verification](#81-playwright-mcp-ui-verification)
  - [Pause-Work Expansion](#82-pause-work-expansion)
  - [Response Language Config](#83-response-language-config)
  - [Manual Update Procedure](#84-manual-update-procedure)
  - [New Runtime Support (Trae, Cline, Augment Code)](#85-new-runtime-support-trae-cline-augment-code)
  - [Autonomous `--interactive` Flag](#86-autonomous---interactive-flag)
  - [Commit-Docs Guard Hook](#87-commit-docs-guard-hook)
  - [Community Hooks Opt-In](#88-community-hooks-opt-in)
- [v1.34.0 Features](#v1340-features)
  - [Global Learnings Store](#89-global-learnings-store)
  - [Queryable Codebase Intelligence](#90-queryable-codebase-intelligence)
  - [Execution Context Profiles](#91-execution-context-profiles)
  - [Gates Taxonomy](#92-gates-taxonomy)
  - [Code Review Pipeline](#93-code-review-pipeline)
  - [Socratic Exploration](#94-socratic-exploration)
  - [Safe Undo](#95-safe-undo)
  - [Plan Import](#96-plan-import)
  - [Rapid Codebase Scan](#97-rapid-codebase-scan)
  - [Autonomous Audit-to-Fix](#98-autonomous-audit-to-fix)
  - [Improved Prompt Injection Scanner](#99-improved-prompt-injection-scanner)
  - [Stall Detection in Plan-Phase](#100-stall-detection-in-plan-phase)
  - [Hard Stop Safety Gates in /gsd-next](#101-hard-stop-safety-gates-in-gsd-next)
  - [Adaptive Model Preset](#102-adaptive-model-preset)
  - [Post-Merge Hunk Verification](#103-post-merge-hunk-verification)
- [v1.35.0 Features](#v1350-features)
  - [New Runtime Support (Cline, CodeBuddy, Qwen Code)](#104-new-runtime-support-cline-codebuddy-qwen-code)
  - [GSD-2 Reverse Migration](#105-gsd-2-reverse-migration)
  - [AI Integration Phase Wizard](#106-ai-integration-phase-wizard)
  - [AI Eval Review](#107-ai-eval-review)
- [v1.36.0 Features](#v1360-features)
  - [Plan Bounce](#108-plan-bounce)
  - [External Code Review Command](#109-external-code-review-command)
  - [Cross-AI Execution Delegation](#110-cross-ai-execution-delegation)
  - [Architectural Responsibility Mapping](#111-architectural-responsibility-mapping)
  - [Extract Learnings](#112-extract-learnings)
  - [SDK Workstream Support](#113-sdk-workstream-support)
  - [Context-Window-Aware Prompt Thinning](#114-context-window-aware-prompt-thinning)
  - [Configurable CLAUDE.md Path](#115-configurable-claudemd-path)
  - [TDD Pipeline Mode](#116-tdd-pipeline-mode)
- [v1.37.0 Features](#v1370-features)
  - [Spike Command](#117-spike-command)
  - [Sketch Command](#118-sketch-command)
  - [Agent Size-Budget Enforcement](#119-agent-size-budget-enforcement)
  - [Shared Boilerplate Extraction](#120-shared-boilerplate-extraction)
  - [Knowledge Graph Integration](#121-knowledge-graph-integration)
- [v1.32 Features](#v132-features)
  - [STATE.md Consistency Gates](#69-statemd-consistency-gates)
  - [Autonomous `--to N` Flag](#70-autonomous---to-n-flag)
  - [Research Gate](#71-research-gate)
  - [Verifier Milestone Scope Filtering](#72-verifier-milestone-scope-filtering)
  - [Read-Before-Edit Guard Hook](#73-read-before-edit-guard-hook)
  - [Context Reduction](#74-context-reduction)
  - [Discuss-Phase `--power` Flag](#75-discuss-phase---power-flag)
  - [Debug `--diagnose` Flag](#76-debug---diagnose-flag)
  - [Phase Dependency Analysis](#77-phase-dependency-analysis)
  - [Anti-Pattern Severity Levels](#78-anti-pattern-severity-levels)
  - [Methodology Artifact Type](#79-methodology-artifact-type)
  - [Planner Reachability Check](#80-planner-reachability-check)
  - [Playwright-MCP UI Verification](#81-playwright-mcp-ui-verification)
  - [Pause-Work Expansion](#82-pause-work-expansion)
  - [Response Language Config](#83-response-language-config)
  - [Manual Update Procedure](#84-manual-update-procedure)
  - [New Runtime Support (Trae, Cline, Augment Code)](#85-new-runtime-support-trae-cline-augment-code)
  - [Autonomous `--interactive` Flag](#86-autonomous---interactive-flag)
  - [Commit-Docs Guard Hook](#87-commit-docs-guard-hook)
  - [Community Hooks Opt-In](#88-community-hooks-opt-in)

---

## Core Features

### 1. Project Initialization

**Command:** `/gsd-new-project [--auto @file.md]`

**Purpose:** Transform a user's idea into a fully structured project with research, scoped requirements, and a phased roadmap.

**Requirements:**
- REQ-INIT-01: System MUST conduct adaptive questioning until project scope is fully understood
- REQ-INIT-02: System MUST spawn parallel research agents to investigate the domain ecosystem
- REQ-INIT-03: System MUST extract requirements into v1 (must-have), v2 (future), and out-of-scope categories
- REQ-INIT-04: System MUST generate a phased roadmap with requirement traceability
- REQ-INIT-05: System MUST require user approval of the roadmap before proceeding
- REQ-INIT-06: System MUST prevent re-initialization when `.planning/PROJECT.md` already exists
- REQ-INIT-07: System MUST support `--auto @file.md` flag to skip interactive questions and extract from a document

**Produces:**
| Artifact | Description |
|----------|-------------|
| `PROJECT.md` | Project vision, constraints, technical decisions, evolution rules |
| `REQUIREMENTS.md` | Scoped requirements with unique IDs (REQ-XX) |
| `ROADMAP.md` | Phase breakdown with status tracking and requirement mapping |
| `STATE.md` | Initial project state with position, decisions, metrics |
| `config.json` | Workflow configuration |
| `research/SUMMARY.md` | Synthesized domain research |
| `research/STACK.md` | Technology stack investigation |
| `research/FEATURES.md` | Feature implementation patterns |
| `research/ARCHITECTURE.md` | Architecture patterns and trade-offs |
| `research/PITFALLS.md` | Common failure modes and mitigations |

**Process:**
1. **Questions** — Adaptive questioning guided by the "dream extraction" philosophy (not requirements gathering)
2. **Research** — 4 parallel researcher agents investigate stack, features, architecture, and pitfalls
3. **Synthesis** — Research synthesizer combines findings into SUMMARY.md
4. **Requirements** — Extracted from user responses + research, categorized by scope
5. **Roadmap** — Phase breakdown mapped to requirements, with granularity setting controlling phase count

**Functional Requirements:**
- Questions adapt based on detected project type (web app, CLI, mobile, API, etc.)
- Research agents have web search capability for current ecosystem information
- Granularity setting controls phase count: `coarse` (3-5), `standard` (5-8), `fine` (8-12)
- `--auto` mode extracts all information from the provided document without interactive questioning
- Existing codebase context (from `/gsd-map-codebase`) is loaded if present

---

### 2. Phase Discussion

**Command:** `/gsd-discuss-phase [N] [--auto] [--batch]`

**Purpose:** Capture user's implementation preferences and decisions before research and planning begin. Eliminates the gray areas that cause AI to guess.

**Requirements:**
- REQ-DISC-01: System MUST analyze the phase scope and identify decision areas (gray areas)
- REQ-DISC-02: System MUST categorize gray areas by type (visual, API, content, organization, etc.)
- REQ-DISC-03: System MUST ask only questions not already answered in prior CONTEXT.md files
- REQ-DISC-04: System MUST persist decisions in `{phase}-CONTEXT.md` with canonical references
- REQ-DISC-05: System MUST support `--auto` flag to auto-select recommended defaults
- REQ-DISC-06: System MUST support `--batch` flag for grouped question intake
- REQ-DISC-07: System MUST scout relevant source files before identifying gray areas (code-aware discussion)
- REQ-DISC-08: System MUST adapt gray area language to product-outcome terms when USER-PROFILE.md indicates a non-technical owner (learning_style: guided, jargon in frustration_triggers, or high-level explanation depth)
- REQ-DISC-09: When REQ-DISC-08 applies, advisor_research rationale paragraphs MUST be rewritten in plain language — same decisions, translated framing

**Produces:** `{padded_phase}-CONTEXT.md` — User preferences that feed into research and planning

**Gray Area Categories:**
| Category | Example Decisions |
|----------|-------------------|
| Visual features | Layout, density, interactions, empty states |
| APIs/CLIs | Response format, flags, error handling, verbosity |
| Content systems | Structure, tone, depth, flow |
| Organization | Grouping criteria, naming, duplicates, exceptions |

---

### 3. UI Design Contract

**Command:** `/gsd-ui-phase [N]`

**Purpose:** Lock design decisions before planning so that all components in a phase share consistent visual standards.

**Requirements:**
- REQ-UI-01: System MUST detect existing design system state (shadcn components.json, Tailwind config, tokens)
- REQ-UI-02: System MUST ask only unanswered design contract questions
- REQ-UI-03: System MUST validate against 6 dimensions (Copywriting, Visuals, Color, Typography, Spacing, Registry Safety)
- REQ-UI-04: System MUST enter revision loop if validation returns BLOCKED (max 2 iterations)
- REQ-UI-05: System MUST offer shadcn initialization for React/Next.js/Vite projects without `components.json`
- REQ-UI-06: System MUST enforce registry safety gate for third-party shadcn registries

**Produces:** `{padded_phase}-UI-SPEC.md` — Design contract consumed by executors

**6 Validation Dimensions:**
1. **Copywriting** — CTA labels, empty states, error messages
2. **Visuals** — Focal points, visual hierarchy, icon accessibility
3. **Color** — Accent usage discipline, 60/30/10 compliance
4. **Typography** — Font size/weight constraint adherence
5. **Spacing** — Grid alignment, token consistency
6. **Registry Safety** — Third-party component inspection requirements

**shadcn Integration:**
- Detects missing `components.json` in React/Next.js/Vite projects
- Guides user through `ui.shadcn.com/create` preset configuration
- Preset string becomes a planning artifact reproducible across phases
- Safety gate requires `npx shadcn view` and `npx shadcn diff` before third-party components

---

### 4. Phase Planning

**Command:** `/gsd-plan-phase [N] [--auto] [--skip-research] [--skip-verify]`

**Purpose:** Research the implementation domain and produce verified, atomic execution plans.

**Requirements:**
- REQ-PLAN-01: System MUST spawn a phase researcher to investigate implementation approaches
- REQ-PLAN-02: System MUST produce plans with 2-3 tasks each, sized for a single context window
- REQ-PLAN-03: System MUST structure plans as XML with `<task>` elements containing `name`, `files`, `action`, `verify`, and `done` fields
- REQ-PLAN-04: System MUST include `read_first` and `acceptance_criteria` sections in every plan
- REQ-PLAN-05: System MUST run plan checker verification loop (up to 3 iterations) unless `--skip-verify` is set
- REQ-PLAN-06: System MUST support `--skip-research` flag to bypass research phase
- REQ-PLAN-07: System MUST prompt user to run `/gsd-ui-phase` if frontend phase detected and no UI-SPEC.md exists (UI safety gate)
- REQ-PLAN-08: System MUST include Nyquist validation mapping when `workflow.nyquist_validation` is enabled
- REQ-PLAN-09: System MUST verify all phase requirements are covered by at least one plan before planning completes (requirements coverage gate)

**Produces:**
| Artifact | Description |
|----------|-------------|
| `{phase}-RESEARCH.md` | Ecosystem research findings |
| `{phase}-{N}-PLAN.md` | Atomic execution plans (2-3 tasks each) |
| `{phase}-VALIDATION.md` | Test coverage mapping (Nyquist layer) |

**Plan Structure (XML):**
```xml
<task type="auto">
  <name>Create login endpoint</name>
  <files>src/app/api/auth/login/route.ts</files>
  <action>
    Use jose for JWT. Validate credentials against users table.
    Return httpOnly cookie on success.
  </action>
  <verify>curl -X POST localhost:3000/api/auth/login returns 200 + Set-Cookie</verify>
  <done>Valid credentials return cookie, invalid return 401</done>
</task>
```

**Plan Checker Verification (8 Dimensions):**
1. Requirement coverage — Plans address all phase requirements
2. Task atomicity — Each task is independently committable
3. Dependency ordering — Tasks sequence correctly
4. File scope — No excessive file overlap between plans
5. Verification commands — Each task has testable done criteria
6. Context fit — Tasks fit within a single context window
7. Gap detection — No missing implementation steps
8. Nyquist compliance — Tasks have automated verify commands (when enabled)

---

### 5. Phase Execution

**Command:** `/gsd-execute-phase <N>`

**Purpose:** Execute all plans in a phase using wave-based parallelization with fresh context windows per executor.

**Requirements:**
- REQ-EXEC-01: System MUST analyze plan dependencies and group into execution waves
- REQ-EXEC-02: System MUST spawn independent plans in parallel within each wave
- REQ-EXEC-03: System MUST give each executor a fresh context window (200K tokens)
- REQ-EXEC-04: System MUST produce atomic git commits per task
- REQ-EXEC-05: System MUST produce a SUMMARY.md for each completed plan
- REQ-EXEC-06: System MUST run post-execution verifier to check phase goals were met
- REQ-EXEC-07: System MUST support git branching strategies (`none`, `phase`, `milestone`)
- REQ-EXEC-08: System MUST invoke node repair operator on task verification failure (when enabled)
- REQ-EXEC-09: System MUST run prior phases' test suites before verification to catch cross-phase regressions

**Produces:**
| Artifact | Description |
|----------|-------------|
| `{phase}-{N}-SUMMARY.md` | Execution outcomes per plan |
| `{phase}-VERIFICATION.md` | Post-execution verification report |
| Git commits | Atomic commits per task |

**Wave Execution:**
- Plans with no dependencies → Wave 1 (parallel)
- Plans depending on Wave 1 → Wave 2 (parallel, waits for Wave 1)
- Continues until all plans complete
- File conflicts force sequential execution within same wave

**Executor Capabilities:**
- Reads PLAN.md with full task instructions
- Has access to PROJECT.md, STATE.md, CONTEXT.md, RESEARCH.md
- Commits each task atomically with structured commit messages
- Uses `--no-verify` on commits during parallel execution to avoid build lock contention
- Handles checkpoint types: `auto`, `checkpoint:human-verify`, `checkpoint:decision`, `checkpoint:human-action`
- Reports deviations from plan in SUMMARY.md

**Parallel Safety:**
- **Pre-commit hooks**: Skipped by parallel agents (`--no-verify`), run once by orchestrator after each wave
- **STATE.md locking**: File-level lockfile prevents concurrent write corruption across agents

---

### 6. Work Verification

**Command:** `/gsd-verify-work [N]`

**Purpose:** User acceptance testing — walk the user through testing each deliverable and auto-diagnose failures.

**Requirements:**
- REQ-VERIFY-01: System MUST extract testable deliverables from the phase
- REQ-VERIFY-02: System MUST present deliverables one at a time for user confirmation
- REQ-VERIFY-03: System MUST spawn debug agents to diagnose failures automatically
- REQ-VERIFY-04: System MUST create fix plans for identified issues
- REQ-VERIFY-05: System MUST inject cold-start smoke test for phases modifying server/database/seed/startup files
- REQ-VERIFY-06: System MUST produce UAT.md with pass/fail results

**Produces:** `{phase}-UAT.md` — User acceptance test results, plus fix plans if issues found

---

### 6.5. Ship

**Command:** `/gsd-ship [N] [--draft]`

**Purpose:** Bridge local completion → merged PR. After verification passes, push branch, create PR with auto-generated body from planning artifacts, optionally trigger review, and track in STATE.md.

**Requirements:**
- REQ-SHIP-01: System MUST verify phase has passed verification before shipping
- REQ-SHIP-02: System MUST push branch and create PR via `gh` CLI
- REQ-SHIP-03: System MUST auto-generate PR body from SUMMARY.md, VERIFICATION.md, and REQUIREMENTS.md
- REQ-SHIP-04: System MUST update STATE.md with shipping status and PR number
- REQ-SHIP-05: System MUST support `--draft` flag for draft PRs

**Prerequisites:** Phase verified, `gh` CLI installed and authenticated, work on feature branch

**Produces:** GitHub PR with rich body, STATE.md updated

---

### 7. UI Review

**Command:** `/gsd-ui-review [N]`

**Purpose:** Retroactive 6-pillar visual audit of implemented frontend code. Works standalone on any project.

**Requirements:**
- REQ-UIREVIEW-01: System MUST score each of the 6 pillars on a 1-4 scale
- REQ-UIREVIEW-02: System MUST capture screenshots via Playwright CLI to `.planning/ui-reviews/`
- REQ-UIREVIEW-03: System MUST create `.gitignore` for screenshot directory
- REQ-UIREVIEW-04: System MUST identify top 3 priority fixes
- REQ-UIREVIEW-05: System MUST work standalone (without UI-SPEC.md) using abstract quality standards

**6 Audit Pillars (scored 1-4):**
1. **Copywriting** — CTA labels, empty states, error states
2. **Visuals** — Focal points, visual hierarchy, icon accessibility
3. **Color** — Accent usage discipline, 60/30/10 compliance
4. **Typography** — Font size/weight constraint adherence
5. **Spacing** — Grid alignment, token consistency
6. **Experience Design** — Loading/error/empty state coverage

**Produces:** `{padded_phase}-UI-REVIEW.md` — Scores and prioritized fixes

---

### 8. Milestone Management

**Commands:** `/gsd-audit-milestone`, `/gsd-complete-milestone`, `/gsd-new-milestone [name]`

**Purpose:** Verify milestone completion, archive, tag release, and start the next development cycle.

**Requirements:**
- REQ-MILE-01: Audit MUST verify all milestone requirements are met
- REQ-MILE-02: Audit MUST detect stubs, placeholder implementations, and untested code
- REQ-MILE-03: Audit MUST check Nyquist validation compliance across phases
- REQ-MILE-04: Complete MUST archive milestone data to MILESTONES.md
- REQ-MILE-05: Complete MUST offer git tag creation for the release
- REQ-MILE-06: Complete MUST offer squash merge or merge with history for branching strategies
- REQ-MILE-07: Complete MUST clean up UI review screenshots
- REQ-MILE-08: New milestone MUST follow same flow as new-project (questions → research → requirements → roadmap)
- REQ-MILE-09: New milestone MUST NOT reset existing workflow configuration

**Gap Closure:** `/gsd-plan-milestone-gaps` creates phases to close gaps identified by audit.

---

## Planning Features

### 9. Phase Management

**Commands:** `/gsd-add-phase`, `/gsd-insert-phase [N]`, `/gsd-remove-phase [N]`

**Purpose:** Dynamic roadmap modification during development.

**Requirements:**
- REQ-PHASE-01: Add MUST append a new phase to the end of the current roadmap
- REQ-PHASE-02: Insert MUST use decimal numbering (e.g., 3.1) between existing phases
- REQ-PHASE-03: Remove MUST renumber all subsequent phases
- REQ-PHASE-04: Remove MUST prevent removing phases that have been executed
- REQ-PHASE-05: All operations MUST update ROADMAP.md and create/remove phase directories

---

### 10. Quick Mode

**Command:** `/gsd-quick [--full] [--discuss] [--research]`

**Purpose:** Ad-hoc task execution with GSD guarantees but a faster path.

**Requirements:**
- REQ-QUICK-01: System MUST accept freeform task description
- REQ-QUICK-02: System MUST use same planner + executor agents as full workflow
- REQ-QUICK-03: System MUST skip research, plan checker, and verifier by default
- REQ-QUICK-04: `--full` flag MUST enable plan checking (max 2 iterations) and post-execution verification
- REQ-QUICK-05: `--discuss` flag MUST run lightweight pre-planning discussion
- REQ-QUICK-06: `--research` flag MUST spawn focused research agent before planning
- REQ-QUICK-07: Flags MUST be composable (`--discuss --research --full`)
- REQ-QUICK-08: System MUST track quick tasks in `.planning/quick/YYMMDD-xxx-slug/`
- REQ-QUICK-09: System MUST produce atomic commits for quick task execution

---

### 11. Autonomous Mode

**Command:** `/gsd-autonomous [--from N]`

**Purpose:** Run all remaining phases autonomously — discuss → plan → execute per phase.

**Requirements:**
- REQ-AUTO-01: System MUST iterate through all incomplete phases in roadmap order
- REQ-AUTO-02: System MUST run discuss → plan → execute for each phase
- REQ-AUTO-03: System MUST pause for explicit user decisions (gray area acceptance, blockers, validation)
- REQ-AUTO-04: System MUST re-read ROADMAP.md after each phase to catch dynamically inserted phases
- REQ-AUTO-05: `--from N` flag MUST start from a specific phase number

---

### 12. Freeform Routing

**Command:** `/gsd-do`

**Purpose:** Analyze freeform text and route to the appropriate GSD command.

**Requirements:**
- REQ-DO-01: System MUST parse user intent from natural language input
- REQ-DO-02: System MUST map intent to the best matching GSD command
- REQ-DO-03: System MUST confirm the routing with the user before executing
- REQ-DO-04: System MUST handle project-exists vs no-project contexts differently

---

### 13. Note Capture

**Command:** `/gsd-note`

**Purpose:** Zero-friction idea capture without interrupting workflow. Append timestamped notes, list all notes, or promote notes to structured todos.

**Requirements:**
- REQ-NOTE-01: System MUST save timestamped note files with a single Write call
- REQ-NOTE-02: System MUST support `list` subcommand to show all notes from project and global scopes
- REQ-NOTE-03: System MUST support `promote N` subcommand to convert a note into a structured todo
- REQ-NOTE-04: System MUST support `--global` flag for global scope operations
- REQ-NOTE-05: System MUST NOT use Task, AskUserQuestion, or Bash — runs inline only

---

### 14. Auto-Advance (Next)

**Command:** `/gsd-next`

**Purpose:** Automatically detect current project state and advance to the next logical workflow step, eliminating the need to remember which phase/step you're on.

**Requirements:**
- REQ-NEXT-01: System MUST read STATE.md, ROADMAP.md, and phase directories to determine current position
- REQ-NEXT-02: System MUST detect whether discuss, plan, execute, or verify is needed
- REQ-NEXT-03: System MUST invoke the correct command automatically
- REQ-NEXT-04: System MUST suggest `/gsd-new-project` if no project exists
- REQ-NEXT-05: System MUST suggest `/gsd-complete-milestone` when all phases are complete

**State Detection Logic:**
| State | Action |
|-------|--------|
| No `.planning/` directory | Suggest `/gsd-new-project` |
| Phase has no CONTEXT.md | Run `/gsd-discuss-phase` |
| Phase has no PLAN.md files | Run `/gsd-plan-phase` |
| Phase has plans but no SUMMARY.md | Run `/gsd-execute-phase` |
| Phase executed but no VERIFICATION.md | Run `/gsd-verify-work` |
| All phases complete | Suggest `/gsd-complete-milestone` |

---

## Quality Assurance Features

### 15. Nyquist Validation

**Purpose:** Map automated test coverage to phase requirements before any code is written. Named after the Nyquist sampling theorem — ensures a feedback signal exists for every requirement.

**Requirements:**
- REQ-NYQ-01: System MUST detect existing test infrastructure during plan-phase research
- REQ-NYQ-02: System MUST map each requirement to a specific test command
- REQ-NYQ-03: System MUST identify Wave 0 tasks (test scaffolding needed before implementation)
- REQ-NYQ-04: Plan checker MUST enforce Nyquist compliance as 8th verification dimension
- REQ-NYQ-05: System MUST support retroactive validation via `/gsd-validate-phase`
- REQ-NYQ-06: System MUST be disableable via `workflow.nyquist_validation: false`

**Produces:** `{phase}-VALIDATION.md` — Test coverage contract

**Retroactive Validation (`/gsd-validate-phase [N]`):**
- Scans implementation and maps requirements to tests
- Identifies gaps where requirements lack automated verification
- Spawns auditor to generate tests (max 3 attempts)
- Never modifies implementation code — only test files and VALIDATION.md
- Flags implementation bugs as escalations for user to address

---

### 16. Plan Checking

**Purpose:** Goal-backward verification that plans will achieve phase objectives before execution.

**Requirements:**
- REQ-PLANCK-01: System MUST verify plans against 8 quality dimensions
- REQ-PLANCK-02: System MUST loop up to 3 iterations until plans pass
- REQ-PLANCK-03: System MUST produce specific, actionable feedback on failures
- REQ-PLANCK-04: System MUST be disableable via `workflow.plan_check: false`

---

### 17. Post-Execution Verification

**Purpose:** Automated check that the codebase delivers what the phase promised.

**Requirements:**
- REQ-POSTVER-01: System MUST check against phase goals, not just task completion
- REQ-POSTVER-02: System MUST produce VERIFICATION.md with pass/fail analysis
- REQ-POSTVER-03: System MUST log issues for `/gsd-verify-work` to address
- REQ-POSTVER-04: System MUST be disableable via `workflow.verifier: false`

---

### 18. Node Repair

**Purpose:** Autonomous recovery when task verification fails during execution.

**Requirements:**
- REQ-REPAIR-01: System MUST analyze failure and choose one strategy: RETRY, DECOMPOSE, or PRUNE
- REQ-REPAIR-02: RETRY MUST attempt with a concrete adjustment
- REQ-REPAIR-03: DECOMPOSE MUST break task into smaller verifiable sub-steps
- REQ-REPAIR-04: PRUNE MUST remove unachievable tasks and escalate to user
- REQ-REPAIR-05: System MUST respect repair budget (default: 2 attempts per task)
- REQ-REPAIR-06: System MUST be configurable via `workflow.node_repair_budget` and `workflow.node_repair`

---

### 19. Health Validation

**Command:** `/gsd-health [--repair]`

**Purpose:** Validate `.planning/` directory integrity and auto-repair issues.

**Requirements:**
- REQ-HEALTH-01: System MUST check for missing required files
- REQ-HEALTH-02: System MUST validate configuration consistency
- REQ-HEALTH-03: System MUST detect orphaned plans without summaries
- REQ-HEALTH-04: System MUST check phase numbering and roadmap sync
- REQ-HEALTH-05: `--repair` flag MUST auto-fix recoverable issues

---

### 20. Cross-Phase Regression Gate

**Purpose:** Prevent regressions from compounding across phases by running prior phases' test suites after execution.

**Requirements:**
- REQ-REGR-01: System MUST run test suites from all completed prior phases after phase execution
- REQ-REGR-02: System MUST report any test failures as cross-phase regressions
- REQ-REGR-03: Regressions MUST be surfaced before post-execution verification
- REQ-REGR-04: System MUST identify which prior phase's tests were broken

**When:** Runs automatically during `/gsd-execute-phase` before the verifier step.

---

### 21. Requirements Coverage Gate

**Purpose:** Ensure all phase requirements are covered by at least one plan before planning completes.

**Requirements:**
- REQ-COVGATE-01: System MUST extract all requirement IDs assigned to the phase from ROADMAP.md
- REQ-COVGATE-02: System MUST verify each requirement appears in at least one PLAN.md
- REQ-COVGATE-03: Uncovered requirements MUST block planning completion
- REQ-COVGATE-04: System MUST report which specific requirements lack plan coverage

**When:** Runs automatically at the end of `/gsd-plan-phase` after the plan checker loop.

---

## Context Engineering Features

### 22. Context Window Monitoring

**Purpose:** Prevent context rot by alerting both user and agent when context is running low.

**Requirements:**
- REQ-CTX-01: Statusline MUST display context usage percentage to user
- REQ-CTX-02: Context monitor MUST inject agent-facing warnings at ≤35% remaining (WARNING)
- REQ-CTX-03: Context monitor MUST inject agent-facing warnings at ≤25% remaining (CRITICAL)
- REQ-CTX-04: Warnings MUST debounce (5 tool uses between repeated warnings)
- REQ-CTX-05: Severity escalation (WARNING→CRITICAL) MUST bypass debounce
- REQ-CTX-06: Context monitor MUST differentiate GSD-active vs non-GSD-active projects
- REQ-CTX-07: Warnings MUST be advisory, never imperative commands that override user preferences
- REQ-CTX-08: All hooks MUST fail silently and never block tool execution

**Architecture:** Two-part bridge system:
1. Statusline writes metrics to `/tmp/claude-ctx-{session}.json`
2. Context monitor reads metrics and injects `additionalContext` warnings

---

### 23. Session Management

**Commands:** `/gsd-pause-work`, `/gsd-resume-work`, `/gsd-progress`

**Purpose:** Maintain project continuity across context resets and sessions.

**Requirements:**
- REQ-SESSION-01: Pause MUST save current position and next steps to `continue-here.md` and structured `HANDOFF.json`
- REQ-SESSION-02: Resume MUST restore full project context from HANDOFF.json (preferred) or state files (fallback)
- REQ-SESSION-03: Progress MUST show current position, next action, and overall completion
- REQ-SESSION-04: Progress MUST read all state files (STATE.md, ROADMAP.md, phase directories)
- REQ-SESSION-05: All session operations MUST work after `/clear` (context reset)
- REQ-SESSION-06: HANDOFF.json MUST include blockers, human actions pending, and in-progress task state
- REQ-SESSION-07: Resume MUST surface human actions and blockers immediately on session start

---

### 24. Session Reporting

**Command:** `/gsd-session-report`

**Purpose:** Generate a structured post-session summary document capturing work performed, outcomes achieved, and estimated resource usage.

**Requirements:**
- REQ-REPORT-01: System MUST gather data from STATE.md, git log, and plan/summary files
- REQ-REPORT-02: System MUST include commits made, plans executed, and phases progressed
- REQ-REPORT-03: System MUST estimate token usage and cost based on session activity
- REQ-REPORT-04: System MUST include active blockers and decisions made
- REQ-REPORT-05: System MUST recommend next steps

**Produces:** `.planning/reports/SESSION_REPORT.md`

**Report Sections:**
- Session overview (duration, milestone, phase)
- Work performed (commits, plans, phases)
- Outcomes and deliverables
- Blockers and decisions
- Resource estimates (tokens, cost)
- Next steps recommendation

---

### 25. Multi-Agent Orchestration

**Purpose:** Coordinate specialized agents with fresh context windows for each task.

**Requirements:**
- REQ-ORCH-01: Each agent MUST receive a fresh context window
- REQ-ORCH-02: Orchestrators MUST be thin — spawn agents, collect results, route next
- REQ-ORCH-03: Context payload MUST include all relevant project artifacts
- REQ-ORCH-04: Parallel agents MUST be truly independent (no shared mutable state)
- REQ-ORCH-05: Agent results MUST be written to disk before orchestrator processes them
- REQ-ORCH-06: Failed agents MUST be detected (spot-check actual output vs reported failure)

---

### 26. Model Profiles

**Command:** `/gsd-set-profile <quality|balanced|budget|inherit>`

**Purpose:** Control which AI model each agent uses, balancing quality vs cost.

**Requirements:**
- REQ-MODEL-01: System MUST support 4 profiles: `quality`, `balanced`, `budget`, `inherit`
- REQ-MODEL-02: Each profile MUST define model tier per agent (see profile table)
- REQ-MODEL-03: Per-agent overrides MUST take precedence over profile
- REQ-MODEL-04: `inherit` profile MUST defer to runtime's current model selection
- REQ-MODEL-04a: `inherit` profile MUST be used when running non-Anthropic providers (OpenRouter, local models) to avoid unexpected API costs
- REQ-MODEL-05: Profile switch MUST be programmatic (script, not LLM-driven)
- REQ-MODEL-06: Model resolution MUST happen once per orchestration, not per spawn

**Profile Assignments:**

| Agent | `quality` | `balanced` | `budget` | `inherit` |
|-------|-----------|------------|----------|-----------|
| gsd-planner | Opus | Opus | Sonnet | Inherit |
| gsd-roadmapper | Opus | Sonnet | Sonnet | Inherit |
| gsd-executor | Opus | Sonnet | Sonnet | Inherit |
| gsd-phase-researcher | Opus | Sonnet | Haiku | Inherit |
| gsd-project-researcher | Opus | Sonnet | Haiku | Inherit |
| gsd-research-synthesizer | Sonnet | Sonnet | Haiku | Inherit |
| gsd-debugger | Opus | Sonnet | Sonnet | Inherit |
| gsd-codebase-mapper | Sonnet | Haiku | Haiku | Inherit |
| gsd-verifier | Sonnet | Sonnet | Haiku | Inherit |
| gsd-plan-checker | Sonnet | Sonnet | Haiku | Inherit |
| gsd-integration-checker | Sonnet | Sonnet | Haiku | Inherit |
| gsd-nyquist-auditor | Sonnet | Sonnet | Haiku | Inherit |

---

## Brownfield Features

### 27. Codebase Mapping

**Command:** `/gsd-map-codebase [area]`

**Purpose:** Analyze an existing codebase before starting a new project, so GSD understands what exists.

**Requirements:**
- REQ-MAP-01: System MUST spawn parallel mapper agents for each analysis area
- REQ-MAP-02: System MUST produce structured documents in `.planning/codebase/`
- REQ-MAP-03: System MUST detect: tech stack, architecture patterns, coding conventions, concerns
- REQ-MAP-04: Subsequent `/gsd-new-project` MUST load codebase mapping and focus questions on what's being added
- REQ-MAP-05: Optional `[area]` argument MUST scope mapping to a specific area

**Produces:**
| Document | Content |
|----------|---------|
| `STACK.md` | Languages, frameworks, databases, infrastructure |
| `ARCHITECTURE.md` | Patterns, layers, data flow, boundaries |
| `CONVENTIONS.md` | Naming, file organization, code style, testing patterns |
| `CONCERNS.md` | Technical debt, security issues, performance bottlenecks |
| `STRUCTURE.md` | Directory layout and file organization |
| `TESTING.md` | Test infrastructure, coverage, patterns |
| `INTEGRATIONS.md` | External services, APIs, third-party dependencies |

**Incremental remap — `--paths` (#2003):** The mapper accepts an optional
`--paths <p1,p2,...>` scope hint. When provided, it restricts exploration
to the listed repo-relative prefixes instead of scanning the whole tree.
This is the pathway used by the post-execute codebase-drift gate to refresh
only the subtrees the phase actually changed. Each produced document carries
`last_mapped_commit` in its YAML frontmatter so drift can be measured
against the mapping point, not HEAD.

### 27a. Post-Execute Codebase Drift Detection

**Introduced by:** #2003
**Trigger:** Runs automatically at the end of every `/gsd-execute-phase`
**Configuration:**
- `workflow.drift_threshold` (integer, default `3`) — minimum new
  structural elements before the gate acts.
- `workflow.drift_action` (`warn` | `auto-remap`, default `warn`) —
  warn-only or spawn `gsd-codebase-mapper` with `--paths` scoped to
  affected subtrees.

**What counts as drift:**
- New directory outside mapped paths
- New barrel export at `(packages|apps)/*/src/index.*`
- New migration file (supabase/prisma/drizzle/src/migrations/…)
- New route module under `routes/` or `api/`

**Non-blocking guarantee:** any internal failure (missing STRUCTURE.md,
git errors, mapper spawn failure) logs a single line and the phase
continues. Drift detection cannot fail verification.

**Requirements:**
- REQ-DRIFT-01: System MUST detect the four drift categories from `git diff
  --name-status last_mapped_commit..HEAD`
- REQ-DRIFT-02: Action fires only when element count ≥ `workflow.drift_threshold`
- REQ-DRIFT-03: `warn` action MUST NOT spawn any agent
- REQ-DRIFT-04: `auto-remap` action MUST pass sanitized `--paths` to the mapper
- REQ-DRIFT-05: Detection/remap failure MUST be non-blocking for `/gsd-execute-phase`
- REQ-DRIFT-06: `last_mapped_commit` round-trip through YAML frontmatter
  on each `.planning/codebase/*.md` file

---

## Utility Features

### 28. Debug System

**Command:** `/gsd-debug [description]`

**Purpose:** Systematic debugging with persistent state across context resets.

**Requirements:**
- REQ-DEBUG-01: System MUST create debug session file in `.planning/debug/`
- REQ-DEBUG-02: System MUST track hypotheses, evidence, and eliminated theories
- REQ-DEBUG-03: System MUST persist state so debugging survives context resets
- REQ-DEBUG-04: System MUST require human verification before marking resolved
- REQ-DEBUG-05: Resolved sessions MUST append to `.planning/debug/knowledge-base.md`
- REQ-DEBUG-06: Knowledge base MUST be consulted on new debug sessions to prevent re-investigation

**Debug Session States:** `gathering` → `investigating` → `fixing` → `verifying` → `awaiting_human_verify` → `resolved`

---

### 29. Todo Management

**Commands:** `/gsd-add-todo [desc]`, `/gsd-check-todos`

**Purpose:** Capture ideas and tasks during sessions for later work.

**Requirements:**
- REQ-TODO-01: System MUST capture todo from current conversation context
- REQ-TODO-02: Todos MUST be stored in `.planning/todos/pending/`
- REQ-TODO-03: Completed todos MUST move to `.planning/todos/completed/`
- REQ-TODO-04: Check-todos MUST list all pending items with selection to work on one

---

### 30. Statistics Dashboard

**Command:** `/gsd-stats`

**Purpose:** Display project metrics — phases, plans, requirements, git history, and timeline.

**Requirements:**
- REQ-STATS-01: System MUST show phase/plan completion counts
- REQ-STATS-02: System MUST show requirement coverage
- REQ-STATS-03: System MUST show git commit metrics
- REQ-STATS-04: System MUST support multiple output formats (json, table, bar)

---

### 31. Update System

**Command:** `/gsd-update`

**Purpose:** Update GSD to the latest version with changelog preview.

**Requirements:**
- REQ-UPDATE-01: System MUST check for new versions via npm
- REQ-UPDATE-02: System MUST display changelog for new version before updating
- REQ-UPDATE-03: System MUST be runtime-aware and target the correct directory
- REQ-UPDATE-04: System MUST back up locally modified files to `gsd-local-patches/`
- REQ-UPDATE-05: `/gsd-update --reapply` MUST restore local modifications after update

---

### 32. Settings Management

**Command:** `/gsd-settings`

**Purpose:** Interactive configuration of workflow toggles and model profile.

**Requirements:**
- REQ-SETTINGS-01: System MUST present current settings with toggle options
- REQ-SETTINGS-02: System MUST update `.planning/config.json`
- REQ-SETTINGS-03: System MUST support saving as global defaults (`~/.gsd/defaults.json`)

**Configurable Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `mode` | enum | `interactive` | `interactive` or `yolo` (auto-approve) |
| `granularity` | enum | `standard` | `coarse`, `standard`, or `fine` |
| `model_profile` | enum | `balanced` | `quality`, `balanced`, `budget`, or `inherit` |
| `models.<phase_type>` | enum | (none) | Per-phase-type tier override (`planning`, `discuss`, `research`, `execution`, `verification`, `completion`). Values: `opus`, `sonnet`, `haiku`, `inherit`. Coarse phase-level tuning that wins over `model_profile` but loses to per-agent `model_overrides`. See [CONFIGURATION.md](CONFIGURATION.md#per-phase-type-models-models--added-in-v140). Added in v1.40 |
| `workflow.research` | boolean | `true` | Domain research before planning |
| `workflow.plan_check` | boolean | `true` | Plan verification loop |
| `workflow.verifier` | boolean | `true` | Post-execution verification |
| `workflow.auto_advance` | boolean | `false` | Auto-chain discuss→plan→execute |
| `workflow.nyquist_validation` | boolean | `true` | Nyquist test coverage mapping |
| `workflow.ui_phase` | boolean | `true` | UI design contract generation |
| `workflow.ui_safety_gate` | boolean | `true` | Prompt for ui-phase on frontend phases |
| `workflow.node_repair` | boolean | `true` | Autonomous task repair |
| `workflow.node_repair_budget` | number | `2` | Max repair attempts per task |
| `planning.commit_docs` | boolean | `true` | Commit `.planning/` files to git |
| `planning.search_gitignored` | boolean | `false` | Include gitignored files in searches |
| `parallelization.enabled` | boolean | `true` | Run independent plans simultaneously |
| `git.branching_strategy` | enum | `none` | `none`, `phase`, or `milestone` |

---

### 33. Test Generation

**Command:** `/gsd-add-tests [N]`

**Purpose:** Generate tests for a completed phase based on UAT criteria and implementation.

**Requirements:**
- REQ-TEST-01: System MUST analyze completed phase implementation
- REQ-TEST-02: System MUST generate tests based on UAT criteria and acceptance criteria
- REQ-TEST-03: System MUST use existing test infrastructure patterns

---

## Infrastructure Features

### 34. Git Integration

**Purpose:** Atomic commits, branching strategies, and clean history management.

**Requirements:**
- REQ-GIT-01: Each task MUST get its own atomic commit
- REQ-GIT-02: Commit messages MUST follow structured format: `type(scope): description`
- REQ-GIT-03: System MUST support 3 branching strategies: `none`, `phase`, `milestone`
- REQ-GIT-04: Phase strategy MUST create one branch per phase
- REQ-GIT-05: Milestone strategy MUST create one branch per milestone
- REQ-GIT-06: Complete-milestone MUST offer squash merge (recommended) or merge with history
- REQ-GIT-07: System MUST respect `commit_docs` setting for `.planning/` files
- REQ-GIT-08: System MUST auto-detect `.planning/` in `.gitignore` and skip commits

**Commit Format:**
```
type(phase-plan): description

# Examples:
docs(08-02): complete user registration plan
feat(08-02): add email confirmation flow
fix(03-01): correct auth token expiry
```

---

### 35. CLI Tools

**Purpose:** Programmatic utilities for workflows and agents, replacing repetitive inline bash patterns.

**Requirements:**
- REQ-CLI-01: System MUST provide atomic commands for state, config, phase, roadmap operations
- REQ-CLI-02: System MUST provide compound `init` commands that load all context for each workflow
- REQ-CLI-03: System MUST support `--raw` flag for machine-readable output
- REQ-CLI-04: System MUST support `--cwd` flag for sandboxed subagent operation
- REQ-CLI-05: All operations MUST use forward-slash paths on Windows

**Command Categories:** State (11 subcommands), Phase (5), Roadmap (3), Verify (8), Template (2), Frontmatter (4), Scaffold (4), Init (12), Validate (2), Progress, Stats, Todo

---

### 36. Multi-Runtime Support

**Purpose:** Run GSD across multiple AI coding agent runtimes.

**Requirements:**
- REQ-RUNTIME-01: System MUST support Claude Code, OpenCode, Gemini CLI, Kilo, Codex, Copilot, Antigravity, Trae, Cline, Augment Code, CodeBuddy, Qwen Code
- REQ-RUNTIME-02: Installer MUST transform content per runtime (tool names, paths, frontmatter)
- REQ-RUNTIME-03: Installer MUST support interactive and non-interactive (`--claude --global`) modes
- REQ-RUNTIME-04: Installer MUST support both global and local installation
- REQ-RUNTIME-05: Uninstall MUST cleanly remove all GSD files without affecting other configurations
- REQ-RUNTIME-06: Installer MUST handle platform differences (Windows, macOS, Linux, WSL, Docker)

**Runtime Transformations:**

| Aspect | Claude Code | OpenCode | Gemini | Kilo | Codex | Copilot | Antigravity | Trae | Cline | Augment | CodeBuddy | Qwen Code |
|--------|------------|----------|--------|-------|-------|---------|-------------|------|-------|---------|-----------|-----------|
| Commands | Slash commands | Slash commands | Slash commands | Slash commands | Skills (TOML) | Slash commands | Skills | Skills | Rules | Skills | Skills | Skills |
| Agent format | Claude native | `mode: subagent` | Claude native | `mode: subagent` | Skills | Tool mapping | Skills | Skills | Rules | Skills | Skills | Skills |
| Hook events | `PostToolUse` | N/A | `AfterTool` | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| Config | `settings.json` | `opencode.json(c)` | `settings.json` | `kilo.json(c)` | TOML | Instructions | Config | Config | `.clinerules` | Config | Config | Config |

---

### 37. Hook System

**Purpose:** Runtime event hooks for context monitoring, status display, and update checking.

**Requirements:**
- REQ-HOOK-01: Statusline MUST display model, current task, directory, and context usage
- REQ-HOOK-02: Context monitor MUST inject agent-facing warnings at threshold levels
- REQ-HOOK-03: Update checker MUST run in background on session start
- REQ-HOOK-04: All hooks MUST respect `CLAUDE_CONFIG_DIR` env var
- REQ-HOOK-05: All hooks MUST include 3-second stdin timeout guard
- REQ-HOOK-06: All hooks MUST fail silently on any error
- REQ-HOOK-07: Context usage MUST normalize for autocompact buffer (16.5% reserved)

**Statusline Display:**
```
[⬆ /gsd-update │] model │ [current task │] directory [█████░░░░░ 50%]
```

Color coding: <50% green, <65% yellow, <80% orange, ≥80% red with skull emoji

### 38. Developer Profiling

**Command:** `/gsd-profile-user [--questionnaire] [--refresh]`

**Purpose:** Analyze Claude Code session history to build behavioral profiles across 8 dimensions, generating artifacts that personalize Claude's responses to the developer's style.

**Dimensions:**
1. Communication style (terse vs verbose, formal vs casual)
2. Decision patterns (rapid vs deliberate, risk tolerance)
3. Debugging approach (systematic vs intuitive, log preference)
4. UX preferences (design sensibility, accessibility awareness)
5. Vendor/technology choices (framework preferences, ecosystem familiarity)
6. Frustration triggers (what causes friction in workflows)
7. Learning style (documentation vs examples, depth preference)
8. Explanation depth (high-level vs implementation detail)

**Generated Artifacts:**
- `USER-PROFILE.md` — Full behavioral profile with evidence citations
- `/gsd-dev-preferences` command — Load preferences in any session
- `CLAUDE.md` profile section — Auto-discovered by Claude Code

**Flags:**
- `--questionnaire` — Interactive questionnaire fallback when session history is unavailable
- `--refresh` — Re-analyze sessions and regenerate profile

**Pipeline Modules:**
- `profile-pipeline.cjs` — Session scanning, message extraction, sampling
- `profile-output.cjs` — Profile rendering, questionnaire, artifact generation
- `gsd-user-profiler` agent — Behavioral analysis from session data

**Requirements:**
- REQ-PROF-01: Session analysis MUST cover at least 8 behavioral dimensions
- REQ-PROF-02: Profile MUST cite evidence from actual session messages
- REQ-PROF-03: Questionnaire MUST be available as fallback when no session history exists
- REQ-PROF-04: Generated artifacts MUST be discoverable by Claude Code (CLAUDE.md integration)

### 39. Execution Hardening

**Purpose:** Three additive quality improvements to the execution pipeline that catch cross-plan failures before they cascade.

**Components:**

**1. Pre-Wave Dependency Check** (execute-phase)
Before spawning wave N+1, verify key-links from prior wave artifacts exist and are wired correctly. Catches cross-plan dependency gaps before they cascade into downstream failures.

**2. Cross-Plan Data Contracts — Dimension 9** (plan-checker)
New analysis dimension that checks plans sharing data pipelines have compatible transformations. Flags when one plan strips data that another plan needs in its original form.

**3. Export-Level Spot Check** (verify-phase)
After Level 3 wiring verification passes, spot-check individual exports for actual usage. Catches dead stores that exist in wired files but are never called.

**Requirements:**
- REQ-HARD-01: Pre-wave check MUST verify key-links from all prior wave artifacts before spawning next wave
- REQ-HARD-02: Cross-plan contract check MUST detect incompatible data transformations between plans
- REQ-HARD-03: Export spot-check MUST identify dead stores in wired files

---

### 40. Verification Debt Tracking

**Command:** `/gsd-audit-uat`

**Purpose:** Prevent silent loss of UAT/verification items when projects advance past phases with outstanding tests. Surfaces verification debt across all prior phases so items are never forgotten.

**Components:**

**1. Cross-Phase Health Check** (progress.md Step 1.6)
Every `/gsd-progress` call scans ALL phases in the current milestone for outstanding items (pending, skipped, blocked, human_needed). Displays a non-blocking warning section with actionable links.

**2. `status: partial`** (verify-work.md, UAT.md)
New UAT status that distinguishes between "session ended" and "all tests resolved". Prevents `status: complete` when tests are still pending, blocked, or skipped without reason.

**3. `result: blocked` with `blocked_by` tag** (verify-work.md, UAT.md)
New test result type for tests blocked by external dependencies (server, physical device, release build, third-party services). Categorized separately from skipped tests.

**4. HUMAN-UAT.md Persistence** (execute-phase.md)
When verification returns `human_needed`, items are persisted as a trackable HUMAN-UAT.md file with `status: partial`. Feeds into the cross-phase health check and audit systems.

**5. Phase Completion Warnings** (phase.cjs, transition.md)
`phase complete` CLI returns verification debt warnings in its JSON output. Transition workflow surfaces outstanding items before confirmation.

**Requirements:**
- REQ-DEBT-01: System MUST surface outstanding UAT/verification items from ALL prior phases in `/gsd-progress`
- REQ-DEBT-02: System MUST distinguish incomplete testing (partial) from completed testing (complete)
- REQ-DEBT-03: System MUST categorize blocked tests with `blocked_by` tags
- REQ-DEBT-04: System MUST persist human_needed verification items as trackable UAT files
- REQ-DEBT-05: System MUST warn (non-blocking) during phase completion and transition when verification debt exists
- REQ-DEBT-06: `/gsd-audit-uat` MUST scan all phases, categorize items by testability, and produce a human test plan

---

## v1.27 Features

### 41. Fast Mode

**Command:** `/gsd-fast [task description]`

**Purpose:** Execute trivial tasks inline without spawning subagents or generating PLAN.md files. For tasks too small to justify planning overhead: typo fixes, config changes, small refactors, forgotten commits, simple additions.

**Requirements:**
- REQ-FAST-01: System MUST execute the task directly in the current context without subagents
- REQ-FAST-02: System MUST produce an atomic git commit for the change
- REQ-FAST-03: System MUST track the task in `.planning/quick/` for state consistency
- REQ-FAST-04: System MUST NOT be used for tasks requiring research, multi-step planning, or verification

**When to use vs `/gsd-quick`:**
- `/gsd-fast` — One-sentence tasks executable in under 2 minutes (typo, config change, small addition)
- `/gsd-quick` — Anything needing research, multi-step planning, or verification

---

### 42. Cross-AI Peer Review

**Command:** `/gsd-review --phase N [--gemini] [--claude] [--codex] [--coderabbit] [--opencode] [--qwen] [--cursor] [--all]`

**Purpose:** Invoke external AI CLIs (Gemini, Claude, Codex, CodeRabbit, OpenCode, Qwen Code, Cursor) to independently review phase plans. Produces structured REVIEWS.md with per-reviewer feedback.

**Requirements:**
- REQ-REVIEW-01: System MUST detect available AI CLIs on the system
- REQ-REVIEW-02: System MUST build a structured review prompt from phase plans
- REQ-REVIEW-03: System MUST invoke each selected CLI independently
- REQ-REVIEW-04: System MUST collect responses and produce `REVIEWS.md`
- REQ-REVIEW-05: Reviews MUST be consumable by `/gsd-plan-phase --reviews`

**Produces:** `{phase}-REVIEWS.md` — Per-reviewer structured feedback

---

### 43. Backlog Parking Lot

**Commands:** `/gsd-add-backlog <description>`, `/gsd-review-backlog`, `/gsd-plant-seed <idea>`

**Purpose:** Capture ideas that aren't ready for active planning. Backlog items use 999.x numbering to stay outside the active phase sequence. Seeds are forward-looking ideas with trigger conditions that surface automatically at the right milestone.

**Requirements:**
- REQ-BACKLOG-01: Backlog items MUST use 999.x numbering to stay outside active phase sequence
- REQ-BACKLOG-02: Phase directories MUST be created immediately so `/gsd-discuss-phase` and `/gsd-plan-phase` work on them
- REQ-BACKLOG-03: `/gsd-review-backlog` MUST support promote, keep, and remove actions per item
- REQ-BACKLOG-04: Promoted items MUST be renumbered into the active milestone sequence
- REQ-SEED-01: Seeds MUST capture the full WHY and WHEN to surface conditions
- REQ-SEED-02: `/gsd-new-milestone` MUST scan seeds and present matches

**Produces:**
| Artifact | Description |
|----------|-------------|
| `.planning/phases/999.x-slug/` | Backlog item directory |
| `.planning/seeds/SEED-NNN-slug.md` | Seed with trigger conditions |

---

### 44. Persistent Context Threads

**Command:** `/gsd-thread [name | description]`

**Purpose:** Lightweight cross-session knowledge stores for work that spans multiple sessions but doesn't belong to any specific phase. Lighter weight than `/gsd-pause-work` — no phase state, no plan context.

**Requirements:**
- REQ-THREAD-01: System MUST support create, list, and resume modes
- REQ-THREAD-02: Threads MUST be stored in `.planning/threads/` as markdown files
- REQ-THREAD-03: Thread files MUST include Goal, Context, References, and Next Steps sections
- REQ-THREAD-04: Resuming a thread MUST load its full context into the current session
- REQ-THREAD-05: Threads MUST be promotable to phases or backlog items

**Produces:** `.planning/threads/{slug}.md` — Persistent context thread

---

### 45. PR Branch Filtering

**Command:** `/gsd-pr-branch [target branch]`

**Purpose:** Create a clean branch suitable for pull requests by filtering out `.planning/` commits. Reviewers see only code changes, not GSD planning artifacts.

**Requirements:**
- REQ-PRBRANCH-01: System MUST identify commits that only modify `.planning/` files
- REQ-PRBRANCH-02: System MUST create a new branch with planning commits filtered out
- REQ-PRBRANCH-03: Code changes MUST be preserved exactly as committed

---

### 46. Security Hardening

**Purpose:** Defense-in-depth security for GSD's planning artifacts. Because GSD generates markdown files that become LLM system prompts, user-controlled text flowing into these files is a potential indirect prompt injection vector.

**Components:**

**1. Centralized Security Module** (`security.cjs`)
- Path traversal prevention — validates file paths resolve within the project directory
- Prompt injection detection — scans for known injection patterns in user-supplied text
- Safe JSON parsing — catches malformed input before state corruption
- Field name validation — prevents injection through config field names
- Shell argument validation — sanitizes user text before shell interpolation

**2. Prompt Injection Guard Hook** (`gsd-prompt-guard.js`)
PreToolUse hook that scans Write/Edit calls targeting `.planning/` for injection patterns. Advisory-only — logs detection for awareness without blocking legitimate operations.

**3. Workflow Guard Hook** (`gsd-workflow-guard.js`)
PreToolUse hook that detects when Claude attempts file edits outside a GSD workflow context. Advises using `/gsd-quick` or `/gsd-fast` instead of direct edits. Configurable via `hooks.workflow_guard` (default: false).

**4. CI-Ready Injection Scanner** (`prompt-injection-scan.test.cjs`)
Test suite that scans all agent, workflow, and command files for embedded injection vectors.

**Requirements:**
- REQ-SEC-01: All user-supplied file paths MUST be validated against the project directory
- REQ-SEC-02: Prompt injection patterns MUST be detected before text enters planning artifacts
- REQ-SEC-03: Security hooks MUST be advisory-only (never block legitimate operations)
- REQ-SEC-04: JSON parsing of user input MUST catch malformed data gracefully
- REQ-SEC-05: macOS `/var` → `/private/var` symlink resolution MUST be handled in path validation

---

### 47. Multi-Repo Workspace Support

**Purpose:** Auto-detection and project root resolution for monorepos and multi-repo setups. Supports workspaces where `.planning/` may need to resolve across repository boundaries.

**Requirements:**
- REQ-MULTIREPO-01: System MUST auto-detect multi-repo workspace configuration
- REQ-MULTIREPO-02: System MUST resolve project root across repository boundaries
- REQ-MULTIREPO-03: Executor MUST record per-repo commit hashes in multi-repo mode

---

### 48. Discussion Audit Trail

**Purpose:** Auto-generate `DISCUSSION-LOG.md` during `/gsd-discuss-phase` for full audit trail of decisions made during discussion.

**Requirements:**
- REQ-DISCLOG-01: System MUST auto-generate DISCUSSION-LOG.md during discuss-phase
- REQ-DISCLOG-02: Log MUST capture questions asked, options presented, and decisions made
- REQ-DISCLOG-03: Decision IDs MUST enable traceability from discuss-phase to plan-phase

---

## v1.28 Features

### 49. Forensics

**Command:** `/gsd-forensics [description]`

**Purpose:** Post-mortem investigation of failed or stuck GSD workflows.

**Requirements:**
- REQ-FORENSICS-01: System MUST analyze git history for anomalies (stuck loops, long gaps, repeated commits)
- REQ-FORENSICS-02: System MUST check artifact integrity (completed phases have expected files)
- REQ-FORENSICS-03: System MUST generate a markdown report saved to `.planning/forensics/`
- REQ-FORENSICS-04: System MUST offer to create a GitHub issue with findings
- REQ-FORENSICS-05: System MUST NOT modify project files (read-only investigation)

**Produces:**
| Artifact | Description |
|----------|-------------|
| `.planning/forensics/report-{timestamp}.md` | Post-mortem investigation report |

**Process:**
1. **Scan** — Analyze git history for anomalies: stuck loops, long gaps between commits, repeated identical commits
2. **Integrity Check** — Verify completed phases have expected artifact files
3. **Report** — Generate markdown report with findings, saved to `.planning/forensics/`
4. **Issue** — Offer to create a GitHub issue with findings for team visibility

---

### 50. Milestone Summary

**Command:** `/gsd-milestone-summary [version]`

**Purpose:** Generate comprehensive project summary from milestone artifacts for team onboarding.

**Requirements:**
- REQ-SUMMARY-01: System MUST aggregate phase plans, summaries, and verification results
- REQ-SUMMARY-02: System MUST work for both current and archived milestones
- REQ-SUMMARY-03: System MUST produce a single navigable document

**Produces:**
| Artifact | Description |
|----------|-------------|
| `MILESTONE-SUMMARY.md` | Comprehensive navigable summary of milestone artifacts |

**Process:**
1. **Collect** — Aggregate phase plans, summaries, and verification results from the target milestone
2. **Synthesize** — Combine artifacts into a single navigable document with cross-references
3. **Output** — Write `MILESTONE-SUMMARY.md` suitable for team onboarding and stakeholder review

---

### 51. Workstream Namespacing

**Command:** `/gsd-workstreams`

**Purpose:** Parallel workstreams for concurrent work on different milestone areas.

**Requirements:**
- REQ-WS-01: System MUST isolate workstream state in separate `.planning/workstreams/{name}/` directories
- REQ-WS-02: System MUST validate workstream names (alphanumeric + hyphens only, no path traversal)
- REQ-WS-03: System MUST support list, create, switch, status, progress, complete, resume subcommands

**Produces:**
| Artifact | Description |
|----------|-------------|
| `.planning/workstreams/{name}/` | Isolated workstream directory structure |

**Process:**
1. **Create** — Initialize a named workstream with isolated `.planning/workstreams/{name}/` directory
2. **Switch** — Change active workstream context for subsequent GSD commands
3. **Manage** — List, check status, track progress, complete, or resume workstreams

---

### 52. Manager Dashboard

**Command:** `/gsd-manager`

**Purpose:** Interactive command center for managing multiple phases from one terminal.

**Requirements:**
- REQ-MGR-01: System MUST show overview of all phases with status
- REQ-MGR-02: System MUST filter to current milestone scope
- REQ-MGR-03: System MUST show phase dependencies and conflicts

**Produces:** Interactive terminal output

**Process:**
1. **Scan** — Load all phases in the current milestone with their statuses
2. **Display** — Render overview showing phase dependencies, conflicts, and progress
3. **Interact** — Accept commands to navigate, inspect, or act on individual phases

---

### 53. Assumptions Discussion Mode

**Command:** `/gsd-discuss-phase` with `workflow.discuss_mode: 'assumptions'`

**Purpose:** Replace interview-style questioning with codebase-first assumption analysis.

**Requirements:**
- REQ-ASSUME-01: System MUST analyze codebase to generate structured assumptions before asking questions
- REQ-ASSUME-02: System MUST classify assumptions by confidence level (Confident/Likely/Unclear)
- REQ-ASSUME-03: System MUST produce identical CONTEXT.md format as default discuss mode
- REQ-ASSUME-04: System MUST support confidence-based skip gate (all HIGH = no questions)

**Produces:**
| Artifact | Description |
|----------|-------------|
| `{phase}-CONTEXT.md` | Same format as default discuss mode |

**Process:**
1. **Analyze** — Scan codebase to generate structured assumptions about implementation approach
2. **Classify** — Categorize assumptions by confidence level: Confident, Likely, Unclear
3. **Gate** — If all assumptions are HIGH confidence, skip questioning entirely
4. **Confirm** — Present unclear assumptions as targeted questions to the user
5. **Output** — Produce `{phase}-CONTEXT.md` in identical format to default discuss mode

---

### 54. UI Phase Auto-Detection

**Part of:** `/gsd-new-project` and `/gsd-progress`

**Purpose:** Automatically detect UI-heavy projects and surface `/gsd-ui-phase` recommendation.

**Requirements:**
- REQ-UI-DETECT-01: System MUST detect UI signals in project description (keywords, framework references)
- REQ-UI-DETECT-02: System MUST annotate ROADMAP.md phases with `ui_hint` when applicable
- REQ-UI-DETECT-03: System MUST suggest `/gsd-ui-phase` in next steps for UI-heavy phases
- REQ-UI-DETECT-04: System MUST NOT make `/gsd-ui-phase` mandatory

**Process:**
1. **Detect** — Scan project description and tech stack for UI signals (keywords, framework references)
2. **Annotate** — Add `ui_hint` markers to applicable phases in ROADMAP.md
3. **Surface** — Include `/gsd-ui-phase` recommendation in next steps for UI-heavy phases

---

### 55. Multi-Runtime Installer Selection

**Part of:** `npx get-shit-done-cc`

**Purpose:** Select multiple runtimes in a single interactive install session.

**Requirements:**
- REQ-MULTI-RT-01: Interactive prompt MUST support multi-select (e.g., Claude Code + Gemini)
- REQ-MULTI-RT-02: CLI flags MUST continue to work for non-interactive installs

**Process:**
1. **Detect** — Identify available AI CLI runtimes on the system
2. **Prompt** — Present multi-select interface for runtime selection
3. **Install** — Configure GSD for all selected runtimes in a single session

---

## v1.29 Features

### 56. Windsurf Runtime Support

**Part of:** `npx get-shit-done-cc`

**Purpose:** Add Windsurf as a supported AI CLI runtime for GSD installation and execution.

**Requirements:**
- REQ-WINDSURF-01: Installer MUST detect Windsurf runtime and offer it as a target
- REQ-WINDSURF-02: GSD commands MUST function correctly within Windsurf sessions

**Process:**
1. **Detect** — Identify Windsurf runtime availability on the system
2. **Install** — Configure GSD skills and hooks for the Windsurf environment

---

### 57. Internationalized Documentation

**Part of:** `docs/`

**Purpose:** Provide GSD documentation in Portuguese, Korean, and Japanese.

**Requirements:**
- REQ-I18N-01: Documentation MUST be available in Portuguese (pt), Korean (ko), and Japanese (ja)
- REQ-I18N-02: Translations MUST stay synchronized with English source documents

**Process:**
1. **Translate** — Convert core documentation into target languages
2. **Publish** — Make translated documentation accessible alongside English originals

---

## v1.30 Features

### 58. GSD SDK

**Command:** Programmatic API (headless)

**Purpose:** Headless TypeScript SDK for running GSD workflows programmatically without a CLI session.

**Requirements:**
- REQ-SDK-01: SDK MUST expose GSD workflow operations as TypeScript functions
- REQ-SDK-02: SDK MUST support headless execution without interactive prompts
- REQ-SDK-03: SDK MUST produce the same artifacts as CLI-driven workflows

**Process:**
1. **Import** — Import GSD SDK into a TypeScript/JavaScript project
2. **Configure** — Set project path and workflow options programmatically
3. **Execute** — Run GSD phases (discuss, plan, execute) via API calls

---

## v1.31 Features

### 59. Schema Drift Detection

**Command:** Automatic during `/gsd-execute-phase`

**Purpose:** Detect when ORM schema files are modified without corresponding migration or push commands, preventing false-positive verification.

**Requirements:**
- REQ-SCHEMA-01: System MUST detect modifications to ORM schema files (Prisma, Drizzle, Payload, Sanity, Mongoose)
- REQ-SCHEMA-02: System MUST verify corresponding migration/push commands exist when schema changes are detected
- REQ-SCHEMA-03: System MUST implement two-layer defense: plan-time injection and execute-time gate
- REQ-SCHEMA-04: System MUST support `GSD_SKIP_SCHEMA_CHECK` env var to override detection
- REQ-SCHEMA-05: System MUST prevent false-positive verification when schema is modified without migration

**Process:**
1. **Detect** — Monitor ORM schema file modifications during plan execution
2. **Verify** — Check that corresponding migration/push commands are present in the plan
3. **Gate** — Block execution if schema drift is detected without migration (execute-time gate)
4. **Inject** — Add migration reminders during plan generation (plan-time injection)

**Config:** `GSD_SKIP_SCHEMA_CHECK` environment variable to bypass detection.

---

### 60. Security Enforcement

**Command:** `/gsd-secure-phase <N>`

**Purpose:** Threat-model-anchored security verification for phase implementations.

**Requirements:**
- REQ-SEC-01: System MUST perform threat-model-anchored verification (not blind scanning)
- REQ-SEC-02: System MUST support configurable OWASP ASVS verification levels (1-3)
- REQ-SEC-03: System MUST block phase advancement based on configurable severity threshold
- REQ-SEC-04: System MUST spawn `gsd-security-auditor` agent for analysis

**Produces:**
| Artifact | Description |
|----------|-------------|
| Security audit report | Threat-model-anchored findings with severity classification |

**Process:**
1. **Model** — Build threat model from phase implementation context
2. **Audit** — Spawn `gsd-security-auditor` to verify against threat model
3. **Gate** — Block phase advancement if findings meet or exceed `security_block_on` severity

**Config:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `security_enforcement` | boolean | `true` | Enable threat-model security verification |
| `security_asvs_level` | number (1-3) | `1` | OWASP ASVS verification level |
| `security_block_on` | string | `"high"` | Minimum severity to block phase advancement |

---

### 61. Documentation Generation

**Command:** `/gsd-docs-update`

**Purpose:** Generate and verify project documentation with accuracy checks.

**Requirements:**
- REQ-DOCS-01: System MUST spawn `gsd-doc-writer` agent to generate documentation
- REQ-DOCS-02: System MUST spawn `gsd-doc-verifier` agent to check accuracy
- REQ-DOCS-03: System MUST verify generated documentation against actual implementation

**Produces:**
| Artifact | Description |
|----------|-------------|
| Updated project documentation | Generated and verified documentation files |

**Process:**
1. **Generate** — Spawn `gsd-doc-writer` to create or update documentation from implementation
2. **Verify** — Spawn `gsd-doc-verifier` to check documentation accuracy against codebase
3. **Output** — Produce verified documentation with accuracy annotations

---

### 62. Discuss Chain Mode

**Flag:** `/gsd-discuss-phase <N> --chain`

**Purpose:** Auto-chain discuss, plan, and execute phases in one flow to reduce manual command sequencing.

**Requirements:**
- REQ-CHAIN-01: System MUST auto-chain discuss → plan → execute when `--chain` flag is provided
- REQ-CHAIN-02: System MUST respect all gate settings between chained phases
- REQ-CHAIN-03: System MUST halt the chain if any phase fails

**Process:**
1. **Discuss** — Run discuss-phase to gather context
2. **Plan** — Automatically invoke plan-phase with gathered context
3. **Execute** — Automatically invoke execute-phase with generated plan

---

### 63. Single-Phase Autonomous

**Flag:** `/gsd-autonomous --only N`

**Purpose:** Execute just one phase autonomously instead of all remaining phases.

**Requirements:**
- REQ-ONLY-01: System MUST execute only the specified phase number when `--only N` is provided
- REQ-ONLY-02: System MUST follow the same discuss → plan → execute flow as full autonomous mode
- REQ-ONLY-03: System MUST stop after the specified phase completes

**Process:**
1. **Select** — Identify the target phase from `--only N` argument
2. **Execute** — Run full autonomous flow (discuss → plan → execute) for that single phase
3. **Stop** — Halt after the phase completes instead of advancing to the next

---

### 64. Scope Reduction Detection

**Part of:** `/gsd-plan-phase`

**Purpose:** Prevent silent requirement dropping during plan generation with three-layer defense.

**Requirements:**
- REQ-SCOPE-01: System MUST prohibit planners from reducing scope without explicit justification
- REQ-SCOPE-02: System MUST have plan-checker verify requirement dimension coverage
- REQ-SCOPE-03: System MUST have orchestrator recover dropped requirements and re-inject them
- REQ-SCOPE-04: System MUST implement three-layer defense: planner prohibition, checker dimension, orchestrator recovery

**Process:**
1. **Prohibit** — Planner instructions explicitly forbid scope reduction
2. **Check** — Plan-checker verifies all phase requirements are covered in the plan
3. **Recover** — Orchestrator detects dropped requirements and re-injects them into the planning loop

---

### 65. Claim Provenance Tagging

**Part of:** `/gsd-research-phase`

**Purpose:** Ensure research claims are tagged with source evidence and assumptions are logged separately.

**Requirements:**
- REQ-PROVENANCE-01: Researcher MUST mark claims with source evidence references
- REQ-PROVENANCE-02: Assumptions MUST be logged separately from sourced claims
- REQ-PROVENANCE-03: System MUST distinguish between evidenced facts and inferred assumptions

**Process:**
1. **Research** — Researcher gathers information from codebase and domain sources
2. **Tag** — Each claim is annotated with its source (file path, documentation, API response)
3. **Separate** — Assumptions without direct evidence are logged in a distinct section

---

### 66. Worktree Toggle

**Config:** `workflow.use_worktrees: false`

**Purpose:** Disable git worktree isolation for users who prefer sequential execution.

**Requirements:**
- REQ-WORKTREE-01: System MUST respect `workflow.use_worktrees` setting when deciding isolation strategy
- REQ-WORKTREE-02: System MUST default to `true` (worktrees enabled) for backward compatibility
- REQ-WORKTREE-03: System MUST fall back to sequential execution when worktrees are disabled

**Config:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `workflow.use_worktrees` | boolean | `true` | When `false`, disables git worktree isolation |

---

### 67. Project Code Prefixing

**Config:** `project_code: "ABC"`

**Purpose:** Prefix phase directory names with a project code for multi-project disambiguation.

**Requirements:**
- REQ-PREFIX-01: System MUST prefix phase directories with project code when configured (e.g., `ABC-01-setup/`)
- REQ-PREFIX-02: System MUST use standard naming when `project_code` is not set
- REQ-PREFIX-03: System MUST apply prefix consistently across all phase operations

**Config:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `project_code` | string | (none) | Prefix for phase directory names |

---

### 68. Claude Code Skills Migration

**Part of:** `npx get-shit-done-cc`

**Purpose:** Migrate GSD commands to Claude Code 2.1.88+ skills format with backward compatibility.

**Requirements:**
- REQ-SKILLS-01: Installer MUST write `skills/gsd-*/SKILL.md` for Claude Code 2.1.88+
- REQ-SKILLS-02: Installer MUST auto-clean legacy `commands/gsd/` directory
- REQ-SKILLS-03: Installer MUST maintain backward compatibility with older Claude Code versions via Gemini path

**Process:**
1. **Detect** — Check Claude Code version to determine skills support
2. **Migrate** — Write `skills/gsd-*/SKILL.md` files for each GSD command
3. **Clean** — Remove legacy `commands/gsd/` directory if skills are installed
4. **Fallback** — Maintain Gemini path compatibility for older Claude Code versions

---

## v1.32 Features

### 69. STATE.md Consistency Gates

**Commands:** `state validate`, `state sync [--verify]`, `state planned-phase --phase N --plans N`

**Purpose:** Detect and repair drift between STATE.md and the actual filesystem, preventing cascading errors from stale state.

**Requirements:**
- REQ-STATE-01: `state validate` MUST detect drift between STATE.md fields and filesystem reality
- REQ-STATE-02: `state sync` MUST reconstruct STATE.md from actual project state on disk
- REQ-STATE-03: `state sync --verify` MUST perform a dry-run showing proposed changes without writing
- REQ-STATE-04: `state planned-phase` MUST record the state transition after plan-phase completes (Planned/Ready to execute)

**Produces:**
| Artifact | Description |
|----------|-------------|
| Updated `STATE.md` | Corrected state reflecting filesystem reality |

**Process:**
1. **Validate** — Compare STATE.md fields against filesystem (phase directories, plan files, summaries)
2. **Sync** — Reconstruct STATE.md from disk when drift is detected
3. **Transition** — Record post-planning state with plan count for execute-phase readiness

---

### 70. Autonomous `--to N` Flag

**Flag:** `/gsd-autonomous --to N`

**Purpose:** Stop autonomous execution after completing a specific phase, allowing partial autonomous runs.

**Requirements:**
- REQ-TO-01: System MUST stop execution after the specified phase number completes
- REQ-TO-02: System MUST follow the same discuss -> plan -> execute flow for each phase up to N
- REQ-TO-03: `--to N` MUST be combinable with `--from N` for bounded autonomous ranges

**Process:**
1. **Bound** — Set the upper phase limit from `--to N` argument
2. **Execute** — Run autonomous flow for each phase up to and including phase N
3. **Stop** — Halt after phase N completes

---

### 71. Research Gate

**Part of:** `/gsd-plan-phase`

**Purpose:** Block planning when RESEARCH.md has unresolved open questions, preventing plans built on incomplete information.

**Requirements:**
- REQ-RESGATE-01: System MUST scan RESEARCH.md for unresolved open questions before planning begins
- REQ-RESGATE-02: System MUST block plan-phase entry when open questions exist
- REQ-RESGATE-03: System MUST surface the specific unresolved questions to the user

**Process:**
1. **Scan** — Check RESEARCH.md for open questions section with unresolved items
2. **Gate** — Block planning if unresolved questions are found
3. **Surface** — Display the specific open questions requiring resolution

---

### 72. Verifier Milestone Scope Filtering

**Part of:** `/gsd-execute-phase` (verifier step)

**Purpose:** Distinguish between genuine gaps and items deferred to later phases, reducing false negatives in verification.

**Requirements:**
- REQ-VSCOPE-01: Verifier MUST check whether a gap is addressed in a later milestone phase
- REQ-VSCOPE-02: Gaps addressed in later phases MUST be marked as "deferred", not "gap"
- REQ-VSCOPE-03: Only genuine gaps (not covered by any future phase) MUST be reported as failures

**Process:**
1. **Verify** — Run standard goal-backward verification
2. **Filter** — Cross-reference detected gaps against later milestone phases
3. **Classify** — Mark deferred items separately from genuine gaps

---

### 73. Read-Before-Edit Guard Hook

**Part of:** Hooks (`PreToolUse`)

**Purpose:** Prevent infinite retry loops in non-Claude runtimes by ensuring files are read before editing.

**Requirements:**
- REQ-RBE-01: Hook MUST detect Edit/Write tool calls that target files not previously read in the session
- REQ-RBE-02: Hook MUST advise reading the file first (advisory, non-blocking)
- REQ-RBE-03: Hook MUST prevent infinite retry loops common in runtimes without built-in read-before-edit enforcement

---

### 74. Context Reduction

**Part of:** GSD SDK prompt assembly

**Purpose:** Reduce context prompt sizes through markdown truncation and cache-friendly prompt ordering.

**Requirements:**
- REQ-CTXRED-01: System MUST truncate oversized markdown artifacts to fit within context budgets
- REQ-CTXRED-02: System MUST order prompts for cache-friendly assembly (stable prefixes first)
- REQ-CTXRED-03: Reduction MUST preserve essential information (headings, requirements, task structure)
- REQ-CTXRED-04: Skill `description:` fields MUST be ≤ 100 chars; enforced by `npm run lint:descriptions` (see `scripts/lint-descriptions.cjs` and `tests/enh-2789-description-budget.test.cjs`)

**Process:**
1. **Measure** — Calculate total prompt size for the workflow
2. **Truncate** — Apply markdown-aware truncation to oversized artifacts
3. **Order** — Arrange prompt sections for optimal KV-cache reuse

---

### 75. Discuss-Phase `--power` Flag

**Flag:** `/gsd-discuss-phase --power`

**Purpose:** File-based bulk question answering for discuss-phase, enabling batch input from a prepared answers file.

**Requirements:**
- REQ-POWER-01: System MUST accept a file containing pre-written answers to discussion questions
- REQ-POWER-02: System MUST map answers to the corresponding gray area questions
- REQ-POWER-03: System MUST produce CONTEXT.md identical to interactive discuss-phase

---

### 76. Debug `--diagnose` Flag

**Flag:** `/gsd-debug --diagnose`

**Purpose:** Diagnosis-only mode that investigates without attempting fixes.

**Requirements:**
- REQ-DIAG-01: System MUST perform full debug investigation (hypotheses, evidence, root cause)
- REQ-DIAG-02: System MUST NOT attempt any code modifications
- REQ-DIAG-03: System MUST produce a diagnostic report with findings and recommended fixes

---

### 77. Phase Dependency Analysis

**Command:** `/gsd-analyze-dependencies`

**Purpose:** Detect phase dependencies and suggest `Depends on` entries for ROADMAP.md before running `/gsd-manager`.

**Requirements:**
- REQ-DEP-01: System MUST detect file overlap between phases
- REQ-DEP-02: System MUST detect semantic dependencies (API/schema producers and consumers)
- REQ-DEP-03: System MUST detect data flow dependencies (output producers and readers)
- REQ-DEP-04: System MUST suggest dependency entries with user confirmation before writing

**Produces:** Dependency suggestion table; optionally updates ROADMAP.md `Depends on` fields

---

### 78. Anti-Pattern Severity Levels

**Part of:** `/gsd-resume-work`

**Purpose:** Mandatory understanding checks at resume with severity-based anti-pattern enforcement.

**Requirements:**
- REQ-ANTI-01: System MUST classify anti-patterns by severity level
- REQ-ANTI-02: System MUST enforce mandatory understanding checks at session resume
- REQ-ANTI-03: Higher severity anti-patterns MUST block workflow progression until acknowledged

---

### 79. Methodology Artifact Type

**Part of:** Planning artifacts

**Purpose:** Define consumption mechanisms for methodology documents, ensuring they are consumed correctly by agents.

**Requirements:**
- REQ-METHOD-01: System MUST support methodology as a distinct artifact type
- REQ-METHOD-02: Methodology artifacts MUST have defined consumption mechanisms for agents

---

### 80. Planner Reachability Check

**Part of:** `/gsd-plan-phase`

**Purpose:** Validate that plan steps are achievable before committing to execution.

**Requirements:**
- REQ-REACH-01: Planner MUST validate that each plan step references reachable files and APIs
- REQ-REACH-02: Unreachable steps MUST be flagged during planning, not discovered during execution

---

### 81. Playwright-MCP UI Verification

**Part of:** `/gsd-verify-work` (optional)

**Purpose:** Automated visual verification using Playwright-MCP during verify-phase.

**Requirements:**
- REQ-PLAY-01: System MUST support optional Playwright-MCP visual verification during verify-phase
- REQ-PLAY-02: Visual verification MUST be opt-in, not mandatory
- REQ-PLAY-03: System MUST capture and compare visual state against UI-SPEC.md expectations

---

### 82. Pause-Work Expansion

**Part of:** `/gsd-pause-work`

**Purpose:** Support non-phase contexts with richer handoff data for broader pause-work applicability.

**Requirements:**
- REQ-PAUSE-01: System MUST support pausing in non-phase contexts (quick tasks, debug sessions, threads)
- REQ-PAUSE-02: Handoff data MUST include richer context appropriate to the current work type

---

### 83. Response Language Config

**Config:** `response_language`

**Purpose:** Cross-phase language consistency for non-English users.

**Requirements:**
- REQ-LANG-01: System MUST respect `response_language` setting across all phases and agents
- REQ-LANG-02: Setting MUST propagate to all spawned agents for consistent language output

**Config:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `response_language` | string | (none) | Language code for agent responses (e.g., `"pt"`, `"ko"`, `"ja"`) |

---

### 84. Manual Update Procedure

**Part of:** `docs/manual-update.md`

**Purpose:** Document a manual update path for environments where `npx` is unavailable or npm publish is experiencing outages.

**Requirements:**
- REQ-MANUAL-01: Documentation MUST describe step-by-step manual update procedure
- REQ-MANUAL-02: Procedure MUST work without npm access

---

### 85. New Runtime Support (Trae, Cline, Augment Code)

**Part of:** `npx get-shit-done-cc`

**Purpose:** Extend GSD installation to Trae IDE, Cline, and Augment Code runtimes.

**Requirements:**
- REQ-TRAE-01: Installer MUST support `--trae` flag for Trae IDE installation
- REQ-CLINE-01: Installer MUST support Cline via `.clinerules` configuration
- REQ-AUGMENT-01: Installer MUST support Augment Code with skill conversion and config management

---

### 86. Autonomous `--interactive` Flag

**Flag:** `/gsd-autonomous --interactive`

**Purpose:** Lean-context autonomous mode that keeps discuss-phase interactive (user answers questions) while dispatching plan and execute as background agents.

**Requirements:**
- REQ-INTERACT-01: `--interactive` MUST run discuss-phase inline with interactive questions (not auto-answered)
- REQ-INTERACT-02: `--interactive` MUST dispatch plan-phase and execute-phase as background agents for context isolation
- REQ-INTERACT-03: `--interactive` MUST enable pipeline parallelism — discuss Phase N+1 while Phase N builds
- REQ-INTERACT-04: Main context MUST only accumulate discuss conversations (lean context)

**Process:**
1. **Discuss inline** — Run discuss-phase in the main context with user interaction
2. **Dispatch** — Send plan and execute to background agents with fresh context windows
3. **Pipeline** — While background agents build Phase N, begin discussing Phase N+1

---

### 87. Commit-Docs Guard Hook

**Hook:** `gsd-commit-docs.js`

**Purpose:** PreToolUse hook that enforces the `commit_docs` configuration, preventing `.planning/` files from being committed when `planning.commit_docs` is `false`.

**Requirements:**
- REQ-COMMITDOCS-01: Hook MUST intercept git commit commands that stage `.planning/` files
- REQ-COMMITDOCS-02: Hook MUST block commits containing `.planning/` files when `commit_docs` is `false`
- REQ-COMMITDOCS-03: Hook MUST be advisory — does not block when `commit_docs` is `true` or absent

---

### 88. Community Hooks Opt-In

**Hooks:** `gsd-validate-commit.sh`, `gsd-session-state.sh`, `gsd-phase-boundary.sh`

**Purpose:** Optional git and session hooks for GSD projects, gated behind `hooks.community: true` in config.

**Requirements:**
- REQ-COMMUNITY-01: All community hooks MUST be no-ops unless `hooks.community` is `true` in `.planning/config.json`
- REQ-COMMUNITY-02: `gsd-validate-commit.sh` MUST enforce Conventional Commits format on git commit messages
- REQ-COMMUNITY-03: `gsd-session-state.sh` MUST track session state transitions
- REQ-COMMUNITY-04: `gsd-phase-boundary.sh` MUST enforce phase boundary checks

**Config:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hooks.community` | boolean | `false` | Enable optional community hooks for commit validation, session state, and phase boundaries |

---

## v1.34.0 Features

  - [Global Learnings Store](#89-global-learnings-store)
  - [Queryable Codebase Intelligence](#90-queryable-codebase-intelligence)
  - [Execution Context Profiles](#91-execution-context-profiles)
  - [Gates Taxonomy](#92-gates-taxonomy)
  - [Code Review Pipeline](#93-code-review-pipeline)
  - [Socratic Exploration](#94-socratic-exploration)
  - [Safe Undo](#95-safe-undo)
  - [Plan Import](#96-plan-import)
  - [Rapid Codebase Scan](#97-rapid-codebase-scan)
  - [Autonomous Audit-to-Fix](#98-autonomous-audit-to-fix)
  - [Improved Prompt Injection Scanner](#99-improved-prompt-injection-scanner)
  - [Stall Detection in Plan-Phase](#100-stall-detection-in-plan-phase)
  - [Hard Stop Safety Gates in /gsd-next](#101-hard-stop-safety-gates-in-gsd-next)
  - [Adaptive Model Preset](#102-adaptive-model-preset)
  - [Post-Merge Hunk Verification](#103-post-merge-hunk-verification)

---

### 89. Global Learnings Store

**Commands:** Auto-triggered at phase completion; consumed by planner
**Config:** `features.global_learnings`

**Purpose:** Persist cross-session, cross-project learnings in a global store so the planner agent can learn from patterns across the entire project history — not just the current session.

**Requirements:**
- REQ-LEARN-01: Learnings MUST be auto-copied from `.planning/` to the global store at phase completion
- REQ-LEARN-02: The planner agent MUST receive relevant learnings at spawn time via injection
- REQ-LEARN-03: Injection MUST be capped by `learnings.max_inject` to avoid context bloat
- REQ-LEARN-04: Feature MUST be opt-in via `features.global_learnings: true`

**Config:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `features.global_learnings` | boolean | `false` | Enable cross-project learnings pipeline |
| `learnings.max_inject` | number | (system default) | Maximum learnings entries injected into planner |

---

### 90. Queryable Codebase Intelligence

**Command:** `/gsd-intel [query <term>|status|diff|refresh]`
**Config:** `intel.enabled`

**Purpose:** Maintain a queryable JSON index of codebase structure, API surface, dependency graph, file roles, and architecture decisions in `.planning/intel/`. Enables targeted lookups without reading the entire codebase.

**Requirements:**
- REQ-INTEL-01: Intel files MUST be stored as JSON in `.planning/intel/`
- REQ-INTEL-02: `query` mode MUST search across all intel files for a term and group results by file
- REQ-INTEL-03: `status` mode MUST report freshness (FRESH/STALE, stale threshold: 24 hours)
- REQ-INTEL-04: `diff` mode MUST compare current intel state to the last snapshot
- REQ-INTEL-05: `refresh` mode MUST spawn the intel-updater agent to rebuild all files
- REQ-INTEL-06: Feature MUST be opt-in via `intel.enabled: true`

**Intel files produced:**
| File | Contents |
|------|----------|
| `stack.json` | Technology stack and dependencies |
| `api-map.json` | Exported functions and API surface |
| `dependency-graph.json` | Inter-module dependency relationships |
| `file-roles.json` | Role classification for each source file |
| `arch-decisions.json` | Detected architecture decisions |

---

### 91. Execution Context Profiles

**Config:** `context_profile`

**Purpose:** Select a pre-configured execution context (mode, model, workflow settings) tuned for a specific type of work without manually adjusting individual settings.

**Requirements:**
- REQ-CTX-01: `dev` profile MUST optimize for iterative development (balanced model, plan_check enabled)
- REQ-CTX-02: `research` profile MUST optimize for research-heavy work (higher model tier, research enabled)
- REQ-CTX-03: `review` profile MUST optimize for code review work (verifier and code_review enabled)

**Available profiles:** `dev`, `research`, `review`

**Config:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `context_profile` | string | (none) | Execution context preset: `dev`, `research`, or `review` |

---

### 92. Gates Taxonomy

**References:** `get-shit-done/references/gates.md`
**Agents:** plan-checker, verifier

**Purpose:** Define 4 canonical gate types that structure all workflow decision points, enabling plan-checker and verifier agents to apply consistent gate logic.

**Gate types:**
| Type | Description |
|------|-------------|
| **Confirm** | User approves before proceeding (e.g., roadmap review) |
| **Quality** | Automated quality check must pass (e.g., plan verification loop) |
| **Safety** | Hard stop on detected risk or policy violation |
| **Transition** | Phase or milestone boundary acknowledgment |

**Requirements:**
- REQ-GATES-01: plan-checker MUST classify each checkpoint as one of the 4 gate types
- REQ-GATES-02: verifier MUST apply gate logic appropriate to the gate type
- REQ-GATES-03: Hard stop safety gates MUST never be bypassed by `--auto` flags

---

### 93. Code Review Pipeline

**Commands:** `/gsd-code-review`, `/gsd-code-review-fix`

**Purpose:** Structured review of source files changed during a phase, with a separate auto-fix pass that commits each fix atomically.

**Requirements:**
- REQ-REVIEW-01: `gsd-code-review` MUST scope files to the phase using SUMMARY.md and git diff fallback
- REQ-REVIEW-02: Review MUST support three depth levels: `quick`, `standard`, `deep`
- REQ-REVIEW-03: Findings MUST be severity-classified: Critical, Warning, Info
- REQ-REVIEW-04: `gsd-code-review-fix` MUST read REVIEW.md and fix Critical + Warning findings by default
- REQ-REVIEW-05: Each fix MUST be committed atomically with a descriptive message
- REQ-REVIEW-06: `--auto` flag MUST enable fix + re-review iteration loop, capped at 3 iterations
- REQ-REVIEW-07: Feature MUST be gated by `workflow.code_review` config flag

**Config:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `workflow.code_review` | boolean | `true` | Enable code review commands |
| `workflow.code_review_depth` | string | `standard` | Default review depth: `quick`, `standard`, or `deep` |

---

### 94. Socratic Exploration

**Command:** `/gsd-explore [topic]`

**Purpose:** Guide a developer through exploring an idea via Socratic probing questions before committing to a plan. Routes outputs to the appropriate GSD artifact: notes, todos, seeds, research questions, requirements updates, or a new phase.

**Requirements:**
- REQ-EXPLORE-01: Exploration MUST use Socratic probing — ask questions before proposing solutions
- REQ-EXPLORE-02: Session MUST offer to route outputs to the appropriate GSD artifact
- REQ-EXPLORE-03: An optional topic argument MUST prime the first question
- REQ-EXPLORE-04: Exploration MUST optionally spawn a research agent for technical feasibility

---

### 95. Safe Undo

**Command:** `/gsd-undo --last N | --phase NN | --plan NN-MM`

**Purpose:** Roll back GSD phase or plan commits safely using the phase manifest and git log, with dependency checks and a hard confirmation gate before any revert is applied.

**Requirements:**
- REQ-UNDO-01: `--phase` mode MUST identify all commits for the phase via manifest and git log fallback
- REQ-UNDO-02: `--plan` mode MUST identify all commits for a specific plan
- REQ-UNDO-03: `--last N` mode MUST display recent GSD commits for interactive selection
- REQ-UNDO-04: System MUST check for dependent phases/plans before reverting
- REQ-UNDO-05: A confirmation gate MUST be shown before any git revert is executed

---

### 96. Plan Import

**Command:** `/gsd-import --from <filepath>`

**Purpose:** Ingest an external plan file into the GSD planning system with conflict detection against `PROJECT.md` decisions, converting it to a valid GSD PLAN.md and validating it through the plan-checker.

**Requirements:**
- REQ-IMPORT-01: Importer MUST detect conflicts between the external plan and existing PROJECT.md decisions
- REQ-IMPORT-02: All detected conflicts MUST be presented to the user for resolution before writing
- REQ-IMPORT-03: Imported plan MUST be written as a valid GSD PLAN.md format
- REQ-IMPORT-04: Written plan MUST pass `gsd-plan-checker` validation

---

### 97. Rapid Codebase Scan

**Command:** `/gsd-scan [--focus tech|arch|quality|concerns|tech+arch]`

**Purpose:** Lightweight alternative to `/gsd-map-codebase` that spawns a single mapper agent for a specific focus area, producing targeted output in `.planning/codebase/` without the overhead of 4 parallel agents.

**Requirements:**
- REQ-SCAN-01: Scan MUST spawn exactly one mapper agent (not four parallel agents)
- REQ-SCAN-02: Focus area MUST be one of: `tech`, `arch`, `quality`, `concerns`, `tech+arch` (default)
- REQ-SCAN-03: Output MUST be written to `.planning/codebase/` in the same format as `/gsd-map-codebase`

---

### 98. Autonomous Audit-to-Fix

**Command:** `/gsd-audit-fix [--source <audit>] [--severity high|medium|all] [--max N] [--dry-run]`

**Purpose:** End-to-end pipeline that runs an audit, classifies findings as auto-fixable vs. manual-only, then autonomously fixes auto-fixable issues with test verification and atomic commits.

**Requirements:**
- REQ-AUDITFIX-01: Findings MUST be classified as auto-fixable or manual-only before any changes
- REQ-AUDITFIX-02: Each fix MUST be verified with tests before committing
- REQ-AUDITFIX-03: Each fix MUST be committed atomically
- REQ-AUDITFIX-04: `--dry-run` MUST show classification table without applying any fixes
- REQ-AUDITFIX-05: `--max N` MUST limit the number of fixes applied in one run (default: 5)

---

### 99. Improved Prompt Injection Scanner

**Hook:** `gsd-prompt-guard.js`
**Script:** `scripts/prompt-injection-scan.sh`

**Purpose:** Enhanced detection of prompt injection attempts in planning artifacts, adding invisible Unicode character detection, encoding obfuscation patterns, and entropy-based analysis.

**Requirements:**
- REQ-SCAN-INJ-01: Scanner MUST detect invisible Unicode characters (zero-width spaces, soft hyphens, etc.)
- REQ-SCAN-INJ-02: Scanner MUST detect encoding obfuscation patterns (base64-encoded instructions, homoglyphs)
- REQ-SCAN-INJ-03: Scanner MUST apply entropy analysis to flag high-entropy strings in unexpected positions
- REQ-SCAN-INJ-04: Scanner MUST remain advisory-only — detection is logged, not blocking

---

### 100. Stall Detection in Plan-Phase

**Command:** `/gsd-plan-phase`

**Purpose:** Detect when the planner revision loop has stalled — producing the same output across multiple iterations — and break the cycle by escalating to a different strategy or exiting with a clear diagnostic.

**Requirements:**
- REQ-STALL-01: Revision loop MUST detect identical plan output across consecutive iterations
- REQ-STALL-02: On stall detection, system MUST escalate strategy before retrying
- REQ-STALL-03: Maximum stall retries MUST be bounded (capped at the existing max 3 iterations)

---

### 101. Hard Stop Safety Gates in /gsd-next

**Command:** `/gsd-next`

**Purpose:** Prevent `/gsd-next` from entering runaway loops by adding hard stop safety gates and a consecutive-call guard that interrupts autonomous chaining when repeated identical steps are detected.

**Requirements:**
- REQ-NEXT-GATE-01: `/gsd-next` MUST track consecutive same-step calls
- REQ-NEXT-GATE-02: On repeated same-step, system MUST present a hard stop gate to the user
- REQ-NEXT-GATE-03: User MUST explicitly confirm to continue past a hard stop gate

---

### 102. Adaptive Model Preset

**Config:** `model_profile: "adaptive"`

**Purpose:** Role-based model assignment that automatically selects the appropriate model tier based on the current agent's role, rather than applying a single tier to all agents.

**Requirements:**
- REQ-ADAPTIVE-01: `adaptive` preset MUST assign model tiers based on agent role (planner → quality tier, executor → balanced tier, etc.)
- REQ-ADAPTIVE-02: `adaptive` MUST be selectable via `/gsd-set-profile adaptive`

---

### 103. Post-Merge Hunk Verification

**Command:** `/gsd-update --reapply`

**Purpose:** After applying local patches post-update, verify that all hunks were actually applied by comparing the expected patch content against the live filesystem. Surface any dropped or partial hunks immediately rather than silently accepting incomplete merges.

**Requirements:**
- REQ-PATCH-VERIFY-01: Reapply-patches MUST verify each hunk was applied after the merge
- REQ-PATCH-VERIFY-02: Dropped or partial hunks MUST be reported to the user with file and line context
- REQ-PATCH-VERIFY-03: Verification MUST run after all patches are applied, not per-patch

---

## v1.35.0 Features

- [New Runtime Support (Cline, CodeBuddy, Qwen Code)](#104-new-runtime-support-cline-codebuddy-qwen-code)
- [GSD-2 Reverse Migration](#105-gsd-2-reverse-migration)
- [AI Integration Phase Wizard](#106-ai-integration-phase-wizard)
- [AI Eval Review](#107-ai-eval-review)

---

### 104. New Runtime Support (Cline, CodeBuddy, Qwen Code)

**Part of:** `npx get-shit-done-cc`

**Purpose:** Extend GSD installation to Cline, CodeBuddy, and Qwen Code runtimes.

**Requirements:**
- REQ-CLINE-02: Cline install MUST write `.clinerules` to `~/.cline/` (global) or `./.cline/` (local). No custom slash commands — rules-based integration only. Flag: `--cline`.
- REQ-CODEBUDDY-01: CodeBuddy install MUST deploy skills to `~/.codebuddy/skills/gsd-*/SKILL.md`. Flag: `--codebuddy`.
- REQ-QWEN-01: Qwen Code install MUST deploy skills to `~/.qwen/skills/gsd-*/SKILL.md`, following the open standard used by Claude Code 2.1.88+. `QWEN_CONFIG_DIR` env var overrides the default path. Flag: `--qwen`.

**Runtime summary:**

| Runtime | Install Format | Config Path | Flag |
|---------|---------------|-------------|------|
| Cline | `.clinerules` | `~/.cline/` or `./.cline/` | `--cline` |
| CodeBuddy | Skills (`SKILL.md`) | `~/.codebuddy/skills/` | `--codebuddy` |
| Qwen Code | Skills (`SKILL.md`) | `~/.qwen/skills/` | `--qwen` |

---

### 105. GSD-2 Reverse Migration

**Command:** `/gsd-from-gsd2 [--dry-run] [--force] [--path <dir>]`

**Purpose:** Migrate a project from GSD-2 format (`.gsd/` directory with Milestone→Slice→Task hierarchy) back to the v1 `.planning/` format, restoring full compatibility with all GSD v1 commands.

**Requirements:**
- REQ-FROM-GSD2-01: Importer MUST read `.gsd/` from the specified or current directory
- REQ-FROM-GSD2-02: Milestone→Slice hierarchy MUST be flattened to sequential phase numbers (M001/S01→phase 01, M001/S02→phase 02, M002/S01→phase 03, etc.)
- REQ-FROM-GSD2-03: System MUST guard against overwriting an existing `.planning/` directory without `--force`
- REQ-FROM-GSD2-04: `--dry-run` MUST preview all changes without writing any files
- REQ-FROM-GSD2-05: Migration MUST produce `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, and sequential phase directories

**Flags:**

| Flag | Description |
|------|-------------|
| `--dry-run` | Preview migration output without writing files |
| `--force` | Overwrite an existing `.planning/` directory |
| `--path <dir>` | Specify the GSD-2 root directory |

---

### 106. AI Integration Phase Wizard

**Command:** `/gsd-ai-integration-phase [N]`

**Purpose:** Guide developers through selecting, integrating, and planning evaluation for AI/LLM capabilities in a project phase. Produces a structured `AI-SPEC.md` that feeds into planning and verification.

**Requirements:**
- REQ-AISPEC-01: Wizard MUST present an interactive decision matrix covering framework selection, model choice, and integration approach
- REQ-AISPEC-02: System MUST surface domain-specific failure modes and eval criteria relevant to the project type
- REQ-AISPEC-03: System MUST spawn 3 parallel specialist agents: domain-researcher, framework-selector, and eval-planner
- REQ-AISPEC-04: Output MUST produce `{phase}-AI-SPEC.md` with framework recommendation, implementation guidance, and evaluation strategy

**Produces:** `{phase}-AI-SPEC.md` in the phase directory

---

### 107. AI Eval Review

**Command:** `/gsd-eval-review [N]`

**Purpose:** Retroactively audit an executed AI phase's evaluation coverage against the `AI-SPEC.md` plan. Identifies gaps between planned and implemented evaluation before the phase is closed.

**Requirements:**
- REQ-EVALREVIEW-01: Review MUST read `AI-SPEC.md` from the specified phase
- REQ-EVALREVIEW-02: Each eval dimension MUST be scored as COVERED, PARTIAL, or MISSING
- REQ-EVALREVIEW-03: Output MUST include findings, gap descriptions, and remediation guidance
- REQ-EVALREVIEW-04: `EVAL-REVIEW.md` MUST be written to the phase directory

**Produces:** `{phase}-EVAL-REVIEW.md` with scored eval dimensions, gap analysis, and remediation steps

---

## v1.36.0 Features

### 108. Plan Bounce

**Command:** `/gsd-plan-phase N --bounce`

**Purpose:** After plans pass the checker, optionally refine them through an external script (a second AI, a linter, a custom validator). The bounce step backs up each plan, runs the script, validates YAML frontmatter integrity on the result, re-runs the plan checker, and restores the original if anything fails.

**Requirements:**
- REQ-BOUNCE-01: `--bounce` flag or `workflow.plan_bounce: true` activates the step; `--skip-bounce` always disables it
- REQ-BOUNCE-02: `workflow.plan_bounce_script` must point to a valid executable; missing script produces a warning and skips
- REQ-BOUNCE-03: Each plan is backed up to `*-PLAN.pre-bounce.md` before the script runs
- REQ-BOUNCE-04: Bounced plans with broken YAML frontmatter or that fail the plan checker are restored from backup
- REQ-BOUNCE-05: `workflow.plan_bounce_passes` (default: 2) controls how many refinement passes the script receives

**Configuration:** `workflow.plan_bounce`, `workflow.plan_bounce_script`, `workflow.plan_bounce_passes`

---

### 109. External Code Review Command

**Command:** `/gsd-ship` (enhanced)

**Purpose:** Before the manual review step in `/gsd-ship`, automatically run an external code review command if configured. The command receives the diff and phase context via stdin and returns a JSON verdict (`APPROVED` or `REVISE`). Falls through to the existing manual review flow regardless of outcome.

**Requirements:**
- REQ-EXTREVIEW-01: `workflow.code_review_command` must be set to a command string; null means skip
- REQ-EXTREVIEW-02: Diff is generated against `BASE_BRANCH` with `--stat` summary included
- REQ-EXTREVIEW-03: Review prompt is piped via stdin (never shell-interpolated)
- REQ-EXTREVIEW-04: 120-second timeout; stderr captured on failure
- REQ-EXTREVIEW-05: JSON output parsed for `verdict`, `confidence`, `summary`, `issues` fields

**Configuration:** `workflow.code_review_command`

---

### 110. Cross-AI Execution Delegation

**Command:** `/gsd-execute-phase N --cross-ai`

**Purpose:** Delegate individual plans to an external AI runtime for execution. Plans with `cross_ai: true` in their frontmatter (or all plans when `--cross-ai` is used) are sent to the configured command via stdin. Successfully handled plans are removed from the normal executor queue.

**Requirements:**
- REQ-CROSSAI-01: `--cross-ai` forces all plans through cross-AI; `--no-cross-ai` disables it
- REQ-CROSSAI-02: `workflow.cross_ai_execution: true` and plan frontmatter `cross_ai: true` required for per-plan activation
- REQ-CROSSAI-03: Task prompt is piped via stdin to prevent injection
- REQ-CROSSAI-04: Dirty working tree produces a warning before execution
- REQ-CROSSAI-05: On failure, user chooses: retry, skip (fall back to normal executor), or abort

**Configuration:** `workflow.cross_ai_execution`, `workflow.cross_ai_command`, `workflow.cross_ai_timeout`

---

### 111. Architectural Responsibility Mapping

**Command:** `/gsd-plan-phase` (enhanced research step)

**Purpose:** During phase research, the phase-researcher now maps each capability to its architectural tier owner (browser, frontend server, API, CDN/static, database). The planner cross-references tasks against this map, and the plan-checker enforces tier compliance as Dimension 7c.

**Requirements:**
- REQ-ARM-01: Phase researcher produces an Architectural Responsibility Map table in RESEARCH.md (Step 1.5)
- REQ-ARM-02: Planner sanity-checks task-to-tier assignments against the map
- REQ-ARM-03: Plan checker validates tier compliance as Dimension 7c (WARNING for general mismatches, BLOCKER for security-sensitive ones)

**Produces:** `## Architectural Responsibility Map` section in `{phase}-RESEARCH.md`

---

### 112. Extract Learnings

**Command:** `/gsd-extract-learnings N`

**Purpose:** Extract structured knowledge from completed phase artifacts. Reads PLAN.md and SUMMARY.md (required) plus VERIFICATION.md, UAT.md, and STATE.md (optional) to produce four categories of learnings: decisions, lessons, patterns, and surprises. Optionally captures each item to an external knowledge base via `capture_thought` tool.

**Requirements:**
- REQ-LEARN-01: Requires PLAN.md and SUMMARY.md; exits with clear error if missing
- REQ-LEARN-02: Each extracted item includes source attribution (artifact and section)
- REQ-LEARN-03: If `capture_thought` tool is available, captures items with `source`, `project`, and `phase` metadata
- REQ-LEARN-04: If `capture_thought` is unavailable, completes successfully and logs that external capture was skipped
- REQ-LEARN-05: Running twice overwrites the previous `LEARNINGS.md`

**Produces:** `{phase}-LEARNINGS.md` with YAML frontmatter (phase, project, counts per category, missing_artifacts)

**Optional integration — `capture_thought`:** `capture_thought` is a **convention, not a bundled tool**. GSD does not ship one and does not require one. The workflow checks whether any MCP server in the current session exposes a tool named `capture_thought` and, if so, calls it once per extracted learning with the signature below. If no such tool is present, the step is skipped silently and `LEARNINGS.md` remains the primary output.

Expected tool signature:
```javascript
capture_thought({
  category: "decision" | "lesson" | "pattern" | "surprise",
  phase: <phase_number>,
  content: <learning_text>,
  source: <artifact_name>
})
```

Users who run a memory / knowledge-base MCP server (for example, ExoCortex-style servers, `claude-mem`, or `mem0`-style servers) can implement this tool name to have learnings routed into their knowledge base automatically with `project`, `phase`, and `source` metadata. Everyone else can use `/gsd-extract-learnings` without any extra setup — the `LEARNINGS.md` artifact is the feature.

---

### 113. SDK Workstream Support

**Command:** `gsd-sdk init @prd.md --ws my-workstream`

**Purpose:** Route all SDK `.planning/` paths to `.planning/workstreams/<name>/`, enabling multi-workstream projects without "Project already exists" errors. The `--ws` flag validates the workstream name and propagates to all subsystems (tools, config, context engine).

**Requirements:**
- REQ-WS-01: `--ws <name>` routes all `.planning/` paths to `.planning/workstreams/<name>/`
- REQ-WS-02: Without `--ws`, behavior is unchanged (flat mode)
- REQ-WS-03: Name validated to alphanumeric, hyphens, underscores, and dots only
- REQ-WS-04: Config resolves from workstream path first, falls back to root `.planning/config.json`

---

### 114. Context-Window-Aware Prompt Thinning

**Purpose:** Reduce static prompt overhead by ~40% for models with context windows under 200K tokens. Extended examples and anti-pattern lists are extracted from agent definitions into reference files loaded on demand via `@` required_reading.

**Requirements:**
- REQ-THIN-01: When `CONTEXT_WINDOW < 200000`, executor and planner agent prompts omit inline examples
- REQ-THIN-02: Extracted content lives in `references/executor-examples.md` and `references/planner-antipatterns.md`
- REQ-THIN-03: Standard (200K-500K) and enriched (500K+) tiers are unaffected
- REQ-THIN-04: Core rules and decision logic remain inline; only verbose examples are extracted

**Reference files:** `executor-examples.md`, `planner-antipatterns.md`

---

### 115. Configurable CLAUDE.md Path

**Purpose:** Allow projects to store their CLAUDE.md in a non-root location. The `claude_md_path` config key controls where `/gsd-profile-user` and related commands write the generated CLAUDE.md file.

**Requirements:**
- REQ-CMDPATH-01: `claude_md_path` defaults to `./CLAUDE.md`
- REQ-CMDPATH-02: Profile generation commands read the path from config and write to the specified location
- REQ-CMDPATH-03: Relative paths are resolved from the project root

**Configuration:** `claude_md_path`

---

### 116. TDD Pipeline Mode

**Purpose:** Opt-in TDD (red-green-refactor) as a first-class phase execution mode. When enabled, the planner aggressively selects `type: tdd` for eligible tasks and the executor enforces RED/GREEN/REFACTOR gate sequence with fail-fast on unexpected GREEN before RED.

**Requirements:**
- REQ-TDD-01: `workflow.tdd_mode` config key (boolean, default `false`)
- REQ-TDD-02: When enabled, planner applies TDD heuristics from `references/tdd.md` to all eligible tasks (business logic, APIs, validations, algorithms, state machines)
- REQ-TDD-03: Executor enforces gate sequence for `type: tdd` plans — RED commit (`test(...)`) must precede GREEN commit (`feat(...)`)
- REQ-TDD-04: Executor fails fast if tests pass unexpectedly during RED phase (feature already exists or test is wrong)
- REQ-TDD-05: End-of-phase collaborative review checkpoint verifies gate compliance across all TDD plans (advisory, non-blocking)
- REQ-TDD-06: Gate violations surfaced in SUMMARY.md under `## TDD Gate Compliance` section

**Configuration:** `workflow.tdd_mode`
**Reference files:** `tdd.md`, `checkpoints.md`

---

## v1.37.0 Features

### 117. Spike Command

**Command:** `/gsd-spike [idea] [--quick]`

**Purpose:** Run 2–5 focused feasibility experiments before committing to an implementation approach. Each experiment uses Given/When/Then framing, produces executable code, and returns a VALIDATED / INVALIDATED / PARTIAL verdict. Companion `/gsd-spike-wrap-up` packages findings into a project-local skill.

**Requirements:**
- REQ-SPIKE-01: Each experiment MUST produce a Given/When/Then hypothesis before any code is written
- REQ-SPIKE-02: Each experiment MUST include working code or a minimal reproduction
- REQ-SPIKE-03: Each experiment MUST return one of: VALIDATED, INVALIDATED, or PARTIAL verdict with evidence
- REQ-SPIKE-04: Results MUST be stored in `.planning/spikes/NNN-experiment-name/` with a README and MANIFEST.md
- REQ-SPIKE-05: `--quick` flag skips intake conversation and uses the argument text as the experiment direction
- REQ-SPIKE-06: `/gsd-spike-wrap-up` MUST package findings into `.claude/skills/spike-findings-[project]/`

**Produces:**
| Artifact | Description |
|----------|-------------|
| `.planning/spikes/NNN-name/README.md` | Hypothesis, experiment code, verdict, and evidence |
| `.planning/spikes/MANIFEST.md` | Index of all spikes with verdicts |
| `.claude/skills/spike-findings-[project]/` | Packaged findings (via `/gsd-spike-wrap-up`) |

---

### 118. Sketch Command

**Command:** `/gsd-sketch [idea] [--quick] [--text]`

**Purpose:** Explore design directions through throwaway HTML mockups before committing to implementation. Produces 2–3 interactive variants per design question, all viewable directly in a browser with no build step. Companion `/gsd-sketch-wrap-up` packages winning decisions into a project-local skill.

**Requirements:**
- REQ-SKETCH-01: Each sketch MUST answer one specific visual design question
- REQ-SKETCH-02: Each sketch MUST include 2–3 meaningfully different variants in a single `index.html` with tab navigation
- REQ-SKETCH-03: All interactive elements (hover, click, transitions) MUST be functional
- REQ-SKETCH-04: Sketches MUST use real-ish content, not lorem ipsum
- REQ-SKETCH-05: A shared `themes/default.css` MUST provide CSS variables adapted to the agreed aesthetic
- REQ-SKETCH-06: `--quick` flag skips mood intake; `--text` flag replaces `AskUserQuestion` with numbered lists for non-Claude runtimes
- REQ-SKETCH-07: The winning variant MUST be marked in the README frontmatter and with a ★ in the HTML tab
- REQ-SKETCH-08: `/gsd-sketch-wrap-up` MUST package winning decisions into `.claude/skills/sketch-findings-[project]/`

**Produces:**
| Artifact | Description |
|----------|-------------|
| `.planning/sketches/NNN-name/index.html` | 2–3 interactive HTML variants |
| `.planning/sketches/NNN-name/README.md` | Design question, variants, winner, what to look for |
| `.planning/sketches/themes/default.css` | Shared CSS theme variables |
| `.planning/sketches/MANIFEST.md` | Index of all sketches with winners |
| `.claude/skills/sketch-findings-[project]/` | Packaged decisions (via `/gsd-sketch-wrap-up`) |

---

### 119. Agent Size-Budget Enforcement

**Purpose:** Keep agent prompt files lean with tiered line-count limits enforced in CI. Oversized agents are caught before they bloat context windows in production.

**Requirements:**
- REQ-BUDGET-01: `agents/gsd-*.md` files are classified into three tiers: XL (≤ 1 600 lines), Large (≤ 1 000 lines), Default (≤ 500 lines)
- REQ-BUDGET-02: Tier assignment is declared in the file's YAML frontmatter (`size: xl | large | default`)
- REQ-BUDGET-03: `tests/agent-size-budget.test.cjs` enforces limits and fails CI on violation
- REQ-BUDGET-04: Files without a `size` frontmatter key default to the Default (500-line) limit

**Test file:** `tests/agent-size-budget.test.cjs`

---

### 120. Shared Boilerplate Extraction

**Purpose:** Reduce duplication across agents by extracting two common boilerplate blocks into shared reference files loaded on demand. Keeps agent files within size budget and makes boilerplate updates a single-file change.

**Requirements:**
- REQ-BOILER-01: Mandatory-initial-read instructions extracted to `references/mandatory-initial-read.md`
- REQ-BOILER-02: Project-skills-discovery instructions extracted to `references/project-skills-discovery.md`
- REQ-BOILER-03: Agents that previously inlined these blocks MUST now reference them via `@` required_reading

**Reference files:** `references/mandatory-initial-read.md`, `references/project-skills-discovery.md`

---

### 121. Knowledge Graph Integration

**Purpose:** Build, query, and inspect a lightweight knowledge graph of the project in `.planning/graphs/`. Opt-in per project. Exposed as the `/gsd-graphify` user-facing command and the `gsd-tools.cjs graphify …` programmatic verb family. Complements `/gsd-intel` (snapshot-oriented) with a graph-oriented view of nodes and edges across commands, agents, workflows, and phases.

**Requirements:**
- REQ-GRAPH-01: Opt-in via `graphify.enabled: true` in `.planning/config.json`. When disabled, `/gsd-graphify` prints an activation hint and stops without writing.
- REQ-GRAPH-02: Slash-command `/gsd-graphify` exposes subcommands `build`, `query <term>`, `status`, `diff`. The programmatic CLI `node gsd-tools.cjs graphify …` additionally exposes `snapshot`, which is also invoked automatically as the final step of `graphify build`.
- REQ-GRAPH-03: Build runs within the configurable `graphify.build_timeout` (seconds); exceeding the timeout aborts cleanly without leaving a partial graph.
- REQ-GRAPH-04: `graphify.cjs` falls back to `graph.links` when `graph.edges` is absent so older graph artifacts keep rendering.
- REQ-GRAPH-05: CJS-only surface; `gsd-sdk query` does not yet register graphify handlers.

**Configuration:** `graphify.enabled`, `graphify.build_timeout`
**Reference files:** `commands/gsd/graphify.md`, `bin/lib/graphify.cjs`
