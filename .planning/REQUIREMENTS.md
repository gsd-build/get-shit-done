# Requirements: GSD v2.0 Web Dashboard

**Created:** 2026-03-10
**Source:** PRD (docs/gsd-dashboard-prd.md) + Research + User scoping

---

## v2.0 Requirements

### Infrastructure (INFRA)

Foundation layer required for all streaming and real-time features.

- [x] **INFRA-01**: WebSocket server supports bidirectional communication with auto-reconnect and state sync on reconnection
- [x] **INFRA-02**: Token buffering system batches streaming output using requestAnimationFrame to prevent UI backpressure
- [x] **INFRA-03**: File locking prevents race conditions when CLI and dashboard access the same .planning/ files concurrently
- [x] **INFRA-04**: Security layer validates file paths, resolves symlinks, and restricts access to project directories only

### Dashboard (DASH)

Project overview and navigation.

- [x] **DASH-01**: User can view list of all GSD projects with health status indicators (healthy/degraded/error)
- [x] **DASH-02**: User can see current phase and progress percentage for each project
- [x] **DASH-03**: User can view recent activity feed (last 5 actions) for each project
- [x] **DASH-04**: User can search and filter projects by name or status
- [x] **DASH-05**: User can navigate to project detail view by clicking a project card

### Discuss Phase UI (DISC)

Context gathering through conversational interface.

- [ ] **DISC-01**: User can have a chat-style conversation with Claude with real-time token streaming
- [ ] **DISC-02**: User can see live preview of CONTEXT.md being generated as conversation progresses
- [ ] **DISC-03**: User can mark individual decisions as locked (must keep) vs discretionary (agent can adjust)
- [ ] **DISC-04**: User can refresh browser and resume discussion session where they left off
- [ ] **DISC-05**: User can manually edit CONTEXT.md with sync back to conversation state

### Plan Phase UI (PLAN)

Research, planning, and verification workflow.

- [ ] **PLAN-01**: User can see real-time progress as researcher agents spawn, run, and complete
- [ ] **PLAN-02**: User can preview generated plans with task breakdown and wave grouping
- [ ] **PLAN-03**: User can see verification feedback with specific issues highlighted per plan
- [ ] **PLAN-04**: User can view requirement coverage matrix showing requirement-to-phase mapping
- [ ] **PLAN-05**: User can edit plan tasks inline before execution

### Execute Phase UI (EXEC)

Real-time execution with streaming and checkpoints.

- [x] **EXEC-01**: User can see wave-based execution progress with real-time log streaming per plan
- [x] **EXEC-02**: User can see tool calls visualized as collapsible cards (Read, Write, Bash, etc.)
- [x] **EXEC-03**: User can respond to checkpoint dialogs with timeout warning display
- [x] **EXEC-04**: User can view file changes in Monaco DiffEditor with syntax highlighting
- [x] **EXEC-05**: User can see git commit timeline showing commits created during execution
- [ ] **EXEC-06**: User can pause execution and resume from the paused state
- [ ] **EXEC-07**: User can abort execution gracefully with rollback option
- [x] **EXEC-08**: User can recover from errors with retry options and context preservation

### Execute Quality (QUAL)

Quality enforcement during code execution.

- [ ] **QUAL-01**: Execution follows Red-Green-Refactor TDD workflow for code development tasks
- [ ] **QUAL-02**: Tests are written before implementation and must fail initially (Red)
- [ ] **QUAL-03**: Implementation makes tests pass without shortcuts (Green)
- [ ] **QUAL-04**: Code is refactored for clarity after tests pass (Refactor)

### Verify Work UI (VERIF)

User acceptance testing and gap closure.

- [ ] **VERIF-01**: User can view verification report with pass/fail status per requirement
- [ ] **VERIF-02**: User can see gaps highlighted with severity levels (blocking, major, minor)
- [ ] **VERIF-03**: Verification executes all tests automatically before displaying results
- [ ] **VERIF-04**: Verification validates that all success criteria are genuinely met (not superficially passed)
- [ ] **VERIF-05**: User can mark manual test items as pass/fail in checklist
- [ ] **VERIF-06**: User can approve completed work or reject with gap selection
- [ ] **VERIF-07**: Rejection routes to plan-phase --gaps to create fix plans automatically

### Roadmap Visualization (ROAD)

Visual representation of project progress and dependencies.

- [ ] **ROAD-01**: User can view dependency graph showing phase-to-phase relationships
- [ ] **ROAD-02**: User can view Gantt-style timeline showing phase schedule
- [ ] **ROAD-03**: User can see progress tracking per phase with visual indicators
- [ ] **ROAD-04**: User can see phases grouped by milestone
- [ ] **ROAD-05**: User can click phase in visualization to navigate to phase detail

### Debug Session UI (DEBUG)

Visual debugging workflow.

- [ ] **DEBUG-01**: User can create a new debug session from dashboard
- [ ] **DEBUG-02**: User can track hypotheses with evidence for/against
- [ ] **DEBUG-03**: User can collect evidence via UI (logs, screenshots, reproduction steps)
- [ ] **DEBUG-04**: User can view session history with timeline of investigations

---

## Deferred to v2.1

### Settings & Configuration (SETTINGS)

- [ ] **SETTINGS-01**: User can select model profile (quality/balanced/budget)
- [ ] **SETTINGS-02**: User can toggle workflow options (research, verification, etc.)
- [ ] **SETTINGS-03**: User can manage API keys securely
- [ ] **SETTINGS-04**: User can switch between light and dark theme
- [ ] **SETTINGS-05**: User can customize keyboard shortcuts

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-user collaboration | GSD is single-developer workflow by design |
| Real-time shared sessions | Adds complexity without proportional value |
| Mobile native apps | Responsive web is sufficient |
| Offline mode | Dashboard requires server connection for agent execution |
| Plugin/extension system | Premature; validate core workflow first |
| Git provider integrations | GitHub/GitLab UI not needed for local workflow |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 13 | Complete |
| INFRA-02 | Phase 13 | Complete |
| INFRA-03 | Phase 13 | Complete |
| INFRA-04 | Phase 13 | Complete |
| DASH-01 | Phase 15 | Complete |
| DASH-02 | Phase 15 | Complete |
| DASH-03 | Phase 15 | Complete |
| DASH-04 | Phase 15 | Complete |
| DASH-05 | Phase 15 | Complete |
| DISC-01 | Phase 16 | Pending |
| DISC-02 | Phase 16 | Pending |
| DISC-03 | Phase 16 | Pending |
| DISC-04 | Phase 16 | Pending |
| DISC-05 | Phase 16 | Pending |
| PLAN-01 | Phase 18 | Pending |
| PLAN-02 | Phase 18 | Pending |
| PLAN-03 | Phase 18 | Pending |
| PLAN-04 | Phase 18 | Pending |
| PLAN-05 | Phase 18 | Pending |
| EXEC-01 | Phase 17 | Complete |
| EXEC-02 | Phase 17 | Complete |
| EXEC-03 | Phase 17 | Complete |
| EXEC-04 | Phase 17 | Complete |
| EXEC-05 | Phase 17 | Complete |
| EXEC-06 | Phase 17 | Pending |
| EXEC-07 | Phase 17 | Pending |
| EXEC-08 | Phase 17 | Complete |
| QUAL-01 | Phase 17 | Pending |
| QUAL-02 | Phase 17 | Pending |
| QUAL-03 | Phase 17 | Pending |
| QUAL-04 | Phase 17 | Pending |
| VERIF-01 | Phase 18 | Pending |
| VERIF-02 | Phase 18 | Pending |
| VERIF-03 | Phase 18 | Pending |
| VERIF-04 | Phase 18 | Pending |
| VERIF-05 | Phase 18 | Pending |
| VERIF-06 | Phase 18 | Pending |
| VERIF-07 | Phase 18 | Pending |
| ROAD-01 | Phase 19 | Pending |
| ROAD-02 | Phase 19 | Pending |
| ROAD-03 | Phase 19 | Pending |
| ROAD-04 | Phase 19 | Pending |
| ROAD-05 | Phase 19 | Pending |
| DEBUG-01 | Phase 20 | Pending |
| DEBUG-02 | Phase 20 | Pending |
| DEBUG-03 | Phase 20 | Pending |
| DEBUG-04 | Phase 20 | Pending |

**Coverage:**
- v2.0 requirements: 47 total
- Mapped to phases: 47 (100%)
- Unmapped: 0

---

---

## v3.0 Requirements

### Agent Runtime Engine (RUNTIME)

Core TypeScript runtime that loads and executes markdown prompts.

- [ ] **RUNTIME-01**: Agent definitions load from `agents/*.md` with frontmatter parsing
- [ ] **RUNTIME-02**: Agent graph executes with typed state transitions using Vercel AI SDK
- [ ] **RUNTIME-03**: Tool calls have typed inputs/outputs with Zod validation
- [ ] **RUNTIME-04**: Checkpoints persist to database and resume across sessions
- [ ] **RUNTIME-05**: Agent output streams to consumers (WebSocket, CLI)
- [ ] **RUNTIME-06**: Claude API integration via Anthropic SDK with provider abstraction

### Prompt Loader (PROMPT)

Parse markdown prompts into executable agent configurations.

- [ ] **PROMPT-01**: YAML frontmatter extracts agent metadata (name, description, tools)
- [ ] **PROMPT-02**: Markdown body becomes system prompt with section parsing
- [ ] **PROMPT-03**: `@file` references resolve to include external content inline
- [ ] **PROMPT-04**: Template variables (`{phase_number}`, `{project_path}`) resolve at runtime
- [ ] **PROMPT-05**: Invalid prompts produce clear error messages with line numbers
- [ ] **PROMPT-06**: Hot-reload prompts in development mode without restart

### State Management (STATE)

Database-backed state replacing markdown file parsing.

- [ ] **STATE-01**: SQLite works for local development, PostgreSQL for production
- [ ] **STATE-02**: Drizzle ORM provides type-safe queries and migrations
- [ ] **STATE-03**: Schema covers project, phase, plan, execution, checkpoint state
- [ ] **STATE-04**: Backward compatibility maintained with `.planning/` markdown files
- [ ] **STATE-05**: Bidirectional sync keeps database and markdown in sync
- [ ] **STATE-06**: Common queries complete in <10ms (vs 100ms+ markdown parsing)

### Observability (TRACE)

Trace agent execution for debugging and performance analysis.

- [ ] **TRACE-01**: OpenTelemetry traces generated for all agent operations
- [ ] **TRACE-02**: Tool calls traced with input, output, duration, and status
- [ ] **TRACE-03**: Checkpoint events traced with user response time
- [ ] **TRACE-04**: LLM calls traced with token counts and latency
- [ ] **TRACE-05**: Local trace viewer (web UI) for development debugging
- [ ] **TRACE-06**: Traces exportable to external systems (Jaeger, Honeycomb)

### Agent Framework Integration (AGENT)

Build on Vercel AI SDK for streaming and tool calling.

- [ ] **AGENT-01**: Framework selected and integrated (Vercel AI SDK + custom orchestration)
- [ ] **AGENT-02**: GSD workflow patterns mapped to framework primitives
- [ ] **AGENT-03**: Parallel agent execution (wave-based) supported
- [ ] **AGENT-04**: Agent-to-agent communication (orchestrator → subagent) works
- [ ] **AGENT-05**: GSD checkpoint semantics maintained within framework
- [ ] **AGENT-06**: Framework is TypeScript native throughout

### API-First Design (API)

REST and WebSocket API as primary interface.

- [ ] **API-01**: REST API provides CRUD for projects, phases, plans, executions
- [ ] **API-02**: WebSocket API handles streaming output and checkpoint responses
- [ ] **API-03**: OpenAPI specification auto-generated with TypeScript types
- [ ] **API-04**: Authentication layer supports optional multi-user deployments
- [ ] **API-05**: Rate limiting and request validation enforced
- [ ] **API-06**: CLI implemented as API client (no separate business logic)

### CLI Wrapper (CLI)

Thin CLI that wraps the API.

- [ ] **CLI-01**: Commander-based CLI with subcommands mirrors current `/gsd:*` interface
- [ ] **CLI-02**: All commands call API endpoints (no direct database access)
- [ ] **CLI-03**: Long-running operations stream output to terminal
- [ ] **CLI-04**: Checkpoints prompt interactively, responses sent via API
- [ ] **CLI-05**: Configuration via environment variables and config file
- [ ] **CLI-06**: Backward-compatible with existing `/gsd:*` command outputs

### Testing Infrastructure (TEST)

Unit and integration tests for agent logic.

- [ ] **TEST-01**: Mock LLM responses enable deterministic agent tests
- [ ] **TEST-02**: Agent state transitions testable without API calls
- [ ] **TEST-03**: Snapshot testing validates prompt rendering
- [ ] **TEST-04**: Integration tests with real API using test account
- [ ] **TEST-05**: CI pipeline enforces 80%+ coverage, blocks on failure
- [ ] **TEST-06**: Playwright tests cover Dashboard-API integration

### v3.0 Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| RUNTIME-01 | Phase 21 | Pending |
| RUNTIME-02 | Phase 21 | Pending |
| RUNTIME-03 | Phase 21 | Pending |
| RUNTIME-04 | Phase 21 | Pending |
| RUNTIME-05 | Phase 21 | Pending |
| RUNTIME-06 | Phase 21 | Pending |
| PROMPT-01 | Phase 22 | Pending |
| PROMPT-02 | Phase 22 | Pending |
| PROMPT-03 | Phase 22 | Pending |
| PROMPT-04 | Phase 22 | Pending |
| PROMPT-05 | Phase 22 | Pending |
| PROMPT-06 | Phase 22 | Pending |
| STATE-01 | Phase 23 | Pending |
| STATE-02 | Phase 23 | Pending |
| STATE-03 | Phase 23 | Pending |
| STATE-04 | Phase 23 | Pending |
| STATE-05 | Phase 23 | Pending |
| STATE-06 | Phase 23 | Pending |
| TRACE-01 | Phase 24 | Pending |
| TRACE-02 | Phase 24 | Pending |
| TRACE-03 | Phase 24 | Pending |
| TRACE-04 | Phase 24 | Pending |
| TRACE-05 | Phase 24 | Pending |
| TRACE-06 | Phase 24 | Pending |
| AGENT-01 | Phase 25 | Pending |
| AGENT-02 | Phase 25 | Pending |
| AGENT-03 | Phase 25 | Pending |
| AGENT-04 | Phase 25 | Pending |
| AGENT-05 | Phase 25 | Pending |
| AGENT-06 | Phase 25 | Pending |
| API-01 | Phase 26 | Pending |
| API-02 | Phase 26 | Pending |
| API-03 | Phase 26 | Pending |
| API-04 | Phase 26 | Pending |
| API-05 | Phase 26 | Pending |
| API-06 | Phase 26 | Pending |
| CLI-01 | Phase 27 | Pending |
| CLI-02 | Phase 27 | Pending |
| CLI-03 | Phase 27 | Pending |
| CLI-04 | Phase 27 | Pending |
| CLI-05 | Phase 27 | Pending |
| CLI-06 | Phase 27 | Pending |
| TEST-01 | Phase 28 | Pending |
| TEST-02 | Phase 28 | Pending |
| TEST-03 | Phase 28 | Pending |
| TEST-04 | Phase 28 | Pending |
| TEST-05 | Phase 28 | Pending |
| TEST-06 | Phase 28 | Pending |

**v3.0 Coverage:**
- v3.0 requirements: 48 total
- Mapped to phases: 48 (100%)
- Unmapped: 0

---

## Previous Milestones

### v1.1 Upstream Sync (Complete)

| Category | Count | Status |
|----------|-------|--------|
| Core Operations (SYNC) | 4 | Complete |
| Notification (NOTIF) | 3 | Complete |
| Analysis (ANAL) | 4 | Complete |
| Merge Operations (MERGE) | 4 | Complete |
| Interactive (INTER) | 3 | Complete |
| Integration (INTEG) | 2 | Complete |
| Documentation (DOC) | 4 | Complete |
| **Total** | **24** | **Complete** |

---
*Requirements defined: 2026-03-10*
*Traceability updated: 2026-03-10*
