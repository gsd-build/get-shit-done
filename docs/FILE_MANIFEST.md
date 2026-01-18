# GSD File Manifest

Complete inventory of all GSD system files with metadata for documentation and modification tasks.

---

## Documentation & Guides

### Root Documentation & Governance

| File | Purpose | Lines |
|------|---------|-------|
| README.md | Repository overview, installation, and usage guidance | 484 |
| CHANGELOG.md | Release notes and version history | 1050 |
| LICENSE | License terms for GSD | 21 |
| GSD-STYLE.md | Writing conventions and style guide for GSD docs | 434 |
| GSD_ARCHITECTURE_SCAFFOLDING.md | Architecture reference, registries, invariants, and key flows | 434 |
| GSD_DOCUMENTATION_EXECUTION_PLAN.md | Documentation execution plan and coverage strategy | 1220 |

### Documentation Index & Guides (docs/*.md)

| File | Purpose | Lines |
|------|---------|-------|
| docs/GSD_DOCUMENTATION_INDEX.md | Master navigation index for GSD documentation | 398 |
| docs/GSD_USER_JOURNEY.md | End-to-end user journey narrative and flow mapping | 469 |
| docs/FILE_MANIFEST.md | Complete file inventory with metadata | 340 |

### Component References (docs/*-components-reference.md)

| File | Purpose | Lines |
|------|---------|-------|
| docs/support-components-reference.md | Detailed reference for workflows, templates, and references | 1187 |
| docs/operational-components-reference.md | Installer, hooks, and operational behavior reference | 259 |

### Command References (docs/commands/*.md)

| File | Purpose | Lines |
|------|---------|-------|
| docs/commands/core-commands-reference.md | Deep reference for core workflow commands | 419 |
| docs/commands/secondary-commands-reference.md | Reference for supporting commands | 458 |

### Agent References (docs/agents/*.md)

| File | Purpose | Lines |
|------|---------|-------|
| docs/agents/gsd-planner-reference.md | Deep reference for gsd-planner behavior | 464 |
| docs/agents/gsd-executor-reference.md | Deep reference for gsd-executor behavior | 407 |
| docs/agents/gsd-verifier-reference.md | Deep reference for gsd-verifier behavior | 497 |
| docs/agents/gsd-plan-checker-reference.md | Deep reference for gsd-plan-checker behavior | 479 |
| docs/agents/gsd-debugger-reference.md | Standard reference for gsd-debugger behavior | 341 |
| docs/agents/gsd-codebase-mapper-reference.md | Standard reference for gsd-codebase-mapper behavior | 131 |
| docs/agents/gsd-project-researcher-reference.md | Standard reference for gsd-project-researcher behavior | 321 |
| docs/agents/gsd-phase-researcher-reference.md | Standard reference for gsd-phase-researcher behavior | 417 |
| docs/agents/gsd-roadmapper-reference.md | Standard reference for gsd-roadmapper behavior | 413 |
| docs/agents/gsd-integration-checker-reference.md | Standard reference for gsd-integration-checker behavior | 173 |
| docs/agents/gsd-research-synthesizer-reference.md | Summary reference for gsd-research-synthesizer behavior | 185 |

---

## Agents (agents/*.md)

| File | Purpose | Lines | Complexity |
|------|---------|-------|------------|
| gsd-planner.md | Creates executable phase plans with task breakdown, dependency analysis, and goal-backward verification | 1367 | High (12/12) |
| gsd-executor.md | Executes GSD plans with atomic commits, deviation handling, checkpoint protocols, and state management | 753 | High (11/12) |
| gsd-verifier.md | Verifies phase goal achievement through goal-backward analysis, creates VERIFICATION.md report | 778 | High (12/12) |
| gsd-plan-checker.md | Verifies plans will achieve phase goal before execution via goal-backward analysis | 745 | High (10/12) |
| gsd-debugger.md | Investigates bugs using scientific method, manages debug sessions, handles checkpoints | 1184 | Medium (9/12) |
| gsd-codebase-mapper.md | Explores codebase and writes structured analysis documents to .planning/codebase/ | 738 | Medium (8/12) |
| gsd-project-researcher.md | Researches domain ecosystem before roadmap creation, produces .planning/research/ files | 865 | Medium (8/12) |
| gsd-phase-researcher.md | Researches how to implement a phase before planning, produces RESEARCH.md | 632 | Medium (7/12) |
| gsd-roadmapper.md | Creates project roadmaps with phase breakdown, requirement mapping, and success criteria | 605 | Medium (8/12) |
| gsd-integration-checker.md | Verifies cross-phase integration and E2E flows work together as a system | 423 | Medium (7/12) |
| gsd-research-synthesizer.md | Synthesizes research outputs from parallel researcher agents into SUMMARY.md | 247 | Low (6/12) |

### Agent Relationships

| Agent | Spawned By | Outputs | Consumes |
|-------|------------|---------|----------|
| gsd-planner | /gsd:plan-phase | PLAN.md | STATE.md, ROADMAP.md, RESEARCH.md, CONTEXT.md |
| gsd-executor | /gsd:execute-phase | SUMMARY.md, code | PLAN.md, STATE.md |
| gsd-verifier | /gsd:execute-phase (post) | VERIFICATION.md | PLAN.md, SUMMARY.md, codebase |
| gsd-plan-checker | /gsd:plan-phase | feedback | PLAN.md, ROADMAP.md |
| gsd-debugger | /gsd:debug | DEBUG.md | codebase, error context |
| gsd-codebase-mapper | /gsd:map-codebase | .planning/codebase/*.md | codebase |
| gsd-project-researcher | /gsd:new-project, /gsd:new-milestone | .planning/research/*.md | PROJECT.md |
| gsd-phase-researcher | /gsd:plan-phase | RESEARCH.md | ROADMAP.md, CONTEXT.md |
| gsd-roadmapper | /gsd:new-project | ROADMAP.md, STATE.md | REQUIREMENTS.md, research files |
| gsd-integration-checker | /gsd:audit-milestone | integration report | phase SUMMARYs, codebase |
| gsd-research-synthesizer | /gsd:new-project | SUMMARY.md | STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md |

---

## Commands (commands/gsd/*.md)

### Core Workflow Commands

| File | Purpose | Lines | Spawns |
|------|---------|-------|--------|
| new-project.md | Initialize new project with questioning → research → requirements → roadmap | 896 | gsd-project-researcher, gsd-research-synthesizer, gsd-roadmapper |
| plan-phase.md | Create detailed execution plan for a phase (PLAN.md) with verification loop | 475 | gsd-phase-researcher, gsd-planner, gsd-plan-checker |
| execute-phase.md | Execute all plans in a phase with wave-based parallelization | 304 | gsd-executor, gsd-verifier |
| verify-work.md | Validate built features through conversational UAT | 219 | gsd-debugger, gsd-planner, gsd-plan-checker |

### Roadmap Management Commands

| File | Purpose | Lines | Spawns |
|------|---------|-------|--------|
| add-phase.md | Add phase to end of current milestone in roadmap | 207 | None |
| insert-phase.md | Insert urgent work as decimal phase (e.g., 72.1) between existing phases | 227 | None |
| remove-phase.md | Remove a future phase from roadmap and renumber subsequent phases | 338 | None |

### Milestone Management Commands

| File | Purpose | Lines | Spawns |
|------|---------|-------|--------|
| new-milestone.md | Start new milestone cycle — update PROJECT.md and route to requirements | 717 | gsd-project-researcher, gsd-roadmapper |
| complete-milestone.md | Archive completed milestone and prepare for next version | 136 | None |
| audit-milestone.md | Audit milestone completion against original intent before archiving | 258 | gsd-integration-checker |
| plan-milestone-gaps.md | Create phases to close all gaps identified by milestone audit | 284 | None |

### Session Management Commands

| File | Purpose | Lines | Spawns |
|------|---------|-------|--------|
| pause-work.md | Create context handoff when pausing work mid-phase | 123 | None |
| resume-work.md | Resume work from previous session with full context restoration | 40 | None |
| progress.md | Check project progress, show context, and route to next action | 356 | None |

### Research & Analysis Commands

| File | Purpose | Lines | Spawns |
|------|---------|-------|--------|
| research-phase.md | Research how to implement a phase (standalone) | 180 | gsd-phase-researcher |
| discuss-phase.md | Gather phase context through adaptive questioning before planning | 80 | None |
| list-phase-assumptions.md | Surface Claude's assumptions about a phase approach before planning | 50 | None |
| map-codebase.md | Analyze codebase with parallel mapper agents | 71 | gsd-codebase-mapper (x4) |
| debug.md | Systematic debugging with persistent state across context resets | 149 | gsd-debugger |

### Todo & Utility Commands

| File | Purpose | Lines | Spawns |
|------|---------|-------|--------|
| add-todo.md | Capture idea or task as todo from current conversation context | 182 | None |
| check-todos.md | List pending todos and select one to work on | 217 | None |
| help.md | Show available GSD commands and usage guide | 383 | None |
| update.md | Update GSD to latest version with changelog display | 172 | None |
| whats-new.md | See what's new in GSD since your installed version | 124 | None |

---

## Workflows (get-shit-done/workflows/*.md)

| File | Purpose | Lines | Used By |
|------|---------|-------|---------|
| execute-plan.md | Execute a phase prompt (PLAN.md) and create SUMMARY.md | 1831 | gsd-executor |
| execute-phase.md | Wave-based parallel plan execution orchestration | 552 | /gsd:execute-phase |
| verify-phase.md | Goal-backward phase verification after execution | 629 | gsd-verifier |
| verify-work.md | Conversational UAT with persistent state | 563 | /gsd:verify-work |
| complete-milestone.md | Archive milestone and prepare for next version | 750 | /gsd:complete-milestone |
| discovery-phase.md | Initial project discovery process | 293 | plan-phase |
| discuss-phase.md | Adaptive questioning to gather phase context | 422 | /gsd:discuss-phase |
| diagnose-issues.md | Parallel diagnosis of UAT failures | 233 | /gsd:verify-work |
| map-codebase.md | Parallel codebase analysis orchestration | 289 | /gsd:map-codebase |
| resume-project.md | Context restoration for session continuity | 311 | /gsd:resume-work |
| transition.md | Phase transition and state update | 564 | Post-phase execution |
| list-phase-assumptions.md | Surface implicit assumptions about phase approach | 178 | /gsd:list-phase-assumptions |

---

## Templates (get-shit-done/templates/*.md)

### Core State Templates

| File | Produces | Filled By | Lines |
|------|----------|-----------|-------|
| state.md | .planning/STATE.md | gsd-roadmapper, transitions | 206 |
| project.md | .planning/PROJECT.md | /gsd:new-project | 184 |
| requirements.md | .planning/REQUIREMENTS.md | /gsd:new-project | 231 |
| roadmap.md | .planning/ROADMAP.md | gsd-roadmapper | 202 |

### Phase Execution Templates

| File | Produces | Filled By | Lines |
|------|----------|-----------|-------|
| phase-prompt.md | {phase}-PLAN.md | gsd-planner | 576 |
| planner-subagent-prompt.md | Subagent instructions | /gsd:plan-phase | 117 |
| summary.md | {phase}-SUMMARY.md | gsd-executor | 269 |
| verification-report.md | {phase}-VERIFICATION.md | gsd-verifier | 322 |

### Research Templates

| File | Produces | Filled By | Lines |
|------|----------|-----------|-------|
| research.md | {phase}-RESEARCH.md | gsd-phase-researcher | 529 |
| discovery.md | Discovery notes | plan-phase discovery | 146 |

### Research Project Templates (get-shit-done/templates/research-project/*.md)

| File | Produces | Filled By | Lines |
|------|----------|-----------|-------|
| SUMMARY.md | .planning/research/SUMMARY.md | gsd-research-synthesizer | 170 |
| STACK.md | .planning/research/STACK.md | gsd-project-researcher | 120 |
| FEATURES.md | .planning/research/FEATURES.md | gsd-project-researcher | 147 |
| ARCHITECTURE.md | .planning/research/ARCHITECTURE.md | gsd-project-researcher | 204 |
| PITFALLS.md | .planning/research/PITFALLS.md | gsd-project-researcher | 200 |

### Codebase Templates (get-shit-done/templates/codebase/*.md)

| File | Produces | Filled By | Lines |
|------|----------|-----------|-------|
| stack.md | .planning/codebase/STACK.md | gsd-codebase-mapper (tech) | 186 |
| integrations.md | .planning/codebase/INTEGRATIONS.md | gsd-codebase-mapper (tech) | 280 |
| architecture.md | .planning/codebase/ARCHITECTURE.md | gsd-codebase-mapper (arch) | 255 |
| structure.md | .planning/codebase/STRUCTURE.md | gsd-codebase-mapper (arch) | 285 |
| conventions.md | .planning/codebase/CONVENTIONS.md | gsd-codebase-mapper (quality) | 307 |
| testing.md | .planning/codebase/TESTING.md | gsd-codebase-mapper (quality) | 480 |
| concerns.md | .planning/codebase/CONCERNS.md | gsd-codebase-mapper (concerns) | 310 |

### Session & Debug Templates

| File | Produces | Filled By | Lines |
|------|----------|-----------|-------|
| context.md | {phase}-CONTEXT.md | /gsd:discuss-phase | 291 |
| continue-here.md | .continue-here.md | /gsd:pause-work | 78 |
| DEBUG.md | .planning/debug/*.md | gsd-debugger | 159 |
| debug-subagent-prompt.md | Debug subagent instructions | /gsd:debug | 91 |
| UAT.md | {phase}-UAT.md | /gsd:verify-work | 247 |

### Milestone Templates

| File | Produces | Filled By | Lines |
|------|----------|-----------|-------|
| milestone.md | .planning/milestones/v*.md | /gsd:complete-milestone | 115 |
| milestone-archive.md | Archived milestone record | /gsd:complete-milestone | 123 |
| user-setup.md | User setup instructions | /gsd:new-project | 323 |

---

## References (get-shit-done/references/*.md)

| File | Domain | Lines | Used By |
|------|--------|-------|---------|
| checkpoints.md | Checkpoint types and usage patterns | 788 | gsd-executor, gsd-planner |
| verification-patterns.md | How to verify artifacts are real implementations | 595 | gsd-verifier, gsd-plan-checker |
| continuation-format.md | Context handoff format for session continuity | 249 | /gsd:pause-work, /gsd:resume-work |
| git-integration.md | Git workflow and commit patterns | 254 | gsd-executor |
| questioning.md | Adaptive questioning methodology | 141 | /gsd:new-project, /gsd:discuss-phase |
| tdd.md | Test-driven development patterns | 263 | gsd-planner, gsd-executor |
| ui-brand.md | UI output formatting standards | 160 | All commands |

---

## Project Metadata & Distribution

| File | Purpose | Lines |
|------|---------|-------|
| package.json | NPM package metadata, CLI bin mapping, version source for installer | 32 |

---

## Operational Scripts & Hooks

| File | Purpose | Relationship Notes | Lines |
|------|---------|--------------------|-------|
| bin/install.js | Installer/CLI setup entrypoint that configures GSD for local use | Coordinates setup tasks invoked by installation workflow and ensures the CLI is wired for command usage | 415 |
| hooks/statusline.js | UI/statusline integration for surfacing runtime status | Feeds status output into terminal integrations so command workflows can expose progress and context | 84 |
| hooks/gsd-check-update.js | Update check hook for detecting newer GSD versions | Invoked by CLI/session hooks to prompt update awareness without interrupting core flows | 51 |
| get-shit-done/templates/config.json | Workflow config template used to bootstrap default settings | Seeded during setup to provide baseline configuration consumed by workflows and commands | 26 |

---

## Summary Statistics

| Category | File Count | Total Lines |
|----------|------------|-------------|
| Documentation & Guides | 24 | 11,001 |
| Agents | 11 | 8,337 |
| Commands | 24 | 5,387 |
| Workflows | 12 | 5,615 |
| Templates | 30 | 5,802 |
| References | 7 | 2,450 |
| Project Metadata & Distribution | 1 | 32 |
| Operational Scripts & Hooks | 4 | 576 |
| **Total** | **113** | **39,200** |

---

## Complexity Assessment Criteria

Agents are scored 1-3 on four dimensions:

1. **Centrality** — How many other components depend on this agent
2. **Complexity** — Number of modes, decision points, state transitions
3. **Failure Impact** — Consequences when this agent fails
4. **Novelty** — How GSD-specific vs. generic the patterns are

| Score | Tier | Documentation Depth |
|-------|------|---------------------|
| 10-12 | High | Deep Reference (~800 tokens) |
| 7-9 | Medium | Standard Reference (~400 tokens) |
| 4-6 | Low | Summary (~200 tokens) |

---

## File Naming Conventions

| Pattern | Category | Example |
|---------|----------|---------|
| `gsd-{name}.md` | Agent | `gsd-planner.md` |
| `{command}.md` | Command | `plan-phase.md` |
| `{workflow}.md` | Workflow | `execute-plan.md` |
| `{template}.md` | Template | `state.md` |
| `{reference}.md` | Reference | `checkpoints.md` |
| `{CAPS}.md` | Output (codebase) | `STACK.md` |

---

## Key File Relationships

```
/gsd:new-project
    └── gsd-project-researcher → .planning/research/*.md
    └── gsd-research-synthesizer → .planning/research/SUMMARY.md
    └── gsd-roadmapper → ROADMAP.md, STATE.md

/gsd:plan-phase
    └── gsd-phase-researcher → RESEARCH.md
    └── gsd-planner → PLAN.md (uses phase-prompt.md template)
    └── gsd-plan-checker → feedback → gsd-planner (revision loop)

/gsd:execute-phase
    └── gsd-executor → SUMMARY.md (uses execute-plan.md workflow)
    └── gsd-verifier → VERIFICATION.md (uses verify-phase.md workflow)

/gsd:verify-work
    └── UAT session → {phase}-UAT.md
    └── gsd-debugger → diagnosis
    └── gsd-planner (--gaps) → fix plans
```
