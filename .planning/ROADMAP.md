# Roadmap: GSD v2.0 Web Dashboard

## Overview

This roadmap delivers a feature-rich web dashboard that replicates and enhances the Claude Code CLI experience. The journey progresses from infrastructure (WebSocket, file locking, security), through backend core (REST API, agent orchestrator), to frontend foundation (Next.js, dashboard), then feature-specific UIs (Discuss, Execute, Plan, Verify), and finally visualization and debugging tools. Each phase builds on the previous, delivering complete, usable functionality at each boundary.

## Milestones

- <details><summary>v1.0 Worktree Isolation (Phases 1-4) - SHIPPED 2026-02-23</summary>(See legacy roadmap)</details>
- <details><summary>v1.1 Upstream Sync (Phases 5-10) - SHIPPED 2026-03-10</summary>(See legacy roadmap)</details>
- [ ] **v2.0 GSD Web Dashboard** - Phases 13-20 (in progress)

## Phases

**Phase Numbering:**
- v1.0 completed Phases 1-4 (Worktree Isolation)
- v1.1 completed Phases 5-10 (Upstream Sync)
- Phases 11-12 pending (Document-assisted discuss, MCP Server API)
- v2.0 starts at Phase 13 (Web Dashboard)
- Decimal phases (e.g., 13.1): Urgent insertions (marked with INSERTED)

- [ ] **Phase 13: Foundation Infrastructure** - WebSocket server, token buffering, file locking, and security layer
- [ ] **Phase 14: Backend Core** - REST API, agent orchestrator, and WebSocket connection management
- [ ] **Phase 15: Frontend Foundation & Dashboard** - Next.js app with project listing, health indicators, and navigation
- [ ] **Phase 16: Discuss Phase UI** - Chat interface with streaming and CONTEXT.md preview
- [ ] **Phase 17: Execute Phase UI** - Execution streaming, tool visualization, checkpoints, and TDD workflow
- [ ] **Phase 18: Plan & Verify Phase UIs** - Research streaming, plan preview, verification report, and gap workflow
- [ ] **Phase 19: Roadmap Visualization** - Dependency graph, Gantt timeline, and progress tracking
- [ ] **Phase 20: Debug Session UI** - Debug session creation, hypothesis tracking, and evidence collection

## Phase Details

### Phase 13: Foundation Infrastructure
**Goal**: Establish the infrastructure layer required for all real-time streaming and concurrent file access
**Depends on**: Phase 12 (MCP Server API provides GSD library patterns to wrap)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04
**Success Criteria** (what must be TRUE):
  1. WebSocket server accepts connections and auto-reconnects with state sync on reconnection
  2. Token streaming uses requestAnimationFrame buffering without overwhelming the UI
  3. CLI and dashboard can read/write .planning/ files concurrently without corruption
  4. File access is restricted to project directories with symlink escape protection
**Plans**: TBD

Plans:
- [ ] 13-01-PLAN.md — Turborepo monorepo with pnpm workspaces and shared typed events
- [ ] 13-02-PLAN.md — Socket.IO server with auto-reconnect and state sync protocol
- [ ] 13-03-PLAN.md — File locking and security layer (symlink protection, path validation)

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
**Plans**: TBD

Plans:
- [ ] 14-01-PLAN.md — REST API for project listing, health checks, and phase data (Hono)
- [ ] 14-02-PLAN.md — GSD wrapper adapting sync CJS modules to async TypeScript
- [ ] 14-03-PLAN.md — Agent orchestrator with Claude API streaming and tool execution
- [ ] 14-04-PLAN.md — Checkpoint handling with idempotency and timeout warnings

### Phase 15: Frontend Foundation & Dashboard
**Goal**: Deliver project dashboard with health status, progress tracking, and navigation
**Depends on**: Phase 14
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05
**Success Criteria** (what must be TRUE):
  1. User can view list of all GSD projects with health status indicators (healthy/degraded/error)
  2. User can see current phase and progress percentage for each project
  3. User can view recent activity feed (last 5 actions) for each project
  4. User can search and filter projects by name or status
  5. User can navigate to project detail view by clicking a project card
**Plans**: TBD

Plans:
- [ ] 15-01-PLAN.md — Next.js 15 app with App Router, Tailwind v4, and dark mode
- [ ] 15-02-PLAN.md — Socket.IO client hook with reconnection and Zustand stores
- [ ] 15-03-PLAN.md — Dashboard UI with project cards, health indicators, and activity feed
- [ ] 15-04-PLAN.md — Project search, filtering, and navigation to detail view

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
**Plans**: TBD

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
**Plans**: TBD

Plans:
- [ ] 17-01-PLAN.md — Wave-based execution progress with log streaming
- [ ] 17-02-PLAN.md — Tool call visualization with collapsible cards
- [ ] 17-03-PLAN.md — Checkpoint dialog modal with timeout warning
- [ ] 17-04-PLAN.md — Monaco DiffEditor integration for file changes
- [ ] 17-05-PLAN.md — Git commit timeline visualization
- [ ] 17-06-PLAN.md — Pause/resume and abort/rollback controls
- [ ] 17-07-PLAN.md — Error recovery with retry options
- [ ] 17-08-PLAN.md — TDD workflow enforcement (Red-Green-Refactor)

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
**Plans**: TBD

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
**Plans**: TBD

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
**Plans**: TBD

Plans:
- [ ] 20-01-PLAN.md — Debug session creation and management
- [ ] 20-02-PLAN.md — Hypothesis tracking with evidence linking
- [ ] 20-03-PLAN.md — Evidence collection UI (logs, screenshots, repro steps)
- [ ] 20-04-PLAN.md — Session history timeline

## Progress

**Execution Order:**
Phases execute in numeric order: 13 -> 14 -> 15 -> 16 -> 17 -> 18 -> 19 -> 20

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 13. Foundation Infrastructure | 0/3 | Not started | - |
| 14. Backend Core | 0/4 | Not started | - |
| 15. Frontend Foundation & Dashboard | 0/4 | Not started | - |
| 16. Discuss Phase UI | 0/4 | Not started | - |
| 17. Execute Phase UI | 0/8 | Not started | - |
| 18. Plan & Verify Phase UIs | 0/8 | Not started | - |
| 19. Roadmap Visualization | 0/4 | Not started | - |
| 20. Debug Session UI | 0/4 | Not started | - |

---
*Roadmap created: 2026-03-10*
*Last updated: 2026-03-10*
