# Roadmap: GSD

## Overview

This roadmap delivers the GSD (Get Shit Done) meta-prompting framework across multiple milestones. v2.0 delivers a feature-rich web dashboard. v3.0 modernizes the runtime with TypeScript, database-backed state, and observable agents while preserving all markdown prompts.

## Milestones

- <details><summary>v1.0 Worktree Isolation (Phases 1-4) - SHIPPED 2026-02-23</summary>(See legacy roadmap)</details>
- <details><summary>v1.1 Upstream Sync (Phases 5-12) - SHIPPED 2026-03-11</summary>(See legacy roadmap)</details>
- [ ] **v2.0 GSD Web Dashboard** - Phases 13-20 (in progress)
- [ ] **v3.0 Hybrid Runtime Modernization** - Phases 21-28 (planned)

## Phases

**Phase Numbering:**
- v1.0 completed Phases 1-4 (Worktree Isolation)
- v1.1 completed Phases 5-12 (Upstream Sync + MCP Server API)
- v2.0 starts at Phase 13 (Web Dashboard)
- Decimal phases (e.g., 13.1): Urgent insertions (marked with INSERTED)

### v1.1 Completed Phases (for reference)

- [x] **Phase 5: Core Infrastructure** - Upstream configuration, fetch, status, and update notifications (completed 2026-02-24)
- [x] **Phase 6: Analysis** - Commit grouping, conflict preview, and change detection (completed 2026-02-24)
- [x] **Phase 6.1: Local Modifications Integration** - Path migration and finalize-phase command (INSERTED, completed 2026-02-24)
- [x] **Phase 7: Merge Operations** - Atomic merge with rollback and state logging (completed 2026-02-24)
- [x] **Phase 8: Interactive & Integration** - Deep dive mode, worktree awareness, and health integration (completed 2026-02-24)
- [x] **Phase 9: Documentation** - User guide, architecture docs, and troubleshooting (completed 2026-03-10)
- [x] **Phase 10: Parallel Milestones** - Enable parallel milestone execution with scoped phases (completed 2026-03-10)
- [x] **Phase 11: Document-assisted discuss-phase** - Add --docs flag for document extraction (completed 2026-03-07)
- [x] **Phase 12: MCP Server API** - Expose GSD operations as MCP server for programmatic access (completed 2026-03-11)

### v2.0 Phases

- [x] **Phase 13: Foundation Infrastructure** - WebSocket server, token buffering, file locking, and security layer (completed 2026-03-11)
- [x] **Phase 14: Backend Core** - REST API, agent orchestrator, and WebSocket connection management (completed 2026-03-11)
- [x] **Phase 15: Frontend Foundation & Dashboard** - Next.js app with project listing, health indicators, and navigation (completed 2026-03-11)
- [ ] **Phase 16: Discuss Phase UI** - Chat interface with streaming and CONTEXT.md preview
- [ ] **Phase 17: Execute Phase UI** - Execution streaming, tool visualization, checkpoints, and TDD workflow
- [ ] **Phase 18: Plan & Verify Phase UIs** - Research streaming, plan preview, verification report, and gap workflow
- [ ] **Phase 19: Roadmap Visualization** - Dependency graph, Gantt timeline, and progress tracking
- [ ] **Phase 20: Debug Session UI** - Debug session creation, hypothesis tracking, and evidence collection

### v3.0 Hybrid Runtime Modernization (Phases 21-28)

- [ ] **Phase 21: Agent Runtime Engine** - Core TypeScript runtime that loads and executes markdown prompts
- [ ] **Phase 22: Prompt Loader** - Parse markdown prompts into executable agent configurations
- [ ] **Phase 23: State Management** - Database-backed state with Drizzle ORM and markdown sync
- [ ] **Phase 24: Observability** - OpenTelemetry tracing for debugging and performance analysis
- [ ] **Phase 25: Agent Framework Integration** - Vercel AI SDK integration for streaming and orchestration
- [ ] **Phase 26: API Layer** - REST and WebSocket API as primary interface
- [ ] **Phase 27: CLI Wrapper** - Thin Commander-based CLI that wraps the API
- [ ] **Phase 28: Testing Infrastructure** - Unit and integration tests for agent logic

## Phase Details

### Phase 12: MCP Server API (COMPLETE)
**Goal**: Expose GSD operations as MCP server for programmatic access from AI agents and tools
**Depends on**: Phase 10
**Requirements**: MCP-01, MCP-02, MCP-03, MCP-04, MCP-05
**Success Criteria** (what must be TRUE):
  1. MCP server starts and connects via stdio transport
  2. Server exposes core GSD tools (progress, health, state reads)
  3. Tools accept same parameters as CLI commands with JSON responses
  4. Resources expose project state (STATE.md, ROADMAP.md, current phase)
  5. Error handling returns structured errors with recovery suggestions
**Plans:** 3/3 plans complete

Plans:
- [x] 12-01-PLAN.md — Create MCP server scaffold with stdio transport and error envelope pattern
- [x] 12-02-PLAN.md — Register core and extended tier tools
- [x] 12-03-PLAN.md — Register resource providers for state/roadmap

### Phase 13: Foundation Infrastructure
**Goal**: Establish the infrastructure layer required for all real-time streaming and concurrent file access
**Depends on**: Phase 12 (MCP Server API provides GSD library patterns to wrap)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04
**Success Criteria** (what must be TRUE):
  1. WebSocket server accepts connections and auto-reconnects with state sync on reconnection
  2. Token streaming uses requestAnimationFrame buffering without overwhelming the UI
  3. CLI and dashboard can read/write .planning/ files concurrently without corruption
  4. File access is restricted to project directories with symlink escape protection
**Design Decisions**:
  - Monorepo: Feature-based (apps/web, apps/server, packages/events, packages/gsd-core)
  - Shared package: Full SDK with typed client/server wrappers, connection helpers, retry logic
  - GSD integration: Wrapper package defining v3.0 API, implemented with current CJS modules
  - Build tooling: Turborepo + pnpm workspaces
  - TypeScript: Strict everywhere (strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes)
  - WebSocket: Rooms within single namespace + prefixed event names (agent:token, checkpoint:request)
  - Reconnection: Full replay from checkpoint (v2.0), evolves to Snapshot + Bounded Replay in v3.0
  - Token buffering: requestAnimationFrame batching with render-time telemetry; evolve to adaptive throttling in v3.0 if metrics warrant
  - Heartbeat: Both Socket.IO built-in (pingInterval/pingTimeout) + app-level health metrics
  - Error verbosity: Environment-aware (full stack traces in dev, structured codes + messages in prod)
  - File locking: Advisory locks on main worktree only (agents work in isolated worktrees)
  - Stale locks: TTL-based expiry (30s), auto-cleanup on next access
  - Lock API: Internal auto-locking for standard ops + exposed acquireLock()/releaseLock() for advanced cases
  - Lock failures: Structured errors with context { code, file, holder, age }
  - Path security: Project root only + hardcoded denylist (.env*, *.pem, *.key, secrets/**); evolve to configurable boundaries in v3.0
  - Symlinks: Resolve and validate target is within boundaries + configurable policy (allow/deny/project-only, default: allow)
  - Audit logging: Structured logs { path, reason, timestamp } + metrics counter for blocked access
  - Security implementation: Shared in packages/gsd-core for consistent CLI/dashboard behavior
**Plans**: 3 plans

Plans:
- [x] 13-01-PLAN.md — Turborepo monorepo with pnpm workspaces and shared typed events
- [x] 13-02-PLAN.md — Socket.IO server with auto-reconnect and state sync protocol
- [x] 13-03-PLAN.md — File locking and security layer (symlink protection, path validation)

### Phase 14: Backend Core
**Goal**: Provide REST API for project data and agent orchestrator for Claude API streaming
**Depends on**: Phase 13
**Requirements**: (Backend enables DASH, EXEC, and all streaming requirements - no direct requirement mapping)
**Success Criteria** (what must be TRUE):
  1. REST API returns project list with health status from existing GSD modules
  2. WebSocket emits typed events for agent progress, tool calls, and checkpoints
  3. Agent orchestrator streams Claude API responses with tool execution loop
  4. Checkpoint requests are relayed to frontend with idempotent response handling
  5. Rate limit errors (429) are handled with exponential backoff
**Plans**: 4 plans

Plans:
- [x] 14-01-PLAN.md — REST API for project listing, health checks, and phase data (Hono)
- [x] 14-02-PLAN.md — GSD wrapper adapting sync CJS modules to async TypeScript
- [x] 14-03-PLAN.md — Agent orchestrator with Claude API streaming and tool execution
- [x] 14-04-PLAN.md — Checkpoint handling with idempotency and timeout warnings

### Phase 15: Frontend Foundation & Dashboard (COMPLETE)
**Goal**: Deliver project dashboard with health status, progress tracking, and navigation
**Depends on**: Phase 14
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05
**Success Criteria** (what must be TRUE):
  1. User can view list of all GSD projects with health status indicators (healthy/degraded/error)
  2. User can see current phase and progress percentage for each project
  3. User can view recent activity feed (last 5 actions) for each project
  4. User can search and filter projects by name or status
  5. User can navigate to project detail view by clicking a project card
**Plans:** 4/4 plans complete

Plans:
- [x] 15-01-PLAN.md — Next.js 15 app with App Router, Tailwind v4, and dark mode
- [x] 15-02-PLAN.md — Socket.IO client hook with reconnection and Zustand stores
- [x] 15-03-PLAN.md — Dashboard UI with project cards, health indicators, and activity feed
- [x] 15-04-PLAN.md — Project search, filtering, and navigation to detail view

### Phase 16: Discuss Phase UI
**Goal**: Enable conversational context gathering with real-time streaming and CONTEXT.md preview
**Depends on**: Phase 15
**Requirements**: DISC-01, DISC-02, DISC-03, DISC-04, DISC-05
**Success Criteria** (what must be TRUE):
  1. User can have a chat-style conversation with Claude with real-time token streaming
  2. User can see live preview of CONTEXT.md being generated as conversation progresses
  3. User can mark individual decisions as locked (must keep) vs discretionary (agent can adjust)
  4. User can refresh browser and resume discussion session where they left off
  5. User can manually edit CONTEXT.md with sync back to conversation state
**Plans**: 4 plans

Plans:
- [ ] 16-01-PLAN.md — Chat conversation interface with streaming token display
- [ ] 16-02-PLAN.md — CONTEXT.md live preview panel with decision locking
- [ ] 16-03-PLAN.md — Session persistence across reconnects and browser refresh
- [ ] 16-04-PLAN.md — Manual CONTEXT.md editing with bidirectional sync

### Phase 17: Execute Phase UI
**Goal**: Deliver real-time execution interface with streaming, tool visualization, checkpoints, and TDD workflow
**Depends on**: Phase 16
**Requirements**: EXEC-01, EXEC-02, EXEC-03, EXEC-04, EXEC-05, EXEC-06, EXEC-07, EXEC-08, QUAL-01, QUAL-02, QUAL-03, QUAL-04
**Success Criteria** (what must be TRUE):
  1. User can see wave-based execution progress with real-time log streaming per plan
  2. User can see tool calls visualized as collapsible cards (Read, Write, Bash, etc.)
  3. User can respond to checkpoint dialogs with timeout warning display
  4. User can view file changes in Monaco DiffEditor with syntax highlighting
  5. User can see git commit timeline showing commits created during execution
  6. User can pause execution and resume from the paused state
  7. User can abort execution gracefully with rollback option
  8. User can recover from errors with retry options and context preservation
  9. Execution follows Red-Green-Refactor TDD workflow for code development tasks
**Plans**: 8 plans

Plans:
- [ ] 17-01-PLAN.md — Execution state store and Socket.IO subscription hooks
- [ ] 17-02-PLAN.md — Wave pipeline visualization with plan cards and log streaming
- [ ] 17-03-PLAN.md — Tool call cards with icons, code preview, and live timers
- [ ] 17-04-PLAN.md — Checkpoint modal with countdown timer and response handling
- [ ] 17-05-PLAN.md — Monaco DiffEditor panel with file tree and commit timeline
- [ ] 17-06-PLAN.md — Pause/resume and abort controls with confirmation dialog
- [ ] 17-07-PLAN.md — Error recovery UI with retry options
- [ ] 17-08-PLAN.md — TDD indicator and ExecutionPanel integration with E2E tests

### Phase 18: Plan & Verify Phase UIs
**Goal**: Provide research streaming, plan preview, verification report, and gap closure workflow
**Depends on**: Phase 17
**Requirements**: PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05, VERIF-01, VERIF-02, VERIF-03, VERIF-04, VERIF-05, VERIF-06, VERIF-07
**Success Criteria** (what must be TRUE):
  1. User can see real-time progress as researcher agents spawn, run, and complete
  2. User can preview generated plans with task breakdown and wave grouping
  3. User can see verification feedback with specific issues highlighted per plan
  4. User can view requirement coverage matrix showing requirement-to-phase mapping
  5. User can edit plan tasks inline before execution
  6. User can view verification report with pass/fail status per requirement
  7. User can see gaps highlighted with severity levels (blocking, major, minor)
  8. Verification executes all tests automatically before displaying results
  9. Verification validates that all success criteria are genuinely met
  10. User can mark manual test items as pass/fail in checklist
  11. User can approve completed work or reject with gap selection
  12. Rejection routes to plan-phase --gaps to create fix plans automatically
**Plans**: 8 plans

Plans:
- [ ] 18-01-PLAN.md — Research streaming with agent spawn progress
- [ ] 18-02-PLAN.md — Plan preview with task breakdown and wave visualization
- [ ] 18-03-PLAN.md — Inline plan editing before execution
- [ ] 18-04-PLAN.md — Requirement coverage matrix display
- [ ] 18-05-PLAN.md — Verification report with pass/fail status
- [ ] 18-06-PLAN.md — Gap highlighting with severity levels
- [ ] 18-07-PLAN.md — Manual test checklist and approval workflow
- [ ] 18-08-PLAN.md — Rejection-to-gap-planning flow

### Phase 19: Roadmap Visualization
**Goal**: Visualize project progress with dependency graph, Gantt timeline, and milestone grouping
**Depends on**: Phase 18
**Requirements**: ROAD-01, ROAD-02, ROAD-03, ROAD-04, ROAD-05
**Success Criteria** (what must be TRUE):
  1. User can view dependency graph showing phase-to-phase relationships
  2. User can view Gantt-style timeline showing phase schedule
  3. User can see progress tracking per phase with visual indicators
  4. User can see phases grouped by milestone
  5. User can click phase in visualization to navigate to phase detail
**Plans**: 4 plans

Plans:
- [ ] 19-01-PLAN.md — Dependency graph with React Flow (@xyflow/react)
- [ ] 19-02-PLAN.md — Gantt-style timeline visualization
- [ ] 19-03-PLAN.md — Progress tracking and milestone grouping
- [ ] 19-04-PLAN.md — Phase navigation from visualization

### Phase 20: Debug Session UI
**Goal**: Enable visual debugging workflow with hypothesis tracking and evidence collection
**Depends on**: Phase 19
**Requirements**: DEBUG-01, DEBUG-02, DEBUG-03, DEBUG-04
**Success Criteria** (what must be TRUE):
  1. User can create a new debug session from dashboard
  2. User can track hypotheses with evidence for/against
  3. User can collect evidence via UI (logs, screenshots, reproduction steps)
  4. User can view session history with timeline of investigations
**Plans**: 4 plans

Plans:
- [ ] 20-01-PLAN.md — Debug session creation and management
- [ ] 20-02-PLAN.md — Hypothesis tracking with evidence linking
- [ ] 20-03-PLAN.md — Evidence collection UI (logs, screenshots, repro steps)
- [ ] 20-04-PLAN.md — Session history timeline

---

## v3.0 Phase Details

### Phase 21: Agent Runtime Engine
**Goal**: Build the core TypeScript runtime that loads markdown prompts and executes agents
**Depends on**: v2.0 complete (production feedback informs design)
**Requirements**: RUNTIME-01, RUNTIME-02, RUNTIME-03, RUNTIME-04, RUNTIME-05, RUNTIME-06
**Success Criteria** (what must be TRUE):
  1. Agent definitions load from `agents/*.md` with frontmatter parsing
  2. Agent graph executes with typed state transitions
  3. Tool calls have typed inputs/outputs with validation
  4. Checkpoints persist to database and resume across sessions
  5. Agent output streams to consumers (WebSocket, CLI)
  6. Claude API integrated via Anthropic SDK
**Plans**: TBD (planning generates 3-4 plans)

### Phase 22: Prompt Loader
**Goal**: Parse markdown prompts into executable agent configurations
**Depends on**: Phase 21
**Requirements**: PROMPT-01, PROMPT-02, PROMPT-03, PROMPT-04, PROMPT-05, PROMPT-06
**Success Criteria** (what must be TRUE):
  1. YAML frontmatter extracts agent metadata (name, description, tools)
  2. Markdown body becomes system prompt with section parsing
  3. `@file` references resolve to include external content
  4. Template variables resolve at runtime
  5. Invalid prompts produce clear error messages with line numbers
  6. Hot-reload works in development mode
**Plans**: TBD (planning generates 2-3 plans)

### Phase 23: State Management
**Goal**: Implement database-backed state replacing markdown file parsing
**Depends on**: Phase 22
**Requirements**: STATE-01, STATE-02, STATE-03, STATE-04, STATE-05, STATE-06
**Success Criteria** (what must be TRUE):
  1. SQLite works for local, PostgreSQL for production
  2. Drizzle ORM provides type-safe queries and migrations
  3. Schema covers project, phase, plan, execution, checkpoint state
  4. Backward compatibility with `.planning/` markdown files
  5. Bidirectional sync keeps database and markdown in sync
  6. Common queries complete in <10ms
**Plans**: TBD (planning generates 3-4 plans)

### Phase 24: Observability
**Goal**: Add OpenTelemetry tracing for debugging and performance analysis
**Depends on**: Phase 23
**Requirements**: TRACE-01, TRACE-02, TRACE-03, TRACE-04, TRACE-05, TRACE-06
**Success Criteria** (what must be TRUE):
  1. OpenTelemetry traces generated for all agent operations
  2. Tool calls traced with input, output, duration, status
  3. Checkpoint events traced with user response time
  4. LLM calls traced with token counts and latency
  5. Local trace viewer works without external dependencies
  6. Traces exportable to Jaeger, Honeycomb
**Plans**: TBD (planning generates 2-3 plans)

### Phase 25: Agent Framework Integration
**Goal**: Integrate Vercel AI SDK for streaming, tool calling, and orchestration
**Depends on**: Phase 24
**Requirements**: AGENT-01, AGENT-02, AGENT-03, AGENT-04, AGENT-05, AGENT-06
**Success Criteria** (what must be TRUE):
  1. Vercel AI SDK integrated with custom orchestration layer
  2. GSD workflow patterns mapped to framework primitives
  3. Parallel agent execution (wave-based) works
  4. Agent-to-agent communication (orchestrator → subagent) works
  5. GSD checkpoint semantics maintained within framework
  6. Framework is TypeScript native throughout
**Plans**: TBD (planning generates 3-4 plans)

### Phase 26: API Layer
**Goal**: Build REST and WebSocket API as primary interface
**Depends on**: Phase 25
**Requirements**: API-01, API-02, API-03, API-04, API-05, API-06
**Success Criteria** (what must be TRUE):
  1. REST API provides CRUD for projects, phases, plans, executions
  2. WebSocket API handles streaming and checkpoint responses
  3. OpenAPI spec auto-generated with TypeScript types
  4. Authentication supports optional multi-user deployments
  5. Rate limiting and request validation enforced
  6. CLI uses API (no separate business logic)
**Design Decisions** (evolving from Phase 13):
  - Reconnection: Upgrade to Snapshot + Bounded Replay (current state + last N events or since checkpoint)
  - Event persistence: Event store with sequence numbers enables audit log and efficient delta sync
  - Token buffering: Evaluate telemetry from v2.0; upgrade to adaptive throttling if slow-frame metrics indicate need
  - Path security: Upgrade to configurable boundaries (allowedPaths/deniedPaths in config) for hosted/multi-user scenarios
**Plans**: TBD (planning generates 3-4 plans)

### Phase 27: CLI Wrapper
**Goal**: Build thin Commander-based CLI that wraps the API
**Depends on**: Phase 26
**Requirements**: CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, CLI-06
**Success Criteria** (what must be TRUE):
  1. Commander CLI with subcommands mirrors `/gsd:*` interface
  2. All commands call API endpoints
  3. Long-running operations stream to terminal
  4. Checkpoints prompt interactively
  5. Configuration via env vars and config file
  6. Output matches existing `/gsd:*` command formats
**Plans**: TBD (planning generates 2-3 plans)

### Phase 28: Testing Infrastructure
**Goal**: Establish unit and integration tests for agent logic
**Depends on**: Phase 27
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06
**Success Criteria** (what must be TRUE):
  1. Mock LLM responses enable deterministic tests
  2. Agent state transitions testable without API calls
  3. Snapshot testing validates prompt rendering
  4. Integration tests work with real API
  5. CI enforces 80%+ coverage, blocks on failure
  6. Playwright tests cover Dashboard-API integration
**Plans**: TBD (planning generates 3-4 plans)

## Progress

### v1.1 Progress (COMPLETE)

**Execution Order:**
Phases executed: 5 -> 6 -> 6.1 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 5. Core Infrastructure | 4/4 | Complete | 2026-02-24 |
| 6. Analysis | 4/4 | Complete | 2026-02-24 |
| 6.1 Local Modifications Integration | 1/1 | Complete | 2026-02-24 |
| 7. Merge Operations | 3/3 | Complete | 2026-02-24 |
| 8. Interactive & Integration | 4/4 | Complete | 2026-02-24 |
| 9. Documentation | 2/2 | Complete | 2026-03-10 |
| 10. Parallel Milestones | 4/4 | Complete | 2026-03-10 |
| 11. Document-assisted discuss-phase | 2/2 | Complete | 2026-03-07 |
| 12. MCP Server API | 3/3 | Complete | 2026-03-11 |

### v2.0 Progress

**Execution Order:**
Phases execute in numeric order: 13 -> 14 -> 15 -> 16 -> 17 -> 18 -> 19 -> 20

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 13. Foundation Infrastructure | 3/3 | Complete    | 2026-03-11 |
| 14. Backend Core | 4/4 | Complete    | 2026-03-11 |
| 15. Frontend Foundation & Dashboard | 4/4 | Complete    | 2026-03-11 |
| 16. Discuss Phase UI | 0/4 | Planned | - |
| 17. Execute Phase UI | 4/8 | In Progress|  |
| 18. Plan & Verify Phase UIs | 0/8 | Not started | - |
| 19. Roadmap Visualization | 0/4 | Not started | - |
| 20. Debug Session UI | 0/4 | Not started | - |

### v3.0 Progress

**Execution Order:**
Phases execute in numeric order: 21 -> 22 -> 23 -> 24 -> 25 -> 26 -> 27 -> 28

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 21. Agent Runtime Engine | 0/TBD | Not started | - |
| 22. Prompt Loader | 0/TBD | Not started | - |
| 23. State Management | 0/TBD | Not started | - |
| 24. Observability | 0/TBD | Not started | - |
| 25. Agent Framework Integration | 0/TBD | Not started | - |
| 26. API Layer | 0/TBD | Not started | - |
| 27. CLI Wrapper | 0/TBD | Not started | - |
| 28. Testing Infrastructure | 0/TBD | Not started | - |

---
*Roadmap created: 2026-03-10*
*Last updated: 2026-03-11 (Phase 17 planned)*
