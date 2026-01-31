# Architecture

**Analysis Date:** 2026-01-31

## Pattern Overview
**Overall:** Multi-Agent Orchestration System with Context Engineering

GSD is a meta-prompting system that orchestrates specialized AI agents to execute software development workflows. The architecture follows an orchestrator-subagent pattern where thin orchestrators coordinate specialized agents, each operating in fresh context windows to maintain quality.

## Layers

**Installation Layer:**
- Purpose: Deploys GSD components to runtime-specific directories (Claude Code, OpenCode, Gemini CLI)
- Location: `bin/install.js`
- Responsibilities: File copying, path replacement, frontmatter conversion, hook registration, settings configuration

**Command Layer:**
- Purpose: User-facing slash commands that trigger workflows
- Location: `commands/gsd/*.md`
- Responsibilities: Parse user input, validate state, invoke orchestrator workflows, handle errors

**Orchestrator Layer:**
- Purpose: Thin coordination layer that spawns specialized agents and aggregates results
- Location: `get-shit-done/workflows/*.md`
- Responsibilities: Discover plans/phases, analyze dependencies, group into execution waves, spawn agents, handle checkpoints, collect results

**Agent Layer:**
- Purpose: Specialized AI agents that perform specific tasks (planning, execution, verification, research)
- Location: `agents/gsd-*.md`
- Responsibilities: Execute domain-specific work in fresh context windows, return structured results

**Template Layer:**
- Purpose: Reusable prompt templates and document structures
- Location: `get-shit-done/templates/*.md`
- Responsibilities: Standardize output formats, provide context scaffolding, ensure consistency

**Reference Layer:**
- Purpose: Domain knowledge and best practices for agents
- Location: `get-shit-done/references/*.md`
- Responsibilities: Provide guidelines, patterns, and reference material for agent decision-making

**Hook Layer:**
- Purpose: Runtime integration hooks (statusline, update checks)
- Location: `hooks/*.js`
- Responsibilities: Display project state, check for updates, integrate with runtime UI

## Data Flow

**Project Initialization Flow:**
1. User runs `/gsd:new-project`
2. Command (`commands/gsd/new-project.md`) validates state, detects brownfield
3. Orchestrator workflow (`get-shit-done/workflows/discovery-phase.md`) coordinates:
   - Questioning agent gathers requirements
   - Research agents (optional) investigate domain
   - Requirements synthesizer extracts scope
   - Roadmapper creates phase structure
4. Creates `.planning/` directory with PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md

**Phase Planning Flow:**
1. User runs `/gsd:plan-phase N`
2. Command (`commands/gsd/plan-phase.md`) loads phase context
3. Orchestrator (`get-shit-done/workflows/execute-phase.md`) spawns:
   - Researcher agent (optional) investigates implementation approaches
   - Planner agent creates atomic PLAN.md files
   - Plan checker agent verifies plans meet phase goals
4. Creates `{phase}-RESEARCH.md` and `{phase}-{N}-PLAN.md` files

**Execution Flow:**
1. User runs `/gsd:execute-phase N`
2. Command (`commands/gsd/execute-phase.md`) loads project state
3. Orchestrator (`get-shit-done/workflows/execute-phase.md`):
   - Discovers all PLAN.md files for phase
   - Analyzes dependencies, groups into parallel waves
   - Spawns executor agents (`agents/gsd-executor.md`) for each plan
   - Each executor operates in fresh 200k context window
   - Handles checkpoints (human-verify, decision, human-action)
   - Aggregates results, creates SUMMARY.md, commits atomically
4. Creates `{phase}-{N}-SUMMARY.md` and `{phase}-VERIFICATION.md`

**Verification Flow:**
1. User runs `/gsd:verify-work N`
2. Command (`commands/gsd/verify-work.md`) loads phase deliverables
3. Orchestrator (`get-shit-done/workflows/verify-work.md`):
   - Verifier agent checks codebase against phase goals
   - Presents testable deliverables to user
   - Debug agents diagnose failures if needed
   - Creates fix plans for re-execution
4. Creates `{phase}-UAT.md`

## Abstractions

**Context Engineering:**
- Files are sized to stay under quality degradation thresholds (30-50% context usage)
- Each agent loads only necessary context files via `@file` references
- Fresh context per agent prevents accumulated garbage

**Atomic Plans:**
- Plans contain 2-3 tasks max, designed to execute in single context window
- Each plan is self-contained with objective, context, tasks, verification
- Plans are prompts, not documents that become prompts

**Wave-Based Parallelization:**
- Independent plans execute in parallel (wave 1)
- Dependent plans execute sequentially (wave 2+)
- Dependency analysis groups plans into optimal execution order

**Checkpoint System:**
- Plans can include checkpoints: `human-verify`, `decision`, `human-action`
- Checkpoints pause execution, present state to user, resume with fresh agent
- Enables human-in-the-loop workflows without context degradation

**Model Profiles:**
- Configurable model selection per agent type (quality/balanced/budget)
- Allows cost/quality tradeoffs without code changes
- Stored in `.planning/config.json`

**State Management:**
- `STATE.md` tracks project position, decisions, blockers
- `config.json` stores workflow preferences
- Agent history tracked in `.planning/agent-history.json`

## Entry Points

**Installation Entry Point:**
- Location: `bin/install.js`
- Triggers: `npx get-shit-done-cc` or `node bin/install.js`
- Flow: Copies files, converts frontmatter, registers hooks, configures settings

**Command Entry Points:**
- Location: `commands/gsd/*.md`
- Triggers: User slash commands (`/gsd:new-project`, `/gsd:plan-phase`, etc.)
- Flow: Validates state → loads workflow → spawns orchestrator → returns results

**Hook Entry Points:**
- Location: `hooks/gsd-statusline.js`, `hooks/gsd-check-update.js`
- Triggers: Runtime events (SessionStart, statusline refresh)
- Flow: Reads project state → formats output → returns to runtime

**Agent Entry Points:**
- Location: `agents/gsd-*.md`
- Triggers: Task tool calls from orchestrators
- Flow: Loads context → executes domain work → returns structured results

---
*Architecture analysis: 2026-01-31*
